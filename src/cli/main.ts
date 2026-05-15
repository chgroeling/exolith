import { createWriteStream } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { cancel, intro, outro } from '@clack/prompts';
import { program } from 'commander';
import pino from 'pino';
import pkg from '../../package.json' with { type: 'json' };
import {
  buildCompileFactory,
  buildIngestFactory,
  buildPreIngestFactory,
} from '../composition/root';
import { ConfigLoaderServiceImpl } from '../core/config/config-loader-impl';
import { CONFIG_FILE_NAME } from '../core/config/config-types';
import type { ConfigLoadResult, ExolithConfig } from '../core/config/config-types';
import { FileListServiceImpl } from '../core/file-list-service-impl';
import type { TableFormatter } from '../core/table-formatter';
import { TableFormatterImpl } from '../core/table-formatter-impl';
import { createCliPresentation } from './cli-presentation';

(globalThis as Record<string, unknown>).AI_SDK_LOG_WARNINGS = false;

const tableFormatter: TableFormatter = new TableFormatterImpl();

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

program
  .command('init')
  .description('Initialize a new exolith vault by writing exolith.json')
  .option('--provider <provider>', 'LLM provider', 'deepseek')
  .option(
    '--reasoning-level <level>',
    'reasoning effort level (off, low, medium, high, max)',
    'off',
  )
  .action(async (options) => {
    const globalOpts = program.opts();
    const targetDir = resolve(globalOpts.vaultDir ?? process.cwd());
    const configPath = join(targetDir, CONFIG_FILE_NAME);

    if (options.provider !== 'openrouter' && options.provider !== 'deepseek') {
      process.stderr.write(
        `Error: provider must be "openrouter" or "deepseek", got "${options.provider}"\n`,
      );
      process.exit(1);
    }

    const validLevels = ['off', 'low', 'medium', 'high', 'max'];
    if (!validLevels.includes(options.reasoningLevel)) {
      process.stderr.write(
        `Error: reasoning-level must be one of ${validLevels.join(', ')}, got "${options.reasoningLevel}"\n`,
      );
      process.exit(1);
    }

    try {
      await access(configPath);
      process.stderr.write(
        `Error: ${configPath} already exists. Remove it first or use a different directory.\n`,
      );
      process.exit(1);
    } catch {}

    const config: ExolithConfig = {
      provider: options.provider,
      reasoningLevel: options.reasoningLevel as ExolithConfig['reasoningLevel'],
    };

    await mkdir(targetDir, { recursive: true });
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
    process.stderr.write(`Created ${configPath}\n`);
  });

program
  .command('enqueue')
  .description('Process a raw source file and write the source page to the inbox')
  .argument('<file>', 'Path to the raw source file')
  .option('--max-source-size <bytes>', 'maximum source file size in bytes')
  .option('--skip-discuss', 'skip the interactive discussion step')
  .action(async (filePath, options) => {
    const { vaultPath, maxSourceSize, logger, config } = await bootstrap(program.opts(), options);

    intro(`Enqueuing ${filePath}`);
    const sigintHandler = () => {
      cancel('Cancelled.');
      process.exit(0);
    };
    process.once('SIGINT', sigintHandler);

    const factory = buildPreIngestFactory(logger, config);
    const { emit, ask } = createCliPresentation();
    const service = factory.create(
      { maxSourceSize, vaultPath, skipDiscuss: options.skipDiscuss },
      emit,
      ask,
    );

    try {
      const result = await service.process(filePath);
      process.off('SIGINT', sigintHandler);
      outro(`Source page written to inbox: ${result.sourcePath}`);
    } catch (err) {
      process.off('SIGINT', sigintHandler);
      logger.error({ err }, 'enqueue failed');
      cancel(`Error: ${(err as Error).message}`);
      process.exit(1);
    }

    logger.info('enqueue complete');
  });

const ingestCmd = program.command('ingest').description('Process source pages from the inbox');

ingestCmd
  .command('list')
  .description('List source pages in the inbox with their content-based IDs')
  .action(async () => {
    const { vaultPath, logger } = await bootstrap(program.opts());

    const inboxDir = join(vaultPath, 'inbox');
    const fileListService = new FileListServiceImpl();
    const files = await fileListService.listFiles(inboxDir);

    if (files.length === 0) {
      process.stderr.write(`No source pages found (${inboxDir})\n`);
      logger.info('ingest list: no source pages');
      return;
    }

    tableFormatter.renderFileList(
      'Source pages',
      files,
      'Run "exolith ingest process <id>" to start the pipeline.',
    );

    logger.info({ count: files.length }, 'ingest list');
  });

ingestCmd
  .command('process')
  .description('Run the ingest pipeline on a source page from the inbox')
  .argument('<id>', 'ID (or prefix) of the file from "ingest list"')
  .action(async (id, options) => {
    const { vaultPath, logger, config } = await bootstrap(program.opts(), options);

    const inboxDir = join(vaultPath, 'inbox');
    const fileListService = new FileListServiceImpl();
    const files = await fileListService.listFiles(inboxDir);

    const matches = files.filter((f) => f.id.startsWith(id));

    if (matches.length === 0) {
      process.stderr.write(`Error: No file found with ID prefix "${id}" in ${inboxDir}\n`);
      logger.warn({ id }, 'ingest process: no match');
      process.exit(1);
    }

    if (matches.length > 1) {
      tableFormatter.renderAmbiguousIdError(id, matches);
      logger.warn({ id, matches: matches.length }, 'ingest process: ambiguous ID');
      process.exit(1);
    }

    const target = matches[0];
    logger.info({ id, file: target.fullPath }, 'ingest process: starting pipeline');

    intro(`Ingesting ${target.fileName}`);
    const sigintHandler = () => {
      cancel('Cancelled.');
      process.exit(0);
    };
    process.once('SIGINT', sigintHandler);

    const factory = buildIngestFactory(logger, config);
    const { emit, ask } = createCliPresentation();
    const service = factory.create({ vaultPath }, emit, ask);

    try {
      await service.process(target.fullPath);
      process.off('SIGINT', sigintHandler);
      outro(`Ingested: ${target.fileName}`);
    } catch (err) {
      process.off('SIGINT', sigintHandler);
      logger.error({ err }, 'ingest failed');
      cancel(`Error: ${(err as Error).message}`);
      process.exit(1);
    }

    logger.info('ingest complete');
  });

program
  .command('compile')
  .description('Regenerate index, dashboards, and digests from the vault')
  .action(async () => {
    const { vaultPath, logger } = await bootstrap(program.opts());

    intro('Compiling vault');
    const sigintHandler = () => {
      cancel('Cancelled.');
      process.exit(0);
    };
    process.once('SIGINT', sigintHandler);

    const factory = buildCompileFactory(logger);
    const { emit, ask } = createCliPresentation();
    const service = factory.create({ vaultPath }, emit, ask);

    try {
      await service.compile();
      process.off('SIGINT', sigintHandler);
      outro('Compile complete');
    } catch (err) {
      process.off('SIGINT', sigintHandler);
      logger.error({ err }, 'compile failed');
      cancel(`Error: ${(err as Error).message}`);
      process.exit(1);
    }

    logger.info('compile complete');
  });

export function run(): void {
  program.parse();
}
