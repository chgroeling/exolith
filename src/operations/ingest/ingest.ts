// Specification: docs/operations/ingest.md

import { access, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import pino from 'pino';
import type { Logger } from 'pino';
import type { IdentifierService } from '../../core/identifier-service';
import type { LlmService } from '../../infrastructure/llm/llm-service';
import type { PromptService } from '../../infrastructure/prompt/prompt-service';
import type { IngestConfig, IngestPresentation, IngestService } from './ingest-service';

/** Structured output from the LLM for a source page. */
interface SourcePage {
  title: string;
  type: string;
  authors: string;
  date: string;
  urlOrReference: string;
  summary: string;
  mainPoints: string[];
  keyTakeaways: string[];
  tags: string[];
}

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.textile']);

export class Ingest implements IngestService {
  private rawContent = '';
  private filePath = '';
  private enrichedSourcePath = '';
  private discussionSummary = '';
  private logger: Logger;

  constructor(
    private llmService: LlmService,
    private identifier: IdentifierService,
    private promptService: PromptService,
    private config: IngestConfig,
    private presentation: IngestPresentation,
    parentLogger?: Logger,
  ) {
    this.logger = parentLogger?.child({ logger: 'ingest' }) ?? pino({ enabled: false });
  }

  /**
   * Runs the full ingest pipeline on a raw source file.
   * @param filePath Absolute path to the raw source file
   */
  async process(filePath: string): Promise<void> {
    this.filePath = filePath;
    this.logger.info({ filePath }, 'Ingest process started');

    try {
      // 1. Read raw source completely
      this.presentation.onStep('reading');
      await this.readRawSource();
      this.presentation.onStepComplete('reading');

      // 2. Discuss key takeaways with the human
      this.presentation.onStep('discussing');
      await this.discussKeyTakeaways();
      this.presentation.onStepComplete('discussing');

      // 3. Write source page
      this.presentation.onStep('writing-source');
      await this.writeSourcePage();
      this.presentation.onStepComplete('writing-source');

      // 4. Extract entities, concepts, claims, relationships
      this.presentation.onStep('extracting');
      await this.extract();
      this.presentation.onStepComplete('extracting');

      // 5. Update all affected wiki pages
      this.presentation.onStep('updating');
      await this.updateWikiPages();
      this.presentation.onStepComplete('updating');

      // 6. Trigger compile step
      this.presentation.onStep('compiling');
      await this.triggerCompile();
      this.presentation.onStepComplete('compiling');

      // 7. Write log entry
      this.presentation.onStep('logging');
      await this.writeLogEntry();
      this.presentation.onStepComplete('logging');
    } catch (err) {
      this.logger.error({ filePath, err }, 'Ingest process failed');
      throw err;
    }
  }

  /**
   * Validates and reads the raw source file into memory.
   * Checks: file existence, supported text extension, size limit, binary detection.
   */
  private async readRawSource(): Promise<void> {
    const { filePath } = this;
    await access(filePath);
    this.logger.info({ filePath }, 'File exists, reading raw source');

    const ext = extname(filePath).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) {
      throw new Error(
        `Unsupported file type: ${ext}. Must be one of: ${[...TEXT_EXTENSIONS].join(', ')}`,
      );
    }

    const stats = await stat(filePath);
    if (stats.size > this.config.maxSourceSize) {
      throw new Error(
        `Source file exceeds maximum size (${stats.size} > ${this.config.maxSourceSize} bytes)`,
      );
    }

    const buffer = await readFile(filePath);
    if (buffer.includes(0)) {
      throw new Error('Source file appears to be binary');
    }

    this.rawContent = buffer.toString('utf-8');
    this.logger.info({ filePath, size: buffer.length }, 'Raw source read successfully');
  }

  /**
   * Interactive discussion loop with the human.
   * After the discussion, summarizes the human's feedback and archives the enriched source.
   */
  private async discussKeyTakeaways(): Promise<void> {
    this.logger.info({ filePath: this.filePath }, 'Starting discussion step');

    const systemPrompt = this.promptService.render('system-prompt', {});

    const initialPrompt = this.promptService.render('discuss-key-takeaways', {
      filePath: this.filePath,
      rawContent: this.rawContent,
    });

    const session = this.llmService.createSession(systemPrompt);
    session.addUserMessage(initialPrompt);

    this.logger.debug({ filePath: this.filePath }, 'Discussion: sending initial prompt');
    let response = '';
    await session.stream((chunk) => {
      response += chunk;
      this.presentation.onChunk(chunk);
    });
    session.addAssistantMessage(response);

    let turn = 1;
    while (true) {
      const input = await this.presentation.readInput();
      if (!input) break;

      turn++;
      this.logger.trace({ turn, input }, 'Discussion: received user input');
      session.addUserMessage(input);
      this.logger.debug({ filePath: this.filePath, turn }, 'Discussion: sending follow-up');
      response = '';
      await session.stream((chunk) => {
        response += chunk;
        this.presentation.onChunk(chunk);
      });
      session.addAssistantMessage(response);
    }

    this.logger.info(
      { filePath: this.filePath, turns: turn },
      'Discussion ended, summarizing feedback',
    );
    const summary = await this.summarizeDiscussion(session.getMessages());
    this.discussionSummary = summary;
    await this.archiveToRawSources(summary);

    this.logger.info(
      { filePath: this.filePath, enrichedPath: this.enrichedSourcePath },
      'Discussion step completed',
    );
  }

  /**
   * Asks the LLM to extract the human's key feedback from the full discussion.
   */
  private async summarizeDiscussion(
    messages: readonly {
      role: string;
      content: string;
    }[],
  ): Promise<string> {
    const systemPrompt = this.promptService.render('system-prompt', {});
    const discussionMessages = messages
      .slice(2)
      .filter((m) => m.role === 'user' || m.role === 'assistant');

    this.logger.trace({ discussionMessages }, 'Summarization input');

    const prompt = this.promptService.render('summarize-discussion', {
      messages: discussionMessages.map((m) => ({
        role: m.role === 'assistant' ? 'Assistant' : 'User',
        content: m.content,
      })),
    });

    this.logger.debug('Summarizing discussion feedback');
    const result = await this.llmService.complete(prompt, systemPrompt);
    this.logger.trace({ summary: result }, 'Discussion summary generated');
    return result;
  }

  /**
   * Copies the raw source file to raw-sources/ and appends the discussion summary.
   */
  private async archiveToRawSources(summary: string): Promise<void> {
    const rawSourcesDir = `${this.config.vaultPath}/raw-sources`;
    await mkdir(rawSourcesDir, { recursive: true });

    const destPath = `${rawSourcesDir}/${basename(this.filePath)}`;
    await copyFile(this.filePath, destPath);
    this.logger.info({ destPath }, 'Copied raw source to raw-sources');

    const archiveContent = `${this.rawContent}\n\n---\n\n# Discussion Summary\n\n${summary}\n`;
    await writeFile(destPath, archiveContent, 'utf-8');
    this.logger.info({ destPath }, 'Appended discussion summary');

    this.enrichedSourcePath = destPath;
  }

  /** Step 3: Writes a processed source page to the vault. */
  private async writeSourcePage(): Promise<void> {
    const systemPrompt = this.promptService.render('system-prompt', {});
    const fileName = basename(this.filePath);

    const prompt = this.promptService.render('create-source-page', {
      filePath: this.filePath,
      fileName,
      rawContent: this.rawContent,
      discussionSummary: this.discussionSummary,
    });

    this.logger.info({ filePath: this.filePath }, 'Generating source page from LLM');

    const sourcePage = await this.llmService.generateStructured<SourcePage>({
      systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          type: { type: 'string', enum: ['article', 'paper', 'transcript', 'note', 'book'] },
          authors: { type: 'string' },
          date: { type: 'string' },
          urlOrReference: { type: 'string' },
          summary: { type: 'string' },
          mainPoints: { type: 'array', items: { type: 'string' } },
          keyTakeaways: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: [
          'title',
          'type',
          'authors',
          'date',
          'summary',
          'mainPoints',
          'keyTakeaways',
          'tags',
        ],
        additionalProperties: false,
      },
      schemaName: 'SourcePage',
      schemaDescription: 'A processed source page for the wiki vault.',
    });

    const sourceId = this.identifier.createId('source', sourcePage.title);
    const slug = this.identifier.decomposeId(sourceId).slug;
    const sourceDir = join(this.config.vaultPath, 'sources');
    await mkdir(sourceDir, { recursive: true });

    const today = new Date().toISOString().slice(0, 10);
    const tagLines = sourcePage.tags.map((t) => `  - ${t}`);

    const content = [
      '---',
      `id: ${sourceId}`,
      `title: ${sourcePage.title}`,
      'status: active',
      'tags:',
      ...tagLines,
      `created: ${today}`,
      `updated: ${today}`,
      '---',
      '',
      `# ${sourcePage.title}`,
      '',
      `*Type:* ${sourcePage.type}`,
      `*Author(s):* ${sourcePage.authors}`,
      `*Date:* ${sourcePage.date}`,
      `*URL/Reference:* ${sourcePage.urlOrReference || '-'}`,
      `*Original File:* [[raw-sources/${fileName}]]`,
      '',
      '## Summary',
      sourcePage.summary,
      '',
      '## Main Points',
      ...sourcePage.mainPoints.map((p) => `- ${p}`),
      '',
      '## Key Takeaways',
      ...sourcePage.keyTakeaways.map((k) => `- ${k}`),
      '',
      '## Linked Wiki Pages',
      '',
    ].join('\n');

    const sourcePath = join(sourceDir, `${slug}.md`);
    await writeFile(sourcePath, content, 'utf-8');
    this.logger.info({ sourcePath }, 'Source page written');
  }

  /** Step 4: Extracts structured knowledge — entities, concepts, claims, relationships, and open questions. */
  private async extract(): Promise<void> { }

  /** Step 5: Updates all wiki pages touched by the extracted knowledge. */
  private async updateWikiPages(): Promise<void> { }

  /** Step 6: Triggers compilation of index, backlinks, and dashboards. */
  private async triggerCompile(): Promise<void> { }

  /** Step 7: Writes a summary entry to the vault log. */
  private async writeLogEntry(): Promise<void> { }
}
