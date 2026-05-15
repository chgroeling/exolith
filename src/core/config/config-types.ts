/** Shape of the exolith configuration file (JSON5). */
export interface ExolithConfig {
  /** LLM provider. Must be "openrouter" or "deepseek". Required. */
  provider: 'openrouter' | 'deepseek';
  /** Model name for the LLM provider. Defaults depend on the chosen provider. */
  model?: string;
  /** Maximum allowed source file size in bytes. */
  maxSourceSize?: number;
  /** Path to the log file. Relative paths are resolved from the root directory. */
  logFile?: string;
  /** Log level for Pino. */
  logLevel?: string;
  /** Reasoning effort level for the LLM. Defaults to "off". */
  reasoningLevel?: 'off' | 'low' | 'medium' | 'high' | 'max';
}

/** Result of a successful configuration load via bubble-up search. */
export interface ConfigLoadResult {
  /** The parsed configuration values. */
  config: ExolithConfig;
  /** Absolute path to the directory containing {@link CONFIG_FILE_NAME} — the exolith root. */
  rootDir: string;
}

/** Marker file name searched by the bubble-up algorithm. */
export const CONFIG_FILE_NAME = 'exolith.json';
