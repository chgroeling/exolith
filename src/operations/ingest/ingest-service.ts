/** Presentation callbacks required by the ingest pipeline. */
export interface IngestPresentation {
  /** Invoked for each token chunk during LLM streaming. */
  onChunk(chunk: string): void;
  /** Invoked to read a single line of user input during interactive discussion. */
  readInput(): Promise<string>;
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
