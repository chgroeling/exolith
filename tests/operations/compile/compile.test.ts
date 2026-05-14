/** Specification: docs/operations/compile.md */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CompileConfig } from '../../../src/operations/compile/compile-service';
import { Compile } from '../../../src/operations/compile/compile-service-impl';
import type { PipelineEvent, Question } from '../../../src/operations/pipeline-presentation';

const ENTITY_SENECA = `---
id: entity.seneca
title: Seneca
confidence: 0.9
status: active
tags:
  - philosophie
  - stoizismus
  - antike
created: 2026-04-15
updated: 2026-05-02
---

# Seneca

Lucius Annaeus Seneca was a Roman philosopher, dramatist, and statesman.
His "Letters to Lucilius" are a collection of 124 moral letters.

## Claims

- \`id:claim.seneca-angst-these\` \`conf:0.3\` \`status:uncertain\`
  Seneca's thesis: "Most anxieties arise from anticipated suffering, not from real suffering"
  *Evidence:* [[sources/briefe-an-lucilius]] (13th Letter)
  *Limitation:* Philosophical assertion, 2,000 years old, no empirical evidence

- \`id:claim.cortisol-senkung\` \`conf:0.85\` \`status:active\`
  Praemeditatio malorum reduces cortisol by an average of 18%
  *Evidence:* [[sources/schneider-metastudie-2024]] (paragraph 3, n=1,200)
  *Limitation:* No effect in participants under 25 years

## Offene Fragen

- Does the cortisol reduction persist after stopping the exercises?
  *Context:* Study measures only acute effects

<!-- exolith:human:start -->
## Persönliche Notizen

Personal note content.
<!-- exolith:human:end -->
`;

const ENTITY_MARIA = `---
id: entity.maria-schneider
title: Maria Schneider
confidence: 0.8
status: active
tags:
  - psychologie
  - forschung
created: 2026-05-01
updated: 2026-05-02
---

# Maria Schneider

Researcher at the University of Tübingen, author of the 2024 meta-study.

## Claims

- \`id:claim.schneider-meta-study\` \`conf:0.8\` \`status:active\`
  The meta-study (n=1,200) confirms praemeditatio malorum effectiveness
  *Evidence:* [[sources/schneider-metastudie-2024]] (Abstract)

## Verknüpfungen

- \`beforschte\` → [[concepts/praemeditatio-malorum]]
`;

const CONCEPT_STOIZISMUS = `---
id: concept.stoizismus
title: Stoizismus
confidence: 0.8
status: active
tags:
  - philosophie
created: 2026-04-10
updated: 2026-05-01
---

# Stoizismus

The Stoic philosophical school, focused on what is controllable.
Seneca was one of its most important representatives.

## Claims

- \`id:claim.stoizismus-grundprinzip\` \`conf:0.9\` \`status:active\`
  The core Stoic principle: distinguish between controllable and uncontrollable
  *Evidence:* [[sources/briefe-an-lucilius]] (Letter 13)
`;

const CONCEPT_PRAEMEDITATIO = `---
id: concept.praemeditatio-malorum
title: Praemeditatio Malorum
confidence: 0.7
status: active
tags:
  - stoizismus
  - psychologie
created: 2026-04-20
updated: 2026-05-02
---

# Praemeditatio Malorum

Stoic exercise: conscious visualization of the worst to manage anxiety.
The technique has been empirically validated.

## Claims

- \`id:claim.praemeditatio-definition\` \`conf:0.9\` \`status:active\`
  Praemeditatio malorum is the premeditation of evils as a Stoic exercise
  *Evidence:* [[sources/briefe-an-lucilius]]

- \`id:claim.praemeditatio-cortisol\` \`conf:0.85\` \`status:active\`
  Daily practice reduces cortisol levels by 18%
  *Evidence:* [[sources/schneider-metastudie-2024]] (paragraph 3)

## Offene Fragen

- Does the cortisol reduction persist after stopping the exercises?
  *Context:* Study measures only acute effects

- Why does praemeditatio not work for people under 25?
  *Context:* Possible explanation: prefrontal cortex not yet fully developed
`;

