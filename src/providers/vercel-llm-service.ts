import { streamText } from 'ai';

export class VercelLlmService {
  constructor(
    private model: {
      readonly modelId: string;
    },
  ) {}

  streamText(params: {
    messages?: { role: string; content: string }[];
    prompt?: string;
  }): { textStream: AsyncIterable<string> } {
    return streamText({ model: this.model, ...params });
  }
}
