import { stream, confirm, isCancel, log, text } from '@clack/prompts';
import type { PipelinePresentation } from '../operations/pipeline-presentation';
import { SpinnerManager } from './spinner-manager';

/** Display actions the presentation layer can perform for a step transition. */
type DisplayAction = 'LogStep' | 'StartSpin' | 'StopSpin' | 'PrepareStream' | 'FinishStream';

/** A single display action with its parameters. */
interface ActionItem {
  action: DisplayAction;
  label?: string;
}

/** Maps pipeline step names to their display behaviour. */
const STEP_DISPLAY: Record<string, ActionItem[]> = {
  // Pre-ingest states
  Reading: [{ action: 'LogStep', label: 'Reading' }],
  Discussing: [{ action: 'LogStep', label: 'Discussing' }],
  Streaming: [{ action: 'PrepareStream', label: 'Streaming' }],
  WaitingForInput: [{ action: 'FinishStream', label: 'Waiting for input' }],
  DiscussionSummary: [{ action: 'StartSpin', label: 'Summarizing discussion' }],
  ExtractingSourcePage: [
    { action: 'StopSpin' },
    { action: 'StartSpin', label: 'Extracting source page' },
  ],
  SourcePageWritten: [{ action: 'StopSpin' }],
  // Ingest steps
  Extracting: [{ action: 'StartSpin', label: 'Extracting knowledge' }],
  Updating: [{ action: 'StopSpin' }, { action: 'StartSpin', label: 'Updating wiki pages' }],
  Logging: [{ action: 'StopSpin' }, { action: 'LogStep', label: 'Writing log entry' }],
  Compiling: [{ action: 'StopSpin' }, { action: 'LogStep', label: 'Compiling' }],
};

/**
 * Creates a {@link PipelinePresentation} that drives terminal output via
 * {@link https://clack.cc @clack/prompts} spinners, steps, and streamed text.
 *
 * @remarks
 * Works for both pre-ingest and ingest pipelines. The same presentation object
 * is passed to either operation — unused callbacks are simply never invoked.
 */
export function createCliPresentation(opts: { skipDiscuss?: boolean } = {}): PipelinePresentation {
  const spin = new SpinnerManager();
  let chunkQueue: string[] | null = null;
  let queueResolve: (() => void) | null = null;
  let queueDone = false;
  let streamPromise: Promise<void> | null = null;

  function startStream() {
    streamPromise = stream.message({
      async *[Symbol.asyncIterator]() {
        while (true) {
          while (chunkQueue && chunkQueue.length > 0) {
            const item = chunkQueue.shift();
            if (item !== undefined) yield item;
          }
          if (queueDone) return;
          await new Promise<void>((r) => {
            queueResolve = r;
          });
        }
      },
    });
  }

  return {
    onStep(step: string, data?: Record<string, unknown>): void {
      const actions = STEP_DISPLAY[step];
      if (!actions) return;

      for (const item of actions) {
        switch (item.action) {
          case 'LogStep': {
            const label = (data?.sourceFilePath ?? data?.fileName ?? '') as string;
            log.step(`${item.label}: ${label}`);
            break;
          }
          case 'StartSpin':
            if (item.label) spin.start(item.label);
            break;
          case 'StopSpin':
            spin.stop();
            break;
          case 'PrepareStream':
            chunkQueue = [];
            queueDone = false;
            streamPromise = null;
            break;
          case 'FinishStream':
            queueDone = true;
            queueResolve?.();
            queueResolve = null;
            break;
        }
      }
    },

    onSubStep(message: string): void {
      spin.message(`  ${message}`);
    },

    onChunk(chunk: string): void {
      spin.stop();

      if (chunkQueue) {
        if (!streamPromise) startStream();
        chunkQueue.push(chunk);
        queueResolve?.();
        queueResolve = null;
      }
    },

    async readInput(): Promise<string> {
      if (streamPromise) {
        await streamPromise;
        streamPromise = null;
        chunkQueue = null;
      }

      const result = await text({
        message: 'Your response (press Enter on empty to finish)',
        placeholder: 'Type your feedback here...',
      });

      if (isCancel(result)) return '';

      const trimmed = result.trim();
      if (trimmed) {
        spin.start('Thinking');
      }
      return trimmed;
    },

    async shouldDiscuss(): Promise<boolean> {
      if (opts.skipDiscuss) {
        log.info('Skipping discussion (--skip-discuss).');
        return false;
      }

      const result = await confirm({
        message: 'Would you like to discuss the key takeaways with the LLM?',
        initialValue: true,
      });

      if (isCancel(result)) return false;

      if (result) {
        spin.start('Thinking');
      }
      return result;
    },

    onError(error: Error): void {
      log.error(`Error: ${error.message}\n`);
    },
  };
}
