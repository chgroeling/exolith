import { Environment, FileSystemLoader } from 'nunjucks';
import pino from 'pino';
import type { Logger } from 'pino';
import type { PromptService } from './prompt-service';

export class PromptServiceImpl implements PromptService {
  private env: Environment;
  private logger: Logger;

  constructor(templateDir: string, parentLogger?: Logger) {
    this.env = new Environment(new FileSystemLoader(templateDir), {
      autoescape: false,
    });
    this.logger = parentLogger?.child({ name: 'prompt-service-impl' }) ?? pino({ enabled: false });
    this.logger.info({ templateDir }, 'PromptService initialized');
  }

  render(templateName: string, context: Record<string, unknown>): string {
    const name = templateName.endsWith('.njk') ? templateName : `${templateName}.njk`;
    this.logger.debug(
      { templateName: name, contextKeys: Object.keys(context) },
      'Rendering template',
    );
    const result = this.env.render(name, context);
    this.logger.debug({ templateName: name, resultLength: result.length }, 'Template rendered');
    return result;
  }
}
