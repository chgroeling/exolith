import pino from 'pino';
import type { Logger } from 'pino';
import type { LlmProvider } from './llm-provider';
import type { LlmMessage, LlmSession } from './llm-service';

export class LlmSessionImpl implements LlmSession {
  private logger: Logger;

  private messages: LlmMessage[];

  constructor(
    private provider: LlmProvider,
    systemPrompt: string,
    parentLogger?: Logger,
  ) {
    this.logger = parentLogger?.child({ name: 'llm-session-impl' }) ?? pino({ enabled: false });
    this.messages = [{ role: 'system', content: systemPrompt }];
  }

  addUserMessage(content: string): void {
    this.messages.push({ role: 'user', content });
    this.logger.trace({ role: 'user', contentLength: content.length }, 'addUserMessage');
  }

  addAssistantMessage(content: string): void {
    this.messages.push({ role: 'assistant', content });
    this.logger.trace({ role: 'assistant', contentLength: content.length }, 'addAssistantMessage');
  }

  async stream(onChunk: (chunk: string) => void): Promise<void> {
    const systemMsg = this.messages[0];
    const chatMessages = this.messages.slice(1);

    this.logger.debug({ messageCount: chatMessages.length }, 'session stream started');

    const result = this.provider.streamText({
      system: systemMsg.content,
      messages: chatMessages,
    });

    for await (const chunk of result.textStream) {
      onChunk(chunk);
    }

    this.logger.debug({ messageCount: chatMessages.length }, 'session stream completed');
  }

  async complete(): Promise<string> {
    const systemMsg = this.messages[0];
    const chatMessages = this.messages.slice(1);

    this.logger.debug({ messageCount: chatMessages.length }, 'session complete started');

    const result = this.provider.streamText({
      system: systemMsg.content,
      messages: chatMessages,
    });

    let text = '';
    for await (const chunk of result.textStream) {
      text += chunk;
    }

    this.logger.debug(
      { messageCount: chatMessages.length, responseLength: text.length },
      'session complete finished',
    );
    return text;
  }

  getMessages(): readonly LlmMessage[] {
    return Object.freeze([...this.messages]);
  }
}
