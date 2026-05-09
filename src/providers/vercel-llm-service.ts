import { streamText } from 'ai';
import pino from 'pino';

export class VercelLlmService {
  private logger = pino({ name: 'vercel-llm-service' });

  constructor(
    private model: {
      readonly modelId: string;
    },
  ) {}

  async generateStream(
    messages: { role: string; content: string }[],
    onChunk: (chunk: string) => void,
  ): Promise<void> {
    this.logger.debug({ messageCount: messages.length }, 'generateStream started');
    const result = streamText({ model: this.model, messages });

    for await (const chunk of result.textStream) {
      onChunk(chunk);
    }

    this.logger.debug({ messageCount: messages.length }, 'generateStream completed');
  }

  async generate(prompt: string): Promise<string> {
    this.logger.debug({ promptLength: prompt.length }, 'generate started');
    const result = streamText({ model: this.model, prompt });

    let text = '';
    for await (const chunk of result.textStream) {
      text += chunk;
    }

    this.logger.debug({ responseLength: text.length }, 'generate completed');
    return text;
  }
}
