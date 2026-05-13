/** Pipeline states for pre-ingest. */
export type PreIngestState =
  | 'ReadingStart'
  | 'ReadingEnd'
  | 'DiscussingStart'
  | 'DiscussingEnd'
  | 'StreamingStart'
  | 'StreamingEnd'
  | 'WaitingForInputStart'
  | 'WaitingForInputEnd'
  | 'DiscussionSummaryStart'
  | 'DiscussionSummaryEnd'
  | 'ExtractingSourcePageStart'
  | 'ExtractingSourcePageEnd'
  | 'SourcePageWriteStart'
  | 'SourcePageWritten';

import type { PipelineEvent, Question } from '../pipeline-presentation';

/** Context data passed with each state change. */
export interface PreIngestStateData {
  /** Name of the source file being processed. */
  fileName: string;
  /** Path to the written source page file. Only present in 'SourcePageWritten' state. */
  sourcePath?: string;
}

/** Configuration for a pre-ingest pipeline run. */
export interface PreIngestConfig {
  /** Maximum allowed source file size in bytes. */
  maxSourceSize: number;
  /** Path to the vault directory. */
  vaultPath: string;
  /** Skip the interactive discussion step when true. */
  skipDiscuss?: boolean;
}

/** Result of a successful pre-ingest pipeline run. */
export interface PreIngestResult {
  /** Absolute path to the written source page file. */
  sourcePath: string;
}

/** Runs the pre-ingest pipeline on a raw source file. */
export interface PreIngestService {
  process(filePath: string): Promise<PreIngestResult>;
}

/** Creates {@link PreIngestService} instances configured for a single file. */
export interface PreIngestServiceFactory {
  create(
    config: PreIngestConfig,
    emit: (event: PipelineEvent) => void,
    ask: <T>(question: Question<T>) => Promise<T>,
  ): PreIngestService;
}
