import { createWriteStream } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { program } from 'commander';
import pino from 'pino';
import pkg from '../../package.json' with { type: 'json' };
import { buildIngestFactory, buildPreIngestFactory } from '../composition/root';
import { ConfigLoaderServiceImpl } from '../core/config/config-loader-impl';
import type { ConfigLoadResult } from '../core/config/config-types';
import { createCliIngestPresentation, createCliPreIngestPresentation } from './cli-presentation';

function resolvePath(base: string, p?: string): string | undefined {
  if (!p) return undefined;
  return isAbsolute(p) ? p : resolve(base, p);
}

/** Resolves vault configuration and creates a shared logger. */
async function bootstrap(
  globalOpts: {
    vaultDir?: string;
    logFile?: string;
    logLevel?: string;
  },
  cmdOpts: {
    maxSourceSize?: string;
  } = {},
) {
  const configLoader = new ConfigLoaderServiceImpl();

  let result: ConfigLoadResult;

  try {
    result = globalOpts.vaultDir
      ? await configLoader.loadAt(globalOpts.vaultDir)
      : await configLoader.load(process.cwd());
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  const { config, rootDir } = result;
  const vaultPath = rootDir;

  const logFilePath =
    resolvePath(rootDir, globalOpts.logFile ?? config.logFile) ?? resolve(rootDir, 'exolith.log');
  const logLevel = globalOpts.logLevel ?? config.logLevel ?? 'info';
  const maxSourceSize = Number(cmdOpts.maxSourceSize ?? config.maxSourceSize ?? 10485760);

  const logStream = createWriteStream(logFilePath, { flags: 'w' });
  const logger = pino({ level: logLevel, base: undefined }, logStream);

  logger.info({ rootDir }, 'CLI started');

  return { vaultPath, maxSourceSize, logger };
}

program
  .name('exolith')
  .description('A CLI for ingesting knowledge into the exolith vault')
  .version(pkg.version)
  .option('-l, --log-file <path>', 'path to log file')
  .option('--log-level <level>', 'log level')
  .option('-v, --vault-dir <path>', 'path to the vault directory containing exolith.json');

program
  .command('pre-ingest')
  .description('Run the pre-ingest pipeline on a raw source file')
  .argument('<file>', 'path to the raw source file')
  .option('--max-source-size <bytes>', 'maximum source file size in bytes')
  .option('--skip-discuss', 'skip the interactive discussion step')
  .action(async (file, options) => {
    const { vaultPath, maxSourceSize, logger } = await bootstrap(program.opts(), options);

    const factory = buildPreIngestFactory(logger);
    const presentation = createCliPreIngestPresentation({ skipDiscuss: options.skipDiscuss });
    const service = factory.create({ maxSourceSize, vaultPath }, presentation);

    try {
      await service.process(file);
    } catch (err) {
      logger.error({ err }, 'pre-ingest failed');
      process.stderr.write(`Error: ${(err as Error).message}\n`);
      process.exit(1);
    }

    logger.info('pre-ingest complete');
  });

program
  .command('ingest')
  .description('Run the ingest pipeline on a source page')
  .argument('<file>', 'path to the source page in sources/')
  .action(async (file, options) => {
    const { vaultPath, logger } = await bootstrap(program.opts(), options);

    const factory = buildIngestFactory(logger);
    const presentation = createCliIngestPresentation();
    const service = factory.create({ vaultPath }, presentation);

    try {
      await service.process(file);
    } catch (err) {
      logger.error({ err }, 'ingest failed');
      process.stderr.write(`Error: ${(err as Error).message}\n`);
      process.exit(1);
    }

    logger.info('ingest complete');
  });

export function run(): void {
  program.parse();
}
