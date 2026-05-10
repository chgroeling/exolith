import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PromptServiceImpl } from '../../src/services/prompt-service-impl';

describe('PromptServiceImpl', () => {
  let templateDir: string;

  afterEach(async () => {
    if (templateDir) {
      await rm(templateDir, { recursive: true, force: true });
    }
  });

  async function setupTemplate(name: string, content: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'exolith-prompt-test-'));
    await writeFile(join(dir, name), content, 'utf-8');
    return dir;
  }

  it('renders a template with .njk extension', async () => {
    templateDir = await setupTemplate('greet.njk', 'Hello, {{ name }}!');
    const service = new PromptServiceImpl(templateDir);

    const result = service.render('greet.njk', { name: 'World' });

    expect(result).toBe('Hello, World!');
  });

  it('appends .njk extension when omitted', async () => {
    templateDir = await setupTemplate('greet.njk', 'Hello, {{ name }}!');
    const service = new PromptServiceImpl(templateDir);

    const result = service.render('greet', { name: 'World' });

    expect(result).toBe('Hello, World!');
  });

  it('substitutes multiple context variables', async () => {
    templateDir = await setupTemplate(
      'multi.njk',
      '{{ greeting }}, {{ name }}! Score: {{ score }}',
    );
    const service = new PromptServiceImpl(templateDir);

    const result = service.render('multi', { greeting: 'Hi', name: 'Alice', score: 42 });

    expect(result).toBe('Hi, Alice! Score: 42');
  });

  it('passes raw content through nunjucks verbatim when no variables match', async () => {
    templateDir = await setupTemplate('plain.njk', 'Just some text without variables.');
    const service = new PromptServiceImpl(templateDir);

    const result = service.render('plain', {});

    expect(result).toBe('Just some text without variables.');
  });

  it('throws when template file does not exist', async () => {
    templateDir = await mkdtemp(join(tmpdir(), 'exolith-prompt-test-'));
    const service = new PromptServiceImpl(templateDir);

    expect(() => service.render('missing', {})).toThrow();
  });
});
