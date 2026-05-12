/** Specification: docs/operations/compile.md */

import type { PipelinePresentation } from '../pipeline-presentation';

/** Presentation callbacks required by the compile pipeline. */
export interface CompilePresentation extends PipelinePresentation {}

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
  create(config: CompileConfig, presentation: CompilePresentation): CompileService;
}
