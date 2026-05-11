import pino from 'pino';
import type { Logger } from 'pino';
import type { LlmProvider } from './llm-provider';
import type { LlmService, LlmSession, LlmStructuredRequest } from './llm-service';
import { LlmSessionImpl } from './llm-session-impl';

export class LlmServiceImpl implements LlmService {
  private logger: Logger;

  constructor(
    private provider: LlmProvider,
    parentLogger?: Logger,
  ) {
    this.logger = parentLogger?.child({ logger: 'llm-service-impl' }) ?? pino({ enabled: false });
  }

  async complete(prompt: string, systemPrompt: string): Promise<string> {
    this.logger.debug({ promptLength: prompt.length }, 'complete started');

    const result = this.provider.streamText({ system: systemPrompt, prompt });

    let text = '';
    for await (const chunk of result.textStream) {
      text += chunk;
    }

    this.logger.debug({ responseLength: text.length }, 'complete finished');
    return text;
  }

  createSession(systemPrompt: string): LlmSession {
    this.logger.debug('createSession');
    return new LlmSessionImpl(this.provider, systemPrompt, this.logger);
  }

  async generateStructured<T>(request: LlmStructuredRequest): Promise<T> {
    this.logger.debug(
      { schemaName: request.schemaName, messageCount: request.messages.length },
      'generateStructured started',
    );

    const result = await this.provider.generateObject<T>({
      system: request.systemPrompt,
      messages: request.messages,
      schema: request.schema,
      schemaName: request.schemaName,
      schemaDescription: request.schemaDescription,
    });

    this.logger.debug({ schemaName: request.schemaName }, 'generateStructured finished');
    return result.object;
  }
}
