import type { PipelineEvent, Question } from '../pipeline-presentation';
import type { CompileConfig, CompileService, CompileServiceFactory } from './compile-service';
import { Compile } from './compile-service-impl';

export class CompileServiceFactoryImpl implements CompileServiceFactory {
  constructor(private parentLogger?: import('pino').Logger) {}

  /** Creates a {@link CompileService} wired to this factory's dependencies. */
  create(
    config: CompileConfig,
    emit: (event: PipelineEvent) => void,
    ask: <T>(question: Question<T>) => Promise<T>,
  ): CompileService {
    return new Compile(config, emit, ask, this.parentLogger);
  }
}
