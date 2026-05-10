import { createWriteStream, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { program } from 'commander';
import { render } from 'ink';
import pino from 'pino';
import { createElement } from 'react';
import { VercelLlmService } from './providers/vercel-llm-service';
import { IdentifierServiceImpl } from './services/identifier-service-impl';
import { IngestServiceFactoryImpl } from './services/ingest-service-factory-impl';
import { LlmServiceImpl } from './services/llm-service-impl';
import { PromptServiceImpl } from './services/prompt-service-impl';
import { SluggerServiceImpl } from './services/slugger-service-impl';
import { App } from './tui/app';

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
    .option('--max-source-size <bytes>', 'maximum source file size in bytes', '10485760')
    .option('--vault <path>', 'path to the vault directory', '.')
    .action(async (options) => {
      const logStream = createWriteStream(options.logFile, { flags: 'w' });
      const logger = pino({ name: 'exolith', level: options.logLevel }, logStream);

      logger.info('CLI started');

      const model = openrouter('deepseek/deepseek-v4-pro');
      const slugger = new SluggerServiceImpl();
      const identifier = new IdentifierServiceImpl(slugger);
      const provider = new VercelLlmService(model);
      const llmService = new LlmServiceImpl(provider, logger);
      const promptService = new PromptServiceImpl(resolveTemplateDir(import.meta.url), logger);
      const ingestFactory = new IngestServiceFactoryImpl(
        llmService,
        identifier,
        promptService,
        logger,
      );

      const { waitUntilExit } = render(
        createElement(App, {
          ingestFactory,
          maxSourceSize: Number.parseInt(options.maxSourceSize),
          vaultPath: options.vault,
        }),
      );
      await waitUntilExit();

      logger.info('CLI finished');
    });

  program.parse();
}
