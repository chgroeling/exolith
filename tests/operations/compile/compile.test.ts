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

## Linked Wiki Pages
- [[entities/seneca]] (2 Claims)
- [[concepts/praemeditatio-malorum]] (1 Claim)
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

## Linked Wiki Pages
- [[entities/maria-schneider]] (1 Claim)
- [[entities/seneca]] (1 Claim)
- [[concepts/praemeditatio-malorum]] (1 Claim)
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

    it('generates agent-digest.json with correct structure', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();

      await setupVault(config.vaultPath, {
        'entities/seneca.md': ENTITY_SENECA,
        'sources/briefe-an-lucilius.md': SOURCE_BRIEFE,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      const digestRaw = await readFile(join(config.vaultPath, 'agent-digest.json'), 'utf-8');
      const digest = JSON.parse(digestRaw);

      expect(digest.totalPages).toBe(2);
      expect(digest.totalClaims).toBe(2);
      expect(digest.generatedAt).toBeTruthy();

      const senecaPage = digest.pages.find((p: { id: string }) => p.id === 'entity.seneca');
      expect(senecaPage).toBeDefined();
      expect(senecaPage.claimCount).toBe(2);
      expect(senecaPage.claimIds).toContain('id:claim.seneca-angst-these');
      expect(senecaPage.claimIds).toContain('id:claim.cortisol-senkung');
      expect(senecaPage.tags).toEqual(['philosophie', 'stoizismus', 'antike']);
    });

    it('generates claims.jsonl with one line per claim', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();

      await setupVault(config.vaultPath, {
        'concepts/praemeditatio-malorum.md': CONCEPT_PRAEMEDITATIO,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      const jsonlContent = await readFile(join(config.vaultPath, 'claims.jsonl'), 'utf-8');
      const lines = jsonlContent.trim().split('\n');

      expect(lines).toHaveLength(2);

      const parsed = lines.map((l: string) => JSON.parse(l));
      expect(parsed[0].id).toBe('id:claim.praemeditatio-definition');
      expect(parsed[0].confidence).toBe(0.9);
      expect(parsed[0].evidence).toBe('sources/briefe-an-lucilius');

      expect(parsed[1].id).toBe('id:claim.praemeditatio-cortisol');
      expect(parsed[1].confidence).toBe(0.85);
    });

    it('generates open-questions report when questions exist', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();

      await setupVault(config.vaultPath, {
        'concepts/praemeditatio-malorum.md': CONCEPT_PRAEMEDITATIO,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      const reportContent = await readFile(
        join(config.vaultPath, 'reports', 'open-questions.md'),
        'utf-8',
      );

      expect(reportContent).toContain('id: report.open-questions');
      expect(reportContent).toContain('# Open Questions');
      expect(reportContent).toContain('[[concepts/praemeditatio-malorum]]');
      expect(reportContent).toContain('prefrontal cortex');
    });

    it('skips open-questions report when no questions exist', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();

      await setupVault(config.vaultPath, {
        'entities/maria-schneider.md': ENTITY_MARIA,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      await expect(
        readFile(join(config.vaultPath, 'reports', 'open-questions.md'), 'utf-8'),
      ).rejects.toThrow();
    });

    it('generates contradictions report for contested claims', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();

      const contestedEntity = `---
id: entity.conflicting
title: Conflicting Entity
status: active
tags:
  - test
created: 2026-05-01
updated: 2026-05-01
---

# Conflicting Entity

Test entity with a contested claim.

## Claims

- \`id:claim.conflict-1\` \`conf:0.5\` \`status:contested\`
  This claim is contested
  *Evidence:* [[sources/briefe-an-lucilius]]
`;

      await setupVault(config.vaultPath, {
        'sources/briefe-an-lucilius.md': SOURCE_BRIEFE,
        'entities/conflicting.md': contestedEntity,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      const reportContent = await readFile(
        join(config.vaultPath, 'reports', 'contradictions.md'),
        'utf-8',
      );

      expect(reportContent).toContain('id: report.contradictions');
      expect(reportContent).toContain('contested claims');
      expect(reportContent).toContain('claim.conflict-1');
    });

    it('generates low-confidence report', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();

      const lowConfidencePage = `---
id: entity.low-conf
title: Low Confidence Entity
confidence: 0.3
status: active
tags:
  - test
created: 2026-05-01
updated: 2026-05-01
---

# Low Confidence Entity

This page has low confidence.

## Claims

- \`id:claim.low-conf-claim\` \`conf:0.4\` \`status:active\`
  A speculative claim with low confidence
  *Evidence:* [[sources/briefe-an-lucilius]]
`;

      await setupVault(config.vaultPath, {
        'sources/briefe-an-lucilius.md': SOURCE_BRIEFE,
        'entities/low-conf.md': lowConfidencePage,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      const reportContent = await readFile(
        join(config.vaultPath, 'reports', 'low-confidence.md'),
        'utf-8',
      );

      expect(reportContent).toContain('id: report.low-confidence');
      expect(reportContent).toContain('Low Confidence');
      expect(reportContent).toContain('[[entities/low-conf]]');
    });

    it('generates claim-health report for unhealthy claims', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();

      const unhealthyEntity = `---
id: entity.unhealthy
title: Unhealthy Claims Entity
status: active
tags:
  - test
created: 2026-05-01
updated: 2026-05-01
---

# Unhealthy Claims Entity

Test entity with various claim statuses.

## Claims

- \`id:claim.no-evidence\` \`conf:0.5\` \`status:active\`
  This claim has no evidence at all

- \`id:claim.deprecated-claim\` \`conf:0.2\` \`status:deprecated\`
  This claim has been deprecated
  *Evidence:* [[sources/briefe-an-lucilius]]
`;

      await setupVault(config.vaultPath, {
        'sources/briefe-an-lucilius.md': SOURCE_BRIEFE,
        'entities/unhealthy.md': unhealthyEntity,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      const reportContent = await readFile(
        join(config.vaultPath, 'reports', 'claim-health.md'),
        'utf-8',
      );

      expect(reportContent).toContain('id: report.claim-health');
      expect(reportContent).toContain('Missing Evidence');
      expect(reportContent).toContain('claim.no-evidence');
      expect(reportContent).toContain('Deprecated');
      expect(reportContent).toContain('claim.deprecated-claim');
    });

    it('generates stale-pages report for old pages', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();

      const oldPage = `---
id: entity.old-entity
title: Old Entity
status: active
tags:
  - test
created: 2020-01-01
updated: 2023-01-01
---

# Old Entity

This page was last updated in 2023.

## Claims

- \`id:claim.old-claim\` \`conf:0.7\` \`status:active\`
  A claim from an old page
  *Evidence:* [[sources/briefe-an-lucilius]]
`;

      await setupVault(config.vaultPath, {
        'sources/briefe-an-lucilius.md': SOURCE_BRIEFE,
        'entities/old-entity.md': oldPage,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      const reportContent = await readFile(
        join(config.vaultPath, 'reports', 'stale-pages.md'),
        'utf-8',
      );

      expect(reportContent).toContain('id: report.stale-pages');
      expect(reportContent).toContain('Old Entity');
    });

    it('skips stale-pages report when all pages are current', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();

      await setupVault(config.vaultPath, {
        'sources/briefe-an-lucilius.md': SOURCE_BRIEFE,
        'entities/seneca.md': ENTITY_SENECA,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      await expect(
        readFile(join(config.vaultPath, 'reports', 'stale-pages.md'), 'utf-8'),
      ).rejects.toThrow();
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

      const jsonlContent = await readFile(join(config.vaultPath, 'claims.jsonl'), 'utf-8');
      const parsed = JSON.parse(jsonlContent.trim().split('\n')[0]);
      expect(parsed.evidence).toBe('sources/briefe-an-lucilius');
      expect(parsed.evidenceLocation).toBe('(Kapitel 3)');
      expect(parsed.limitation).toBe('Begrenzte Stichprobe');
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

      expect(stepStarts.length).toBeGreaterThanOrEqual(4);
      expect(stepEnds.length).toBeGreaterThanOrEqual(4);

      const stepNames = stepStarts.map((e) => (e.type === 'step_start' ? e.step : ''));
      expect(stepNames).toContain('Parsing');
      expect(stepNames).toContain('GeneratingIndex');
      expect(stepNames).toContain('WritingDigests');
    });

    it('writes JSONL with compact single-line JSON per claim', async () => {
      const config = makeConfig();
      const emit = makeMockEmit();
      const ask = makeMockAsk();

      await setupVault(config.vaultPath, {
        'concepts/praemeditatio-malorum.md': CONCEPT_PRAEMEDITATIO,
      });

      const compile = new Compile(config, emit, ask);
      await compile.compile();

      const jsonlContent = await readFile(join(config.vaultPath, 'claims.jsonl'), 'utf-8');
      const lines = jsonlContent.trim().split('\n');
      expect(lines).toHaveLength(2);

      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
        const parsed = JSON.parse(line);
        expect(parsed.id).toBeTruthy();
        expect(parsed.text).toBeTruthy();
        expect(typeof parsed.confidence).toBe('number');
        expect(parsed.status).toBeTruthy();
        expect(parsed.pageSource).toBeTruthy();
      }
    });
  });
});
