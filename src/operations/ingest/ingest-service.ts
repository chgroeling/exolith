/** The eight pipeline step transitions of an ingest run. */
export type IngestStep =
  | 'ExtractingStart'
  | 'ExtractingEnd'
  | 'UpdatingStart'
  | 'UpdatingEnd'
  | 'LoggingStart'
  | 'LoggingEnd'
  | 'CompilingStart'
  | 'CompilingEnd';

/** Context data passed with each step transition. */
export interface IngestStepData {
  /** Absolute path to the source page being processed. */
  sourceFilePath: string;
}

import type { PipelineEvent, Question } from '../pipeline-presentation';

/** Configuration for an ingest pipeline run. */
export interface IngestConfig {
  /** Path to the vault directory. */
  vaultPath: string;
}

/** Runs the ingest pipeline on a source page from the vault. */
export interface IngestService {
  process(sourceFilePath: string): Promise<void>;
}

/** Creates {@link IngestService} instances configured for a single file. */
export interface IngestServiceFactory {
  create(
    config: IngestConfig,
    emit: (event: PipelineEvent) => void,
    ask: <T>(question: Question<T>) => Promise<T>,
  ): IngestService;
}
