export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmService {
  generateStream(messages: LlmMessage[], onChunk: (chunk: string) => void): Promise<string>;

  generate(prompt: string): Promise<string>;
}
