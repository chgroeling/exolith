export interface LlmProvider {
  streamText(params: {
    messages?: { role: string; content: string }[];
    prompt?: string;
  }): { textStream: AsyncIterable<string> };
}
