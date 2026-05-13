import type { IdentifierService } from '../../core/identifier-service';
import type { LlmService } from '../../infrastructure/llm/llm-service';
import type { PromptService } from '../../infrastructure/prompt/prompt-service';
import type { PipelineEvent, Question } from '../pipeline-presentation';
import type {
  PreIngestConfig,
  PreIngestService,
  PreIngestServiceFactory,
} from './pre-ingest-service';
import { PreIngest } from './pre-ingest-service-impl';

export class PreIngestServiceFactoryImpl implements PreIngestServiceFactory {
  constructor(
    private llmService: LlmService,
    private identifier: IdentifierService,
    private promptService: PromptService,
    private parentLogger?: import('pino').Logger,
  ) {}

  /** Creates a {@link PreIngestService} wired to this factory's dependencies. */
  create(
    config: PreIngestConfig,
    emit: (event: PipelineEvent) => void,
    ask: <T>(question: Question<T>) => Promise<T>,
  ): PreIngestService {
    return new PreIngest(
      this.llmService,
      this.identifier,
      this.promptService,
      config,
      emit,
      ask,
      this.parentLogger,
    );
  }
}
