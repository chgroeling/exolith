/** Specification: docs/operations/ingest.md */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pino from 'pino';
import type { Logger } from 'pino';
import type { IdentifierService } from '../../core/identifier-service';
import { loadSchemaFile } from '../../core/schema-loader';
import type { LlmService } from '../../infrastructure/llm/llm-service';
import type { PromptService } from '../../infrastructure/prompt/prompt-service';
import type { CompileService } from '../compile/compile-service';
import type { PipelineEvent, Question } from '../pipeline-presentation';
import type { IngestConfig, IngestService } from './ingest-service';

/**
 * A distinct, identifiable thing extracted from a source page.
 * May be concrete or abstract, singular or collective.
 */
interface ExtractedEntity {
  name: string;
  entityType: string;
  description: string;
  sourceContext: string;
  /** Canonical slug computed programmatically after extraction — stable, never recomputed. */
  slug: string;
  /** Canonical identifier: `entity.{slug}`. */
  id: string;
}

/** Extracted concept from a source page. */
interface ExtractedConcept {
  name: string;
  domain: string;
  description: string;
  sourceContext: string;
  /** Canonical slug computed programmatically after extraction — stable, never recomputed. */
  slug: string;
  /** Canonical identifier: `concept.{slug}`. */
  id: string;
}

/** Structured extraction result from the LLM. */
interface ExtractionResult {
  entities: ExtractedEntity[];
  concepts: ExtractedConcept[];
}

/** A parsed entry from index.md. */
interface IndexEntry {
  slug: string;
  title: string;
  pageType: string;
  summary: string;
  path: string;
}

/** Semantic match result from the LLM. */
interface SemanticMatchResult {
  matches: Array<{
    extractedName: string;
    matchedSlug: string;
    relationship: string;
    reason: string;
  }>;
  unmatched: Array<{ name: string; reason: string }>;
}

/** Unified view of an entity or concept being updated — used across filter and update steps. */
interface ItemToUpdate {
  name: string;
  type: string;
  description: string;
  sourceContext: string;
  slug: string;
  pageType: 'entity' | 'concept';
}

/** Structured output from the LLM for a new page skeleton (simplified — no claims, no open questions). */
interface PageSkeleton {
  title: string;
  tags: string[];
  body: string;
}

/** A relevant page fully read for the update template context. */
interface RelevantPage {
  slug: string;
  title: string;
  path: string;
  content: string;
}

const PAGE_TYPE_MAP: Record<string, string> = {
  Sources: 'source',
  Entities: 'entity',
  Concepts: 'concept',
  Syntheses: 'synthesis',
  Reports: 'report',
};

const PAGE_DIRS: Record<string, string> = {
  entity: 'entities',
  concept: 'concepts',
  source: 'sources',
  synthesis: 'syntheses',
  report: 'reports',
};

const extractionSchema = loadSchemaFile<Record<string, unknown>>('extraction.schema.json');
const matchSchema = loadSchemaFile<Record<string, unknown>>('match.schema.json');
const entityPageSchema = loadSchemaFile<Record<string, unknown>>('entity-page.schema.json');
const conceptPageSchema = loadSchemaFile<Record<string, unknown>>('concept-page.schema.json');
const relevanceFilterSchema = loadSchemaFile<Record<string, unknown>>(
  'relevance-filter.schema.json',
);

export class Ingest implements IngestService {
  private logger: Logger;
  private extractionResult: ExtractionResult = {
    entities: [],
    concepts: [],
  };
  private createdPages: string[] = [];
  private updatedPages: string[] = [];
  private sourceFileName = '';
  private sourceFilePath = '';
  private sourceTitle = '';
  private sourceContent = '';
  /** Slug matches resolved once before create and update phases to avoid non-deterministic repeated LLM semantic matching. */
  private matchResults: Map<string, Map<string, string>> = new Map();

