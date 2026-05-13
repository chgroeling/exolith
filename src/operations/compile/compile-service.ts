/** Specification: docs/operations/compile.md */

import type { PipelineEvent, Question } from '../pipeline-presentation';

/** Configuration for a compile pipeline run. */
export interface CompileConfig {
  /** Path to the vault directory. */
  vaultPath: string;
}

/** Regenerates index.md, backlinks, dashboards, and machine-readable digests. */
export interface CompileService {
  compile(): Promise<void>;
}

/** Creates {@link CompileService} instances configured for a vault. */
export interface CompileServiceFactory {
  create(
    config: CompileConfig,
    emit: (event: PipelineEvent) => void,
    ask: <T>(question: Question<T>) => Promise<T>,
  ): CompileService;
}
