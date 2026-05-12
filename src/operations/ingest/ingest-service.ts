/** The four pipeline steps of an ingest run. */
export type IngestStep = 'extracting' | 'updating' | 'compiling' | 'logging';

/** Context data passed with each step transition. */
export interface IngestStepData {
  /** Absolute path to the source page being processed. */
  sourceFilePath: string;
}

/** Presentation callbacks required by the ingest pipeline. */
export interface IngestPresentation {
  /** Invoked when the pipeline enters a new step. */
  onStep(step: IngestStep, data: IngestStepData): void;
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
