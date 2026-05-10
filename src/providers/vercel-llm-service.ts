import { generateObject, streamText } from 'ai';
import type { LlmObjectParams, LlmProvider, LlmStreamParams } from '../llm-provider';

export class VercelLlmService implements LlmProvider {
  constructor(
    private model: {
      readonly modelId: string;
    },
  ) {}

  streamText(params: LlmStreamParams): { textStream: AsyncIterable<string> } {
    return streamText({ model: this.model, ...params });
  }

  async generateObject<T>(params: LlmObjectParams): Promise<{ object: T }> {
    const result = await generateObject<Record<string, unknown>>({
      model: this.model,
      system: params.system,
      messages: params.messages,
      schema: params.schema,
      schemaName: params.schemaName,
      schemaDescription: params.schemaDescription,
    });

    return { object: result.object as T };
  }
}