  constructor(
    private llmService: LlmService,
    private identifier: IdentifierService,
    private promptService: PromptService,
    private config: IngestConfig,
    private emit: (event: PipelineEvent) => void,
    private ask: <T>(question: Question<T>) => Promise<T>,
    private compileService: CompileService,
    parentLogger?: Logger,
  ) {
    this.logger = parentLogger?.child({ logger: 'ingest' }) ?? pino({ enabled: false });
  }

  /**
   * Runs the ingest pipeline on a source page from the vault.
   * @param sourceFilePath Absolute path to the source page in sources/
   */
  async process(sourceFilePath: string): Promise<void> {
    this.logger.info({ sourceFilePath }, 'Ingest process started');
    const vaultPath = this.config.vaultPath;

    const inboxDir = join(vaultPath, 'inbox');
    const sourcesDir = join(vaultPath, 'sources');
    await mkdir(sourcesDir, { recursive: true });
    const fileName = sourceFilePath.replace(`${inboxDir}/`, '');
    const newSourcePath = join(sourcesDir, fileName);
    await rename(sourceFilePath, newSourcePath);
    this.logger.info(
      { from: sourceFilePath, to: newSourcePath },
      'Moved source page from inbox to sources',
    );

    this.sourceFileName = fileName;
    this.sourceFilePath = newSourcePath;

    try {
      await this.extract(newSourcePath);
      await this.resolveAllMatches();
      await this.createPages();
      await this.compileIndex();
      await this.updateAllPages();
      await this.writeLogEntry();
      await this.triggerCompile();
    } catch (err) {
      this.emit({ type: 'error', error: err as Error });
      this.logger.error({ sourceFilePath: newSourcePath, err }, 'Ingest process failed');
      throw err;
    }
  }

  /** Step 1: Extracts structured knowledge — entities and concepts from the source. */
  private async extract(sourceFilePath: string): Promise<void> {
    const log = this.logger.child({ step: 'extract', sourceFilePath });
    this.emit({ type: 'step_start', step: 'Extracting', data: { sourceFilePath } });
    const rawContent = await readFile(sourceFilePath, 'utf-8');
    const body = extractBodyAfterFrontmatter(rawContent);
    this.sourceContent = body;
    const frontmatter = parseYamlFrontmatter(rawContent);
    this.sourceTitle = (frontmatter.title as string) ?? this.sourceFileName;

    const systemPrompt = this.promptService.render('system-prompt', {});
    const prompt = this.promptService.render('extract-knowledge', { sourceContent: body });

    log.info('Extracting knowledge from source page');
    const rawResult = await this.llmService.generateStructured<{
      entities: Omit<ExtractedEntity, 'slug' | 'id'>[];
      concepts: Omit<ExtractedConcept, 'slug' | 'id'>[];
    }>({
      systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      schema: extractionSchema,
      schemaName: 'ExtractionResult',
      schemaDescription: 'Structured extraction of entities and concepts from a wiki source page.',
    });

    for (const entity of rawResult.entities) {
      const fullId = this.identifier.createId('entity', entity.name);
      (entity as ExtractedEntity).slug = this.identifier.decomposeId(fullId).slug;
      (entity as ExtractedEntity).id = fullId;
    }
    for (const concept of rawResult.concepts) {
      const fullId = this.identifier.createId('concept', concept.name);
      (concept as ExtractedConcept).slug = this.identifier.decomposeId(fullId).slug;
      (concept as ExtractedConcept).id = fullId;
    }

    this.extractionResult = rawResult as unknown as ExtractionResult;
    log.debug({ prompt, response: this.extractionResult }, 'LLM extract knowledge call');

    log.info(
      {
        entities: this.extractionResult.entities.length,
        concepts: this.extractionResult.concepts.length,
      },
      'Extraction complete',
    );
    this.emit({ type: 'step_end', step: 'Extracting' });
  }

