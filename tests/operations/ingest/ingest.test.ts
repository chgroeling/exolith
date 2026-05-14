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

const defaultEntitySkeleton = {
  title: 'Seneca',
  tags: ['philosophie', 'stoizismus'],
  body: 'Lucius Annaeus Seneca was a Roman philosopher and statesman.',
};

const defaultConceptSkeleton = {
  title: 'Praemeditatio Malorum',
  tags: ['stoicism', 'psychology'],
  body: 'Praemeditatio malorum is a Stoic exercise of visualizing worst-case scenarios.',
};

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
};

const defaultMatchResult = {
  matches: [],
  unmatched: [] as string[],
};

const defaultFilterResult = {
  relevantSlugs: [] as string[],
};

function makeMockLlm(opts?: {
  extractionResult?: Record<string, unknown>;
  matchResult?: Record<string, unknown>;
  entitySkeleton?: Record<string, unknown>;
  conceptSkeleton?: Record<string, unknown>;
  filterResult?: Record<string, unknown>;
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
      if (schemaName === 'EntityPage') {
        return (opts?.entitySkeleton ?? defaultEntitySkeleton) as unknown as T;
      }
      if (schemaName === 'ConceptPage') {
        return (opts?.conceptSkeleton ?? defaultConceptSkeleton) as unknown as T;
      }
      if (schemaName === 'RelevanceFilter') {
        return (opts?.filterResult ?? defaultFilterResult) as unknown as T;
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

function makeMockCompile(vaultPath?: string): CompileService {
  return {
    async compile(): Promise<void> {
      if (!vaultPath) return;

      const { readdir, writeFile } = await import('node:fs/promises');
      const { join } = await import('node:path');

      let indexContent = '# Wiki Index\n\n> Auto-generated\n\n';

      const sections: Array<{ dir: string; heading: string }> = [
        { dir: 'sources', heading: 'Sources' },
        { dir: 'entities', heading: 'Entities' },
        { dir: 'concepts', heading: 'Concepts' },
      ];

      for (const { dir, heading } of sections) {
        const dirPath = join(vaultPath, dir);
        let files: string[];
        try {
          files = await readdir(dirPath);
        } catch {
          continue;
        }

        const mdFiles = files.filter((f) => f.endsWith('.md')).sort();
        if (mdFiles.length === 0) continue;

        indexContent += `## ${heading}\n\n`;
        for (const file of mdFiles) {
          const slug = file.replace(/\.md$/, '');
          indexContent += `- [[${dir}/${slug}]]\n`;
          indexContent += '  `conf:0.5` `active` `2026-05-14`\n';
          indexContent += `  — Mock summary for ${slug}\n\n`;
        }
      }

      await writeFile(join(vaultPath, 'index.md'), indexContent, 'utf-8');
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
        makeMockCompile(config.vaultPath),
      );

      await expect(ingest.process(filePath)).resolves.not.toThrow();
    });

    it('writes new entity and concept skeleton pages to the vault', async () => {
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
        makeMockCompile(config.vaultPath),
      );

      await ingest.process(filePath);

      // Pages exist after processing (skeleton is created then updated by the update phase)
      const senecaPage = join(config.vaultPath, 'entities', 'seneca.md');
      const content = await import('node:fs/promises').then((fs) =>
        fs.readFile(senecaPage, 'utf-8'),
      );
      expect(content.length).toBeGreaterThan(0);

      const conceptPage = join(config.vaultPath, 'concepts', 'praemeditatio-malorum.md');
      await expect(
        import('node:fs/promises').then((fs) => fs.readFile(conceptPage, 'utf-8')),
      ).resolves.not.toThrow();
    });

    it('writes skeleton pages without claims before the update phase', async () => {
      const config = makeConfig();
      const filePath = await createTestSourceFile(config.vaultPath);

      const emit = makeMockEmit();
      const ask = makeMockAsk();
      let compileCallCount = 0;
      const compile = makeMockCompile(config.vaultPath);
      const originalCompile = compile.compile;
      compile.compile = async () => {
        compileCallCount++;
        await originalCompile.call(compile);
      };

      const ingest = new Ingest(
        makeMockLlm(),
        makeMockIdentifier(),
        makeMockPrompt(),
        config,
        emit,
        ask,
        compile,
      );

      await ingest.process(filePath);

      // compile is called twice: once after create (rebuild index) and once at the end
      expect(compileCallCount).toBe(2);
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
        makeMockCompile(config.vaultPath),
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
      expect(logContent).toContain('page(s) updated');
    });
  });

  describe('onStep', () => {
    it('calls emit with each pipeline step in order including create and rebuild phases', async () => {
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
        makeMockCompile(config.vaultPath),
      );

      await ingest.process(filePath);

      expect(steps).toEqual([
        'Extracting',
        'Extracting',
        'Creating',
        'Creating',
        'RebuildingIndex',
        'RebuildingIndex',
        'Updating',
        'Updating',
        'Logging',
        'Logging',
        'Compiling',
        'Compiling',
      ]);
    });

    it('skips RebuildingIndex when no pages are created (all extracted items have existing matches)', async () => {
      const steps: string[] = [];

      const config = makeConfig();
      const filePath = await createTestSourceFile(config.vaultPath);

      // Pre-create entity and concept page files so the update phase can read them
      await mkdir(join(config.vaultPath, 'entities'), { recursive: true });
      await mkdir(join(config.vaultPath, 'concepts'), { recursive: true });
      const pageContent =
        '---\nid: entity.seneca\ntitle: Seneca\nstatus: active\nconfidence: 0.8\n---\n\n# Seneca\n\nContent.';
      await writeFile(join(config.vaultPath, 'entities', 'seneca.md'), pageContent, 'utf-8');
      await writeFile(
        join(config.vaultPath, 'entities', 'dr.-maria-schneider.md'),
        pageContent.replace('Seneca', 'Dr. Maria Schneider'),
        'utf-8',
      );
      await writeFile(
        join(config.vaultPath, 'concepts', 'praemeditatio-malorum.md'),
        pageContent
          .replace('entity.seneca', 'concept.praemeditatio-malorum')
          .replace('Seneca', 'Praemeditatio Malorum'),
        'utf-8',
      );
      await writeFile(
        join(config.vaultPath, 'concepts', 'cortisol-reduction-through-meditation.md'),
        pageContent
          .replace('entity.seneca', 'concept.cortisol-reduction-through-meditation')
          .replace('Seneca', 'Cortisol Reduction'),
        'utf-8',
      );

      // Pre-create index.md with matching entries so no pages are created
      const indexContent = [
        '# Wiki Index',
        '',
        '## Entities',
        '',
        '- [[entities/seneca]]',
        '  `active`',
        '  — Roman philosopher and statesman',
        '',
        '- [[entities/dr.-maria-schneider]]',
        '  `active`',
        '  — Researcher at University of Tübingen',
        '',
        '## Concepts',
        '',
        '- [[concepts/praemeditatio-malorum]]',
        '  `active`',
        '  — Stoic exercise of visualizing worst-case scenarios',
        '',
        '- [[concepts/cortisol-reduction-through-meditation]]',
        '  `active`',
        '  — Measurable effect of mental exercises on stress hormones',
        '',
      ].join('\n');
      await writeFile(join(config.vaultPath, 'index.md'), indexContent, 'utf-8');

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
        makeMockCompile(config.vaultPath),
      );

      await ingest.process(filePath);

      expect(steps).toEqual([
        'Extracting',
        'Extracting',
        'Creating',
        'Creating',
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
        makeMockCompile(config.vaultPath),
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

    it('emits page_updating_start and page_updated events for each page update', async () => {
      const events: Array<{ type: string; pageType: string; name: string; slug: string }> = [];

      const config = makeConfig();
      const filePath = await createTestSourceFile(config.vaultPath);

      const emit = (event: PipelineEvent) => {
        if (event.type === 'page_updating_start' || event.type === 'page_updated') {
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
        makeMockCompile(config.vaultPath),
      );

      await ingest.process(filePath);

      // After create+compile, all 4 items match via phase 1 and are updated
      expect(events).toEqual([
        {
          type: 'page_updating_start',
          pageType: 'entity',
          name: 'Seneca',
          slug: 'seneca',
        },
        {
          type: 'page_updated',
          pageType: 'entity',
          name: 'Seneca',
          slug: 'seneca',
        },
        {
          type: 'page_updating_start',
          pageType: 'entity',
          name: 'Dr. Maria Schneider',
          slug: 'dr.-maria-schneider',
        },
        {
          type: 'page_updated',
          pageType: 'entity',
          name: 'Dr. Maria Schneider',
          slug: 'dr.-maria-schneider',
        },
        {
          type: 'page_updating_start',
          pageType: 'concept',
          name: 'Praemeditatio Malorum',
          slug: 'praemeditatio-malorum',
        },
        {
          type: 'page_updated',
          pageType: 'concept',
          name: 'Praemeditatio Malorum',
          slug: 'praemeditatio-malorum',
        },
        {
          type: 'page_updating_start',
          pageType: 'concept',
          name: 'Cortisol Reduction Through Meditation',
          slug: 'cortisol-reduction-through-meditation',
        },
        {
          type: 'page_updated',
          pageType: 'concept',
          name: 'Cortisol Reduction Through Meditation',
          slug: 'cortisol-reduction-through-meditation',
        },
      ]);
    });
  });

  describe('extract', () => {
    it('reads the source page and calls LLM for extraction', async () => {
      const capturedRequests: LlmStructuredRequest[] = [];

      const config = makeConfig();
      const filePath = await createTestSourceFile(config.vaultPath);

      const llm = makeMockLlm();
      llm.generateStructured = async <T>(req: LlmStructuredRequest): Promise<T> => {
        capturedRequests.push(req);
        if (req.schemaName === 'ExtractionResult') {
          return defaultExtractionResult as unknown as T;
        }
        if (req.schemaName === 'EntityPage') {
          return defaultEntitySkeleton as unknown as T;
        }
        if (req.schemaName === 'ConceptPage') {
          return defaultConceptSkeleton as unknown as T;
        }
        if (req.schemaName === 'RelevanceFilter') {
          return defaultFilterResult as unknown as T;
        }
        return defaultMatchResult as unknown as T;
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
        makeMockCompile(config.vaultPath),
      );

      await ingest.process(filePath);

      expect(capturedRequests.length).toBeGreaterThanOrEqual(1);
      const extractionRequest = capturedRequests.find((r) => r.schemaName === 'ExtractionResult');
      expect(extractionRequest).toBeDefined();
      expect(extractionRequest?.messages[0].content).toContain('Seneca');
      expect(extractionRequest?.messages[0].content).toContain('praemeditatio malorum');
    });
  });

  describe('create skeleton pages', () => {
    it('creates skeleton pages without claims', async () => {
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
        makeMockCompile(config.vaultPath),
      );

      await ingest.process(filePath);

      const senecaPage = join(config.vaultPath, 'entities', 'seneca.md');
      const content = await import('node:fs/promises').then((fs) =>
        fs.readFile(senecaPage, 'utf-8'),
      );
      // Skeleton pages have no claims section — claims are generated during update
      expect(content).not.toContain('## Claims');
    });
  });

  describe('update pages', () => {
    it('calls complete() for each entity and concept during update phase', async () => {
      const completeCalls: string[] = [];

      const config = makeConfig();
      const filePath = await createTestSourceFile(config.vaultPath);

      const llm = makeMockLlm();
      llm.complete = async (prompt: string) => {
        completeCalls.push(prompt.slice(0, 100));
        return 'Updated page content.';
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
        makeMockCompile(config.vaultPath),
      );

      await ingest.process(filePath);

      // One complete() call per entity/concept (4 total)
      expect(completeCalls.length).toBe(4);
    });

    it('calls the filter step for each item during update', async () => {
      const filterCalls: string[] = [];

      const config = makeConfig();
      const filePath = await createTestSourceFile(config.vaultPath);

      const llm = makeMockLlm();
      llm.generateStructured = async <T>(req: LlmStructuredRequest): Promise<T> => {
        if (req.schemaName === 'ExtractionResult') {
          return defaultExtractionResult as unknown as T;
        }
        if (req.schemaName === 'EntityPage') {
          return defaultEntitySkeleton as unknown as T;
        }
        if (req.schemaName === 'ConceptPage') {
          return defaultConceptSkeleton as unknown as T;
        }
        if (req.schemaName === 'RelevanceFilter') {
          filterCalls.push(req.messages[0].content.slice(0, 50));
          return defaultFilterResult as unknown as T;
        }
        return defaultMatchResult as unknown as T;
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
        makeMockCompile(config.vaultPath),
      );

      await ingest.process(filePath);

      // One filter call per entity/concept (4 total)
      expect(filterCalls.length).toBe(4);
    });
  });
});
