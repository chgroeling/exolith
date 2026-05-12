// Specification: docs/operations/pre-ingest.md

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { IdentifierService } from '../../../src/core/identifier-service';
import type { IdentifierType } from '../../../src/core/types';
import type { LlmService, LlmStructuredRequest } from '../../../src/infrastructure/llm/llm-service';
import type { PromptService } from '../../../src/infrastructure/prompt/prompt-service';
import type { PipelinePresentation } from '../../../src/operations/pipeline-presentation';
import type { PreIngestConfig } from '../../../src/operations/pre-ingest/pre-ingest-service';
import { PreIngest } from '../../../src/operations/pre-ingest/pre-ingest-service-impl';

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
  authors: 'Test Author',
  date: '2026-01-01',
  urlOrReference: '-',
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
          '---',
          '',
          `# ${context.title}`,
          '',
          `*Type:* ${context.type}`,
          `*Author(s):* ${context.authors}`,
          `*Date:* ${context.date}`,
          `*URL/Reference:* ${context.urlOrReference || '-'}`,
          `*Original File:* [[raw-sources/${context.fileName}]]`,
          '',
          '## Summary',
          context.summary as string,
          '',
          '## Main Points',
          ...(context.mainPoints as string[]).map((p: string) => `- ${p}`),
          '',
          '## Linked Wiki Pages',
          '',
        ].join('\n');
      }
      return Object.entries(context)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    },
  };
}

function makeMockPresentation(overrides?: Partial<PipelinePresentation>): PipelinePresentation {
  return {
    onStep: () => {},
    onSubStep: () => {},
    onChunk: () => {},
    readInput: () => Promise.resolve(''),
    shouldDiscuss: () => Promise.resolve(true),
    onError: () => {},
    ...overrides,
  };
}

function makeConfig(overrides?: Partial<PreIngestConfig>): PreIngestConfig {
  return {
    maxSourceSize: 1024 * 1024,
    vaultPath: join(tmpdir(), `exolith-test-${Date.now()}`),
    ...overrides,
  };
}