  /**
   * Resolves slug and semantic matches once for all entities and concepts.
   * Resolution must happen exactly once per ingest — semantic LLM matching is
   * non-deterministic and repeated calls may produce different results, causing
   * inconsistent page associations between the create and update phases.
   */
  private async resolveAllMatches(): Promise<void> {
    const log = this.logger.child({ step: 'resolveAllMatches' });
    const index = await this.loadIndex();

    const entityMatches = await this.resolveMatches(
      this.extractionResult.entities.map((e) => ({
        name: e.name,
        slug: e.slug,
        description: e.description,
      })),
      index.get('entity') ?? [],
      'entity',
    );
    this.matchResults.set('entity', entityMatches);

    const conceptMatches = await this.resolveMatches(
      this.extractionResult.concepts.map((c) => ({
        name: c.name,
        slug: c.slug,
        description: c.description,
      })),
      index.get('concept') ?? [],
      'concept',
    );
    this.matchResults.set('concept', conceptMatches);

    log.trace(
      {
        entityMatches: Object.fromEntries(entityMatches),
        conceptMatches: Object.fromEntries(conceptMatches),
      },
      'Resolved all entity and concept matches',
    );
  }

  /**
   * Step 2a: Creates skeleton pages for all unmatched entities and concepts.
   * Skeletons contain only title, tags, and body — no claims, no cross-connections.
   * Pages that already exist in the index are skipped (they will be updated later).
   */
  private async createPages(): Promise<void> {
    const log = this.logger.child({ step: 'createPages' });
    this.emit({
      type: 'step_start',
      step: 'Creating',
      data: { sourceFilePath: this.sourceFilePath },
    });

    const sourceRelativePath = `sources/${this.sourceFileName.replace(/\.md$/, '')}`;
    const entityMatches = this.matchResults.get('entity') ?? new Map();
    const conceptMatches = this.matchResults.get('concept') ?? new Map();

    for (const entity of this.extractionResult.entities) {
      if (entityMatches.has(entity.name)) {
        continue;
      }
      await this.createEntitySkeleton(entity, entity.slug, sourceRelativePath);
    }

    for (const concept of this.extractionResult.concepts) {
      if (conceptMatches.has(concept.name)) {
        continue;
      }
      await this.createConceptSkeleton(concept, concept.slug, sourceRelativePath);
    }

    const patchedEntities: string[] = [];
    const patchedConcepts: string[] = [];

    for (const entity of this.extractionResult.entities) {
      const em = this.matchResults.get('entity') ?? new Map();
      if (!em.has(entity.name)) {
        em.set(entity.name, entity.slug);
        this.matchResults.set('entity', em);
        patchedEntities.push(entity.name);
      }
    }
    for (const concept of this.extractionResult.concepts) {
      const cm = this.matchResults.get('concept') ?? new Map();
      if (!cm.has(concept.name)) {
        cm.set(concept.name, concept.slug);
        this.matchResults.set('concept', cm);
        patchedConcepts.push(concept.name);
      }
    }

    log.trace(
      { patchedEntities, patchedConcepts },
      'Algorithmically patched matchResults for newly created pages',
    );
    log.info({ createdCount: this.createdPages.length }, 'Create phase complete');
    this.emit({ type: 'step_end', step: 'Creating' });
  }

