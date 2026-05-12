/** Presentation callbacks required by every pipeline operation. */
export interface PipelinePresentation {
  /** Invoked when the pipeline encounters a fatal error. */
  onError(error: Error): void;
  /** Invoked when the pipeline enters a new step or state. */
  onStep(step: string, data?: Record<string, unknown>): void;
  /** Invoked for granular progress events within a step (e.g. page creation). */
  onSubStep(message: string): void;
  /** Invoked for each token chunk during LLM streaming. */
  onChunk(chunk: string): void;
  /** Invoked to read a single line of user input during interactive discussion. */
  readInput(): Promise<string>;
  /** Invoked to ask whether the user wants to enter the discussion step. */
  shouldDiscuss(): Promise<boolean>;
}
