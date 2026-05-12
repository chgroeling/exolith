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
type DisplayAction =
  | 'log-step'
  | 'start-spin'
  | 'update-spin-or-start'
  | 'stop-spin-log-success'
  | 'prepare-stream'
  | 'finish-stream';

/** Maps a pre-ingest state to its display behaviour. */
interface StateDisplayConfig {
  action: DisplayAction;
  label: string;
  /** The {@link PreIngestStateData} field to log after stopping the spinner. Only relevant for 'stop-spin-log-success'. */
  successField?: keyof PreIngestStateData;
}

const STATE_DISPLAY: Record<PreIngestState, StateDisplayConfig> = {
  reading: { action: 'log-step', label: 'Reading' },
  discussing: { action: 'log-step', label: 'Discussing' },
  streaming: { action: 'prepare-stream', label: 'Streaming' },
  'waiting-for-input': { action: 'finish-stream', label: 'Waiting for input' },
  'discussion-summary': { action: 'start-spin', label: 'Summarizing discussion' },
  'extracting-source-page': { action: 'update-spin-or-start', label: 'Extracting source page' },
  'source-page-written': {
    action: 'stop-spin-log-success',
    label: 'Source page written',
    successField: 'sourcePath',
  },
};

/** Maps an ingest step to its display label. */
const INGEST_STEP_DISPLAY: Record<IngestStep, { label: string }> = {
  extracting: { label: 'Extracting knowledge' },
  updating: { label: 'Updating wiki pages' },
  logging: { label: 'Writing log entry' },
  compiling: { label: 'Compiling' },
};

const INGEST_STEP_LABELS: Record<IngestStep, string> = {
  extracting: 'Extracting knowledge…',
  updating: 'Updating wiki pages…',
  logging: 'Writing log entry…',
  compiling: 'Compiling…',
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
      const config = STATE_DISPLAY[state];
      switch (config.action) {
        case 'log-step':
          log.step(`${config.label}: ${data.fileName}`);
          break;
        case 'start-spin':
          startSpin(config.label);
          break;
        case 'update-spin-or-start':
          if (spin) {
            spin.message(config.label);
            spinLabel = config.label;
          } else {
            startSpin(config.label);
          }
          break;
        case 'stop-spin-log-success': {
          stopSpin();
          const field = config.successField;
          log.success(field ? `${data[field]}` : '');
          break;
        }
        case 'prepare-stream':
          chunkQueue = [];
          queueDone = false;
          streamPromise = null;
          break;
        case 'finish-stream':
          queueDone = true;
          queueResolve?.();
          queueResolve = null;
          break;
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
