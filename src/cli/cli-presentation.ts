import { stream, confirm, isCancel, log, spinner, text } from '@clack/prompts';
import type { SpinnerResult } from '@clack/prompts';
import type { PipelineEvent, Question } from '../operations/pipeline-presentation';

/** Display actions the presentation layer can perform for a step transition. */
type DisplayAction = 'LogStep' | 'StartSpin' | 'StopSpin' | 'PrepareStream' | 'FinishStream';

/** A single display action with its parameters. */
interface ActionItem {
  action: DisplayAction;
  label?: string;
}

/** Display actions for the start and end of each pipeline step. */
interface StepActions {
  start?: ActionItem[];
  end?: ActionItem[];
}

/** Maps pipeline step names to their display behaviour. */
const STEP_DISPLAY: Record<string, StepActions> = {
  // Pre-ingest states
  Reading: {
    start: [{ action: 'LogStep', label: 'Reading' }],
  },
  Discussing: {
    start: [{ action: 'LogStep', label: 'Discussing' }],
  },
  Streaming: {
    start: [{ action: 'PrepareStream' }],
  },
  WaitingForInput: {
    start: [{ action: 'FinishStream' }],
  },
  DiscussionSummary: {
    start: [{ action: 'StartSpin', label: 'Summarizing discussion' }],
    end: [{ action: 'StopSpin' }],
  },
  ExtractingSourcePage: {
    start: [{ action: 'StartSpin', label: 'Extracting source page' }],
    end: [{ action: 'StopSpin' }],
  },
  SourcePageWrite: {},
  // Ingest steps
  Extracting: {
    start: [{ action: 'StartSpin', label: 'Extracting knowledge' }],
    end: [{ action: 'StopSpin' }],
  },
  Updating: {
    start: [{ action: 'LogStep', label: 'Updating Wiki' }],
  },
  Logging: {
    start: [{ action: 'LogStep', label: 'Writing log entry' }],
  },
  Compiling: {
    start: [{ action: 'LogStep', label: 'Compiling' }],
  },
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
  let spin: SpinnerResult | null = null;
  let spinLabel = '';

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

      case 'step_start': {
        runActions(STEP_DISPLAY[event.step]?.start, event.data);
        break;
      }

      case 'step_end': {
        runActions(STEP_DISPLAY[event.step]?.end, event.data);
        break;
      }

      case 'stream':
        spin?.stop(spinLabel);
        spin = null;
        spinLabel = '';

        if (chunkQueue) {
          if (!streamPromise) startStream();
          chunkQueue.push(event.chunk);
          queueResolve?.();
          queueResolve = null;
        }
        break;

      case 'page_creating_start': {
        spin = spinner({ withGuide: false });
        spinLabel = `▪ Creating ${event.pageType}: ${event.name} (${event.slug})`;
        spin.start(spinLabel);
        break;
      }

      case 'page_created': {
        spinLabel = `▪ Creating ${event.pageType}: ${event.name} (${event.slug}) ✅`;
        spin?.clear();
        spin = null;
        log.message(spinLabel, { spacing: 0 })
        spinLabel = '';
        break;
      }

      case 'page_updating_start': {
        spin = spinner({ withGuide: false });
        spinLabel = `▪ Updating ${event.pageType}: ${event.name} (${event.slug})`;
        spin.start(spinLabel);
        break;
      }

      case 'page_updated': {
        spinLabel = `▪ Updating ${event.pageType}: ${event.name} (${event.slug}) ✅`;
        spin?.clear();
        spin = null;
        log.message(spinLabel, { spacing: 0 })
        spin = null;
        spinLabel = '';
        break;
      }

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

  function runActions(actions: ActionItem[] | undefined, data?: Record<string, unknown>): void {
    if (!actions) return;

    for (const item of actions) {
      switch (item.action) {
        case 'LogStep': {
          const label = (data?.sourceFilePath ?? data?.fileName ?? '') as string;
          log.step(`${item.label}: ${label}`);
          break;
        }
        case 'StartSpin':
          if (item.label) {
            spin = spinner();
            spinLabel = item.label;
            spin.start(item.label);
          }
          break;
        case 'StopSpin':
          spin?.stop(spinLabel);
          spin = null;
          spinLabel = '';
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
      spin = spinner();
      spinLabel = 'Thinking';
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
        spin = spinner();
        spinLabel = 'Thinking';
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
