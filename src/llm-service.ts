export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Input for a structured (typed) generation request. */
export interface LlmStructuredRequest {
  /** The system prompt applied to this generation. */
  systemPrompt: string;
  /** The conversation messages (excluding system prompt). */
  messages: LlmMessage[];
  /** JSON Schema describing the expected output shape. */
  schema: Record<string, unknown>;
  /** Name of the schema, passed to the model for guidance. */
  schemaName: string;
  /** Description of the expected output, passed to the model for guidance. */
  schemaDescription: string;
}

/**
 * A stateful conversation session with the LLM.
 *
 * The session holds the full message history and a system prompt
 * that is applied once at the start. Use {@link LlmService.createSession}
 * to obtain an instance.
 */
export interface LlmSession {
  /**
   * Appends a user message to the conversation history.
   * Does not trigger an LLM call — use {@link stream} or
   * {@link complete} for that.
   */
  addUserMessage(content: string): void;

  /**
   * Appends an assistant message to the conversation history.
   * Typically called after {@link stream} has delivered the
   * full response so the LLM sees its own prior output.
   */
  addAssistantMessage(content: string): void;

  /**
   * Sends the current conversation history to the LLM and streams
   * the response chunk-by-chunk via `onChunk`.
   *
   * The response is NOT automatically appended to the history —
   * call {@link addAssistantMessage} afterwards if you want the
   * LLM to remember its own reply.
   */
  stream(onChunk: (chunk: string) => void): Promise<void>;

  /**
   * Sends the current conversation history to the LLM and collects
   * the full response as a single string.
   *
   * The response is NOT automatically appended to the history.
   */
  complete(): Promise<string>;

  /**
   * Returns a frozen snapshot of the current message history,
   * including the system prompt at index 0.
   */
  getMessages(): readonly LlmMessage[];
}

/**
 * The consumer-owned interface for all LLM interactions.
 *
 * Provides three capabilities:
 * - {@link complete} — one-shot text generation
 * - {@link createSession} — stateful multi-turn conversation
 * - {@link generateStructured} — typed object extraction
 */
export interface LlmService {
  /**
   * Generates a one-shot completion from a plain text prompt.
   *
   * Shortcut for fire-and-forget scenarios such as summarization
   * where no follow-up messages are needed.
   */
  complete(prompt: string, systemPrompt: string): Promise<string>;

  /**
   * Creates a stateful conversation session with the given
   * system prompt. Use the returned {@link LlmSession} to manage
   * multi-turn interactions.
   */
  createSession(systemPrompt: string): LlmSession;

  /**
   * Generates a typed object from the given messages and JSON Schema.
   *
   * The LLM is instructed to produce output conforming to `schema`.
   * The returned value is parsed and validated by the underlying
   * provider before being returned.
   */
  generateStructured<T>(request: LlmStructuredRequest): Promise<T>;
}
