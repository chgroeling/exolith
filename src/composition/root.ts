import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';
import type { Logger } from 'pino';
import type { ExolithConfig } from '../core/config/config-types';
import { IdentifierServiceImpl } from '../core/identifier-service-impl';
import { SluggerServiceImpl } from '../core/slugger-service-impl';
import { DeepSeekLlmProvider } from '../infrastructure/llm/deepseek-llm-provider';
import type { LlmProvider } from '../infrastructure/llm/llm-provider';
import { LlmServiceImpl } from '../infrastructure/llm/llm-service-impl';
import { OpenRouterLlmProvider } from '../infrastructure/llm/openrouter-llm-provider';
import { PromptServiceImpl } from '../infrastructure/prompt/prompt-service-impl';
import type { CompileServiceFactory } from '../operations/compile/compile-service';
import { CompileServiceFactoryImpl } from '../operations/compile/compile-service-factory-impl';
import type { IngestServiceFactory } from '../operations/ingest/ingest-service';
import { IngestServiceFactoryImpl } from '../operations/ingest/ingest-service-factory-impl';
import type { PreIngestServiceFactory } from '../operations/pre-ingest/pre-ingest-service';
import { PreIngestServiceFactoryImpl } from '../operations/pre-ingest/pre-ingest-service-factory-impl';

/** Reasoninglevel values that the config accepts. */
type ReasoningLevel = 'off' | 'low' | 'medium' | 'high' | 'max';

/** Resolves the template directory for both dev and bundled modes. */
export function resolveTemplateDir(importMetaUrl: string): string {
  const bundledDir = fileURLToPath(new URL('./templates', importMetaUrl));
  const devDir = fileURLToPath(new URL('../../templates', importMetaUrl));
  return existsSync(bundledDir) ? bundledDir : devDir;
}

function buildDeepSeekOptions(level: ReasoningLevel): Record<string, unknown> {
  if (level === 'off') {
    return { thinking: { type: 'disabled' } };
  }
  if (level === 'max') {
    return { thinking: { type: 'enabled' }, reasoningEffort: 'max' };
  }
  return { thinking: { type: 'enabled' }, reasoningEffort: 'high' };
}

function buildOpenRouterOptions(level: ReasoningLevel): Record<string, unknown> {
  if (level === 'off') {
    return {};
  }
  const effortMap: Record<string, string> = {
    low: 'low',
    medium: 'medium',
    high: 'high',
    max: 'xhigh',
  };
  return { reasoning: { effort: effortMap[level] } };
}

/** Shared wiring helpers used by both factories. */
function wireServices(logger: Logger, config: ExolithConfig) {
  const model = createModel(config);
  const level: ReasoningLevel = config.reasoningLevel ?? 'off';
  const providerOptions: Record<string, Record<string, unknown>> = config.provider === 'deepseek'
    ? { deepseek: buildDeepSeekOptions(level) }
    : { openrouter: buildOpenRouterOptions(level) };
  const provider = createProvider(config.provider, model, providerOptions);
  const slugger = new SluggerServiceImpl();
  const identifier = new IdentifierServiceImpl(slugger);
  const llmService = new LlmServiceImpl(provider, logger);
  const promptService = new PromptServiceImpl(resolveTemplateDir(import.meta.url), logger);

  return { llmService, identifier, promptService };
}

function createModel(config: ExolithConfig): LanguageModel {
  if (config.provider === 'deepseek') {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error(
        'DEEPSEEK_API_KEY environment variable is required for the DeepSeek provider.',
      );
    }

    const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
    return deepseek(config.model ?? 'deepseek-chat');
  }

  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      'OPENROUTER_API_KEY environment variable is required for the OpenRouter provider.',
    );
  }

  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
  return openrouter(config.model ?? 'deepseek/deepseek-v4-pro');
}

function createProvider(
  provider: string,
  model: LanguageModel,
  providerOptions?: Record<string, Record<string, unknown>>,
): LlmProvider {
  if (provider === 'deepseek') {
    return new DeepSeekLlmProvider(model, providerOptions);
  }
  return new OpenRouterLlmProvider(model, providerOptions);
}

/** Builds the pre-ingest factory wired with all dependencies. */
export function buildPreIngestFactory(
  logger: Logger,
  config: ExolithConfig,
): PreIngestServiceFactory {
  const { llmService, identifier, promptService } = wireServices(logger, config);
  return new PreIngestServiceFactoryImpl(llmService, identifier, promptService, logger);
}

/** Builds the compile factory wired with all dependencies. */
export function buildCompileFactory(logger: Logger): CompileServiceFactory {
  return new CompileServiceFactoryImpl(logger);
}

/** Builds the ingest factory wired with all dependencies. */
export function buildIngestFactory(logger: Logger, config: ExolithConfig): IngestServiceFactory {
  const { llmService, identifier, promptService } = wireServices(logger, config);
  const compileServiceFactory = buildCompileFactory(logger);
  return new IngestServiceFactoryImpl(
    llmService,
    identifier,
    promptService,
    compileServiceFactory,
    logger,
  );
}
