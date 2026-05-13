/** Specification: docs/operations/ingest.md */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
}

/** Extracted concept from a source page. */
interface ExtractedConcept {
  name: string;
  domain: string;
  description: string;
  sourceContext: string;
}

/** Extracted claim from a source page. */
interface ExtractedClaim {
  id: string;
  text: string;
  confidence: number;
  sourceLocation: string;
  evidence: string;
  limitation?: string;
}

/** Extracted relationship from a source page. */
interface ExtractedRelationship {
  source: string;
  relation: string;
  target: string;
  context: string;
}

/** Extracted open question from a source page. */
interface ExtractedQuestion {
  question: string;
  context: string;
}

/** Structured extraction result from the LLM. */
interface ExtractionResult {
  entities: ExtractedEntity[];
  concepts: ExtractedConcept[];
  claims: ExtractedClaim[];
  relationships: ExtractedRelationship[];
  openQuestions: ExtractedQuestion[];
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
  matches: Array<{ extractedName: string; matchedSlug: string }>;
  unmatched: string[];
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

export class Ingest implements IngestService {
  private logger: Logger;
  private extractionResult: ExtractionResult = {
    entities: [],
    concepts: [],
    claims: [],
    relationships: [],
    openQuestions: [],
  };
  private createdPages: string[] = [];
  private updatedPages: string[] = [];
  private sourceFileName = '';
  private sourceFilePath = '';
  private sourceTitle = '';

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
    this.sourceFileName = sourceFilePath.replace(`${vaultPath}/`, '').replace(/^sources\//, '');
    this.sourceFilePath = sourceFilePath;

    try {
      this.emit({ type: 'progress', step: 'Extracting', data: { sourceFilePath } });
      await this.extract(sourceFilePath);

      this.emit({ type: 'progress', step: 'Updating', data: { sourceFilePath } });
      await this.updateWikiPages();

      this.emit({ type: 'progress', step: 'Logging', data: { sourceFilePath } });
      await this.writeLogEntry();

      this.emit({ type: 'progress', step: 'Compiling', data: { sourceFilePath } });
      await this.triggerCompile();
    } catch (err) {
      this.emit({ type: 'error', error: err as Error });
      this.logger.error({ sourceFilePath, err }, 'Ingest process failed');
      throw err;
    }
  }

  /** Step 1: Extracts structured knowledge — entities, concepts, claims, relationships, and open questions. */
  private async extract(sourceFilePath: string): Promise<void> {
    const rawContent = await readFile(sourceFilePath, 'utf-8');
    const body = extractBodyAfterFrontmatter(rawContent);
    const frontmatter = parseYamlFrontmatter(rawContent);
    this.sourceTitle = (frontmatter.title as string) ?? this.sourceFileName;

    const systemPrompt = this.promptService.render('system-prompt', {});
    const prompt = this.promptService.render('extract-knowledge', { sourceContent: body });

    this.logger.info({ sourceFilePath }, 'Extracting knowledge from source page');
    this.extractionResult = await this.llmService.generateStructured<ExtractionResult>({
      systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      schema: extractionSchema,
      schemaName: 'ExtractionResult',
      schemaDescription:
        'Structured extraction of entities, concepts, claims, relationships, and open questions from a wiki source page.',
    });

    this.logger.info(
      {
        entities: this.extractionResult.entities.length,
        concepts: this.extractionResult.concepts.length,
        claims: this.extractionResult.claims.length,
        relationships: this.extractionResult.relationships.length,
        questions: this.extractionResult.openQuestions.length,
      },
      'Extraction complete',
    );
  }

