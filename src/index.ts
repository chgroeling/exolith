import { createWriteStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { program } from 'commander';
import pino from 'pino';
import { Ingest, type IngestConfig } from './operations/ingest';
import { VercelLlmService } from './providers/vercel-llm-service';
import { IdentifierServiceImpl } from './services/identifier-service-impl';
import { LlmServiceImpl } from './services/llm-service-impl';
import { PromptServiceImpl } from './services/prompt-service-impl';
import { SluggerServiceImpl } from './services/slugger-service-impl';

function resolveTemplateDir(importMetaUrl: string): string {
  const bundledDir = fileURLToPath(new URL('./templates', importMetaUrl));
  const devDir = fileURLToPath(new URL('../templates', importMetaUrl));
  return existsSync(bundledDir) ? bundledDir : devDir;
}

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

if (import.meta.url === `file://${process.argv[1]}`) {
  program
    .name('exolith')
    .description('A CLI for ingesting knowledge into the exolith vault')
    .option('-l, --log-file <path>', 'path to log file', 'exolith.log')
    .option('--log-level <level>', 'log level', 'info')
    .option('-i, --inbox <path>', 'run the ingest pipeline on a raw source file')
    .option('--max-source-size <bytes>', 'maximum source file size in bytes', '10485760')
    .option('--vault <path>', 'path to the vault directory', '.')
    .action(async (options) => {
      const logStream = createWriteStream(options.logFile, { flags: 'w' });
      const logger = pino({ name: 'exolith', level: options.logLevel }, logStream);

      logger.info('CLI started');

      const write = (chunk: string) => process.stdout.write(chunk);

      if (options.inbox) {
        const model = openrouter('deepseek/deepseek-v4-pro');
        const slugger = new SluggerServiceImpl();
        const identifier = new IdentifierServiceImpl(slugger);
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const config: IngestConfig = {
          maxSourceSize: Number.parseInt(options.maxSourceSize),
          vaultPath: options.vault,
          onChunk: write,
          readInput: () => rl.question('> '),
        };
        const provider = new VercelLlmService(model);
        const llmService = new LlmServiceImpl(provider, logger);
        const promptService = new PromptServiceImpl(resolveTemplateDir(import.meta.url), logger);
        const ingest = new Ingest(llmService, identifier, promptService, config, logger);
        await ingest.process(options.inbox);
        rl.close();
      }

      logger.info('CLI finished');
    });

  program.parse();
}