  /** Creates a skeleton entity page via LLM structured output — no claims, no cross-connections. */
  private async createEntitySkeleton(
    entity: ExtractedEntity,
    slug: string,
    sourceRelativePath: string,
  ): Promise<void> {
    const log = this.logger.child({
      step: 'create',
      pageType: 'entity',
      name: entity.name,
      slug,
    });
    const systemPrompt = this.promptService.render('system-prompt', {});
    const today = new Date().toISOString().slice(0, 10);

    const createPrompt = this.promptService.render('create-entity', {
      entityName: entity.name,
      entityType: entity.entityType,
      description: entity.description,
      sourceContext: entity.sourceContext,
      sourcePath: sourceRelativePath,
      sourceContent: this.sourceContent,
    });

    log.info('Creating new entity page skeleton');
    this.emit({ type: 'page_creating_start', pageType: 'entity', name: entity.name, slug });

    const skeleton = await this.llmService.generateStructured<PageSkeleton>({
      systemPrompt,
      messages: [{ role: 'user', content: createPrompt }],
      schema: entityPageSchema,
      schemaName: 'EntityPage',
      schemaDescription: 'A skeleton entity page for the wiki vault.',
    });

    const pageContent = this.promptService.render('entity-page-output', {
      id: entity.id,
      title: skeleton.title,
      status: 'review',
      tags: skeleton.tags ?? [],
      confidence: '0.50',
      created: today,
      updated: today,
      body: skeleton.body,
    });

    const dir = join(this.config.vaultPath, PAGE_DIRS.entity);
    await mkdir(dir, { recursive: true });
    const pagePath = join(dir, `${slug}.md`);
    await writeFile(pagePath, pageContent, 'utf-8');
    this.createdPages.push(`${PAGE_DIRS.entity}/${slug}.md`);
    this.emit({ type: 'page_created', pageType: 'entity', name: entity.name, slug });
  }

  /** Creates a skeleton concept page via LLM structured output — no claims, no cross-connections. */
  private async createConceptSkeleton(
    concept: ExtractedConcept,
    slug: string,
    sourceRelativePath: string,
  ): Promise<void> {
    const log = this.logger.child({
      step: 'create',
      pageType: 'concept',
      name: concept.name,
      slug,
    });
    const systemPrompt = this.promptService.render('system-prompt', {});
    const today = new Date().toISOString().slice(0, 10);

    const createPrompt = this.promptService.render('create-concept', {
      conceptName: concept.name,
      domain: concept.domain,
      description: concept.description,
      sourceContext: concept.sourceContext,
      sourcePath: sourceRelativePath,
      sourceContent: this.sourceContent,
    });

    log.info('Creating new concept page skeleton');
    this.emit({
      type: 'page_creating_start',
      pageType: 'concept',
      name: concept.name,
      slug,
    });

    const skeleton = await this.llmService.generateStructured<PageSkeleton>({
      systemPrompt,
      messages: [{ role: 'user', content: createPrompt }],
      schema: conceptPageSchema,
      schemaName: 'ConceptPage',
      schemaDescription: 'A skeleton concept page for the wiki vault.',
    });

    const pageContent = this.promptService.render('concept-page-output', {
      id: concept.id,
      title: skeleton.title,
      status: 'review',
      tags: skeleton.tags ?? [],
      confidence: '0.50',
      created: today,
      updated: today,
      body: skeleton.body,
    });

    const dir = join(this.config.vaultPath, PAGE_DIRS.concept);
    await mkdir(dir, { recursive: true });
    const pagePath = join(dir, `${slug}.md`);
    await writeFile(pagePath, pageContent, 'utf-8');
    this.createdPages.push(`${PAGE_DIRS.concept}/${slug}.md`);
    this.emit({ type: 'page_created', pageType: 'concept', name: concept.name, slug });
  }

  /**
   * Step 2b: Rebuilds the index if any page skeletons were created.
   * This ensures the freshly created pages appear in the index for the update phase.
   */
  private async compileIndex(): Promise<void> {
    if (this.createdPages.length === 0) {
      this.logger.debug('No pages created, skipping index rebuild');
      return;
    }

    const log = this.logger.child({ step: 'compileIndex' });
    this.emit({
      type: 'step_start',
      step: 'RebuildingIndex',
      data: { sourceFilePath: this.sourceFilePath },
    });
    log.info(
      { createdCount: this.createdPages.length },
      'Rebuilding index due to newly created pages',
    );
    await this.compileService.compile();
    this.emit({ type: 'step_end', step: 'RebuildingIndex' });
  }