  /** Step 2: Updates all wiki pages touched by the extracted knowledge. */
  private async updateWikiPages(): Promise<void> {
    const indexEntries = await this.loadIndex();
    const entryCount = [...indexEntries.values()].reduce((s, e) => s + e.length, 0);
    this.logger.info({ indexSize: entryCount }, 'Index loaded');

    const sourceRelativePath = `sources/${this.sourceFileName.replace(/\.md$/, '')}`;

    await this.updatePages(
      this.extractionResult.entities,
      'entity',
      indexEntries,
      sourceRelativePath,
      (item, slug, srcRelPath) => this.createEntityPage(item, slug, srcRelPath),
      'EntityCreated',
    );

    await this.updatePages(
      this.extractionResult.concepts,
      'concept',
      indexEntries,
      sourceRelativePath,
      (item, slug, srcRelPath) => this.createConceptPage(item, slug, srcRelPath),
      'ConceptCreated',
    );
  }

  /** Updates or creates pages of the given type via two-phase lookup and LLM. */
  private async updatePages<T extends { name: string }>(
    items: T[],
    pageType: string,
    indexEntries: Map<string, IndexEntry[]>,
    sourceRelativePath: string,
    createPage: (item: T, slug: string, sourceRelativePath: string) => Promise<void>,
    subStepType: string,
  ): Promise<void> {
    const entries = indexEntries.get(pageType) ?? [];
    const systemPrompt = this.promptService.render('system-prompt', {});
    const today = new Date().toISOString().slice(0, 10);
    const matches = await this.resolveMatches(
      items.map((i) => i.name),
      entries,
      pageType,
    );

    const pagesDir = join(this.config.vaultPath, `${pageType}s`);

    for (const item of items) {
      const matchedSlug = matches.get(item.name);

      if (matchedSlug) {
        const pagePath = join(pagesDir, `${matchedSlug}.md`);
        let currentContent = '';
        try {
          currentContent = await readFile(pagePath, 'utf-8');
        } catch {
          this.logger.warn(
            { pagePath },
            `Matched ${pageType} page not found on disk, treating as create`,
          );
          const slug = this.slugifyName(item.name);
          await createPage(item, slug, sourceRelativePath);
          const label = subStepType === 'EntityCreated' ? 'entity' : 'concept';
          this.emit({
            type: 'progress',
            step: 'Updating',
            subStep: `Created ${label}: ${item.name} (${slug})`,
          });
          continue;
        }

        const updatePrompt = this.promptService.render('update-page', {
          currentPageContent: currentContent,
          sourcePath: sourceRelativePath,
          entities: this.extractionResult.entities,
          concepts: this.extractionResult.concepts,
          claims: this.extractionResult.claims,
          relationships: this.extractionResult.relationships,
          openQuestions: this.extractionResult.openQuestions,
          today,
        });

        this.logger.info({ pagePath }, `Updating existing ${pageType} page`);
        const updatedContent = await this.llmService.complete(updatePrompt, systemPrompt);
        await writeFile(pagePath, updatedContent, 'utf-8');
        this.updatedPages.push(`${pageType}s/${matchedSlug}.md`);
      } else {
        const slug = this.slugifyName(item.name);
        await createPage(item, slug, sourceRelativePath);
        const label = subStepType === 'EntityCreated' ? 'entity' : 'concept';
        this.emit({
          type: 'progress',
          step: 'Updating',
          subStep: `Created ${label}: ${item.name} (${slug})`,
        });
      }
    }
  }

  /** Creates a new entity page via LLM and writes it to the vault. */
  private async createEntityPage(
    entity: ExtractedEntity,
    slug: string,
    sourceRelativePath: string,
  ): Promise<void> {
    const systemPrompt = this.promptService.render('system-prompt', {});
    const today = new Date().toISOString().slice(0, 10);

    const createPrompt = this.promptService.render('create-entity', {
      entityName: entity.name,
      entityType: entity.entityType,
      description: entity.description,
      sourceContext: entity.sourceContext,
      slug,
      sourcePath: sourceRelativePath,
      claims: this.extractionResult.claims,
      relationships: this.extractionResult.relationships,
      openQuestions: this.extractionResult.openQuestions,
      today,
    });

    this.logger.info({ name: entity.name, slug }, 'Creating new entity page');
    const pageContent = await this.llmService.complete(createPrompt, systemPrompt);
    const dir = join(this.config.vaultPath, 'entities');
    await mkdir(dir, { recursive: true });
    const pagePath = join(dir, `${slug}.md`);
    await writeFile(pagePath, pageContent, 'utf-8');
    this.createdPages.push(`entities/${slug}.md`);
  }

