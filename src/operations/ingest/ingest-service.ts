/** The four pipeline steps of an ingest run. */
export type IngestStep = 'extracting' | 'updating' | 'compiling' | 'logging';

/** Human-readable labels for each ingest step. */
export const INGEST_STEP_LABELS: Record<IngestStep, string> = {
  extracting: 'Extracting knowledge…',
  updating: 'Updating wiki pages…',
  logging: 'Writing log entry…',
  compiling: 'Compiling…',
};

/** Ordered list of all ingest steps. */
export const INGEST_STEP_ORDER: IngestStep[] = ['extracting', 'updating', 'logging', 'compiling'];

/** Presentation callbacks required by the ingest pipeline. */
export interface IngestPresentation {
  /** Invoked when the pipeline enters a new step. */
  onStep(step: IngestStep): void;
  /** Invoked when a step completes successfully. */
  onStepComplete(step: IngestStep): void;
}

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
  create(config: IngestConfig, presentation: IngestPresentation): IngestService;
}