  /**
   * Step 2c: Updates ALL wiki pages touched by the extracted knowledge.
   * For each entity and concept, filters the index for relevant pages, reads
   * their full content, and passes everything to the update template where
   * claims, cross-connections, and open questions are generated.
   */
  private async updateAllPages(): Promise<void> {
    const log = this.logger.child({ step: 'updateAllPages' });
    this.emit({
      type: 'step_start',
      step: 'Updating',
      data: { sourceFilePath: this.sourceFilePath },
    });

    const index = await this.loadIndex();
    const sourceRelativePath = `sources/${this.sourceFileName.replace(/\.md$/, '')}`;

    for (const entity of this.extractionResult.entities) {
      const item: ItemToUpdate = {
        name: entity.name,
        type: entity.entityType,
        description: entity.description,
        sourceContext: entity.sourceContext,
        slug: entity.slug,
        pageType: 'entity',
      };
      await this.updateSinglePage(item, 'entity', sourceRelativePath, index);
    }

    for (const concept of this.extractionResult.concepts) {
      const item: ItemToUpdate = {
        name: concept.name,
        type: concept.domain,
        description: concept.description,
        sourceContext: concept.sourceContext,
        slug: concept.slug,
        pageType: 'concept',
      };
      await this.updateSinglePage(item, 'concept', sourceRelativePath, index);
    }

    this.emit({ type: 'step_end', step: 'Updating' });
  }

  /** Updates a single entity or concept page: resolves match, filters relevant pages, reads them, and calls LLM. */
  private async updateSinglePage(
    item: ItemToUpdate,
    pageType: 'entity' | 'concept',
    sourceRelativePath: string,
    index: Map<string, IndexEntry[]>,
  ): Promise<void> {
    const log = this.logger.child({
      step: 'updateSinglePage',
      pageType,
      name: item.name,
    });
    const systemPrompt = this.promptService.render('system-prompt', {});
    const today = new Date().toISOString().slice(0, 10);
    const pageMatches = this.matchResults.get(pageType);
    if (!pageMatches) {
      throw new Error(`No match results for page type: ${pageType}`);
    }
    const matchedSlug = pageMatches.get(item.name);
    if (!matchedSlug) {
      log.error(
        { name: item.name, slug: item.slug },
        'No match found for update — page was not created',
      );
      throw new Error(`No match found for update: ${item.name}`);
    }

    const pagesDir = join(this.config.vaultPath, PAGE_DIRS[pageType]);
    const pagePath = join(pagesDir, `${matchedSlug}.md`);
    let currentContent = '';
    try {
      currentContent = await readFile(pagePath, 'utf-8');
    } catch (err) {
      log.error({ pagePath, err }, 'Page not found on disk for update');
      throw err;
    }

    const allEntries = [...(index.get('entity') ?? []), ...(index.get('concept') ?? [])];
    const relevantSlugs = await this.filterRelevantPages(item, allEntries);
    log.debug({ relevantSlugs }, 'Relevant pages filtered');

    const relevantPages = await this.readRelevantPages(relevantSlugs, index);

    const updatePrompt = this.promptService.render('update-page', {
      itemName: item.name,
      itemType: item.type,
      itemDescription: item.description,
      itemSourceContext: item.sourceContext,
      currentPageContent: currentContent,
      sourcePath: sourceRelativePath,
      relevantPages,
      today,
    });

    log.info({ pagePath, name: item.name }, `Updating ${pageType} page`);
    this.emit({
      type: 'page_updating_start',
      pageType,
      name: item.name,
      slug: matchedSlug,
    });
    const updatedContent = await this.llmService.complete(updatePrompt, systemPrompt);
    log.debug({ response: updatedContent }, 'LLM update page call');
    await writeFile(pagePath, updatedContent, 'utf-8');
    this.updatedPages.push(`${PAGE_DIRS[pageType]}/${matchedSlug}.md`);
    this.emit({
      type: 'page_updated',
      pageType,
      name: item.name,
      slug: matchedSlug,
    });
  }

