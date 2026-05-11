/** The three pipeline steps of a pre-ingest run. */
export type PreIngestStep = 'reading' | 'discussing' | 'writing-source';

/** Human-readable labels for each pre-ingest step. */
export const PRE_INGEST_STEP_LABELS: Record<PreIngestStep, string> = {
  reading: 'Reading raw source…',
  discussing: 'Discussing key takeaways…',
  'writing-source': 'Writing source page…',
};

/** Ordered list of all pre-ingest steps. */
export const PRE_INGEST_STEP_ORDER: PreIngestStep[] = ['reading', 'discussing', 'writing-source'];

/** Presentation callbacks required by the pre-ingest pipeline. */
export interface PreIngestPresentation {
  /** Invoked for each token chunk during LLM streaming. */
  onChunk(chunk: string): void;
  /** Invoked to read a single line of user input during interactive discussion. */
  readInput(): Promise<string>;
  /** Invoked to ask whether the user wants to enter the discussion step. */
  shouldDiscuss(): Promise<boolean>;
  /** Invoked when the pipeline enters a new step. */
  onStep(step: PreIngestStep): void;
  /** Invoked when a step completes successfully. */
  onStepComplete(step: PreIngestStep): void;
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
