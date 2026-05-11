/** Pipeline states for pre-ingest. */
export type PreIngestState =
  | 'reading'
  | 'discussing'
  | 'discussion-summary'
  | 'extracting-source-page'
  | 'source-page-written';

/** Context data passed with each state change. */
export interface PreIngestStateData {
  /** Name of the source file being processed. */
  fileName: string;
  /** Path to the written source page file. Only present in 'source-page-written' state. */
  sourcePath?: string;
}

/** Presentation callbacks required by the pre-ingest pipeline. */
export interface PreIngestPresentation {
  /** Invoked for each token chunk during LLM streaming. */
  onChunk(chunk: string): void;
  /** Invoked to read a single line of user input during interactive discussion. */
  readInput(): Promise<string>;
  /** Invoked to ask whether the user wants to enter the discussion step. */
  shouldDiscuss(): Promise<boolean>;
  /** Invoked when the pipeline transitions to a new state. */
  onStateChange(state: PreIngestState, data: PreIngestStateData): void;
}

/** Configuration for a pre-ingest pipeline run. */
export interface PreIngestConfig {
  /** Maximum allowed source file size in bytes. */
  maxSourceSize: number;
  /** Path to the vault directory. */
  vaultPath: string;
}

/** Runs the pre-ingest pipeline on a raw source file. */
export interface PreIngestService {
  process(filePath: string): Promise<void>;
}

/** Creates {@link PreIngestService} instances configured for a single file. */
export interface PreIngestServiceFactory {
  create(config: PreIngestConfig, presentation: PreIngestPresentation): PreIngestService;
}
