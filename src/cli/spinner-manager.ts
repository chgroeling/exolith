import { spinner } from '@clack/prompts';
import type { SpinnerResult } from '@clack/prompts';

/**
 * Manages an {@link https://clack.cc @clack/prompts} spinner lifecycle.
 *
 * @remarks
 * The caller must sequence {@link start} and {@link stop} through display actions —
 * no automatic stop-before-start is performed.
 */
export class SpinnerManager {
  private spin: SpinnerResult | null = null;
  private spinLabel = '';

  /** Starts a new spinner with the given message. Does not stop a previously running spinner. */
  start(msg: string): void {
    this.spin = spinner();
    this.spin.start(msg);
    this.spinLabel = msg;
  }

  /** Stops the current spinner and resets state. No-op if no spinner is running. */
  stop(): void {
    this.spin?.stop(this.spinLabel);
    this.spin = null;
    this.spinLabel = '';
  }

  /** Appends a message under the currently running spinner without disrupting it. */
  message(msg: string): void {
    this.spin?.message(msg);
  }
}
