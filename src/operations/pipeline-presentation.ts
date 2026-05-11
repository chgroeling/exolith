/** Shared presentation callbacks required by every pipeline operation. */
export interface PipelinePresentation {
  /** Invoked when the pipeline encounters a fatal error. */
  onError(error: Error): void;
}
