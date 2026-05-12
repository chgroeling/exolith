import { describe, expect, it } from 'vitest';
import type { LlmProvider } from '../../../src/infrastructure/llm/llm-provider';
import { LlmSessionImpl } from '../../../src/infrastructure/llm/llm-session-impl';

function makeMockProvider(opts?: {
  streamChunks?: string[];
  objectResult?: unknown;
}): LlmProvider {
  return {
    streamText(_params) {
      const chunks = opts?.streamChunks ?? ['mock-chunk'];
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

describe('LlmSessionImpl', () => {
  it('initializes with system prompt as first message', () => {
    const provider = makeMockProvider();
    const session = new LlmSessionImpl(provider, 'system-prompt');

    const messages = session.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ role: 'system', content: 'system-prompt' });
  });

  it('adds user messages to the history', () => {
    const provider = makeMockProvider();
    const session = new LlmSessionImpl(provider, 'system');

    session.addUserMessage('hello');
    session.addUserMessage('world');

    const messages = session.getMessages();
    expect(messages).toHaveLength(3);
    expect(messages[1]).toEqual({ role: 'user', content: 'hello' });
    expect(messages[2]).toEqual({ role: 'user', content: 'world' });
  });

  it('adds assistant messages to the history', () => {
    const provider = makeMockProvider();
    const session = new LlmSessionImpl(provider, 'system');

    session.addAssistantMessage('reply');

    const messages = session.getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[1]).toEqual({ role: 'assistant', content: 'reply' });
  });

  it('returns frozen messages from getMessages', () => {
    const provider = makeMockProvider();
    const session = new LlmSessionImpl(provider, 'system');

    const messages = session.getMessages();
    expect(Object.isFrozen(messages)).toBe(true);
  });

  it('streams chunks via onChunk', async () => {
    const provider = makeMockProvider({ streamChunks: ['chunk1', 'chunk2'] });
    const session = new LlmSessionImpl(provider, 'system');

    session.addUserMessage('hello');

    const chunks: string[] = [];
    await session.stream((chunk) => chunks.push(chunk));

    expect(chunks).toEqual(['chunk1', 'chunk2']);
  });

  it('does not auto-append stream response to history', async () => {
    const provider = makeMockProvider({ streamChunks: ['response'] });
    const session = new LlmSessionImpl(provider, 'system');

    session.addUserMessage('hello');
    await session.stream(() => {});

    const messages = session.getMessages();
    expect(messages).toHaveLength(2); // system + user only
  });

  it('collects full response via complete', async () => {
    const provider = makeMockProvider({ streamChunks: ['a', 'b', 'c'] });
    const session = new LlmSessionImpl(provider, 'system');

    session.addUserMessage('hello');
    const result = await session.complete();

    expect(result).toBe('abc');
  });

  it('passes system prompt separately via provider', async () => {
    let capturedSystem = '';
    const provider: LlmProvider = {
      streamText(params) {
        capturedSystem = params.system;
        return { textStream: (async function* () {})() };
      },
      async generateObject<T>(_params) {
        return { object: {} as T };
      },
    };

    const session = new LlmSessionImpl(provider, 'custom-system');
    session.addUserMessage('hello');
    await session.stream(() => {});

    expect(capturedSystem).toBe('custom-system');
  });
});
