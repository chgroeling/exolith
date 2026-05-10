import { describe, expect, it } from 'vitest';
import type { LlmProvider } from '../src/infrastructure/llm/llm-provider';
import { LlmServiceImpl } from '../src/infrastructure/llm/llm-service-impl';

function makeMockProvider(opts?: {
  streamChunks?: string[];
  objectResult?: unknown;
}): LlmProvider {
  return {
    streamText(_params) {
      const chunks = opts?.streamChunks ?? ['mock'];
      return {
        textStream: (async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        })(),
      };
    },
    async generateObject<T>(_params) {
      return { object: (opts?.objectResult ?? {}) as T };
    },
  };
}

describe('LlmServiceImpl', () => {
  describe('complete', () => {
    it('returns the full generated text', async () => {
      const provider = makeMockProvider({ streamChunks: ['hello', ' ', 'world'] });
      const service = new LlmServiceImpl(provider);

      const result = await service.complete('prompt', 'system');

      expect(result).toBe('hello world');
    });

    it('passes system prompt and prompt to provider', async () => {
      let capturedSystem = '';
      let capturedPrompt = '';
      const provider: LlmProvider = {
        streamText(params) {
          capturedSystem = params.system;
          capturedPrompt = params.prompt ?? '';
          return { textStream: (async function* () {})() };
        },
        async generateObject<T>(_params) {
          return { object: {} as T };
        },
      };

      const service = new LlmServiceImpl(provider);
      await service.complete('my-prompt', 'my-system');

      expect(capturedSystem).toBe('my-system');
      expect(capturedPrompt).toBe('my-prompt');
    });
  });

  describe('createSession', () => {
    it('returns a session with the given system prompt', () => {
      const provider = makeMockProvider();
      const service = new LlmServiceImpl(provider);

      const session = service.createSession('system-prompt');

      const messages = session.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ role: 'system', content: 'system-prompt' });
    });

    it('session can add messages and stream', async () => {
      const provider = makeMockProvider({ streamChunks: ['response'] });
      const service = new LlmServiceImpl(provider);

      const session = service.createSession('system');
      session.addUserMessage('hello');

      const chunks: string[] = [];
      await session.stream((chunk) => chunks.push(chunk));

      expect(chunks).toEqual(['response']);
    });
  });

  describe('generateStructured', () => {
    it('returns the typed object from the provider', async () => {
      const expected = { name: 'test', value: 42 };
      const provider = makeMockProvider({ objectResult: expected });
      const service = new LlmServiceImpl(provider);

      const result = await service.generateStructured({
        systemPrompt: 'system',
        messages: [{ role: 'user', content: 'extract this' }],
        schema: { type: 'object', properties: {} },
        schemaName: 'TestSchema',
        schemaDescription: 'A test schema',
      });

      expect(result).toEqual(expected);
    });

    it('passes all params to provider', async () => {
      let capturedParams: Record<string, unknown> = {};
      const provider: LlmProvider = {
        streamText(_params) {
          return { textStream: (async function* () {})() };
        },
        async generateObject<T>(params) {
          capturedParams = {
            system: params.system,
            schemaName: params.schemaName,
            schemaDescription: params.schemaDescription,
            messageCount: params.messages.length,
          };
          return { object: {} as T };
        },
      };

      const service = new LlmServiceImpl(provider);
      await service.generateStructured({
        systemPrompt: 'my-system',
        messages: [
          { role: 'user', content: 'a' },
          { role: 'assistant', content: 'b' },
        ],
        schema: { type: 'object' },
        schemaName: 'MySchema',
        schemaDescription: 'Does something',
      });

      expect(capturedParams).toEqual({
        system: 'my-system',
        schemaName: 'MySchema',
        schemaDescription: 'Does something',
        messageCount: 2,
      });
    });
  });
});
