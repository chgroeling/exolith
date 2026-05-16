// Specification: docs/operations/enqueue.md

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { IdentifierService } from '../../../src/core/identifier-service';
import type { IdentifierType } from '../../../src/core/types';
import type { LlmService, LlmStructuredRequest } from '../../../src/infrastructure/llm/llm-service';
import type { PromptService } from '../../../src/infrastructure/prompt/prompt-service';
import type { EnqueueConfig } from '../../../src/operations/enqueue/enqueue-service';
import { Enqueue } from '../../../src/operations/enqueue/enqueue-service-impl';
import type { PipelineEvent, Question } from '../../../src/operations/pipeline-presentation';

function makeMockLlm(opts?: {
  streamDelay?: () => Promise<void>;
  completeResponse?: string;
  structuredResponse?: Record<string, unknown>;
}): LlmService {
  return {
    async complete(_prompt, _systemPrompt) {
      return opts?.completeResponse ?? 'mock summary';
    },
    createSession(_systemPrompt) {
      const messages: { role: string; content: string }[] = [];
      return {
        addUserMessage(content: string) {
          messages.push({ role: 'user', content });
        },
        addAssistantMessage(content: string) {
          messages.push({ role: 'assistant', content });
        },
        async stream(onChunk: (chunk: string) => void) {
          if (opts?.streamDelay) await opts.streamDelay();
          onChunk('mock-chunk');
        },
        async complete() {
          return opts?.completeResponse ?? 'mock summary';
        },
        getMessages() {
          return Object.freeze([...messages]);
        },
      };
    },
    async generateStructured<T>(_request: LlmStructuredRequest): Promise<T> {
      return (opts?.structuredResponse ?? defaultSourcePage) as unknown as T;
    },
  };
}

const defaultSourcePage = {
  title: 'Test Page',
  type: 'article',
  authors: ['Test Author'],
  date: '2026-01-01',
  reference: '-',
  summary: 'Test summary paragraph.',
  mainPoints: ['Main point 1', 'Main point 2'],
  tags: ['test', 'example'],
};

function makeMockIdentifier(): IdentifierService {
  return {
    createId(type: IdentifierType, text: string) {
      return `${type}.${text.toLowerCase().replace(/\s+/g, '-')}`;
    },
    decomposeId(id: string) {
      const dot = id.indexOf('.');
      return { type: id.slice(0, dot) as IdentifierType, slug: id.slice(dot + 1) };
    },
  };
}

function makeMockPrompt(): PromptService {
  return {
    render(templateName: string, context: Record<string, unknown>): string {
      if (templateName === 'source-page-output') {
        return [
          '---',
          `id: ${context.id}`,
          `title: ${context.title}`,
          'status: active',
          'tags:',
          ...(context.tags as string[]).map((t: string) => `  - ${t}`),
          `created: ${context.created}`,
          `updated: ${context.updated}`,
          'authors:',
          ...(context.authors as string[]).map((a: string) => `  - ${a}`),
          `reference: ${context.reference}`,
          `rawSource: raw-sources/${context.fileName}`,
          '---',
          '',
          `# ${context.title}`,
          '',
          `*Type:* ${context.type}`,
          '',
          context.summary as string,
          '',
          '## Main Points',
          ...(context.mainPoints as string[]).map((p: string) => `- ${p}`),
          '',
        ].join('\n');
      }
      return Object.entries(context)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    },
  };
}

function makeMockEmit(opts?: {
  onEmit?: (event: PipelineEvent) => void;
}): (event: PipelineEvent) => void {
  return (event: PipelineEvent) => {
    opts?.onEmit?.(event);
    if (event.type === 'input_required') {
      event.resolve('');
    }
  };
}

function makeMockAsk<T>(response: T): <U>(question: Question<U>) => Promise<U> {
  return <U>() => Promise.resolve(response as unknown as U);
}

function makeConfig(overrides?: Partial<EnqueueConfig>): EnqueueConfig {
  return {
    maxSourceSize: 1024 * 1024,
    vaultPath: join(tmpdir(), `exolith-test-${Date.now()}`),
    ...overrides,
  };
}

