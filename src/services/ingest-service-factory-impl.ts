import type { Logger } from 'pino';
import type { IdentifierService } from '../identifier-service';
import type { IngestConfig, IngestService, IngestServiceFactory } from '../ingest-service';
import type { LlmService } from '../llm-service';
import { Ingest } from '../operations/ingest';
import type { PromptService } from '../prompt-service';

export class IngestServiceFactoryImpl implements IngestServiceFactory {
  constructor(
    private llmService: LlmService,
    private identifier: IdentifierService,
    private promptService: PromptService,
    private parentLogger?: Logger,
  ) {}

  /** Creates an {@link IngestService} wired to this factory's dependencies. */
  create(config: IngestConfig): IngestService {
    return new Ingest(
      this.llmService,
      this.identifier,
      this.promptService,
      config,
      this.parentLogger,
    );
  }
}
