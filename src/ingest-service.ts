/** Configuration for an ingest pipeline run. */
export interface IngestConfig {
  /** Maximum allowed source file size in bytes. */
  maxSourceSize: number;
  /** Path to the vault directory. */
  vaultPath: string;
  /** Callback invoked for each token chunk during LLM streaming. */
  onChunk?: (chunk: string) => void;
  /** Callback invoked to read user input during interactive discussion. */
  readInput?: () => Promise<string>;
}

/** Runs the full ingest pipeline on a raw source file. */
export interface IngestService {
  process(filePath: string): Promise<void>;
}

/** Creates {@link IngestService} instances configured for a single file. */
export interface IngestServiceFactory {
  create(config: IngestConfig): IngestService;
}