  /** Creates a new concept page via LLM and writes it to the vault. */
  private async createConceptPage(
    concept: ExtractedConcept,
    slug: string,
    sourceRelativePath: string,
  ): Promise<void> {
    const systemPrompt = this.promptService.render('system-prompt', {});
    const today = new Date().toISOString().slice(0, 10);

    const createPrompt = this.promptService.render('create-concept', {
      conceptName: concept.name,
      domain: concept.domain,
      description: concept.description,
      sourceContext: concept.sourceContext,
      slug,
      sourcePath: sourceRelativePath,
      claims: this.extractionResult.claims,
      relationships: this.extractionResult.relationships,
      openQuestions: this.extractionResult.openQuestions,
      today,
    });

    this.logger.info({ name: concept.name, slug }, 'Creating new concept page');
    const pageContent = await this.llmService.complete(createPrompt, systemPrompt);
    const dir = join(this.config.vaultPath, 'concepts');
    await mkdir(dir, { recursive: true });
    const pagePath = join(dir, `${slug}.md`);
    await writeFile(pagePath, pageContent, 'utf-8');
    this.createdPages.push(`concepts/${slug}.md`);
  }

  /** Step 3: Writes a summary entry to the vault log. */
  private async writeLogEntry(): Promise<void> {
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
    actionParts.push(`${this.extractionResult.claims.length} claims`);
    actionParts.push(`${this.extractionResult.relationships.length} relationships`);

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
    this.logger.info({ logPath }, 'Log entry written');
  }

  /** Step 4: Triggers the compile operation — a separate operation that regenerates indices and dashboards. */
  private async triggerCompile(): Promise<void> {
    this.logger.info('Triggering compile operation');
    await this.compileService.compile();
  }

  /** Reads and parses index.md into a registry grouped by page type. */
  private async loadIndex(): Promise<Map<string, IndexEntry[]>> {
    const indexPath = join(this.config.vaultPath, 'index.md');
    let content: string;
    try {
      content = await readFile(indexPath, 'utf-8');
    } catch {
      this.logger.info('No index.md found, treating all elements as new pages');
      return new Map();
    }
    return parseIndex(content);
  }

  /** Slugifies a name for exact matching against index slugs. */
  private slugifyName(name: string): string {
    const id = this.identifier.createId('entity', name);
    return this.identifier.decomposeId(id).slug;
  }

  /**
   * Resolves extracted names to existing page slugs using two-phase lookup:
   * Phase 1 — exact slug match; Phase 2 — LLM-based semantic match.
   * Returns a map from name to matched slug, or null if no match was found.
   */
  private async resolveMatches(
    names: string[],
    entries: IndexEntry[],
    pageType: string,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const unmatchedNames: string[] = [];

    for (const name of names) {
      const candidateSlug = this.slugifyName(name);
      const found = entries.find((e) => e.slug === candidateSlug);
      if (found) {
        result.set(name, found.slug);
      } else {
        unmatchedNames.push(name);
      }
    }

    if (unmatchedNames.length > 0 && entries.length > 0) {
      this.logger.info(
        { pageType, unmatchedCount: unmatchedNames.length },
        'Running Phase 2 semantic match',
      );
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
    const systemPrompt = this.promptService.render('system-prompt', {});
    const prompt = this.promptService.render('match-pages', {
      pageType,
      unmatchedNames,
      indexEntries: entries.map((e) => ({
        slug: e.slug,
        title: e.title,
        summary: e.summary,
      })),
    });

    return this.llmService.generateStructured<SemanticMatchResult>({
      systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      schema: matchSchema,
      schemaName: 'SemanticMatchResult',
      schemaDescription:
        'Result of semantic matching between extracted names and existing wiki page summaries.',
    });
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

      entries.push({
        slug,
        title: slug,
        pageType,
        summary,
        path: `${path}.md`,
      });
    }

    result.set(pageType, entries);
  }

  return result;
}
