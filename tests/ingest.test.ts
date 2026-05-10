// Specification: docs/operations/ingest.md

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IdentifierService } from '../src/core/identifier-service';
import type { IdentifierType } from '../src/core/types';
import type { LlmService, LlmStructuredRequest } from '../src/infrastructure/llm/llm-service';
import type { PromptService } from '../src/infrastructure/prompt/prompt-service';
import { Ingest } from '../src/operations/ingest/ingest';
import type { IngestConfig, IngestPresentation } from '../src/operations/ingest/ingest-service';

function makeMockLlm(opts?: {
  streamDelay?: () => Promise<void>;
  completeResponse?: string;
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
      return {} as T;
    },
  };
}

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
    render(_templateName: string, context: Record<string, unknown>): string {
      return Object.entries(context)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    },
  };
}

function makeMockPresentation(overrides?: Partial<IngestPresentation>): IngestPresentation {
  return {
    onChunk: () => {},
    readInput: () => Promise.resolve(''),
    ...overrides,
  };
}

function makeConfig(overrides?: Partial<IngestConfig>): IngestConfig {
  return {
    maxSourceSize: 1024 * 1024,
    vaultPath: join(tmpdir(), `exolith-test-${Date.now()}`),
    ...overrides,
  };
}

describe('Ingest', () => {
  describe('readRawSource', () => {
    it('reads a valid .md file', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'test.md');
      await writeFile(filePath, '# Hello\n\nWorld', 'utf-8');

      const presentation = makeMockPresentation();
      const ingest = new Ingest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await expect(ingest.process(filePath)).resolves.not.toThrow();
    });

    it('rejects unsupported file extensions', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'test.pdf');
      await writeFile(filePath, 'not a pdf', 'utf-8');

      const presentation = makeMockPresentation();
      const ingest = new Ingest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await expect(ingest.process(filePath)).rejects.toThrow('Unsupported file type');
    });

    it('rejects files exceeding maxSourceSize', async () => {
      const config = makeConfig({ maxSourceSize: 10 });
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'big.md');
      await writeFile(filePath, 'x'.repeat(100), 'utf-8');

      const presentation = makeMockPresentation();
      const ingest = new Ingest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await expect(ingest.process(filePath)).rejects.toThrow('Source file exceeds maximum size');
    });

    it('rejects binary files', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'bin.txt');
      const buf = Buffer.alloc(50);
      buf[20] = 0;
      await writeFile(filePath, buf);

      const presentation = makeMockPresentation();
      const ingest = new Ingest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await expect(ingest.process(filePath)).rejects.toThrow('Source file appears to be binary');
    });
  });

  describe('discussKeyTakeaways', () => {
    it('completes discussion with no human input (empty loop)', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nSome content', 'utf-8');

      const presentation = makeMockPresentation({ readInput: () => Promise.resolve('') });
      const ingest = new Ingest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await expect(ingest.process(filePath)).resolves.not.toThrow();
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

      const ingest = new Ingest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await expect(ingest.process(filePath)).resolves.not.toThrow();
    });

    it('archives enriched source with discussion summary', async () => {
      const summary = '## Summary\n- Claim X is central\n- Source is credible';
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nContent', 'utf-8');

      const llm = makeMockLlm({ completeResponse: summary });
      const presentation = makeMockPresentation({ readInput: () => Promise.resolve('') });
      const ingest = new Ingest(llm, makeMockIdentifier(), makeMockPrompt(), config, presentation);

      await ingest.process(filePath);

      const archivedPath = join(config.vaultPath, 'raw-sources', 'source.md');
      const archived = await readFile(archivedPath, 'utf-8');
      expect(archived).toContain('# Test');
      expect(archived).toContain('# Discussion Summary');
      expect(archived).toContain(summary);
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
      const ingest = new Ingest(llm, makeMockIdentifier(), makeMockPrompt(), config, presentation);

      await ingest.process(filePath);

      const archivedPath = join(config.vaultPath, 'raw-sources', 'source.md');
      const archived = await readFile(archivedPath, 'utf-8');
      expect(archived).toContain('expected-summary');
    });
  });

  describe('process', () => {
    it('runs the full pipeline without throwing', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.txt');
      await writeFile(filePath, '# Full pipeline test', 'utf-8');

      const presentation = makeMockPresentation({ readInput: () => Promise.resolve('') });
      const ingest = new Ingest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await expect(ingest.process(filePath)).resolves.not.toThrow();
    });
  });
});
