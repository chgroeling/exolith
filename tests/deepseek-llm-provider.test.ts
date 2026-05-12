(globalThis as Record<string, unknown>).AI_SDK_LOG_WARNINGS = false;

import type { LanguageModel } from 'ai';
import { describe, expect, it } from 'vitest';
import { DeepSeekLlmProvider } from '../src/infrastructure/llm/deepseek-llm-provider';

function makeMockModel(): LanguageModel {
  return {
    specificationVersion: 'v2',
    provider: 'deepseek',
    modelId: 'deepseek-chat',
    defaultObjectGenerationMode: 'json',
    supportsImageUrls: false,
    supportsUrl: null,
    supportsStructuredOutputs: true,
    supportsUrlCacheControl: false,
    supportsPromptCaching: false,
    doGenerate() {
      return Promise.resolve({
        text: '',
        usage: { promptTokens: 0, completionTokens: 0 },
        finishReason: 'stop',
      });
    },
    doStream() {
      return Promise.resolve({
        stream: new ReadableStream(),
      });
    },
  } as unknown as LanguageModel;
}

describe('DeepSeekLlmProvider', () => {
  it('implements LlmProvider and returns an AsyncIterable from streamText with prompt', () => {
    const model = makeMockModel();
    const provider = new DeepSeekLlmProvider(model);

    const result = provider.streamText({ system: 'system', prompt: 'prompt' });

    expect(result.textStream).toBeDefined();
    expect(result.textStream[Symbol.asyncIterator]).toBeDefined();
  });

  it('paths to messages when messages param is provided', () => {
    const model = makeMockModel();
    const provider = new DeepSeekLlmProvider(model);

    const result = provider.streamText({
      system: 'system',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(result.textStream).toBeDefined();
    expect(result.textStream[Symbol.asyncIterator]).toBeDefined();
  });

  it('constructs provider with a model', () => {
    const model = makeMockModel();
    const provider = new DeepSeekLlmProvider(model);

    expect(provider).toBeInstanceOf(DeepSeekLlmProvider);
  });
});
