import { createWriteStream } from 'node:fs';
import { program } from 'commander';
import { render } from 'ink';
import pino from 'pino';
import { createElement } from 'react';
import { buildIngestFactory } from '../composition/root';
import { App } from '../tui/app';

export function run(): void {
  program
    .name('exolith')
    .description('A CLI for ingesting knowledge into the exolith vault')
    .option('-l, --log-file <path>', 'path to log file', 'exolith.log')
    .option('--log-level <level>', 'log level', 'info')
    .option('--max-source-size <bytes>', 'maximum source file size in bytes', '10485760')
    .option('--vault <path>', 'path to the vault directory', '.')
    .action(async (options) => {
      const logStream = createWriteStream(options.logFile, { flags: 'w' });
      const logger = pino({ name: 'exolith', level: options.logLevel }, logStream);

      logger.info('CLI started');

      const ingestFactory = buildIngestFactory(logger);

      const { waitUntilExit } = render(
        createElement(App, {
          ingestFactory,
          maxSourceSize: Number.parseInt(options.maxSourceSize),
          vaultPath: options.vault,
        }),
        { alternateScreen: true, exitOnCtrlC: false },
      );
      await waitUntilExit();

      logger.info('CLI finished');
    });

  program.parse();
}
