import { stream, confirm, isCancel, log, spinner, text } from '@clack/prompts';
import type { SpinnerResult } from '@clack/prompts';
import type { IngestPresentation, IngestStep } from '../operations/ingest/ingest-service';
import type {
  PreIngestPresentation,
  PreIngestState,
  PreIngestStateData,
} from '../operations/pre-ingest/pre-ingest-service';

const STATE_LABELS: Record<PreIngestState, string> = {
  reading: 'Reading',
  discussing: 'Discussing',
  streaming: 'Streaming',
  'waiting-for-input': 'Waiting for input',
  'discussion-summary': 'Summarizing discussion',
  'extracting-source-page': 'Extracting source page',
  'source-page-written': 'Source page written',
};

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
  let buffer = '';
  let pendingDisplay: Promise<void> | null = null;

  return {
    onStateChange(state: PreIngestState, data: PreIngestStateData): void {
      const label = STATE_LABELS[state];

      if (state === 'streaming') {
        return;
      }

      if (state === 'waiting-for-input') {
        pendingDisplay = stream.message([buffer]).then(() => {
          pendingDisplay = null;
        });
        buffer = '';
        return;
      }

      if (state === 'source-page-written') {
        spin?.stop(`${label}`);
        spin = null;
        log.success(`${data.sourcePath}`);
        return;
      }

      if (state === 'extracting-source-page') {
        if (spin) {
          spin.message(`${label} …`);
        } else {
          spin = spinner();
          spin.start(`${label} …`);
        }
        return;
      }

      if (state === 'discussion-summary') {
        spin = spinner();
        spin.start(`${label} …`);
        return;
      }

      log.step(`${label}: ${data.fileName}`);
    },

    onChunk(chunk: string): void {
      spin?.stop();
      spin = null;
      buffer += chunk;
    },

    async readInput(): Promise<string> {
      if (pendingDisplay) await pendingDisplay;

      const result = await text({
        message: 'Your response (press Enter on empty to finish)',
        placeholder: 'Type your feedback here...',
      });

      if (isCancel(result)) return '';

      const trimmed = result.trim();
      if (trimmed) {
        spin = spinner();
        spin.start('Thinking …');
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
        spin = spinner();
        spin.start('Thinking …');
      }
      return result;
    },
  };
}

/**
 * Creates an {@link IngestPresentation} that writes step progress to stderr.
 */
export function createCliIngestPresentation(): IngestPresentation {
  return {
    onStep(step: IngestStep): void {
      log.step(`[${step}]`);
    },
  };
}
