/** Non-blocking events emitted by pipeline operations to signal progress, errors, streamed output, and user input requests. */
export type PipelineEvent =
  | { type: 'error'; error: Error }
  | { type: 'progress'; step: string; subStep?: string; data?: unknown }
  | { type: 'stream'; chunk: string }
  | { type: 'input_required'; prompt: string; resolve: (val: string) => void };

/** Blocking interactive prompt that awaits a user response. */
export interface Question<T> {
  /** Prompt text to display. */
  message: string;
  /** Default value when the user submits without input. */
  initial?: T;
  /** Returns an error message for invalid input, or undefined for valid input. */
  validate?: (value: T) => string | undefined;
}
