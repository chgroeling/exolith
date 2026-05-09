export interface PromptService {
  render(templateName: string, context: Record<string, unknown>): string;
}
