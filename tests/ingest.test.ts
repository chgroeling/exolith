// Specification: docs/operations/ingest.md

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LlmService } from '../src/llm-service';
import { type Identifier, Ingest, type IngestConfig } from '../src/operations/ingest';
import type { IdentifierType } from '../src/types';

function makeMockLlm(opts?: {
  streamDelay?: () => Promise<void>;
  generateResponse?: string;
}): LlmService {
  return {
    async generateStream(_messages, onChunk) {
      if (opts?.streamDelay) await opts.streamDelay();
      onChunk('mock-chunk');
    },
    async generate(_prompt) {
      return opts?.generateResponse ?? 'mock summary';
    },
  };
}

function makeMockIdentifier(): Identifier {
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

      const ingest = new Ingest(makeMockLlm(), makeMockIdentifier(), config);

      await expect(ingest.process(filePath)).resolves.not.toThrow();
    });

    it('rejects unsupported file extensions', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'test.pdf');
      await writeFile(filePath, 'not a pdf', 'utf-8');

      const ingest = new Ingest(makeMockLlm(), makeMockIdentifier(), config);

      await expect(ingest.process(filePath)).rejects.toThrow('Unsupported file type');
    });

    it('rejects files exceeding maxSourceSize', async () => {
      const config = makeConfig({ maxSourceSize: 10 });
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'big.md');
      await writeFile(filePath, 'x'.repeat(100), 'utf-8');

      const ingest = new Ingest(makeMockLlm(), makeMockIdentifier(), config);

      await expect(ingest.process(filePath)).rejects.toThrow('Source file exceeds maximum size');
    });

    it('rejects binary files', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'bin.txt');
      const buf = Buffer.alloc(50);
      buf[20] = 0;
      await writeFile(filePath, buf);

      const ingest = new Ingest(makeMockLlm(), makeMockIdentifier(), config);

      await expect(ingest.process(filePath)).rejects.toThrow('Source file appears to be binary');
    });
  });

  describe('discussKeyTakeaways', () => {
    it('completes discussion with no human input (empty loop)', async () => {
      const config = makeConfig({ readInput: () => Promise.resolve('') });
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nSome content', 'utf-8');

      const ingest = new Ingest(makeMockLlm(), makeMockIdentifier(), config);

      await expect(ingest.process(filePath)).resolves.not.toThrow();
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

      const ingest = new Ingest(makeMockLlm(), makeMockIdentifier(), config);

      await expect(ingest.process(filePath)).resolves.not.toThrow();
    });

    it('archives enriched source with discussion summary', async () => {
      const summary = '## Summary\n- Claim X is central\n- Source is credible';
      const config = makeConfig({ readInput: () => Promise.resolve('') });
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Test\n\nContent', 'utf-8');

      const llm = makeMockLlm({ generateResponse: summary });
      const ingest = new Ingest(llm, makeMockIdentifier(), config);

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
      const ingest = new Ingest(llm, makeMockIdentifier(), config);

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

      const ingest = new Ingest(makeMockLlm(), makeMockIdentifier(), config);

      await expect(ingest.process(filePath)).resolves.not.toThrow();
    });
  });
});
