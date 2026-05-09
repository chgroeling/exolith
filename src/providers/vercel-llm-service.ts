import { streamText } from 'ai';
import type { LanguageModel, ModelMessage } from 'ai';
import type { LlmProvider } from '../llm-provider';

export class VercelLlmService implements LlmProvider {
  constructor(private model: LanguageModel) {}

  streamText(params: {
    messages?: { role: string; content: string }[];
    prompt?: string;
  }): { textStream: AsyncIterable<string> } {
    if (params.messages) {
      return streamText({ model: this.model, messages: params.messages as ModelMessage[] });
    }
    return streamText({ model: this.model, prompt: params.prompt ?? '' });
  }
}