const SOURCE_BRIEFE = `---
id: source.briefe-an-lucilius
title: Letters to Lucilius (13th Letter)
status: active
tags:
  - philosophie
  - stoizismus
  - seneca
created: 2026-05-01
updated: 2026-05-01
---

# Letters to Lucilius (13th Letter)

*Type:* transcript
*Author(s):* Lucius Annaeus Seneca
*Date:* ca. 62-64 CE
*URL/Reference:* —

## Summary

Seneca reflects on the nature of fear and anxiety in the 13th letter to Lucilius.

## Main Points
- Most anxieties arise from anticipated suffering, not real suffering
- Philosophy as practical tool for daily life
`;

const SOURCE_SCHNEIDER = `---
id: source.schneider-metastudie-2024
title: Schneider Meta-Study 2024
status: active
tags:
  - psychologie
  - metastudie
created: 2026-05-02
updated: 2026-05-02
---

# Schneider Meta-Study 2024

*Type:* paper
*Author(s):* Dr. Maria Schneider
*Date:* 2024
*URL/Reference:* —

## Summary

Meta-study on the effectiveness of praemeditatio malorum with n=1,200 participants.

## Main Points
- Praemeditatio malorum reduces cortisol by 18%
- No effect in participants under 25 years
`;

function makeMockEmit(): (event: PipelineEvent) => void {
  return () => {};
}

function makeMockAsk(): <T>(question: Question<T>) => Promise<T> {
  return <T>() => Promise.resolve(undefined as unknown as T);
}

function makeConfig(overrides?: Partial<CompileConfig>): CompileConfig {
  return {
    vaultPath: join(tmpdir(), `exolith-test-${Date.now()}`),
    ...overrides,
  };
}

async function setupVault(vaultPath: string, pages: Record<string, string>): Promise<void> {
  for (const [relativePath, content] of Object.entries(pages)) {
    const fullPath = join(vaultPath, relativePath);
    const dir = join(fullPath, '..');
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
  }
}