  /**
   * Determines which existing wiki pages are relevant to the item being updated.
   * Passes the item and all entity/concept index summaries to the LLM,
   * which returns only the slugs of semantically relevant pages.
   */
  private async filterRelevantPages(
    item: ItemToUpdate,
    indexEntries: IndexEntry[],
  ): Promise<string[]> {
    const log = this.logger.child({ step: 'filterRelevantPages', name: item.name });

    if (indexEntries.length === 0) return [];

    const systemPrompt = this.promptService.render('system-prompt', {});
    const prompt = this.promptService.render('filter-relevant-pages', {
      itemName: item.name,
      itemType: item.type,
      itemDescription: item.description,
      itemSourceContext: item.sourceContext,
      indexEntries: indexEntries.map((e) => ({
        slug: e.slug,
        pageType: e.pageType,
        summary: e.summary,
      })),
    });

    const result = await this.llmService.generateStructured<{ relevantSlugs: string[] }>({
      systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      schema: relevanceFilterSchema,
      schemaName: 'RelevanceFilter',
      schemaDescription:
        'Filter determining which existing wiki pages are relevant to an item being updated.',
    });

    log.debug({ relevantSlugs: result.relevantSlugs }, 'Filter result');
    return result.relevantSlugs;
  }

  /**
   * Reads the full content of the pages identified as relevant by the filter step.
   * Returns an array of {@link RelevantPage} for use in the update template context.
   */
  private async readRelevantPages(
    slugs: string[],
    index: Map<string, IndexEntry[]>,
  ): Promise<RelevantPage[]> {
    const log = this.logger.child({ step: 'readRelevantPages' });
    const relevantPages: RelevantPage[] = [];
    const allEntries = [...index.values()].flat();

    for (const slug of slugs) {
      const entry = allEntries.find((e) => e.slug === slug);
      if (!entry) continue;

      const pagePath = join(this.config.vaultPath, entry.path);
      try {
        const rawContent = await readFile(pagePath, 'utf-8');
        relevantPages.push({
          slug,
          title: entry.title,
          path: entry.path,
          content: rawContent,
        });
      } catch (err) {
        log.warn({ slug, pagePath, err }, 'Could not read relevant page');
      }
    }

    return relevantPages;
  }

  /** Step 3: Writes a summary entry to the vault log. */
  private async writeLogEntry(): Promise<void> {
    const log = this.logger.child({ step: 'log' });
    this.emit({
      type: 'step_start',
      step: 'Logging',
      data: { sourceFilePath: this.sourceFilePath },
    });
    const today = new Date().toISOString().slice(0, 10);
    const logPath = join(this.config.vaultPath, 'log.md');

    const actionParts: string[] = [];
    if (this.createdPages.length > 0) {
      actionParts.push(`${this.createdPages.length} page(s) created`);
    }
    if (this.updatedPages.length > 0) {
      actionParts.push(`${this.updatedPages.length} page(s) updated`);
    }
    actionParts.push(`${this.extractionResult.entities.length} entities`);
    actionParts.push(`${this.extractionResult.concepts.length} concepts`);

    const sourceRelPath = `sources/${this.sourceFileName.replace(/\.md$/, '')}`;
    const heading = `## ${today} • ingest | ${this.sourceTitle}`;
    const sourceLine = `Source: [[${sourceRelPath}]]`;
    const actionLine = `Action: ${actionParts.join(', ')}`;

    const detailsLines: string[] = [];
    if (this.createdPages.length > 0) {
      detailsLines.push(
        `  Created: ${this.createdPages.map((p) => `[[${p.replace(/\.md$/, '')}]]`).join(', ')}`,
      );
    }
    if (this.updatedPages.length > 0) {
      detailsLines.push(
        `  Updated: ${this.updatedPages.map((p) => `[[${p.replace(/\.md$/, '')}]]`).join(', ')}`,
      );
    }

    const newEntry = [heading, sourceLine, actionLine, ...detailsLines, ''].join('\n');

    let existingLog = '';
    try {
      existingLog = await readFile(logPath, 'utf-8');
    } catch {
      existingLog = '# Wiki Log\n\n';
    }

    const headerEnd = existingLog.indexOf('\n## ');
    let header: string;
    let body: string;
    if (headerEnd === -1) {
      header = existingLog.trimEnd();
      body = '';
    } else {
      header = existingLog.slice(0, headerEnd).trimEnd();
      body = existingLog.slice(headerEnd);
    }

    const updatedLog = `${header}\n\n${newEntry}${body}`;
    await writeFile(logPath, updatedLog, 'utf-8');
    log.debug(
      {
        logPath,
        createdPages: this.createdPages,
        updatedPages: this.updatedPages,
        entityCount: this.extractionResult.entities.length,
        conceptCount: this.extractionResult.concepts.length,
      },
      'Log entry written',
    );
    this.emit({ type: 'step_end', step: 'Logging' });
  }

