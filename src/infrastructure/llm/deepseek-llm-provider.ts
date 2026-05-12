import { generateObject, jsonSchema, streamText } from 'ai';
import type { LanguageModel, ModelMessage } from 'ai';
import type { LlmObjectParams, LlmProvider, LlmStreamParams } from './llm-provider';

/** Thin adapter that bridges {@link LlmProvider} to the DeepSeek AI SDK {@link LanguageModel}. */
export class DeepSeekLlmProvider implements LlmProvider {
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
    const result = await generateObject({
      model: this.model,
      system: params.system,
      messages: params.messages as unknown as ModelMessage[],
      schema: jsonSchema(params.schema),
      schemaName: params.schemaName,
      schemaDescription: params.schemaDescription,
    });
    return { object: result.object as T };
  }
}
