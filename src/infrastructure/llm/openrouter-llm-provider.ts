import { generateObject, streamText } from 'ai';
import type { LanguageModel, ModelMessage } from 'ai';
import type { LlmObjectParams, LlmProvider, LlmStreamParams } from './llm-provider';

export class OpenRouterLlmProvider implements LlmProvider {
  constructor(private model: LanguageModel) {}

  streamText(params: LlmStreamParams): { textStream: AsyncIterable<string> } {
    const base = { model: this.model, system: params.system };

    if (params.messages) {
      return streamText({
        ...base,
        messages: params.messages as unknown as ModelMessage[],
      });
    }

    return streamText({ ...base, prompt: params.prompt as string });
  }

  async generateObject<T>(params: LlmObjectParams): Promise<{ object: T }> {
    const aiParams = {
      model: this.model,
      system: params.system,
      messages: params.messages,
      schema: params.schema,
      schemaName: params.schemaName,
      schemaDescription: params.schemaDescription,
    } as unknown as Parameters<typeof generateObject>[0];

    const result = await generateObject(aiParams);
    return { object: result.object as T };
  }
}
