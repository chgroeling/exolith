import { generateObject, jsonSchema, streamText } from 'ai';
import type { LanguageModel, ModelMessage } from 'ai';
import type { LlmObjectParams, LlmProvider, LlmStreamParams } from './llm-provider';

export class OpenRouterLlmProvider implements LlmProvider {
  constructor(
    private model: LanguageModel,
    private providerOptions?: Record<string, Record<string, unknown>>,
  ) {}

  streamText(params: LlmStreamParams): { textStream: AsyncIterable<string> } {
    const base = { model: this.model, system: params.system };

    if (params.messages) {
      return streamText({
        ...base,
        messages: params.messages as unknown as ModelMessage[],
        providerOptions: this.providerOptions,
      } as unknown as Parameters<typeof streamText>[0]);
    }

    return streamText({
      ...base,
      prompt: params.prompt as string,
      providerOptions: this.providerOptions,
    } as unknown as Parameters<typeof streamText>[0]);
  }

  async generateObject<T>(params: LlmObjectParams): Promise<{ object: T }> {
    const result = await generateObject({
      model: this.model,
      system: params.system,
      messages: params.messages as unknown as ModelMessage[],
      schema: jsonSchema(params.schema),
      schemaName: params.schemaName,
      schemaDescription: params.schemaDescription,
      providerOptions: this.providerOptions,
    } as unknown as Parameters<typeof generateObject>[0]);
    return { object: result.object as T };
  }
}
