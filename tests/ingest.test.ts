// Specification: docs/operations/ingest.md

import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { IdentifierService } from '../src/core/identifier-service';
import type { IdentifierType } from '../src/core/types';
import type { LlmService, LlmStructuredRequest } from '../src/infrastructure/llm/llm-service';
import type { PromptService } from '../src/infrastructure/prompt/prompt-service';
import { Ingest } from '../src/operations/ingest/ingest';
import type { IngestConfig, IngestPresentation } from '../src/operations/ingest/ingest-service';

function makeMockLlm(): LlmService {
  return {
    async complete(_prompt, _systemPrompt) {
      return 'mock summary';
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
          onChunk('mock-chunk');
        },
        async complete() {
          return 'mock summary';
        },
        getMessages() {
          return Object.freeze([...messages]);
        },
      };
    },
    async generateStructured<T>(_request: LlmStructuredRequest): Promise<T> {
      return {} as unknown as T;
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
    onStep: () => {},
    onStepComplete: () => {},
    ...overrides,
  };
}

function makeConfig(overrides?: Partial<IngestConfig>): IngestConfig {
  return {
    vaultPath: join(tmpdir(), `exolith-test-${Date.now()}`),
    ...overrides,
  };
}

describe('Ingest', () => {
  describe('process', () => {
    it('runs the full pipeline without throwing', async () => {
      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source-page.md');
      await writeFile(filePath, '# Source Page', 'utf-8');

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
  });

  describe('onStep', () => {
    it('calls onStep with each pipeline step in order', async () => {
      const steps: string[] = [];

      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Content', 'utf-8');

      const presentation = makeMockPresentation({
        onStep: (step) => {
          steps.push(step);
        },
      });
      const ingest = new Ingest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await ingest.process(filePath);

      expect(steps).toEqual(['extracting', 'updating', 'logging', 'compiling']);
    });

    it('calls onStepComplete for each completed step in order', async () => {
      const completed: string[] = [];

      const config = makeConfig();
      await mkdir(config.vaultPath, { recursive: true });
      const filePath = join(config.vaultPath, 'source.md');
      await writeFile(filePath, '# Content', 'utf-8');

      const presentation = makeMockPresentation({
        onStepComplete: (step) => {
          completed.push(step);
        },
      });
      const ingest = new Ingest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        presentation,
      );

      await ingest.process(filePath);

      expect(completed).toEqual(['extracting', 'updating', 'logging', 'compiling']);
    });
  });
});
