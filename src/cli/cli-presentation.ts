import { stream, confirm, isCancel, log, spinner, text } from '@clack/prompts';
import type { SpinnerResult } from '@clack/prompts';
import type {
  IngestPresentation,
  IngestStep,
  IngestStepData,
} from '../operations/ingest/ingest-service';
import type {
  PreIngestPresentation,
  PreIngestState,
  PreIngestStateData,
} from '../operations/pre-ingest/pre-ingest-service';

/** Display actions the presentation layer can perform for a state transition. */
type DisplayAction = 'LogStep' | 'StartSpin' | 'StopSpin' | 'PrepareStream' | 'FinishStream';

/** A single display action with its parameters. */
interface ActionItem {
  action: DisplayAction;
  label?: string;
}

/** Maps a pre-ingest state to its display behaviour — one or more actions executed in order. */
interface StateDisplayConfig {
  actions: ActionItem[];
}

const STATE_DISPLAY: Record<PreIngestState, StateDisplayConfig> = {
  Reading: { actions: [{ action: 'LogStep', label: 'Reading' }] },
  Discussing: { actions: [{ action: 'LogStep', label: 'Discussing' }] },
  Streaming: { actions: [{ action: 'PrepareStream', label: 'Streaming' }] },
  WaitingForInput: { actions: [{ action: 'FinishStream', label: 'Waiting for input' }] },
  DiscussionSummary: { actions: [{ action: 'StartSpin', label: 'Summarizing discussion' }] },
  ExtractingSourcePage: {
    actions: [{ action: 'StopSpin' }, { action: 'StartSpin', label: 'Extracting source page' }],
  },
  SourcePageWritten: {
    actions: [{ action: 'StopSpin' }],
  },
};

/** Maps an ingest step to its display label. */
const INGEST_STEP_DISPLAY: Record<IngestStep, { label: string }> = {
  Extracting: { label: 'Extracting knowledge' },
  Updating: { label: 'Updating wiki pages' },
  Logging: { label: 'Writing log entry' },
  Compiling: { label: 'Compiling' },
};

/** Shared error display for both pipeline presentations. */
function makeErrorHandler(): (error: Error) => void {
  return (error: Error) => log.error(`Error: ${error.message}\n`);
}

/**
 * Creates a {@link PreIngestPresentation} that writes step progress to stderr,
 * streams LLM chunks to stdout, and reads user input with {@link https://clack.cc @clack/prompts}.
 *
 * @remarks
 * Progress indicators are managed autonomously by the presentation layer —
 * the operation itself is never aware of spinners or display framing.
 */
export function createCliPreIngestPresentation(
  opts: { skipDiscuss?: boolean } = {},
): PreIngestPresentation {
  let spin: SpinnerResult | null = null;
  let spinLabel = '';
  let chunkQueue: string[] | null = null;
  let queueResolve: (() => void) | null = null;
  let queueDone = false;
  let streamPromise: Promise<void> | null = null;

  function startSpin(msg: string) {
    spin = spinner();
    spin.start(msg);
    spinLabel = msg;
  }

  function stopSpin() {
    spin?.stop(spinLabel);
    spin = null;
    spinLabel = '';
  }

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
    /** Writes the current state and file name to stderr. Uses the output path when available. */
    onStateChange(state: PreIngestState, data: PreIngestStateData): void {
      for (const item of STATE_DISPLAY[state].actions) {
        switch (item.action) {
          case 'LogStep':
            log.step(`${item.label}: ${data.fileName}`);
            break;
          case 'StartSpin':
            if (item.label) startSpin(item.label);
            break;
          case 'StopSpin':
            stopSpin();
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

    /** Streams a single LLM token chunk to stdout. */
    onChunk(chunk: string): void {
      stopSpin();

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
        startSpin('Thinking');
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
        startSpin('Thinking');
      }
      return result;
    },

    onError: makeErrorHandler(),
  };
}

/**
 * Creates an {@link IngestPresentation} that writes step progress to stderr.
 *
 * @remarks
 * Progress indicators are managed autonomously by the presentation layer —
 * the operation itself is never aware of display framing.
 */
export function createCliIngestPresentation(): IngestPresentation {
  return {
    onStep(step: IngestStep, data: IngestStepData): void {
      const { label } = INGEST_STEP_DISPLAY[step];
      log.step(`${label}: ${data.sourceFilePath}`);
    },

    onError: makeErrorHandler(),
  };
}
