import { createWriteStream } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { program } from 'commander';
import { render } from 'ink';
import pino from 'pino';
import { createElement } from 'react';
import { buildIngestFactory } from '../composition/root';
import { ConfigLoaderServiceImpl } from '../core/config/config-loader-impl';
import type { ConfigLoadResult } from '../core/config/config-types';
import { App } from '../tui/app';

function resolvePath(base: string, p?: string): string | undefined {
  if (!p) return undefined;
  return isAbsolute(p) ? p : resolve(base, p);
}

export function run(): void {
  program
    .name('exolith')
    .description('A CLI for ingesting knowledge into the exolith vault')
    .option('-l, --log-file <path>', 'path to log file')
    .option('--log-level <level>', 'log level')
    .option('--max-source-size <bytes>', 'maximum source file size in bytes')
    .option('-v, --vault-dir <path>', 'path to the vault directory containing exolith.json')
    .action(async (options) => {
      const configLoader = new ConfigLoaderServiceImpl();

      let result: ConfigLoadResult;

      try {
        result = options.vaultDir
          ? await configLoader.loadAt(options.vaultDir)
          : await configLoader.load(process.cwd());
      } catch (err) {
        console.error((err as Error).message);
        process.exit(1);
      }

      const { config, rootDir } = result;
      const vaultPath = rootDir;

      const logFilePath =
        resolvePath(rootDir, options.logFile ?? config.logFile) ?? resolve(rootDir, 'exolith.log');
      const logLevel = options.logLevel ?? config.logLevel ?? 'info';
      const maxSourceSize = options.maxSourceSize ?? config.maxSourceSize ?? 10485760;

      const logStream = createWriteStream(logFilePath, { flags: 'w' });
      const logger = pino({ level: logLevel, base: undefined }, logStream);

      logger.info({ rootDir }, 'CLI started');

      const ingestFactory = buildIngestFactory(logger);

      const { waitUntilExit } = render(
        createElement(App, {
          ingestFactory,
          maxSourceSize: Number(maxSourceSize),
          vaultPath,
        }),
        { alternateScreen: true, exitOnCtrlC: false },
      );
      await waitUntilExit();

      logger.info('CLI finished');
    });

  program.parse();
}
