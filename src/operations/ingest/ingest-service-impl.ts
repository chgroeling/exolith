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
  claimIds: string[];
  claimTexts: string[];
}

/** Semantic match result from the LLM. */
interface SemanticMatchResult {
  matches: Array<{ extractedName: string; matchedSlug: string }>;
  unmatched: string[];
}

/** Structured output from the LLM for a new entity page. */
interface EntityPage {
  title: string;
  tags: string[];
  body: string;
  claims: Array<{
    slug: string;
    confidence: number;
    status: string;
    text: string;
    evidence: string;
    evidenceLocation?: string;
    limitation?: string;
  }>;
  openQuestions?: Array<{
    question: string;
    context?: string;
  }>;
}

/** Structured output from the LLM for a new concept page. */
interface ConceptPage {
  title: string;
  tags: string[];
  body: string;
  claims: Array<{
    slug: string;
    confidence: number;
    status: string;
    text: string;
    evidence: string;
    evidenceLocation?: string;
    limitation?: string;
  }>;
  openQuestions?: Array<{
    question: string;
    context?: string;
  }>;
}

const PAGE_TYPE_MAP: Record<string, string> = {
  Sources: 'source',
  Entities: 'entity',
  Concepts: 'concept',
  Syntheses: 'synthesis',
  Reports: 'report',
};

