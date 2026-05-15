/** Shape of the exolith configuration file (JSON5). */
export interface ExolithConfig {
  /**
   * Model identifier in `gateway/model-id` format.
   * The first segment selects the LLM gateway ("deepseek" or "openrouter").
   * The remainder is the model string passed to that gateway.
   */
  model: string;
  /** Maximum allowed source file size in bytes. */
  maxSourceSize?: number;
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
