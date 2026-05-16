/** Pipeline states for enqueue. */
export type EnqueueState =
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
export interface EnqueueStateData {
  /** Name of the source file being processed. */
  fileName: string;
  /** Path to the written source page file. Only present in 'SourcePageWritten' state. */
  sourcePath?: string;
}

/** Configuration for an enqueue pipeline run. */
export interface EnqueueConfig {
  /** Maximum allowed source file size in bytes. */
  maxSourceSize: number;
  /** Path to the vault directory. */
  vaultPath: string;
  /** Skip the interactive discussion step when true. */
  skipDiscuss?: boolean;
}

/** Result of a successful enqueue pipeline run. */
export interface EnqueueResult {
  /** Absolute path to the written source page file. */
  sourcePath: string;
}

/** Runs the enqueue pipeline on a raw source file. */
export interface EnqueueService {
  process(filePath: string): Promise<EnqueueResult>;
}

/** Creates {@link EnqueueService} instances configured for a single file. */
export interface EnqueueServiceFactory {
  create(
    config: EnqueueConfig,
    emit: (event: PipelineEvent) => void,
    ask: <T>(question: Question<T>) => Promise<T>,
  ): EnqueueService;
}
