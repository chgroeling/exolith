// Specification: docs/operations/ingest.md

import pino from 'pino';
import type { Logger } from 'pino';
import type { IdentifierService } from '../../core/identifier-service';
import type { LlmService } from '../../infrastructure/llm/llm-service';
import type { PromptService } from '../../infrastructure/prompt/prompt-service';
import type { IngestConfig, IngestPresentation, IngestService } from './ingest-service';

export class Ingest implements IngestService {
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
   * Runs the ingest pipeline on a source page from the vault.
   * @param sourceFilePath Absolute path to the source page in sources/
   */
  async process(sourceFilePath: string): Promise<void> {
    this.logger.info({ sourceFilePath }, 'Ingest process started');

    try {
      // 1. Extract entities, concepts, claims, relationships
      this.presentation.onStep('extracting');
      await this.extract(sourceFilePath);
      this.presentation.onStepComplete('extracting');

      // 2. Update all affected wiki pages
      this.presentation.onStep('updating');
      await this.updateWikiPages();
      this.presentation.onStepComplete('updating');

      // 3. Trigger compile step
      this.presentation.onStep('compiling');
      await this.triggerCompile();
      this.presentation.onStepComplete('compiling');

      // 4. Write log entry
      this.presentation.onStep('logging');
      await this.writeLogEntry();
      this.presentation.onStepComplete('logging');
    } catch (err) {
      this.logger.error({ sourceFilePath, err }, 'Ingest process failed');
      throw err;
    }
  }

  /** Step 1: Extracts structured knowledge — entities, concepts, claims, relationships, and open questions. */
  private async extract(_sourceFilePath: string): Promise<void> {}

  /** Step 2: Updates all wiki pages touched by the extracted knowledge. */
  private async updateWikiPages(): Promise<void> {}

  /** Step 3: Triggers compilation of index, backlinks, and dashboards. */
  private async triggerCompile(): Promise<void> {}

  /** Step 4: Writes a summary entry to the vault log. */
  private async writeLogEntry(): Promise<void> {}
}