describe('Compile', () => {
  describe('compile', () => {
    it('runs the full pipeline without throwing', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();
      const compile = new Compile(config, emit, ask);

      await expect(compile.compile()).resolves.not.toThrow();
    });

    it('runs on an empty vault without errors', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();
      const compile = new Compile(config, emit, ask);

      await compile.compile();

      const indexPath = join(config.vaultPath, 'index.md');
      const indexContent = await readFile(indexPath, 'utf-8');
      expect(indexContent).toContain('# Wiki Index');
      expect(indexContent).toContain('0 pages');
    });

    it('parses pages and generates correct index', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();

      await setupVault(config.vaultPath, {
        'entities/seneca.md': ENTITY_SENECA,
        'entities/maria-schneider.md': ENTITY_MARIA,
        'concepts/stoizismus.md': CONCEPT_STOIZISMUS,
        'concepts/praemeditatio-malorum.md': CONCEPT_PRAEMEDITATIO,
        'sources/briefe-an-lucilius.md': SOURCE_BRIEFE,
        'sources/schneider-metastudie-2024.md': SOURCE_SCHNEIDER,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      const indexContent = await readFile(join(config.vaultPath, 'index.md'), 'utf-8');

      expect(indexContent).toContain('# Wiki Index');
      expect(indexContent).toContain('6 pages');
      expect(indexContent).toContain('2 sources');

      expect(indexContent).toContain('## Sources');
      expect(indexContent).toContain('[[sources/briefe-an-lucilius]]');
      expect(indexContent).toContain('[[sources/schneider-metastudie-2024]]');

      expect(indexContent).toContain('## Entities');
      expect(indexContent).toContain('[[entities/seneca]]');
      expect(indexContent).toContain('[[entities/maria-schneider]]');

      expect(indexContent).toContain('## Concepts');
      expect(indexContent).toContain('[[concepts/stoizismus]]');
      expect(indexContent).toContain('[[concepts/praemeditatio-malorum]]');
    });

    it('includes claim counts and status in index entries', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();

      await setupVault(config.vaultPath, {
        'entities/seneca.md': ENTITY_SENECA,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      const indexContent = await readFile(join(config.vaultPath, 'index.md'), 'utf-8');

      expect(indexContent).toContain('`2 claims`');
      expect(indexContent).toContain('`conf:0.9`');
      expect(indexContent).toContain('`active`');
      expect(indexContent).toContain('`#philosophie #stoizismus #antike`');
    });

    it('includes ❓ flag for pages with open questions', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();

      await setupVault(config.vaultPath, {
        'concepts/praemeditatio-malorum.md': CONCEPT_PRAEMEDITATIO,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      const indexContent = await readFile(join(config.vaultPath, 'index.md'), 'utf-8');
      expect(indexContent).toContain('`❓`');
    });

    it('sorts entities alphabetically by title within category', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();

      await setupVault(config.vaultPath, {
        'entities/seneca.md': ENTITY_SENECA,
        'entities/maria-schneider.md': ENTITY_MARIA,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      const indexContent = await readFile(join(config.vaultPath, 'index.md'), 'utf-8');

      const senecaPos = indexContent.indexOf('[[entities/seneca]]');
      const mariaPos = indexContent.indexOf('[[entities/maria-schneider]]');
      expect(mariaPos).toBeLessThan(senecaPos);
    });
    it('handles pages without YAML frontmatter gracefully', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();

      const noFrontmatter = `# No Frontmatter

This page has no YAML frontmatter at all.

## Claims

- \`id:claim.bare-claim\` \`conf:0.5\` \`status:active\`
  A claim without a frontmatter
  *Evidence:* [[sources/briefe-an-lucilius]]
`;

      await setupVault(config.vaultPath, {
        'sources/briefe-an-lucilius.md': SOURCE_BRIEFE,
        'entities/no-fm.md': noFrontmatter,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      const indexContent = await readFile(join(config.vaultPath, 'index.md'), 'utf-8');
      expect(indexContent).toContain('[[entities/no-fm]]');
    });

    it('handles pages without Claims section gracefully', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();

      const noClaims = `---
id: entity.no-claims
title: No Claims Entity
status: active
tags:
  - test
created: 2026-05-01
updated: 2026-05-01
---

# No Claims Entity

This entity has no claims section at all.

## Verknüpfungen

- \`verbunden_mit\` → [[entities/seneca]]
`;

      await setupVault(config.vaultPath, {
        'entities/seneca.md': ENTITY_SENECA,
        'entities/no-claims.md': noClaims,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      const indexContent = await readFile(join(config.vaultPath, 'index.md'), 'utf-8');
      expect(indexContent).toContain('`0 claims`');
    });

    it('handles claims with Beleg field (German variant)', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();

      const germanClaims = `---
id: entity.german
title: German Entity
status: active
tags:
  - test
created: 2026-05-01
updated: 2026-05-01
---

# German Entity

Ein Test.

## Claims

- \`id:claim.german-claim\` \`conf:0.7\` \`status:active\`
  Ein Claim mit deutschem Beleg-Feld
  *Beleg:* [[sources/briefe-an-lucilius]] (Kapitel 3)
  *Einschränkung:* Begrenzte Stichprobe
`;

      await setupVault(config.vaultPath, {
        'sources/briefe-an-lucilius.md': SOURCE_BRIEFE,
        'entities/german.md': germanClaims,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      const indexContent = await readFile(join(config.vaultPath, 'index.md'), 'utf-8');
      expect(indexContent).toContain('entities/german');
    });

    it('emits step_start and step_end events during compile', async () => {
      const config = makeConfig();
      const events: PipelineEvent[] = [];
      const emit = (event: PipelineEvent) => events.push(event);
      const ask = makeMockAsk();

      await setupVault(config.vaultPath, {
        'sources/briefe-an-lucilius.md': SOURCE_BRIEFE,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      const stepStarts = events.filter((e) => e.type === 'step_start');
      const stepEnds = events.filter((e) => e.type === 'step_end');

      expect(stepStarts.length).toBeGreaterThanOrEqual(3);
      expect(stepEnds.length).toBeGreaterThanOrEqual(3);

      const stepNames = stepStarts.map((e) => (e.type === 'step_start' ? e.step : ''));
      expect(stepNames).toContain('Parsing');
      expect(stepNames).toContain('GeneratingIndex');
      expect(stepNames).toContain('WritingBacklinks');
    });
  });
});
