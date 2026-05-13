/** Specification: docs/operations/ingest.md */

import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { IdentifierService } from '../../../src/core/identifier-service';
import type { IdentifierType } from '../../../src/core/types';
import type { LlmService, LlmStructuredRequest } from '../../../src/infrastructure/llm/llm-service';
import type { PromptService } from '../../../src/infrastructure/prompt/prompt-service';
import type { CompileService } from '../../../src/operations/compile/compile-service';
import type { IngestConfig } from '../../../src/operations/ingest/ingest-service';
import { Ingest } from '../../../src/operations/ingest/ingest-service-impl';
import type { PipelineEvent, Question } from '../../../src/operations/pipeline-presentation';

const defaultExtractionResult = {
  entities: [
    {
      name: 'Seneca',
      entityType: 'person',
      description: 'Roman philosopher and statesman',
      sourceContext: 'Seneca was a Roman philosopher...',
    },
    {
      name: 'Dr. Maria Schneider',
      entityType: 'person',
      description: 'Researcher at University of Tübingen',
      sourceContext: 'Dr. Maria Schneider published a meta-study...',
    },
  ],
  concepts: [
    {
      name: 'Praemeditatio Malorum',
      domain: 'philosophy/psychology',
      description: 'Stoic exercise of visualizing worst-case scenarios',
      sourceContext: 'The deliberate visualization of the worst case as an exercise against fear',
    },
    {
      name: 'Cortisol Reduction Through Meditation',
      domain: 'neurobiology',
      description: 'Measurable effect of mental exercises on stress hormones',
      sourceContext: 'Reduce cortisol levels by 18%',
    },
  ],
  claims: [
    {
      id: 'claim.cortisol-reduction',
      text: 'Praemeditatio malorum reduces cortisol by 18%',
      confidence: 0.85,
      sourceLocation: 'Paragraph 2',
      evidence: 'Meta-study, n=1,200, Nature Human Behaviour',
      limitation: 'No effect in participants under 25 years',
    },
    {
      id: 'claim.seneca-anxiety-thesis',
      text: 'Most anxieties arise from anticipated suffering, not from real events',
      confidence: 0.3,
      sourceLocation: 'Paragraph 1',
      evidence: "Seneca's Letters to Lucilius, 13th letter",
      limitation: 'Philosophical assertion, 2,000 years old, no empirical evidence',
    },
  ],
  openQuestions: [
    {
      question: 'Does the cortisol reduction persist after discontinuing the exercises?',
      context: 'Only acute effects measured',
    },
  ],
};

const defaultMatchResult = {
  matches: [],
  unmatched: [] as string[],
};

function makeMockLlm(opts?: {
  extractionResult?: Record<string, unknown>;
  matchResult?: Record<string, unknown>;
  completeResponse?: string;
}): LlmService {
  return {
    async complete(_prompt, _systemPrompt) {
      return opts?.completeResponse ?? 'Updated page content.';
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
          return opts?.completeResponse ?? 'mock summary';
        },
        getMessages() {
          return Object.freeze([...messages]);
        },
      };
    },
    async generateStructured<T>(_request: LlmStructuredRequest): Promise<T> {
      const schemaName = _request.schemaName;
      if (schemaName === 'ExtractionResult') {
        return (opts?.extractionResult ?? defaultExtractionResult) as unknown as T;
      }
      if (schemaName === 'SemanticMatchResult') {
        return (opts?.matchResult ?? defaultMatchResult) as unknown as T;
      }
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
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join('\n');
    },
  };
}

function makeMockCompile(): CompileService {
  return {
    async compile(): Promise<void> {
      // stub
    },
  };
}

function makeMockEmit(): (event: PipelineEvent) => void {
  return () => {};
}

function makeMockAsk(): <T>(question: Question<T>) => Promise<T> {
  return <T>() => Promise.resolve(undefined as unknown as T);
}

function makeConfig(overrides?: Partial<IngestConfig>): IngestConfig {
  return {
    vaultPath: join(tmpdir(), `exolith-test-${Date.now()}`),
    ...overrides,
  };
}

