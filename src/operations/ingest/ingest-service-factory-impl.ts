import type { IdentifierService } from '../../core/identifier-service';
import type { LlmService } from '../../infrastructure/llm/llm-service';
import type { PromptService } from '../../infrastructure/prompt/prompt-service';
import type { CompileServiceFactory } from '../compile/compile-service';
import type { PipelineEvent, Question } from '../pipeline-presentation';
import type { IngestConfig, IngestService, IngestServiceFactory } from './ingest-service';
import { Ingest } from './ingest-service-impl';

/** Compile presentation that absorbs all callbacks into no-ops — used when the compile step is a stub. */
const noopEmit: (event: PipelineEvent) => void = () => {};
const noopAsk: <T>(question: Question<T>) => Promise<T> = <T>() =>
  Promise.resolve(undefined as unknown as T);

export class IngestServiceFactoryImpl implements IngestServiceFactory {
  constructor(
    private llmService: LlmService,
    private identifier: IdentifierService,
    private promptService: PromptService,
    private compileServiceFactory: CompileServiceFactory,
    private parentLogger?: import('pino').Logger,
  ) {}

  /** Creates an {@link IngestService} wired to this factory's dependencies. */
  create(
    config: IngestConfig,
    emit: (event: PipelineEvent) => void,
    ask: <T>(question: Question<T>) => Promise<T>,
  ): IngestService {
    const compileService = this.compileServiceFactory.create(
      { vaultPath: config.vaultPath },
      noopEmit,
      noopAsk,
    );
    return new Ingest(
      this.llmService,
      this.identifier,
      this.promptService,
      config,
      emit,
      ask,
      compileService,
      this.parentLogger,
    );
  }
}
