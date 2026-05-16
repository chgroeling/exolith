import type { IdentifierService } from '../../core/identifier-service';
import type { LlmService } from '../../infrastructure/llm/llm-service';
import type { PromptService } from '../../infrastructure/prompt/prompt-service';
import type { PipelineEvent, Question } from '../pipeline-presentation';
import type { EnqueueConfig, EnqueueService, EnqueueServiceFactory } from './enqueue-service';
import { Enqueue } from './enqueue-service-impl';

export class EnqueueServiceFactoryImpl implements EnqueueServiceFactory {
  constructor(
    private llmService: LlmService,
    private identifier: IdentifierService,
    private promptService: PromptService,
    private parentLogger?: import('pino').Logger,
  ) {}

  /** Creates a {@link EnqueueService} wired to this factory's dependencies. */
  create(
    config: EnqueueConfig,
    emit: (event: PipelineEvent) => void,
    ask: <T>(question: Question<T>) => Promise<T>,
  ): EnqueueService {
    return new Enqueue(
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