async function createTestSourceFile(vaultPath: string): Promise<string> {
  const inboxDir = join(vaultPath, 'inbox');
  await mkdir(inboxDir, { recursive: true });
  const filePath = join(inboxDir, 'test-source.md');
  const content = [
    '---',
    'id: source.test-source',
    'title: Test Source Page',
    'status: active',
    'tags:',
    '  - test',
    'created: 2026-01-01',
    'updated: 2026-01-01',
    '---',
    '',
    '# Test Source Page',
    '',
    'This is a test source page about Seneca and Stoicism.',
    '',
    'Seneca was a Roman philosopher and statesman who wrote',
    'letters to Lucilius discussing Stoic principles.',
    '',
    'Dr. Maria Schneider published a meta-study in 2024',
    'confirming that praemeditatio malorum, a Stoic exercise,',
    'reduces cortisol by 18% (n=1,200).',
    '',
    '## Main Points',
    '- Seneca defined praemeditatio malorum as an anxiety exercise',
    '- Cortisol reduction was empirically confirmed by Schneider',
    '',
    '## Linked Wiki Pages',
  ].join('\n');
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

describe('Ingest', () => {
  describe('process', () => {
    it('runs the full pipeline without throwing', async () => {
      const config = makeConfig();
      const filePath = await createTestSourceFile(config.vaultPath);

      const emit = makeMockEmit();
      const ask = makeMockAsk();
      const ingest = new Ingest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
        makeMockCompile(),
      );

      await expect(ingest.process(filePath)).resolves.not.toThrow();
    });

    it('writes new entity and concept pages to the vault', async () => {
      const config = makeConfig();
      const filePath = await createTestSourceFile(config.vaultPath);

      const emit = makeMockEmit();
      const ask = makeMockAsk();
      const ingest = new Ingest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
        makeMockCompile(),
      );

      await ingest.process(filePath);

      const senecaPage = join(config.vaultPath, 'entities', 'seneca.md');
      await expect(
        import('node:fs/promises').then((fs) => fs.readFile(senecaPage, 'utf-8')),
      ).resolves.toContain('Updated page content');
    });

    it('writes a log entry to log.md', async () => {
      const config = makeConfig();
      const filePath = await createTestSourceFile(config.vaultPath);

      const emit = makeMockEmit();
      const ask = makeMockAsk();
      const ingest = new Ingest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
        makeMockCompile(),
      );

      await ingest.process(filePath);

      const logPath = join(config.vaultPath, 'log.md');
      const logContent = await import('node:fs/promises').then((fs) =>
        fs.readFile(logPath, 'utf-8'),
      );
      expect(logContent).toContain('ingest');
      expect(logContent).toContain('Test Source Page');
      expect(logContent).toContain('sources/test-source');
      expect(logContent).toContain('page(s) created');
    });
  });

  describe('onStep', () => {
    it('calls emit with each pipeline step in order', async () => {
      const steps: string[] = [];

      const config = makeConfig();
      const filePath = await createTestSourceFile(config.vaultPath);

      const emit = (event: PipelineEvent) => {
        if (event.type === 'step_start' || event.type === 'step_end') {
          steps.push(event.step);
        }
      };
      const ask = makeMockAsk();
      const ingest = new Ingest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
        makeMockCompile(),
      );

      await ingest.process(filePath);

      expect(steps).toEqual([
        'Extracting',
        'Extracting',
        'Updating',
        'Updating',
        'Logging',
        'Logging',
        'Compiling',
        'Compiling',
      ]);
    });

    it('emits page_creating_start and page_created events for each created page', async () => {
      const events: Array<{ type: string; pageType: string; name: string; slug: string }> = [];

      const config = makeConfig();
      const filePath = await createTestSourceFile(config.vaultPath);

      const emit = (event: PipelineEvent) => {
        if (event.type === 'page_creating_start' || event.type === 'page_created') {
          events.push({
            type: event.type,
            pageType: event.pageType,
            name: event.name,
            slug: event.slug,
          });
        }
      };
      const ask = makeMockAsk();
      const ingest = new Ingest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
        makeMockCompile(),
      );

      await ingest.process(filePath);

      expect(events).toEqual([
        {
          type: 'page_creating_start',
          pageType: 'entity',
          name: 'Seneca',
          slug: 'seneca',
        },
        {
          type: 'page_created',
          pageType: 'entity',
          name: 'Seneca',
          slug: 'seneca',
        },
        {
          type: 'page_creating_start',
          pageType: 'entity',
          name: 'Dr. Maria Schneider',
          slug: 'dr.-maria-schneider',
        },
        {
          type: 'page_created',
          pageType: 'entity',
          name: 'Dr. Maria Schneider',
          slug: 'dr.-maria-schneider',
        },
        {
          type: 'page_creating_start',
          pageType: 'concept',
          name: 'Praemeditatio Malorum',
          slug: 'praemeditatio-malorum',
        },
        {
          type: 'page_created',
          pageType: 'concept',
          name: 'Praemeditatio Malorum',
          slug: 'praemeditatio-malorum',
        },
        {
          type: 'page_creating_start',
          pageType: 'concept',
          name: 'Cortisol Reduction Through Meditation',
          slug: 'cortisol-reduction-through-meditation',
        },
        {
          type: 'page_created',
          pageType: 'concept',
          name: 'Cortisol Reduction Through Meditation',
          slug: 'cortisol-reduction-through-meditation',
        },
      ]);
    });
  });

  describe('extract', () => {
    it('reads the source page and calls LLM for extraction', async () => {
      let capturedRequest: LlmStructuredRequest | undefined;

      const config = makeConfig();
      const filePath = await createTestSourceFile(config.vaultPath);

      const llm = makeMockLlm();
      llm.generateStructured = async <T>(req: LlmStructuredRequest): Promise<T> => {
        capturedRequest = req;
        return defaultExtractionResult as unknown as T;
      };

      const emit = makeMockEmit();
      const ask = makeMockAsk();
      const ingest = new Ingest(
        llm,
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
        makeMockCompile(),
      );

      await ingest.process(filePath);

      expect(capturedRequest).toBeDefined();
      expect(capturedRequest?.schemaName).toBe('ExtractionResult');
      expect(capturedRequest?.messages[0].content).toContain('Seneca');
      expect(capturedRequest?.messages[0].content).toContain('praemeditatio malorum');
    });
  });
});
