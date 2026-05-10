import type { IdentifierService } from '../../core/identifier-service';
import type { LlmService } from '../../infrastructure/llm/llm-service';
import type { PromptService } from '../../infrastructure/prompt/prompt-service';
import { Ingest } from './ingest';
import type {
  IngestConfig,
  IngestPresentation,
  IngestService,
  IngestServiceFactory,
} from './ingest-service';

export class IngestServiceFactoryImpl implements IngestServiceFactory {
  constructor(
    private llmService: LlmService,
    private identifier: IdentifierService,
    private promptService: PromptService,
    private parentLogger?: import('pino').Logger,
  ) {}

  /** Creates an {@link IngestService} wired to this factory's dependencies. */
  create(config: IngestConfig, presentation: IngestPresentation): IngestService {
    return new Ingest(
      this.llmService,
      this.identifier,
      this.promptService,
      config,
      presentation,
      this.parentLogger,
    );
  }
}
