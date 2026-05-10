import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { Logger } from 'pino';
import { IdentifierServiceImpl } from '../core/identifier-service-impl';
import { SluggerServiceImpl } from '../core/slugger-service-impl';
import { LlmServiceImpl } from '../infrastructure/llm/llm-service-impl';
import { OpenRouterLlmProvider } from '../infrastructure/llm/openrouter-llm-provider';
import { PromptServiceImpl } from '../infrastructure/prompt/prompt-service-impl';
import type { IngestServiceFactory } from '../operations/ingest/ingest-service';
import { IngestServiceFactoryImpl } from '../operations/ingest/ingest-service-factory-impl';

/** Resolves the template directory for both dev and bundled modes. */
export function resolveTemplateDir(importMetaUrl: string): string {
  const bundledDir = fileURLToPath(new URL('./templates', importMetaUrl));
  const devDir = fileURLToPath(new URL('../../templates', importMetaUrl));
  return existsSync(bundledDir) ? bundledDir : devDir;
}

/** Builds and wires the full dependency graph. */
export function buildIngestFactory(logger: Logger): IngestServiceFactory {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  const model = openrouter('deepseek/deepseek-v4-pro');
  const slugger = new SluggerServiceImpl();
  const identifier = new IdentifierServiceImpl(slugger);
  const provider = new OpenRouterLlmProvider(model);
  const llmService = new LlmServiceImpl(provider, logger);
  const promptService = new PromptServiceImpl(resolveTemplateDir(import.meta.url), logger);

  return new IngestServiceFactoryImpl(llmService, identifier, promptService, logger);
}
