/** Non-blocking events emitted by pipeline operations to signal progress, errors, streamed output, user input requests, and page lifecycle changes. */
export type PipelineEvent =
  | { type: 'error'; error: Error }
  | { type: 'step_start'; step: string; data?: Record<string, unknown> }
  | { type: 'step_end'; step: string; data?: Record<string, unknown> }
  | { type: 'stream'; chunk: string }
  | { type: 'input_required'; prompt: string; resolve: (val: string) => void }
  | { type: 'page_creating_start'; pageType: 'entity' | 'concept'; name: string; slug: string }
  | { type: 'page_created'; pageType: 'entity' | 'concept'; name: string; slug: string }
  | { type: 'page_updating_start'; pageType: 'entity' | 'concept'; name: string; slug: string }
  | { type: 'page_updated'; pageType: 'entity' | 'concept'; name: string; slug: string };

/** Blocking interactive prompt that awaits a user response. */
export interface Question<T> {
  /** Prompt text to display. */
  message: string;
  /** Default value when the user submits without input. */
  initial?: T;
  /** Returns an error message for invalid input, or undefined for valid input. */
  validate?: (value: T) => string | undefined;
}