describe('Enqueue', () => {
  describe('readRawSource', () => {
    it('reads a valid .md file', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'test.md');
      await writeFile(filePath, '# Hello\n\nWorld', 'utf-8');

      const emit = makeMockEmit();
      const ask = makeMockAsk(true);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await expect(enqueue.process(filePath)).resolves.not.toThrow();
    });

    it('rejects unsupported file extensions', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'test.pdf');
      await writeFile(filePath, 'not a pdf', 'utf-8');

      const emit = makeMockEmit();
      const ask = makeMockAsk(true);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await expect(enqueue.process(filePath)).rejects.toThrow('Unsupported file type');
    });

    it('rejects files exceeding maxSourceSize', async () => {
      const config = makeConfig({ maxSourceSize: 10 });
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'big.md');
      await writeFile(filePath, 'x'.repeat(100), 'utf-8');

      const emit = makeMockEmit();
      const ask = makeMockAsk(true);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await expect(enqueue.process(filePath)).rejects.toThrow('Source file exceeds maximum size');
    });

    it('rejects binary files', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'bin.txt');
      const buf = Buffer.alloc(50);
      buf[20] = 0;
      await writeFile(filePath, buf);

      const emit = makeMockEmit();
      const ask = makeMockAsk(true);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await expect(enqueue.process(filePath)).rejects.toThrow('Source file appears to be binary');
    });
  });

  describe('runDiscussion', () => {
    it('skips discussion when ask returns false', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nSome content', 'utf-8');

      const emit = makeMockEmit();
      const ask = makeMockAsk(false);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await expect(enqueue.process(filePath)).resolves.not.toThrow();

      const sourcePath = join(config.vaultPath, 'inbox', 'test-page.md');
      const pageContent = await readFile(sourcePath, 'utf-8');
      expect(pageContent).toBeTruthy();
    });

    it('skips discussion when skipDiscuss config is set', async () => {
      const config = makeConfig({ skipDiscuss: true });
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nSome content', 'utf-8');

      let askCalled = false;
      const emit = makeMockEmit();
      const ask = <T>() => {
        askCalled = true;
        return Promise.resolve(true as unknown as T);
      };
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await expect(enqueue.process(filePath)).resolves.not.toThrow();
      expect(askCalled).toBe(false);
    });

    it('completes discussion with no human input (empty loop)', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nSome content', 'utf-8');

      const emit = makeMockEmit();
      const ask = makeMockAsk(true);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await expect(enqueue.process(filePath)).resolves.not.toThrow();
    });

    it('handles multiple human inputs in the discussion loop', async () => {
      const inputs = ['This is central', 'Ignore that part', ''];
      let callCount = 0;
      const emit = (event: PipelineEvent) => {
        if (event.type === 'input_required') {
          const val = inputs[callCount] ?? '';
          callCount++;
          event.resolve(val);
        }
      };
      const ask = makeMockAsk(true);
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nMulti-turn content', 'utf-8');

      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await expect(enqueue.process(filePath)).resolves.not.toThrow();
    });

    it('stores discussion summary for source page extraction', async () => {
      const summary = '## Summary\n- Claim X is central\n- Source is credible';
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nContent', 'utf-8');

      let capturedRequest: LlmStructuredRequest | undefined;
      const llm = makeMockLlm({ completeResponse: summary });
      llm.generateStructured = async <T>(req: LlmStructuredRequest): Promise<T> => {
        capturedRequest = req;
        return defaultSourcePage as unknown as T;
      };
      const emit = makeMockEmit();
      const ask = makeMockAsk(true);
      const enqueue = new Enqueue(llm, makeMockIdentifier(), makeMockPrompt(), config, emit, ask);

      await enqueue.process(filePath);

      const userContent = capturedRequest?.messages?.[0]?.content ?? '';
      expect(userContent).toContain('discussionSummary: ## Summary');
    });

    it('archives raw source to raw-sources/ regardless of discussion', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nContent', 'utf-8');

      const emit = makeMockEmit();
      const ask = makeMockAsk(false);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await enqueue.process(filePath);

      const archivedPath = join(config.vaultPath, 'raw-sources', 'source.md');
      const content = await readFile(archivedPath, 'utf-8');
      expect(content).toBe('# Test\n\nContent');
    });
  });

  describe('summarizeDiscussion', () => {
    it('uses discussion summary in source page extraction', async () => {
      let calls = 0;
      const emit = (event: PipelineEvent) => {
        if (event.type === 'input_required') {
          calls++;
          event.resolve(calls === 1 ? 'My feedback' : '');
        }
      };
      const ask = makeMockAsk(true);
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nContent', 'utf-8');

      let capturedRequest: LlmStructuredRequest | undefined;
      const llm = makeMockLlm({ completeResponse: 'expected-summary' });
      llm.generateStructured = async <T>(req: LlmStructuredRequest): Promise<T> => {
        capturedRequest = req;
        return defaultSourcePage as unknown as T;
      };
      const enqueue = new Enqueue(llm, makeMockIdentifier(), makeMockPrompt(), config, emit, ask);

      await enqueue.process(filePath);

      const userContent = capturedRequest?.messages?.[0]?.content ?? '';
      expect(userContent).toContain('discussionSummary: expected-summary');
    });
  });

  describe('writeSourcePage', () => {
    it('writes a source page to inbox/{slug}.md', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'test.md');
      await writeFile(filePath, '# Test\n\nSource content', 'utf-8');

      const emit = makeMockEmit();
      const ask = makeMockAsk(true);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await enqueue.process(filePath);

      const expectedPath = join(config.vaultPath, 'inbox', 'test-page.md');
      const pageContent = await readFile(expectedPath, 'utf-8');
      expect(pageContent).toBeTruthy();
    });

    it('includes correct YAML frontmatter with id and tags', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Content', 'utf-8');

      const emit = makeMockEmit();
      const ask = makeMockAsk(true);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await enqueue.process(filePath);

      const sourcePath = join(config.vaultPath, 'inbox', 'test-page.md');
      const pageContent = await readFile(sourcePath, 'utf-8');

      expect(pageContent).toContain('id: source.test-page');
      expect(pageContent).toContain('title: Test Page');
      expect(pageContent).toContain('status: active');
      expect(pageContent).toContain('tags:');
      expect(pageContent).toContain('  - test');
      expect(pageContent).toContain('  - example');
      const today = new Date().toISOString().slice(0, 10);
      expect(pageContent).toContain(`created: ${today}`);
    });

    it('includes wikilink to raw source in raw-sources/', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'my-article.md');
      await writeFile(filePath, '# Article', 'utf-8');

      const emit = makeMockEmit();
      const ask = makeMockAsk(true);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await enqueue.process(filePath);

      const sourcePath = join(config.vaultPath, 'inbox', 'test-page.md');
      const pageContent = await readFile(sourcePath, 'utf-8');

      expect(pageContent).toContain('rawSource: raw-sources/my-article.md');
    });

    it('includes summary, main points, and key takeaways sections', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'article.txt');
      await writeFile(filePath, '# Article\n\nBody', 'utf-8');

      const emit = makeMockEmit();
      const ask = makeMockAsk(true);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await enqueue.process(filePath);

      const sourcePath = join(config.vaultPath, 'inbox', 'test-page.md');
      const pageContent = await readFile(sourcePath, 'utf-8');

      expect(pageContent).toContain('Test summary paragraph.');
      expect(pageContent).toContain('## Main Points');
      expect(pageContent).toContain('- Main point 1');
      expect(pageContent).toContain('- Main point 2');
    });

    it('uses source page type metadata in the body', async () => {
      const structuredResponse = {
        title: 'Specific Article',
        type: 'paper',
        authors: ['Jane Doe'],
        date: '2025-07-15',
        reference: 'https://example.org/paper',
        summary: 'A summary.',
        mainPoints: ['Point A'],
        tags: ['science'],
      };

      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'paper.md');
      await writeFile(filePath, '# Paper content', 'utf-8');

      const emit = makeMockEmit();
      const ask = makeMockAsk(true);
      const enqueue = new Enqueue(
        makeMockLlm({ structuredResponse }),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await enqueue.process(filePath);

      const sourcePath = join(config.vaultPath, 'inbox', 'specific-article.md');
      const pageContent = await readFile(sourcePath, 'utf-8');

      expect(pageContent).toContain('*Type:* paper');
      expect(pageContent).toContain('  - Jane Doe');
      expect(pageContent).toContain('reference: https://example.org/paper');
    });

    it('passes the enriched source context to the LLM', async () => {
      let capturedRequest: LlmStructuredRequest | undefined;

      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'context-test.md');
      const rawContent = '# Unique Content\n\nSpecific text for testing context.';
      await writeFile(filePath, rawContent, 'utf-8');

      const emit = makeMockEmit();
      const ask = makeMockAsk(true);
      const llm = makeMockLlm();
      llm.generateStructured = async <T>(req: LlmStructuredRequest): Promise<T> => {
        capturedRequest = req;
        return defaultSourcePage as unknown as T;
      };
      const enqueue = new Enqueue(llm, makeMockIdentifier(), makeMockPrompt(), config, emit, ask);

      await enqueue.process(filePath);

      expect(capturedRequest).toBeDefined();
      const userContent = capturedRequest?.messages[0].content;
      expect(userContent).toContain(rawContent);
      expect(userContent).toContain('discussionSummary: mock summary');
      expect(capturedRequest?.schemaName).toBe('SourcePage');
      expect(capturedRequest?.schema.required).toEqual([
        'title',
        'type',
        'authors',
        'date',
        'summary',
        'mainPoints',
        'tags',
      ]);
    });
  });

  describe('onStep', () => {
    it('transitions through all states in order', async () => {
      const states: string[] = [];

      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Content', 'utf-8');

      const emit = (event: PipelineEvent) => {
        if (event.type === 'step_start' || event.type === 'step_end') {
          states.push(event.step);
        }
        if (event.type === 'input_required') {
          event.resolve('');
        }
      };
      const ask = makeMockAsk(true);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await enqueue.process(filePath);

      expect(states).toEqual([
        'Reading',
        'Reading',
        'Discussing',
        'Streaming',
        'Streaming',
        'WaitingForInput',
        'Discussing',
        'ExtractingSourcePage',
        'ExtractingSourcePage',
        'SourcePageWrite',
        'SourcePageWrite',
      ]);
    });

    it('includes fileName in state data for all states', async () => {
      const fileNames: string[] = [];

      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Content', 'utf-8');

      const emit = (event: PipelineEvent) => {
        if ((event.type === 'step_start' || event.type === 'step_end') && event.data?.fileName) {
          fileNames.push(event.data.fileName);
        }
        if (event.type === 'input_required') {
          event.resolve('');
        }
      };
      const ask = makeMockAsk(true);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await enqueue.process(filePath);

      expect(fileNames).toEqual(['source.md', 'source.md', 'source.md']);
    });

    it('includes sourcePath in state data for source-page-written', async () => {
      let finalData: { fileName: string; sourcePath?: string } | null = null;

      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Content', 'utf-8');

      const emit = (event: PipelineEvent) => {
        if (event.type === 'step_end' && event.step === 'SourcePageWrite') {
          finalData = event.data;
        }
        if (event.type === 'input_required') {
          event.resolve('');
        }
      };
      const ask = makeMockAsk(true);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await enqueue.process(filePath);

      expect(finalData?.fileName).toBe('source.md');
      expect(finalData?.sourcePath).toContain('inbox/');
    });

    it('skips discussion-summary when discussion is declined', async () => {
      const states: string[] = [];

      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Content', 'utf-8');

      const emit = (event: PipelineEvent) => {
        if (event.type === 'step_start' || event.type === 'step_end') {
          states.push(event.step);
        }
      };
      const ask = makeMockAsk(false);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await enqueue.process(filePath);

      expect(states).toEqual([
        'Reading',
        'Reading',
        'ExtractingSourcePage',
        'ExtractingSourcePage',
        'SourcePageWrite',
        'SourcePageWrite',
      ]);
    });

    it('stops at reading when reading throws', async () => {
      const states: string[] = [];

      const config = makeConfig({ maxSourceSize: 1 });
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'big.md');
      await writeFile(filePath, 'x'.repeat(100), 'utf-8');

      const emit = (event: PipelineEvent) => {
        if (event.type === 'step_start' || event.type === 'step_end') {
          states.push(event.step);
        }
      };
      const ask = makeMockAsk(true);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await expect(enqueue.process(filePath)).rejects.toThrow();

      expect(states).toEqual(['Reading']);
    });
  });

  describe('process', () => {
    it('runs the full pipeline without throwing', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.txt');
      await writeFile(filePath, '# Full pipeline test', 'utf-8');

      const emit = makeMockEmit();
      const ask = makeMockAsk(true);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await expect(enqueue.process(filePath)).resolves.not.toThrow();
    });

    it('runs the full pipeline without discussion when skipped', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.txt');
      await writeFile(filePath, '# Full pipeline test', 'utf-8');

      const emit = makeMockEmit();
      const ask = makeMockAsk(false);
      const enqueue = new Enqueue(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
      );

      await expect(enqueue.process(filePath)).resolves.not.toThrow();
    });
  });
});