  /** Step 4: Triggers the compile operation — a separate operation that regenerates indices and dashboards. */
  private async triggerCompile(): Promise<void> {
    const log = this.logger.child({ step: 'compile' });
    this.emit({
      type: 'step_start',
      step: 'Compiling',
      data: { sourceFilePath: this.sourceFilePath },
    });
    log.info('Triggering compile operation');
    await this.compileService.compile();
    this.emit({ type: 'step_end', step: 'Compiling' });
  }

  /** Reads and parses index.md into a registry grouped by page type. */
  private async loadIndex(): Promise<Map<string, IndexEntry[]>> {
    const log = this.logger.child({ step: 'loadIndex' });
    const indexPath = join(this.config.vaultPath, 'index.md');
    let content: string;
    try {
      content = await readFile(indexPath, 'utf-8');
    } catch {
      log.info('No index.md found, treating all elements as new pages');
      return new Map();
    }
    const index = parseIndex(content);
    log.trace({ index: Object.fromEntries(index) }, 'Index parse result');
    return index;
  }

  /**
   * Resolves extracted items to existing page slugs using two-phase lookup:
   * Phase 1 — exact slug match (uses pre-computed item slug); Phase 2 — LLM-based semantic match.
   * Returns a map from name to matched slug.
   */
  private async resolveMatches(
    items: { name: string; slug: string; description?: string }[],
    entries: IndexEntry[],
    pageType: string,
  ): Promise<Map<string, string>> {
    const log = this.logger.child({ step: 'resolveMatches', pageType });
    const result = new Map<string, string>();
    const unmatchedItems: { name: string; description?: string }[] = [];

    for (const item of items) {
      const found = entries.find((e) => e.slug === item.slug);
      if (found) {
        result.set(item.name, found.slug);
        log.trace(
          { name: item.name, slug: found.slug, method: 'ExactSlugMatch' },
          'Matched via exact slug',
        );
      } else {
        unmatchedItems.push({ name: item.name, description: item.description });
      }
    }

    if (unmatchedItems.length > 0 && entries.length > 0) {
      log.debug({ unmatchedCount: unmatchedItems.length }, 'Running Phase 2 semantic match');
      const semanticMatches = await this.semanticMatch(unmatchedItems, entries, pageType);
      for (const sm of semanticMatches.matches) {
        if (!result.has(sm.extractedName)) {
          result.set(sm.extractedName, sm.matchedSlug);
          log.trace(
            {
              name: sm.extractedName,
              slug: sm.matchedSlug,
              method: 'SemanticMatch',
              reason: sm.reason,
            },
            'Matched via semantic match',
          );
        }
      }
      for (const um of semanticMatches.unmatched) {
        log.trace({ name: um.name, reason: um.reason }, 'Not matched via semantic match');
      }
    }

    return result;
  }

