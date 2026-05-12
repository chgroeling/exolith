import type {
  CompileConfig,
  CompilePresentation,
  CompileService,
  CompileServiceFactory,
} from './compile-service';
import { Compile } from './compile-service-impl';

export class CompileServiceFactoryImpl implements CompileServiceFactory {
  constructor(private parentLogger?: import('pino').Logger) {}

  /** Creates a {@link CompileService} wired to this factory's dependencies. */
  create(config: CompileConfig, presentation: CompilePresentation): CompileService {
    return new Compile(config, presentation, this.parentLogger);
  }
}
