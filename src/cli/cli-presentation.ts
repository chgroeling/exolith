import { stream, confirm, isCancel, log, text } from '@clack/prompts';
import type { PipelineEvent, Question } from '../operations/pipeline-presentation';
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
 * Creates `emit` and `ask` functions that drive terminal output via
 * {@link https://clack.cc @clack/prompts} spinners, steps, and streamed text.
 *
 * @remarks
 * Works for both pre-ingest and ingest pipelines. The same functions
 * are passed to either operation — unused event types are simply never emitted.
 */
export function createCliPresentation(): {
  emit: (event: PipelineEvent) => void;
  ask: <T>(question: Question<T>) => Promise<T>;
} {
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

  function emit(event: PipelineEvent): void {
    switch (event.type) {
      case 'error':
        log.error(`Error: ${event.error.message}\n`);
        break;

      case 'progress': {
        const actions = STEP_DISPLAY[event.step];
        if (!actions) return;

        for (const item of actions) {
          switch (item.action) {
            case 'LogStep': {
              const d = event.data as Record<string, unknown> | undefined;
              const label = (d?.sourceFilePath ?? d?.fileName ?? '') as string;
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

        if (event.subStep) {
          spin.message(`  ${event.subStep}`);
        }
        break;
      }

      case 'stream':
        spin.stop();

        if (chunkQueue) {
          if (!streamPromise) startStream();
          chunkQueue.push(event.chunk);
          queueResolve?.();
          queueResolve = null;
        }
        break;

      case 'input_required': {
        if (streamPromise) {
          streamPromise.then(() => {
            streamPromise = null;
            chunkQueue = null;
            promptInput(event.prompt, event.resolve);
          });
        } else {
          promptInput(event.prompt, event.resolve);
        }
        break;
      }
    }
  }

  async function promptInput(prompt: string, resolve: (val: string) => void) {
    const result = await text({
      message: prompt,
      placeholder: 'Type your feedback here...',
    });

    if (isCancel(result)) {
      resolve('');
      return;
    }

    const trimmed = result.trim();
    if (trimmed) {
      spin.start('Thinking');
    }
    resolve(trimmed);
  }

  async function ask<T>(question: Question<T>): Promise<T> {
    if (typeof question.initial === 'boolean') {
      const result = await confirm({
        message: question.message,
        initialValue: question.initial,
      });

      if (isCancel(result)) return false as unknown as T;

      if (result) {
        spin.start('Thinking');
      }
      return result as unknown as T;
    }

    const result = await text({
      message: question.message,
      placeholder: 'Type your answer here...',
    });

    if (isCancel(result)) return (question.initial ?? '') as unknown as T;

    const trimmed = result.trim();
    return (trimmed || (question.initial ?? '')) as unknown as T;
  }

  return { emit, ask };
}
