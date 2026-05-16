// Specification: docs/operations/enqueue.md

import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import pino from 'pino';
import type { Logger } from 'pino';
import type { IdentifierService } from '../../core/identifier-service';
import { loadSchemaFile } from '../../core/schema-loader';
import type { LlmService } from '../../infrastructure/llm/llm-service';
import type { PromptService } from '../../infrastructure/prompt/prompt-service';
import type { PipelineEvent, Question } from '../pipeline-presentation';
import type { EnqueueConfig, EnqueueResult, EnqueueService } from './enqueue-service';

/** Structured output from the LLM for a source page. */
interface SourcePage {
  title: string;
  type: string;
  authors: string[];
  date: string;
  reference: string;
  summary: string;
  mainPoints: string[];
  tags: string[];
}

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.textile']);

const sourcePageSchema = loadSchemaFile<{ properties: Record<string, unknown> }>(
  'source-page.schema.json',
);

const sourcePagePropertyKeys = Object.keys(sourcePageSchema.properties);

export class Enqueue implements EnqueueService {
  private rawContent = '';
  private filePath = '';
  private discussionSummary = '';
  private logger: Logger;

  constructor(
    private llmService: LlmService,
    private identifier: IdentifierService,
    private promptService: PromptService,
    private config: EnqueueConfig,
    private emit: (event: PipelineEvent) => void,
    private ask: <T>(question: Question<T>) => Promise<T>,
    parentLogger?: Logger,
  ) {
    this.logger = parentLogger?.child({ logger: 'enqueue' }) ?? pino({ enabled: false });
  }

  /**
   * Runs the full enqueue pipeline on a raw source file.
   * @param filePath Absolute path to the raw source file
   */
  async process(filePath: string): Promise<EnqueueResult> {
    this.filePath = filePath;
    this.logger.info({ filePath }, 'Enqueue process started');

    try {
      await this.readRawSource();

      let shouldDiscuss = false;
      if (!this.config.skipDiscuss) {
        shouldDiscuss = await this.ask<boolean>({
          message: 'Would you like to discuss the key takeaways with the LLM?',
          initial: true,
        });
      }

      if (shouldDiscuss) {
        const messages = await this.runDiscussion();
        this.discussionSummary = await this.summarizeDiscussion(messages);
      }

      const sourcePage = await this.extractSourcePage();

      // 5. Write source page to disk
      const sourcePath = await this.writeSourcePageToDisk(sourcePage);
      return { sourcePath };
    } catch (err) {
      this.emit({ type: 'error', error: err as Error });
      this.logger.error({ filePath, err }, 'Enqueue process failed');
      throw err;
    }
  }

  /**
   * Validates and reads the raw source file into memory.
   * Checks: file existence, supported text extension, size limit, binary detection.
   */
  private async readRawSource(): Promise<void> {
    const { filePath } = this;
    this.emit({
      type: 'step_start',
      step: 'Reading',
      data: { fileName: basename(this.filePath) },
    });
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
    this.emit({ type: 'step_end', step: 'Reading' });
  }

  /**
   * Interactive discussion loop with the human.
   * Returns the full session messages for later summarization.
   */
  private async runDiscussion(): Promise<readonly { role: string; content: string }[]> {
    this.logger.info({ filePath: this.filePath }, 'Starting discussion step');
    this.emit({
      type: 'step_start',
      step: 'Discussing',
      data: { fileName: basename(this.filePath) },
    });

    const systemPrompt = this.promptService.render('system-prompt', {});

    const initialPrompt = this.promptService.render('discuss-key-takeaways', {
      filePath: this.filePath,
      rawContent: this.rawContent,
    });

    const session = this.llmService.createSession(systemPrompt);
    session.addUserMessage(initialPrompt);

    this.logger.debug({ filePath: this.filePath }, 'Discussion: sending initial prompt');
    let response = '';
    this.emit({ type: 'step_start', step: 'Streaming' });
    await session.stream((chunk) => {
      response += chunk;
      this.emit({ type: 'stream', chunk });
    });
    session.addAssistantMessage(response);
    this.emit({ type: 'step_end', step: 'Streaming' });

    let turn = 1;
    while (true) {
      this.emit({ type: 'step_start', step: 'WaitingForInput' });
      const input = await new Promise<string>((resolve) => {
        this.emit({
          type: 'input_required',
          prompt: 'Your response (press Enter on empty to finish)',
          resolve,
        });
      });
      if (!input) break;

      this.emit({ type: 'step_end', step: 'WaitingForInput' });

      turn++;
      this.logger.trace({ turn, input }, 'Discussion: received user input');
      session.addUserMessage(input);
      this.logger.debug({ filePath: this.filePath, turn }, 'Discussion: sending follow-up');
      response = '';
      this.emit({ type: 'step_start', step: 'Streaming' });
      await session.stream((chunk) => {
        response += chunk;
        this.emit({ type: 'stream', chunk });
      });
      session.addAssistantMessage(response);
      this.emit({ type: 'step_end', step: 'Streaming' });
    }

    this.logger.info({ filePath: this.filePath, turns: turn }, 'Discussion ended');
    this.emit({ type: 'step_end', step: 'Discussing' });
    return session.getMessages();
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

  /** Calls the LLM to extract structured source page data from the raw content. */
  private async extractSourcePage(): Promise<SourcePage> {
    const systemPrompt = this.promptService.render('system-prompt', {});
    const fileName = basename(this.filePath);
    this.emit({ type: 'step_start', step: 'ExtractingSourcePage' });

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
      schema: sourcePageSchema,
      schemaName: 'SourcePage',
      schemaDescription: 'A processed source page for the wiki vault.',
    });

    this.emit({ type: 'step_end', step: 'ExtractingSourcePage' });
    return sourcePage;
  }

  /** Formats and writes the extracted source page to the vault. */
  private async writeSourcePageToDisk(sourcePage: SourcePage): Promise<string> {
    const fileName = basename(this.filePath);
    this.emit({ type: 'step_start', step: 'SourcePageWrite' });
    const sourceId = this.identifier.createId('source', sourcePage.title);
    const slug = this.identifier.decomposeId(sourceId).slug;
    const sourceDir = join(this.config.vaultPath, 'inbox');
    await mkdir(sourceDir, { recursive: true });

    const today = new Date().toISOString().slice(0, 10);

    const context: Record<string, unknown> = {
      id: sourceId,
      created: today,
      updated: today,
      fileName,
    };
    for (const key of sourcePagePropertyKeys) {
      context[key] = (sourcePage as unknown as Record<string, unknown>)[key];
    }
    const content = this.promptService.render('source-page-output', context);

    const sourcePath = join(sourceDir, `${slug}.md`);
    await writeFile(sourcePath, content, 'utf-8');
    this.logger.info({ sourcePath }, 'Source page written');

    this.emit({
      type: 'step_end',
      step: 'SourcePageWrite',
      data: { fileName: basename(this.filePath), sourcePath },
    });
    return sourcePath;
  }
}
