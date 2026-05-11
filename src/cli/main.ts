import { createWriteStream } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { program } from 'commander';
import pino from 'pino';
import pkg from '../../package.json' with { type: 'json' };
import { buildIngestFactory, buildPreIngestFactory } from '../composition/root';
import { ConfigLoaderServiceImpl } from '../core/config/config-loader-impl';
import type { ConfigLoadResult } from '../core/config/config-types';
import { FileListServiceImpl } from '../core/file-list-service-impl';
import { createCliIngestPresentation, createCliPreIngestPresentation } from './cli-presentation';

(globalThis as Record<string, unknown>).AI_SDK_LOG_WARNINGS = false;

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

  return { vaultPath, maxSourceSize, logger, config };
}

program
  .name('exolith')
  .description('A CLI for ingesting knowledge into the exolith vault')
  .version(pkg.version)
  .option('-l, --log-file <path>', 'path to log file')
  .option('--log-level <level>', 'log level')
  .option('-v, --vault-dir <path>', 'path to the vault directory containing exolith.json');

const preIngestCmd = program
  .command('pre-ingest')
  .description('Manage and process raw source files in the inbox');

preIngestCmd
  .command('list')
  .description('List files in the inbox with their content-based IDs')
  .action(async () => {
    const { vaultPath, logger } = await bootstrap(program.opts());

    const inboxDir = join(vaultPath, 'inbox');
    const fileListService = new FileListServiceImpl();
    const files = await fileListService.listFiles(inboxDir);

    if (files.length === 0) {
      process.stderr.write(`Inbox is empty (${inboxDir})\n`);
      logger.info('pre-ingest list: inbox empty');
      return;
    }

    process.stderr.write(`\nInbox (${files.length} file${files.length === 1 ? '' : 's'}):\n\n`);

    for (const file of files) {
      process.stdout.write(`  ${file.id}  ${file.fileName}\n`);
    }

    process.stderr.write(`\nRun "exolith pre-ingest process <id>" to start the pipeline.\n`);

    logger.info({ count: files.length }, 'pre-ingest list');
  });

preIngestCmd
  .command('process')
  .description('Run the pre-ingest pipeline on a file from the inbox')
  .argument('<id>', 'ID (or prefix) of the file from "pre-ingest list"')
  .option('--max-source-size <bytes>', 'maximum source file size in bytes')
  .option('--skip-discuss', 'skip the interactive discussion step')
  .action(async (id, options) => {
    const { vaultPath, maxSourceSize, logger, config } = await bootstrap(program.opts(), options);

    const inboxDir = join(vaultPath, 'inbox');
    const fileListService = new FileListServiceImpl();
    const files = await fileListService.listFiles(inboxDir);

    const matches = files.filter((f) => f.id.startsWith(id));

    if (matches.length === 0) {
      process.stderr.write(`Error: No file found with ID prefix "${id}" in ${inboxDir}\n`);
      logger.warn({ id }, 'pre-ingest process: no match');
      process.exit(1);
    }

    if (matches.length > 1) {
      const maxIdWidth = Math.max(...matches.map((m) => m.id.length));
      process.stderr.write(`Error: ID prefix "${id}" matches multiple files:\n`);
      for (const m of matches) {
        process.stderr.write(`  ${m.id.padEnd(maxIdWidth)}  ${m.fileName}\n`);
      }
      process.stderr.write('Provide a longer ID prefix to disambiguate.\n');
      logger.warn({ id, matches: matches.length }, 'pre-ingest process: ambiguous ID');
      process.exit(1);
    }

    const target = matches[0];
    logger.info({ id, file: target.fullPath }, 'pre-ingest process: starting pipeline');

    const factory = buildPreIngestFactory(logger, config);
    const presentation = createCliPreIngestPresentation({ skipDiscuss: options.skipDiscuss });
    const service = factory.create({ maxSourceSize, vaultPath }, presentation);

    try {
      await service.process(target.fullPath);
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
    const { vaultPath, logger, config } = await bootstrap(program.opts(), options);

    const factory = buildIngestFactory(logger, config);
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
