import { createWriteStream } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { cancel, intro, outro } from '@clack/prompts';
import { program } from 'commander';
import pc from 'picocolors';
import pino from 'pino';
import pkg from '../../package.json' with { type: 'json' };
import { buildIngestFactory, buildPreIngestFactory } from '../composition/root';
import { ConfigLoaderServiceImpl } from '../core/config/config-loader-impl';
import { CONFIG_FILE_NAME } from '../core/config/config-types';
import type { ConfigLoadResult, ExolithConfig } from '../core/config/config-types';
import { FileListServiceImpl } from '../core/file-list-service-impl';
import { createCliIngestPresentation, createCliPreIngestPresentation } from './cli-presentation';

(globalThis as Record<string, unknown>).AI_SDK_LOG_WARNINGS = false;

/** Truncates text to maxLen, appending "..." if shortened. */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  if (maxLen < 4) return '...'.slice(0, maxLen);
  return `${text.slice(0, maxLen - 3)}...`;
}

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

    try {
      await access(configPath);
      process.stderr.write(
        `Error: ${configPath} already exists. Remove it first or use a different directory.\n`,
      );
      process.exit(1);
    } catch {}

    const config: ExolithConfig = { provider: options.provider };

    await mkdir(targetDir, { recursive: true });
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
    process.stderr.write(`Created ${configPath}\n`);
  });

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

    const maxIdWidth = Math.max(8, ...files.map((f) => f.id.length));
    const termWidth = process.stdout.columns ?? 80;
    const fileMaxLen = Math.max(0, termWidth - 2 - maxIdWidth - 2);
    const headerId = pc.bold(pc.underline('ID'.padEnd(maxIdWidth)));
    const headerFile = pc.bold(pc.underline('File'));

    process.stderr.write(
      `\n${pc.bold('Inbox')} (${files.length} file${files.length === 1 ? '' : 's'}):\n\n`,
    );
    process.stdout.write(`  ${headerId}  ${headerFile}\n`);

    for (const file of files) {
      process.stdout.write(
        `  ${pc.cyan(file.id.padEnd(maxIdWidth))}  ${pc.green(truncate(file.fileName, fileMaxLen))}\n`,
      );
    }

    process.stderr.write(
      `\n${pc.dim('Run "exolith pre-ingest process <id>" to start the pipeline.')}\n`,
    );

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

    intro(`Pre-ingesting ${target.fileName}`);
    const sigintHandler = () => {
      cancel('Cancelled.');
      process.exit(0);
    };
    process.once('SIGINT', sigintHandler);

    const factory = buildPreIngestFactory(logger, config);
    const presentation = createCliPreIngestPresentation({ skipDiscuss: options.skipDiscuss });
    const service = factory.create({ maxSourceSize, vaultPath }, presentation);

    try {
      const result = await service.process(target.fullPath);
      process.off('SIGINT', sigintHandler);
      outro(`Source page written: ${result.sourcePath}`);
    } catch (err) {
      process.off('SIGINT', sigintHandler);
      logger.error({ err }, 'pre-ingest failed');
      cancel(`Error: ${(err as Error).message}`);
      process.exit(1);
    }

    logger.info('pre-ingest complete');
  });

const ingestCmd = program.command('ingest').description('Process source pages from the vault');

ingestCmd
  .command('list')
  .description('List source pages in the vault with their content-based IDs')
  .action(async () => {
    const { vaultPath, logger } = await bootstrap(program.opts());

    const sourcesDir = join(vaultPath, 'sources');
    const fileListService = new FileListServiceImpl();
    const files = await fileListService.listFiles(sourcesDir);

    if (files.length === 0) {
      process.stderr.write(`No source pages found (${sourcesDir})\n`);
      logger.info('ingest list: no source pages');
      return;
    }

    const maxIdWidth = Math.max(8, ...files.map((f) => f.id.length));
    const termWidth = process.stdout.columns ?? 80;
    const fileMaxLen = Math.max(0, termWidth - 2 - maxIdWidth - 2);
    const headerId = pc.bold(pc.underline('ID'.padEnd(maxIdWidth)));
    const headerFile = pc.bold(pc.underline('File'));

    process.stderr.write(
      `\n${pc.bold('Source pages')} (${files.length} file${files.length === 1 ? '' : 's'}):\n\n`,
    );
    process.stdout.write(`  ${headerId}  ${headerFile}\n`);

    for (const file of files) {
      process.stdout.write(
        `  ${pc.cyan(file.id.padEnd(maxIdWidth))}  ${pc.green(truncate(file.fileName, fileMaxLen))}\n`,
      );
    }

    process.stderr.write(
      `\n${pc.dim('Run "exolith ingest process <id>" to start the pipeline.')}\n`,
    );

    logger.info({ count: files.length }, 'ingest list');
  });

ingestCmd
  .command('process')
  .description('Run the ingest pipeline on a source page from the vault')
  .argument('<id>', 'ID (or prefix) of the file from "ingest list"')
  .action(async (id, options) => {
    const { vaultPath, logger, config } = await bootstrap(program.opts(), options);

    const sourcesDir = join(vaultPath, 'sources');
    const fileListService = new FileListServiceImpl();
    const files = await fileListService.listFiles(sourcesDir);

    const matches = files.filter((f) => f.id.startsWith(id));

    if (matches.length === 0) {
      process.stderr.write(`Error: No file found with ID prefix "${id}" in ${sourcesDir}\n`);
      logger.warn({ id }, 'ingest process: no match');
      process.exit(1);
    }

    if (matches.length > 1) {
      const maxIdWidth = Math.max(...matches.map((m) => m.id.length));
      process.stderr.write(`Error: ID prefix "${id}" matches multiple files:\n`);
      for (const m of matches) {
        process.stderr.write(`  ${m.id.padEnd(maxIdWidth)}  ${m.fileName}\n`);
      }
      process.stderr.write('Provide a longer ID prefix to disambiguate.\n');
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
    const presentation = createCliIngestPresentation();
    const service = factory.create({ vaultPath }, presentation);

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

export function run(): void {
  program.parse();
}