const extractionSchema = loadSchemaFile<Record<string, unknown>>('extraction.schema.json');
const matchSchema = loadSchemaFile<Record<string, unknown>>('match.schema.json');
const entityPageSchema = loadSchemaFile<Record<string, unknown>>('entity-page.schema.json');
const conceptPageSchema = loadSchemaFile<Record<string, unknown>>('concept-page.schema.json');

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
      await this.updateWikiPages();
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

  /** Step 2: Updates all wiki pages touched by the extracted knowledge. */
  private async updateWikiPages(): Promise<void> {
    const log = this.logger.child({ step: 'update' });
    this.emit({
      type: 'step_start',
      step: 'Updating',
      data: { sourceFilePath: this.sourceFilePath },
    });
    const indexEntries = await this.loadIndex();
    const entryCount = [...indexEntries.values()].reduce((s, e) => s + e.length, 0);
    log.info({ indexSize: entryCount }, 'Index loaded');

    const sourceRelativePath = `sources/${this.sourceFileName.replace(/\.md$/, '')}`;

    await this.updatePages(
      this.extractionResult.entities,
      'entity',
      indexEntries,
      sourceRelativePath,
      (item, slug, srcRelPath) => this.createEntityPage(item, slug, srcRelPath),
    );

    await this.updatePages(
      this.extractionResult.concepts,
      'concept',
      indexEntries,
      sourceRelativePath,
      (item, slug, srcRelPath) => this.createConceptPage(item, slug, srcRelPath),
    );
    this.emit({ type: 'step_end', step: 'Updating' });
  }

  /** Updates or creates pages of the given type via two-phase lookup and LLM. */
  private async updatePages<T extends { name: string; slug: string }>(
    items: T[],
    pageType: string,
    indexEntries: Map<string, IndexEntry[]>,
    sourceRelativePath: string,
    createPage: (item: T, slug: string, sourceRelativePath: string) => Promise<void>,
  ): Promise<void> {
    const log = this.logger.child({ step: 'updatePages', pageType });
    const entries = indexEntries.get(pageType) ?? [];
    const systemPrompt = this.promptService.render('system-prompt', {});
    const today = new Date().toISOString().slice(0, 10);
    const matches = await this.resolveMatches(
      items.map((i) => ({ name: i.name, slug: i.slug })),
      entries,
      pageType,
    );

    log.debug({ matches: Object.fromEntries(matches) }, 'Resolution matches');
    const pagesDir = join(this.config.vaultPath, `${pageType}s`);

    for (const item of items) {
      const matchedSlug = matches.get(item.name);

      if (matchedSlug) {
        const pagePath = join(pagesDir, `${matchedSlug}.md`);
        let currentContent = '';
        try {
          currentContent = await readFile(pagePath, 'utf-8');
        } catch {
          log.warn({ pagePath }, `Matched ${pageType} page not found on disk, treating as create`);
          await createPage(item, item.slug, sourceRelativePath);
          continue;
        }

        const updatePrompt = this.promptService.render('update-page', {
          currentPageContent: currentContent,
          sourcePath: sourceRelativePath,
          entities: this.extractionResult.entities,
          concepts: this.extractionResult.concepts,
          today,
        });

        log.info({ pagePath, name: item.name }, `Updating existing ${pageType} page`);
        this.emit({
          type: 'page_updating_start',
          pageType: pageType as 'entity' | 'concept',
          name: item.name,
          slug: matchedSlug,
        });
        const updatedContent = await this.llmService.complete(updatePrompt, systemPrompt);
        log.debug({ prompt: updatePrompt, response: updatedContent }, 'LLM update page call');
        await writeFile(pagePath, updatedContent, 'utf-8');
        this.updatedPages.push(`${pageType}s/${matchedSlug}.md`);
        this.emit({
          type: 'page_updated',
          pageType: pageType as 'entity' | 'concept',
          name: item.name,
          slug: matchedSlug,
        });
      } else {
        await createPage(item, item.slug, sourceRelativePath);
      }
    }
  }

  /** Creates a new entity page via LLM structured output and template rendering. */
  private async createEntityPage(
    entity: ExtractedEntity,
    slug: string,
    sourceRelativePath: string,
  ): Promise<void> {
    const log = this.logger.child({ step: 'create', pageType: 'entity', name: entity.name, slug });
    const systemPrompt = this.promptService.render('system-prompt', {});
    const today = new Date().toISOString().slice(0, 10);

    const createPrompt = this.promptService.render('create-entity', {
      entityName: entity.name,
      entityType: entity.entityType,
      description: entity.description,
      sourceContext: entity.sourceContext,
      slug,
      sourcePath: sourceRelativePath,
      sourceContent: this.sourceContent,
      entities: this.extractionResult.entities,
      concepts: this.extractionResult.concepts,
      today,
    });

    log.info('Creating new entity page');
    this.emit({ type: 'page_creating_start', pageType: 'entity', name: entity.name, slug });

    const entityPage = await this.llmService.generateStructured<EntityPage>({
      systemPrompt,
      messages: [{ role: 'user', content: createPrompt }],
      schema: entityPageSchema,
      schemaName: 'EntityPage',
      schemaDescription: 'A complete entity page for the wiki vault.',
    });
    log.debug({ prompt: createPrompt, response: entityPage }, 'LLM create entity call');

    const confidence =
      entityPage.claims.length > 0
        ? (
            entityPage.claims.reduce((sum, c) => sum + c.confidence, 0) / entityPage.claims.length
          ).toFixed(2)
        : '0.50';

    const pageContent = this.promptService.render('entity-page-output', {
      id: entity.id,
      title: entityPage.title,
      status: 'review',
      tags: entityPage.tags ?? [],
      confidence,
      created: today,
      updated: today,
      body: entityPage.body,
      claims: entityPage.claims,
      openQuestions: entityPage.openQuestions ?? [],
    });

    const dir = join(this.config.vaultPath, 'entities');
    await mkdir(dir, { recursive: true });
    const pagePath = join(dir, `${slug}.md`);
    await writeFile(pagePath, pageContent, 'utf-8');
    this.createdPages.push(`entities/${slug}.md`);
    this.emit({ type: 'page_created', pageType: 'entity', name: entity.name, slug });
  }

  /** Creates a new concept page via LLM structured output and template rendering. */
  private async createConceptPage(
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
      slug,
      sourcePath: sourceRelativePath,
      sourceContent: this.sourceContent,
      entities: this.extractionResult.entities,
      concepts: this.extractionResult.concepts,
      today,
    });

    log.info('Creating new concept page');
    this.emit({ type: 'page_creating_start', pageType: 'concept', name: concept.name, slug });

    const conceptPage = await this.llmService.generateStructured<ConceptPage>({
      systemPrompt,
      messages: [{ role: 'user', content: createPrompt }],
      schema: conceptPageSchema,
      schemaName: 'ConceptPage',
      schemaDescription: 'A complete concept page for the wiki vault.',
    });
    log.debug({ prompt: createPrompt, response: conceptPage }, 'LLM create concept call');

    const confidence =
      conceptPage.claims.length > 0
        ? (
            conceptPage.claims.reduce((sum, c) => sum + c.confidence, 0) / conceptPage.claims.length
          ).toFixed(2)
        : '0.50';

    const pageContent = this.promptService.render('concept-page-output', {
      id: concept.id,
      title: conceptPage.title,
      status: 'review',
      tags: conceptPage.tags ?? [],
      confidence,
      created: today,
      updated: today,
      body: conceptPage.body,
      claims: conceptPage.claims,
      openQuestions: conceptPage.openQuestions ?? [],
    });

    const dir = join(this.config.vaultPath, 'concepts');
    await mkdir(dir, { recursive: true });
    const pagePath = join(dir, `${slug}.md`);
    await writeFile(pagePath, pageContent, 'utf-8');
    this.createdPages.push(`concepts/${slug}.md`);
    this.emit({ type: 'page_created', pageType: 'concept', name: concept.name, slug });
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
    return parseIndex(content);
  }

  /**
   * Resolves extracted items to existing page slugs using two-phase lookup:
   * Phase 1 — exact slug match (uses pre-computed item slug); Phase 2 — LLM-based semantic match.
   * Returns a map from name to matched slug.
   */
  private async resolveMatches(
    items: { name: string; slug: string }[],
    entries: IndexEntry[],
    pageType: string,
  ): Promise<Map<string, string>> {
    const log = this.logger.child({ step: 'resolveMatches', pageType });
    const result = new Map<string, string>();
    const unmatchedNames: string[] = [];

    for (const item of items) {
      const found = entries.find((e) => e.slug === item.slug);
      if (found) {
        result.set(item.name, found.slug);
      } else {
        unmatchedNames.push(item.name);
      }
    }

    if (unmatchedNames.length > 0 && entries.length > 0) {
      log.info({ unmatchedCount: unmatchedNames.length }, 'Running Phase 2 semantic match');
      const semanticMatches = await this.semanticMatch(unmatchedNames, entries, pageType);
      for (const sm of semanticMatches.matches) {
        if (!result.has(sm.extractedName)) {
          result.set(sm.extractedName, sm.matchedSlug);
        }
      }
    }

    return result;
  }

  /** Runs Phase 2 semantic matching via LLM for names that had no exact slug match. */
  private async semanticMatch(
    unmatchedNames: string[],
    entries: IndexEntry[],
    pageType: string,
  ): Promise<SemanticMatchResult> {
    const log = this.logger.child({ step: 'semanticMatch', pageType });
    const systemPrompt = this.promptService.render('system-prompt', {});
    const prompt = this.promptService.render('match-pages', {
      pageType,
      unmatchedNames,
      indexEntries: entries.map((e) => ({
        slug: e.slug,
        title: e.title,
        summary: e.summary,
        claimTexts: e.claimTexts,
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
    log.debug({ prompt, response: result }, 'LLM semantic match call');
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

  const claimsByPath = parseClaimSection(content);

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
      const pageClaims = claimsByPath.get(fullPath) ?? { ids: [], texts: [] };

      entries.push({
        slug,
        title: slug,
        pageType,
        summary,
        path: fullPath,
        claimIds: pageClaims.ids,
        claimTexts: pageClaims.texts,
      });
    }

    result.set(pageType, entries);
  }

  return result;
}

/** Parses the ## Claims section of index.md into a map from page path to claim summary. */
function parseClaimSection(content: string): Map<string, { ids: string[]; texts: string[] }> {
  const result = new Map<string, { ids: string[]; texts: string[] }>();
  const claimsMatch = content.match(/\n## Claims\n/);
  if (!claimsMatch || claimsMatch.index === undefined) return result;

  const claimsStart = claimsMatch.index + claimsMatch[0].length;
  const remaining = content.slice(claimsStart);
  const nextHeadingMatch = remaining.match(/\n##(?!#)/);
  const claimsSection = nextHeadingMatch ? remaining.slice(0, nextHeadingMatch.index) : remaining;

  const claimBlocks = claimsSection.split(/\n- /);
  for (let i = 1; i < claimBlocks.length; i++) {
    const block = claimBlocks[i];
    const lines = block.split('\n');

    const metaLine = lines[0] ?? '';
    const idMatch = metaLine.match(/`(id:claim\.[^`]+)`/);
    if (!idMatch) continue;

    const linkMatch = metaLine.match(/→\s*\[\[([^\]]+)\]\]/);
    if (!linkMatch) continue;

    const sourcePath = `${linkMatch[1]}.md`;
    let text = '';
    if (lines.length > 1) {
      text = lines[1].trim();
    }

    const entry = result.get(sourcePath);
    if (entry) {
      entry.ids.push(idMatch[1]);
      if (text) entry.texts.push(text);
    } else {
      result.set(sourcePath, {
        ids: [idMatch[1]],
        texts: text ? [text] : [],
      });
    }
  }

  return result;
}
