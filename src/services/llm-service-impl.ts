import pino from 'pino';
import type { LlmProvider } from '../llm-provider';

export class LlmServiceImpl {
  private logger = pino({ name: 'llm-service-impl' });

  constructor(private provider: LlmProvider) {}

  async generateStream(
    messages: { role: string; content: string }[],
    onChunk: (chunk: string) => void,
  ): Promise<void> {
    this.logger.debug({ messageCount: messages.length }, 'generateStream started');
    const result = this.provider.streamText({ messages });

    for await (const chunk of result.textStream) {
      onChunk(chunk);
    }

    this.logger.debug({ messageCount: messages.length }, 'generateStream completed');
  }

  async generate(prompt: string): Promise<string> {
    this.logger.debug({ promptLength: prompt.length }, 'generate started');
    const result = this.provider.streamText({ prompt });

    let text = '';
    for await (const chunk of result.textStream) {
      text += chunk;
    }

    this.logger.debug({ responseLength: text.length }, 'generate completed');
    return text;
  }
}