describe('PreIngest', () => {
  describe('readRawSource', () => {
    it('reads a valid .md file', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'test.md');
      await writeFile(filePath, '# Hello\n\nWorld', 'utf-8');

      const presentation = makeMockPresentation();
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await expect(preIngest.process(filePath)).resolves.not.toThrow();
    });

    it('rejects unsupported file extensions', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'test.pdf');
      await writeFile(filePath, 'not a pdf', 'utf-8');

      const presentation = makeMockPresentation();
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await expect(preIngest.process(filePath)).rejects.toThrow('Unsupported file type');
    });

    it('rejects files exceeding maxSourceSize', async () => {
      const config = makeConfig({ maxSourceSize: 10 });
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'big.md');
      await writeFile(filePath, 'x'.repeat(100), 'utf-8');

      const presentation = makeMockPresentation();
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await expect(preIngest.process(filePath)).rejects.toThrow('Source file exceeds maximum size');
    });

    it('rejects binary files', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'bin.txt');
      const buf = Buffer.alloc(50);
      buf[20] = 0;
      await writeFile(filePath, buf);

      const presentation = makeMockPresentation();
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await expect(preIngest.process(filePath)).rejects.toThrow('Source file appears to be binary');
    });
  });

  describe('runDiscussion', () => {
    it('skips discussion when shouldDiscuss returns false', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nSome content', 'utf-8');

      const presentation = makeMockPresentation({
        shouldDiscuss: () => Promise.resolve(false),
      });
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await expect(preIngest.process(filePath)).resolves.not.toThrow();

      const sourcePath = join(config.vaultPath, 'sources', 'test-page.md');
      const pageContent = await readFile(sourcePath, 'utf-8');
      expect(pageContent).toBeTruthy();
    });

    it('completes discussion with no human input (empty loop)', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nSome content', 'utf-8');

      const presentation = makeMockPresentation({ readInput: () => Promise.resolve('') });
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await expect(preIngest.process(filePath)).resolves.not.toThrow();
    });

    it('handles multiple human inputs in the discussion loop', async () => {
      const inputs = ['This is central', 'Ignore that part', ''];
      let callCount = 0;
      const presentation = makeMockPresentation({
        readInput: () => {
          const val = inputs[callCount] ?? '';
          callCount++;
          return Promise.resolve(val);
        },
      });
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nMulti-turn content', 'utf-8');

      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await expect(preIngest.process(filePath)).resolves.not.toThrow();
    });

    it('archives enriched source with discussion summary', async () => {
      const summary = '## Summary\n- Claim X is central\n- Source is credible';
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nContent', 'utf-8');

      const llm = makeMockLlm({ completeResponse: summary });
      const presentation = makeMockPresentation({ readInput: () => Promise.resolve('') });
      const preIngest = new PreIngest(
        llm,
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await preIngest.process(filePath);

      const archivedPath = join(config.vaultPath, 'raw-sources', 'source.md');
      const archived = await readFile(archivedPath, 'utf-8');
      expect(archived).toContain('# Test');
      expect(archived).toContain('# Discussion Summary');
      expect(archived).toContain(summary);
    });

    it('does not archive when discussion is skipped', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nContent', 'utf-8');

      const presentation = makeMockPresentation({
        shouldDiscuss: () => Promise.resolve(false),
      });
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await preIngest.process(filePath);

      const archivedPath = join(config.vaultPath, 'raw-sources', 'source.md');
      await expect(readFile(archivedPath, 'utf-8')).rejects.toThrow();
    });
  });

  describe('summarizeDiscussion', () => {
    it('passes human messages to complete and returns the result', async () => {
      let calls = 0;
      const presentation = makeMockPresentation({
        readInput: () => {
          calls++;
          return Promise.resolve(calls === 1 ? 'My feedback' : '');
        },
      });
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nContent', 'utf-8');

      const llm = makeMockLlm({ completeResponse: 'expected-summary' });
      const preIngest = new PreIngest(
        llm,
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await preIngest.process(filePath);

      const archivedPath = join(config.vaultPath, 'raw-sources', 'source.md');
      const archived = await readFile(archivedPath, 'utf-8');
      expect(archived).toContain('expected-summary');
    });
  });

  describe('writeSourcePage', () => {
    it('writes a source page to sources/{slug}.md', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'test.md');
      await writeFile(filePath, '# Test\n\nSource content', 'utf-8');

      const presentation = makeMockPresentation({
        readInput: () => Promise.resolve(''),
      });
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await preIngest.process(filePath);

      const expectedPath = join(config.vaultPath, 'sources', 'test-page.md');
      const pageContent = await readFile(expectedPath, 'utf-8');
      expect(pageContent).toBeTruthy();
    });

    it('includes correct YAML frontmatter with id and tags', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Content', 'utf-8');

      const presentation = makeMockPresentation({
        readInput: () => Promise.resolve(''),
      });
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await preIngest.process(filePath);

      const sourcePath = join(config.vaultPath, 'sources', 'test-page.md');
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

      const presentation = makeMockPresentation({
        readInput: () => Promise.resolve(''),
      });
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await preIngest.process(filePath);

      const sourcePath = join(config.vaultPath, 'sources', 'test-page.md');
      const pageContent = await readFile(sourcePath, 'utf-8');

      expect(pageContent).toContain('*Original File:* [[raw-sources/my-article.md]]');
    });

    it('includes summary, main points, and key takeaways sections', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'article.txt');
      await writeFile(filePath, '# Article\n\nBody', 'utf-8');

      const presentation = makeMockPresentation({
        readInput: () => Promise.resolve(''),
      });
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await preIngest.process(filePath);

      const sourcePath = join(config.vaultPath, 'sources', 'test-page.md');
      const pageContent = await readFile(sourcePath, 'utf-8');

      expect(pageContent).toContain('## Summary');
      expect(pageContent).toContain('Test summary paragraph.');
      expect(pageContent).toContain('## Main Points');
      expect(pageContent).toContain('- Main point 1');
      expect(pageContent).toContain('- Main point 2');
    });

    it('includes Linked Wiki Pages section (empty — maintained by compile)', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'src.txt');
      await writeFile(filePath, '# Src', 'utf-8');

      const presentation = makeMockPresentation({
        readInput: () => Promise.resolve(''),
      });
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await preIngest.process(filePath);

      const sourcePath = join(config.vaultPath, 'sources', 'test-page.md');
      const pageContent = await readFile(sourcePath, 'utf-8');

      expect(pageContent).toContain('## Linked Wiki Pages');
    });

    it('uses source page type metadata in the body', async () => {
      const structuredResponse = {
        title: 'Specific Article',
        type: 'paper',
        authors: 'Jane Doe',
        date: '2025-07-15',
        urlOrReference: 'https://example.org/paper',
        summary: 'A summary.',
        mainPoints: ['Point A'],
        tags: ['science'],
      };

      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'paper.md');
      await writeFile(filePath, '# Paper content', 'utf-8');

      const presentation = makeMockPresentation({
        readInput: () => Promise.resolve(''),
      });
      const preIngest = new PreIngest(
        makeMockLlm({ structuredResponse }),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await preIngest.process(filePath);

      const sourcePath = join(config.vaultPath, 'sources', 'specific-article.md');
      const pageContent = await readFile(sourcePath, 'utf-8');

      expect(pageContent).toContain('*Type:* paper');
      expect(pageContent).toContain('*Author(s):* Jane Doe');
      expect(pageContent).toContain('*Date:* 2025-07-15');
      expect(pageContent).toContain('*URL/Reference:* https://example.org/paper');
    });

    it('passes the enriched source context to the LLM', async () => {
      let capturedRequest: LlmStructuredRequest | undefined;

      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'context-test.md');
      const rawContent = '# Unique Content\n\nSpecific text for testing context.';
      await writeFile(filePath, rawContent, 'utf-8');

      const presentation = makeMockPresentation({
        readInput: () => Promise.resolve(''),
      });
      const llm = makeMockLlm();
      llm.generateStructured = async <T>(req: LlmStructuredRequest): Promise<T> => {
        capturedRequest = req;
        return defaultSourcePage as unknown as T;
      };
      const preIngest = new PreIngest(
        llm,
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await preIngest.process(filePath);

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

      const presentation = makeMockPresentation({
        readInput: () => Promise.resolve(''),
        onStep: (state) => {
          states.push(state);
        },
      });
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await preIngest.process(filePath);

      expect(states).toEqual([
        'Reading',
        'Discussing',
        'Streaming',
        'WaitingForInput',
        'DiscussionSummary',
        'ExtractingSourcePage',
        'SourcePageWritten',
      ]);
    });

    it('includes fileName in state data for all states', async () => {
      const fileNames: string[] = [];

      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Content', 'utf-8');

      const presentation = makeMockPresentation({
        readInput: () => Promise.resolve(''),
        onStep: (_state, data) => {
          fileNames.push(data.fileName);
        },
      });
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await preIngest.process(filePath);

      expect(fileNames).toEqual([
        'source.md',
        'source.md',
        'source.md',
        'source.md',
        'source.md',
        'source.md',
        'source.md',
      ]);
    });

    it('includes sourcePath in state data for source-page-written', async () => {
      let finalData: { fileName: string; sourcePath?: string } | null = null;

      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Content', 'utf-8');

      const presentation = makeMockPresentation({
        readInput: () => Promise.resolve(''),
        onStep: (state, data) => {
          if (state === 'SourcePageWritten') {
            finalData = data;
          }
        },
      });
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await preIngest.process(filePath);

      expect(finalData?.fileName).toBe('source.md');
      expect(finalData?.sourcePath).toContain('sources/');
    });

    it('skips discussion-summary when discussion is declined', async () => {
      const states: string[] = [];

      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Content', 'utf-8');

      const presentation = makeMockPresentation({
        shouldDiscuss: () => Promise.resolve(false),
        onStep: (state) => {
          states.push(state);
        },
      });
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await preIngest.process(filePath);

      expect(states).toEqual([
        'Reading',
        'Discussing',
        'ExtractingSourcePage',
        'SourcePageWritten',
      ]);
    });

    it('stops at reading when reading throws', async () => {
      const states: string[] = [];

      const config = makeConfig({ maxSourceSize: 1 });
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'big.md');
      await writeFile(filePath, 'x'.repeat(100), 'utf-8');

      const presentation = makeMockPresentation({
        onStep: (state) => {
          states.push(state);
        },
      });
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await expect(preIngest.process(filePath)).rejects.toThrow();

      expect(states).toEqual(['Reading']);
    });
  });

  describe('process', () => {
    it('runs the full pipeline without throwing', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.txt');
      await writeFile(filePath, '# Full pipeline test', 'utf-8');

      const presentation = makeMockPresentation({ readInput: () => Promise.resolve('') });
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await expect(preIngest.process(filePath)).resolves.not.toThrow();
    });

    it('runs the full pipeline without discussion when skipped', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.txt');
      await writeFile(filePath, '# Full pipeline test', 'utf-8');

      const presentation = makeMockPresentation({ shouldDiscuss: () => Promise.resolve(false) });
      const preIngest = new PreIngest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await expect(preIngest.process(filePath)).resolves.not.toThrow();
    });
  });
});
