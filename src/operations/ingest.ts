// Specification: docs/operations/ingest.md

import { access, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import pino from 'pino';
import type { Logger } from 'pino';
import type { IdentifierService } from '../identifier-service';
import type { IngestConfig } from '../ingest-service';
import type { LlmService } from '../llm-service';
import type { PromptService } from '../prompt-service';

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.textile']);

export class Ingest {
  private rawContent = '';
  private filePath = '';
  private enrichedSourcePath = '';
  private logger: Logger;

  constructor(
    private llmService: LlmService,
    private identifier: IdentifierService,
    private promptService: PromptService,
    private config: IngestConfig,
    parentLogger?: Logger,
  ) {
    this.logger = parentLogger?.child({ name: 'ingest' }) ?? pino({ enabled: false });
  }

  /**
   * Runs the full ingest pipeline on a raw source file.
   * @param filePath Absolute path to the raw source file
   */
  async process(filePath: string): Promise<void> {
    this.filePath = filePath;
    this.logger.info({ filePath }, 'Ingest process started');

    // 1. Read raw source completely
    await this.readRawSource();

    // 2. Discuss key takeaways with the human
    await this.discussKeyTakeaways();

    // 3. Write source page
    await this.writeSourcePage();

    // 4. Extract entities, concepts, claims, relationships
    await this.extract();

    // 5. Update all affected wiki pages
    await this.updateWikiPages();

    // 6. Trigger compile step
    await this.triggerCompile();

    // 7. Write log entry
    await this.writeLogEntry();
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
    await session.stream(this.config.onChunk ?? (() => {}));

    let turn = 1;
    while (this.config.readInput) {
      const input = await this.config.readInput();
      if (!input) break;

      turn++;
      this.logger.trace({ turn, input }, 'Discussion: received user input');
      session.addUserMessage(input);
      this.logger.debug({ filePath: this.filePath, turn }, 'Discussion: sending follow-up');
      await session.stream(this.config.onChunk ?? (() => {}));
    }

    this.logger.info(
      { filePath: this.filePath, turns: turn },
      'Discussion ended, summarizing feedback',
    );
    const summary = await this.summarizeDiscussion(session.getMessages());
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
    const humanMessages = messages.slice(2);

    const prompt = this.promptService.render('summarize-discussion', {
      humanMessages: humanMessages.map((m) => m.content).join('\n\n'),
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
  private async writeSourcePage(): Promise<void> {}

  /** Step 4: Extracts structured knowledge — entities, concepts, claims, relationships, and open questions. */
  private async extract(): Promise<void> {}

  /** Step 5: Updates all wiki pages touched by the extracted knowledge. */
  private async updateWikiPages(): Promise<void> {}

  /** Step 6: Triggers compilation of index, backlinks, and dashboards. */
  private async triggerCompile(): Promise<void> {}

  /** Step 7: Writes a summary entry to the vault log. */
  private async writeLogEntry(): Promise<void> {}
}
