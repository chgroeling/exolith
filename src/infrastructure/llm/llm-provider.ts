/** Parameters for a streaming text generation call. */
export interface LlmStreamParams {
  /**
   * System prompt. When provided, the provider places it before
   * all other messages.
   */
  system: string;
  /** Conversation messages (without system prompt). */
  messages?: { role: string; content: string }[];
  /** Plain text prompt. Mutually exclusive with messages. */
  prompt?: string;
}

/** Parameters for a structured object generation call. */
export interface LlmObjectParams {
  /** System prompt. */
  system: string;
  /** Conversation messages (without system prompt). */
  messages: { role: string; content: string }[];
  /** JSON Schema defining the expected output shape. */
  schema: Record<string, unknown>;
  /** Name of the schema for model guidance. */
  schemaName: string;
  /** Description of the schema for model guidance. */
  schemaDescription: string;
}

/**
 * Low-level adapter interface wrapping an external AI SDK.
 *
 * The provider is the narrowest possible abstraction over the
 * AI SDK — it knows about model, messages, and streaming,
 * but nothing about sessions, prompts, or domain concepts.
 */
export interface LlmProvider {
  /** Streams a text response for the given messages or prompt. */
  streamText(params: LlmStreamParams): { textStream: AsyncIterable<string> };

  /** Generates a typed object conforming to the given JSON Schema. */
  generateObject<T>(params: LlmObjectParams): Promise<{ object: T }>;
}
