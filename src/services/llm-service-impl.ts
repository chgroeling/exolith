import pino from 'pino';
import type { Logger } from 'pino';
import type { LlmProvider } from '../llm-provider';

export class LlmServiceImpl {
  private logger: Logger;

  constructor(
    private provider: LlmProvider,
    parentLogger?: Logger,
  ) {
    this.logger = (parentLogger ?? pino()).child({ name: 'llm-service-impl' });
  }

  async generateStream(
    messages: { role: string; content: string }[],
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    this.logger.debug({ messageCount: messages.length }, 'generateStream started');
    const result = this.provider.streamText({ messages });

    let text = '';
    for await (const chunk of result.textStream) {
      onChunk(chunk);
      text += chunk;
    }

    this.logger.debug({ messageCount: messages.length }, 'generateStream completed');
    return text;
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
