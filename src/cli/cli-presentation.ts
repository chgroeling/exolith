import * as readline from 'node:readline';
import type { IngestPresentation, IngestStep } from '../operations/ingest/ingest-service';
import type {
  PreIngestPresentation,
  PreIngestState,
  PreIngestStateData,
} from '../operations/pre-ingest/pre-ingest-service';

const STATE_LABELS: Record<PreIngestState, string> = {
  reading: 'Reading',
  discussing: 'Discussing',
  'discussion-summary': 'Summarizing discussion',
  'extracting-source-page': 'Extracting source page',
  'source-page-written': 'Source page written',
};

/**
 * Creates a {@link PreIngestPresentation} that writes step progress to stderr,
 * streams LLM chunks to stdout, and reads user input from stdin.
 */
export function createCliPreIngestPresentation(
  opts: { skipDiscuss?: boolean } = {},
): PreIngestPresentation {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  return {
    onStateChange(state: PreIngestState, data: PreIngestStateData): void {
      const label = STATE_LABELS[state];
      if (state === 'source-page-written' && data.sourcePath) {
        process.stderr.write(`${label}: ${data.sourcePath}\n`);
      } else {
        process.stderr.write(`${label}: ${data.fileName}\n`);
      }
    },

    onChunk(chunk: string): void {
      process.stdout.write(chunk);
    },

    readInput(): Promise<string> {
      return new Promise((resolve) => {
        process.stdout.write('\n');
        rl.question('> ', (answer) => {
          const trimmed = answer.trim();
          if (!trimmed) {
            rl.close();
          }
          resolve(trimmed);
        });
      });
    },

    shouldDiscuss(): Promise<boolean> {
      return new Promise((resolve) => {
        if (opts.skipDiscuss) {
          process.stderr.write('Skipping discussion.\n');
          rl.close();
          resolve(false);
          return;
        }
        rl.question('Discuss key takeaways? [Y/n] ', (answer) => {
          const result = !answer.toLowerCase().startsWith('n');
          if (!result) {
            rl.close();
          }
          resolve(result);
        });
      });
    },
  };
}

/**
 * Creates an {@link IngestPresentation} that writes step progress to stderr.
 */
export function createCliIngestPresentation(): IngestPresentation {
  return {
    onStep(step: IngestStep): void {
      process.stderr.write(`[${step}]\n`);
    },
  };
}