  /** Runs Phase 2 semantic matching via LLM for names that had no exact slug match. */
  private async semanticMatch(
    unmatchedItems: { name: string; description?: string }[],
    entries: IndexEntry[],
    pageType: string,
  ): Promise<SemanticMatchResult> {
    const log = this.logger.child({ step: 'semanticMatch', pageType });
    const systemPrompt = this.promptService.render('system-prompt', {});
    const prompt = this.promptService.render('match-pages', {
      pageType,
      unmatchedItems,
      indexEntries: entries.map((e) => ({
        slug: e.slug,
        title: e.title,
        summary: e.summary,
      })),
    });

    const result = await this.llmService.generateStructured<SemanticMatchResult>({
      systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      schema: matchSchema,
      schemaName: 'SemanticMatchResult',
      schemaDescription:
        'Result of semantic matching between extracted names and existing wiki page summaries.',
    });

    const matchedNames = new Set(result.matches.map((m) => m.extractedName));
    const unmatchedNames = new Set(result.unmatched.map((u) => u.name));
    const inputNames = new Set(unmatchedItems.map((i) => i.name));

    const intersection = [...matchedNames].filter((n) => unmatchedNames.has(n));
    if (intersection.length > 0) {
      log.warn(
        { names: intersection },
        'LLM returned names in both matches and unmatched — discarding from unmatched',
      );
      result.unmatched = result.unmatched.filter((u) => !intersection.includes(u.name));
    }

    const accounted = new Set([...matchedNames, ...unmatchedNames]);
    for (const name of inputNames) {
      if (!accounted.has(name)) {
        log.warn({ name }, 'LLM omitted extracted name — marking as unmatched');
        result.unmatched.push({ name, reason: 'LLM did not provide a match decision.' });
      }
    }

    for (const name of accounted) {
      if (!inputNames.has(name)) {
        log.warn({ name }, 'LLM returned name not in input — discarding');
      }
    }
    result.matches = result.matches.filter((m) => inputNames.has(m.extractedName));
    result.unmatched = result.unmatched.filter((u) => inputNames.has(u.name));

    log.trace({ prompt, response: result }, 'LLM semantic match call');
    return result;
  }
}

/** Extracts the body content after YAML frontmatter delimiters. */
function extractBodyAfterFrontmatter(rawContent: string): string {
  const lines = rawContent.split('\n');
  if (lines[0]?.trim() !== '---') return rawContent;

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) return rawContent;
  return lines
    .slice(endIndex + 1)
    .join('\n')
    .trim();
}

/** Parses YAML frontmatter into a key-value map. */
function parseYamlFrontmatter(rawContent: string): Record<string, unknown> {
  const lines = rawContent.split('\n');
  if (lines[0]?.trim() !== '---') return {};

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) return {};

  const result: Record<string, unknown> = {};
  for (let i = 1; i < endIndex; i++) {
    const line = lines[i];
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    if (key && value) {
      result[key] = value;
    }
  }
  return result;
}

/** Parses index.md into a registry of entries grouped by page type. */
function parseIndex(content: string): Map<string, IndexEntry[]> {
  const result = new Map<string, IndexEntry[]>();
  const sections = content.split(/\n(?=## )/);

  for (const section of sections) {
    const headingMatch = section.match(/^## (\w+)/);
    if (!headingMatch) continue;

    const headingName = headingMatch[1];
    const pageType = PAGE_TYPE_MAP[headingName];
    if (!pageType) continue;

    const entries: IndexEntry[] = [];
    const entryBlocks = section.split(/\n- \[\[/);
    for (let i = 1; i < entryBlocks.length; i++) {
      const blockLines = entryBlocks[i].split('\n');

      const linkMatch = blockLines[0]?.match(/^([^\]]+)\]\]/);
      if (!linkMatch) continue;

      const path = linkMatch[1];
      const slug = path.split('/').pop() ?? '';

      let summary = '';
      for (let j = 1; j < blockLines.length; j++) {
        const dashIdx = blockLines[j].indexOf('—');
        if (dashIdx !== -1) {
          summary = blockLines[j].slice(dashIdx + 1).trim();
          break;
        }
      }

      const fullPath = `${path}.md`;

      entries.push({
        slug,
        title: slug,
        pageType,
        summary,
        path: fullPath,
      });
    }

    result.set(pageType, entries);
  }

  return result;
}
