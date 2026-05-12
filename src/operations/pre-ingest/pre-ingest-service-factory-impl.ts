import type { IdentifierService } from '../../core/identifier-service';
import type { LlmService } from '../../infrastructure/llm/llm-service';
import type { PromptService } from '../../infrastructure/prompt/prompt-service';
import { PreIngest } from './pre-ingest';
import type {
  PreIngestConfig,
  PreIngestPresentation,
  PreIngestService,
  PreIngestServiceFactory,
} from './pre-ingest-service';

export class PreIngestServiceFactoryImpl implements PreIngestServiceFactory {
  constructor(
    private llmService: LlmService,
    private identifier: IdentifierService,
    private promptService: PromptService,
    private parentLogger?: import('pino').Logger,
  ) {}

  /** Creates a {@link PreIngestService} wired to this factory's dependencies. */
  create(config: PreIngestConfig, presentation: PreIngestPresentation): PreIngestService {
    return new PreIngest(
      this.llmService,
      this.identifier,
      this.promptService,
      config,
      presentation,
      this.parentLogger,
    );
  }
}
