import type { IdentifierService } from '../../core/identifier-service';
import type { LlmService } from '../../infrastructure/llm/llm-service';
import type { PromptService } from '../../infrastructure/prompt/prompt-service';
import type { CompilePresentation, CompileServiceFactory } from '../compile/compile-service';
import type { PipelinePresentation } from '../pipeline-presentation';
import type { IngestConfig, IngestService, IngestServiceFactory } from './ingest-service';
import { Ingest } from './ingest-service-impl';

/** Compile presentation that absorbs all callbacks into no-ops — used when the compile step is a stub. */
const noopCompilePresentation: CompilePresentation = {
  onStep: () => {},
  onSubStep: () => {},
  onChunk: () => {},
  readInput: () => Promise.resolve(''),
  shouldDiscuss: () => Promise.resolve(true),
  onError: () => {},
};

export class IngestServiceFactoryImpl implements IngestServiceFactory {
  constructor(
    private llmService: LlmService,
    private identifier: IdentifierService,
    private promptService: PromptService,
    private compileServiceFactory: CompileServiceFactory,
    private parentLogger?: import('pino').Logger,
  ) {}

  /** Creates an {@link IngestService} wired to this factory's dependencies. */
  create(config: IngestConfig, presentation: PipelinePresentation): IngestService {
    const compileService = this.compileServiceFactory.create(
      { vaultPath: config.vaultPath },
      noopCompilePresentation,
    );
    return new Ingest(
      this.llmService,
      this.identifier,
      this.promptService,
      config,
      presentation,
      compileService,
      this.parentLogger,
    );
  }
}
