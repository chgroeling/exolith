// Specification: docs/operations/ingest.md

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IdentifierService } from '../src/identifier-service';
import type { LlmService } from '../src/llm-service';
import { Ingest, type IngestConfig } from '../src/operations/ingest';
import type { PromptService } from '../src/prompt-service';
import type { IdentifierType } from '../src/types';

function makeMockLlm(opts?: {
  streamDelay?: () => Promise<void>;
  generateResponse?: string;
  streamResponse?: string;
}): LlmService {
  return {
    async generateStream(_messages, onChunk) {
      if (opts?.streamDelay) await opts.streamDelay();
      onChunk('mock-chunk');
      return opts?.streamResponse ?? 'mock response';
    },
    async generate(_prompt) {
      return opts?.generateResponse ?? 'mock summary';
    },
  };
}

function makeRecordingLlm(): {
  llm: LlmService;
  getCalls: () => { role: string; content: string }[][];
} {
  const recordedCalls: { role: string; content: string }[][] = [];
  return {
    llm: {
      async generateStream(messages, onChunk) {
        recordedCalls.push(structuredClone(messages));
        onChunk('chunk');
        return 'assistant-response';
      },
      async generate(_prompt) {
        return 'summary';
      },
    },
    getCalls: () => recordedCalls,
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

function makeConfig(overrides?: Partial<IngestConfig>): IngestConfig {
  return {
    maxSourceSize: 1024 * 1024,
    vaultPath: join(tmpdir(), `exolith-test-${Date.now()}`),
    onChunk: undefined,
    readInput: undefined,
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

      const ingest = new Ingest(makeMockLlm(), makeMockIdentifier(), makeMockPrompt(), config);

      await expect(ingest.process(filePath)).resolves.not.toThrow();
    });

    it('rejects unsupported file extensions', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'test.pdf');
      await writeFile(filePath, 'not a pdf', 'utf-8');

      const ingest = new Ingest(makeMockLlm(), makeMockIdentifier(), makeMockPrompt(), config);

      await expect(ingest.process(filePath)).rejects.toThrow('Unsupported file type');
    });

    it('rejects files exceeding maxSourceSize', async () => {
      const config = makeConfig({ maxSourceSize: 10 });
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'big.md');
      await writeFile(filePath, 'x'.repeat(100), 'utf-8');

      const ingest = new Ingest(makeMockLlm(), makeMockIdentifier(), makeMockPrompt(), config);

      await expect(ingest.process(filePath)).rejects.toThrow('Source file exceeds maximum size');
    });

    it('rejects binary files', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'bin.txt');
      const buf = Buffer.alloc(50);
      buf[20] = 0;
      await writeFile(filePath, buf);

      const ingest = new Ingest(makeMockLlm(), makeMockIdentifier(), makeMockPrompt(), config);

      await expect(ingest.process(filePath)).rejects.toThrow('Source file appears to be binary');
    });
  });

  describe('discussKeyTakeaways', () => {
    it('completes discussion with no human input (empty loop)', async () => {
      const config = makeConfig({ readInput: () => Promise.resolve('') });
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nSome content', 'utf-8');

      const ingest = new Ingest(makeMockLlm(), makeMockIdentifier(), makeMockPrompt(), config);

      await expect(ingest.process(filePath)).resolves.not.toThrow();
    });

    it('sends the assistant response back in conversation history', async () => {
      const { llm, getCalls } = makeRecordingLlm();
      let inputCount = 0;
      const config = makeConfig({
        readInput: async () => {
          inputCount++;
          return inputCount === 1 ? 'my feedback' : '';
        },
      });
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nContent', 'utf-8');

      const ingest = new Ingest(llm, makeMockIdentifier(), makeMockPrompt(), config);
      await ingest.process(filePath);

      const calls = getCalls();
      expect(calls.length).toBe(2);

      const firstCall = calls[0];
      expect(firstCall.length).toBe(1);
      expect(firstCall[0].role).toBe('user');

      const secondCall = calls[1];
      expect(secondCall.length).toBe(3);
      expect(secondCall[0].role).toBe('user');
      expect(secondCall[1].role).toBe('assistant');
      expect(secondCall[1].content).toBe('assistant-response');
      expect(secondCall[2].role).toBe('user');
      expect(secondCall[2].content).toBe('my feedback');
    });

    it('builds alternating user/assistant conversation over multiple turns', async () => {
      const { llm, getCalls } = makeRecordingLlm();
      const inputs = ['first feedback', 'second feedback', ''];
      let idx = 0;
      const config = makeConfig({
        readInput: async () => inputs[idx++] ?? '',
      });
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nMulti-turn', 'utf-8');

      const ingest = new Ingest(llm, makeMockIdentifier(), makeMockPrompt(), config);
      await ingest.process(filePath);

      const calls = getCalls();
      expect(calls.length).toBe(3);

      const thirdCall = calls[2];
      expect(thirdCall.length).toBe(5);
      expect(thirdCall[0].role).toBe('user');
      expect(thirdCall[1].role).toBe('assistant');
      expect(thirdCall[2].role).toBe('user');
      expect(thirdCall[3].role).toBe('assistant');
      expect(thirdCall[4].role).toBe('user');
      expect(thirdCall[4].content).toBe('second feedback');
    });

    it('handles multiple human inputs in the discussion loop', async () => {
      const inputs = ['This is central', 'Ignore that part', ''];
      let callCount = 0;
      const config = makeConfig({
        readInput: () => {
          const val = inputs[callCount] ?? '';
          callCount++;
          return Promise.resolve(val);
        },
      });
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nMulti-turn content', 'utf-8');

      const ingest = new Ingest(makeMockLlm(), makeMockIdentifier(), makeMockPrompt(), config);

      await expect(ingest.process(filePath)).resolves.not.toThrow();
    });

    it('archives enriched source with discussion summary', async () => {
      const summary = '## Summary\n- Claim X is central\n- Source is credible';
      const config = makeConfig({ readInput: () => Promise.resolve('') });
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nContent', 'utf-8');

      const llm = makeMockLlm({ generateResponse: summary });
      const ingest = new Ingest(llm, makeMockIdentifier(), makeMockPrompt(), config);

      await ingest.process(filePath);

      const archivedPath = join(config.vaultPath, 'raw-sources', 'source.md');
      const archived = await readFile(archivedPath, 'utf-8');
      expect(archived).toContain('# Test');
      expect(archived).toContain('# Discussion Summary');
      expect(archived).toContain(summary);
    });
  });

  describe('summarizeDiscussion', () => {
    it('passes human messages to generate and returns the result', async () => {
      let calls = 0;
      const config = makeConfig({
        readInput: () => {
          calls++;
          return Promise.resolve(calls === 1 ? 'My feedback' : '');
        },
      });
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nContent', 'utf-8');

      const llm = makeMockLlm({ generateResponse: 'expected-summary' });
      const ingest = new Ingest(llm, makeMockIdentifier(), makeMockPrompt(), config);

      await ingest.process(filePath);

      const archivedPath = join(config.vaultPath, 'raw-sources', 'source.md');
      const archived = await readFile(archivedPath, 'utf-8');
      expect(archived).toContain('expected-summary');
    });
  });

  describe('process', () => {
    it('runs the full pipeline without throwing', async () => {
      const config = makeConfig({ readInput: () => Promise.resolve('') });
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.txt');
      await writeFile(filePath, '# Full pipeline test', 'utf-8');

      const ingest = new Ingest(makeMockLlm(), makeMockIdentifier(), makeMockPrompt(), config);

      await expect(ingest.process(filePath)).resolves.not.toThrow();
    });
  });
});
