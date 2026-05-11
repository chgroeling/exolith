// Specification: docs/operations/pre-ingest.md

import { access, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import pino from 'pino';
import type { Logger } from 'pino';
import type { IdentifierService } from '../../core/identifier-service';
import type { LlmService } from '../../infrastructure/llm/llm-service';
import type { PromptService } from '../../infrastructure/prompt/prompt-service';
import type {
  PreIngestConfig,
  PreIngestPresentation,
  PreIngestService,
} from './pre-ingest-service';

/** Structured output from the LLM for a source page. */
interface SourcePage {
  title: string;
  type: string;
  authors: string;
  date: string;
  urlOrReference: string;
  summary: string;
  mainPoints: string[];
  tags: string[];
}

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.textile']);

export class PreIngest implements PreIngestService {
  private rawContent = '';
  private filePath = '';
  private enrichedSourcePath = '';
  private discussionSummary = '';
  private logger: Logger;

  constructor(
    private llmService: LlmService,
    private identifier: IdentifierService,
    private promptService: PromptService,
    private config: PreIngestConfig,
    private presentation: PreIngestPresentation,
    parentLogger?: Logger,
  ) {
    this.logger = parentLogger?.child({ logger: 'pre-ingest' }) ?? pino({ enabled: false });
  }

  /**
   * Runs the full pre-ingest pipeline on a raw source file.
   * @param filePath Absolute path to the raw source file
   */
  async process(filePath: string): Promise<void> {
    this.filePath = filePath;
    this.logger.info({ filePath }, 'Pre-ingest process started');

    try {
      // 1. Read raw source completely
      this.presentation.onStateChange('reading', { fileName: basename(this.filePath) });
      await this.readRawSource();

      // 2. Discuss key takeaways with the human (skippable)
      this.presentation.onStateChange('discussing', { fileName: basename(this.filePath) });
      const shouldDiscuss = await this.presentation.shouldDiscuss();
      if (shouldDiscuss) {
        const messages = await this.discussKeyTakeaways();

        // 3. Summarize the discussion
        this.presentation.onStateChange('discussion-summary', {
          fileName: basename(this.filePath),
        });
        await this.summarizeAndArchive(messages);
      }

      // 4. Extract structured source page from LLM
      this.presentation.onStateChange('extracting-source-page', {
        fileName: basename(this.filePath),
      });
      const sourcePage = await this.extractSourcePage();

      // 5. Write source page to disk
      const sourcePath = await this.writeSourcePageToDisk(sourcePage);
    } catch (err) {
      this.logger.error({ filePath, err }, 'Pre-ingest process failed');
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
   * Returns the full session messages for later summarization.
   */
  private async discussKeyTakeaways(): Promise<readonly { role: string; content: string }[]> {
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

    this.logger.info({ filePath: this.filePath, turns: turn }, 'Discussion ended');
    return session.getMessages();
  }

  /**
   * Summarizes the discussion feedback and archives the enriched source to raw-sources/.
   */
  private async summarizeAndArchive(
    messages: readonly { role: string; content: string }[],
  ): Promise<void> {
    this.logger.info({ filePath: this.filePath }, 'Summarizing discussion feedback');
    const summary = await this.summarizeDiscussion(messages);
    this.discussionSummary = summary;
    await this.archiveToRawSources(summary);

    this.logger.info(
      { filePath: this.filePath, enrichedPath: this.enrichedSourcePath },
      'Discussion summarization complete',
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
      messages: discussionMessages
        .map((m) =>
          JSON.stringify({
            role: m.role === 'assistant' ? 'Assistant' : 'User',
            content: m.content,
          }),
        )
        .join('\n'),
    });

    this.logger.trace({ prompt: prompt }, 'Summarization prompt rendered');
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

  /** Calls the LLM to extract structured source page data from the raw content. */
  private async extractSourcePage(): Promise<SourcePage> {
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
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'type', 'authors', 'date', 'summary', 'mainPoints', 'tags'],
        additionalProperties: false,
      },
      schemaName: 'SourcePage',
      schemaDescription: 'A processed source page for the wiki vault.',
    });

    return sourcePage;
  }

  /** Formats and writes the extracted source page to the vault. */
  private async writeSourcePageToDisk(sourcePage: SourcePage): Promise<string> {
    const fileName = basename(this.filePath);
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
      '## Linked Wiki Pages',
      '',
    ].join('\n');

    const sourcePath = join(sourceDir, `${slug}.md`);
    await writeFile(sourcePath, content, 'utf-8');
    this.logger.info({ sourcePath }, 'Source page written');

    this.presentation.onStateChange('source-page-written', {
      fileName: basename(this.filePath),
      sourcePath,
    });
    return sourcePath;
  }
}
