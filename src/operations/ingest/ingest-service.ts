/** The seven pipeline steps of an ingest run. */
export type IngestStep =
  | 'reading'
  | 'discussing'
  | 'writing-source'
  | 'extracting'
  | 'updating'
  | 'compiling'
  | 'logging';

/** Human-readable labels for each ingest step. */
export const INGEST_STEP_LABELS: Record<IngestStep, string> = {
  reading: 'Reading raw source…',
  discussing: 'Discussing key takeaways…',
  'writing-source': 'Writing source page…',
  extracting: 'Extracting knowledge…',
  updating: 'Updating wiki pages…',
  compiling: 'Compiling…',
  logging: 'Writing log entry…',
};

/** Ordered list of all ingest steps. */
export const INGEST_STEP_ORDER: IngestStep[] = [
  'reading',
  'discussing',
  'writing-source',
  'extracting',
  'updating',
  'compiling',
  'logging',
];

/** Presentation callbacks required by the ingest pipeline. */
export interface IngestPresentation {
  /** Invoked for each token chunk during LLM streaming. */
  onChunk(chunk: string): void;
  /** Invoked to read a single line of user input during interactive discussion. */
  readInput(): Promise<string>;
  /** Invoked when the pipeline enters a new step. */
  onStep(step: IngestStep): void;
  /** Invoked when a step completes successfully. */
  onStepComplete(step: IngestStep): void;
}

/** Configuration for an ingest pipeline run. */
export interface IngestConfig {
  /** Maximum allowed source file size in bytes. */
  maxSourceSize: number;
  /** Path to the vault directory. */
  vaultPath: string;
}

/** Runs the full ingest pipeline on a raw source file. */
export interface IngestService {
  process(filePath: string): Promise<void>;
}

/** Creates {@link IngestService} instances configured for a single file. */
export interface IngestServiceFactory {
  create(config: IngestConfig, presentation: IngestPresentation): IngestService;
}
