/** Specification: docs/operations/ingest.md — round-trip note parsing integration tests */

import { join } from 'node:path';
import { Environment, FileSystemLoader } from 'nunjucks';
import { describe, expect, it } from 'vitest';
import { parseNote } from '../../src/core/note-parser';
import type { ParsedClaim, ParsedNote, ParsedOpenQuestion } from '../../src/core/note-parser';

function createEnv(): Environment {
  const templateDir = join(import.meta.dirname, '..', '..', 'templates');
  return new Environment(new FileSystemLoader(templateDir), { autoescape: false });
}

/** Converts a ParsedNote to the template context expected by entity-page-output.njk and concept-page-output.njk. */
function toTemplateContext(note: ParsedNote): Record<string, unknown> {
  return {
    id: note.frontmatter.id,
    title: note.frontmatter.title,
    type: note.frontmatter.type,
    tldr: note.tldr,
    status: note.frontmatter.status,
    tags: note.frontmatter.tags,
    confidence: note.frontmatter.confidence,
    created: note.frontmatter.created,
    updated: note.frontmatter.updated,
    body: note.content,
    claims: note.claims,
    openQuestions: note.openQuestions,
    humanBlockContent: note.human || '',
  };
}

/** Renders a ParsedNote through a Nunjucks template and parses it back, asserting round-trip equality. */
function assertRoundTrip(templateName: string, note: ParsedNote): void {
  const env = createEnv();
  const context = toTemplateContext(note);
  const markdown = env.render(templateName, context);
  const parsed = parseNote(markdown);

  expect(parsed.frontmatter.id).toBe(note.frontmatter.id);
  expect(parsed.frontmatter.title).toBe(note.frontmatter.title);
  expect(parsed.frontmatter.type).toBe(note.frontmatter.type);
  expect(parsed.tldr).toBe(note.tldr);
  expect(parsed.frontmatter.status).toBe(note.frontmatter.status);
  expect(parsed.frontmatter.tags).toEqual(note.frontmatter.tags);
  expect(parsed.frontmatter.confidence).toBe(note.frontmatter.confidence);
  expect(parsed.frontmatter.created).toBe(note.frontmatter.created);
  expect(parsed.frontmatter.updated).toBe(note.frontmatter.updated);
  expect(parsed.content).toBe(note.content);
  expect(parsed.claims).toEqual(note.claims);
  expect(parsed.openQuestions).toEqual(note.openQuestions);
  expect(parsed.human).toBe(note.human);
}

function makeClaim(overrides: Partial<ParsedClaim> = {}): ParsedClaim {
  return {
    slug: 'cortisol-senkung',
    confidence: 0.85,
    status: 'active',
    text: 'Praemeditatio malorum reduces cortisol by 18%',
    evidence: 'sources/schneider-2024',
    evidenceLocation: 'paragraph 3',
    limitation: 'No effect under 25',
    ...overrides,
  };
}

function makeOpenQuestion(overrides: Partial<ParsedOpenQuestion> = {}): ParsedOpenQuestion {
  return {
    question: 'Does the effect persist after discontinuing exercises?',
    context: 'Study only measures acute effects',
    ...overrides,
  };
}

function makeFullEntityNote(overrides: Partial<ParsedNote> = {}): ParsedNote {
  return {
    frontmatter: {
      id: 'entity.seneca',
      title: 'Seneca',
      type: 'entity',
      status: 'active',
      tags: ['philosophie', 'stoizismus', 'antike'],
      confidence: 0.9,
      created: '2026-04-15',
      updated: '2026-05-02',
    },
    tldr: 'Seneca was a Roman Stoic philosopher whose letters to Lucilius remain foundational texts on practical ethics.',
    content:
      'Lucius Annaeus Seneca was a Roman philosopher, dramatist, and statesman. His Letters to Lucilius are a collection of 124 moral letters.',
    claims: [
      makeClaim(),
      makeClaim({
        slug: 'seneca-angst-these',
        confidence: 0.3,
        status: 'uncertain',
        text: 'Most anxieties arise from anticipated suffering, not from real suffering',
        evidence: 'sources/briefe-an-lucilius',
        evidenceLocation: undefined,
        limitation: 'Philosophical assertion, 2,000 years old, no empirical evidence',
      }),
    ],
    openQuestions: [makeOpenQuestion()],
    human:
      '## Persönliche Notizen\n\nI find Seneca letters more accessible than Marcus Aurelius — less cryptic, more directly applicable.',
    ...overrides,
  };
}

function makeFullConceptNote(overrides: Partial<ParsedNote> = {}): ParsedNote {
  return {
    frontmatter: {
      id: 'concept.praemeditatio-malorum',
      title: 'Praemeditatio Malorum',
      type: 'concept',
      status: 'active',
      tags: ['stoicism', 'psychology', 'anxiety-management'],
      confidence: 0.7,
      created: '2026-05-02',
      updated: '2026-05-02',
    },
    tldr: 'Praemeditatio malorum is a Stoic exercise of visualizing worst-case scenarios to manage anxiety, now empirically validated by modern research.',
    content:
      'Praemeditatio malorum is a Stoic exercise of visualizing worst-case scenarios. It serves as anxiety management through confrontation rather than suppression.',
    claims: [
      makeClaim({
        slug: 'cortisol-significant',
        confidence: 0.85,
        text: 'Daily praemeditatio significantly reduces cortisol',
        evidence: 'sources/schneider-meta-study-2024',
        evidenceLocation: 'paragraph 3',
        limitation: 'No effect in participants under 25',
      }),
      makeClaim({
        slug: 'age-threshold',
        confidence: 0.8,
        text: 'The effect only occurs in participants over 25 years',
        evidence: 'sources/schneider-meta-study-2024',
        evidenceLocation: 'paragraph 4',
        limitation: undefined,
      }),
    ],
    openQuestions: [
      makeOpenQuestion({ context: 'Study only measures acute effects' }),
      makeOpenQuestion({
        question: 'Why does praemeditatio not work for people under 25?',
        context: 'Possible explanation: prefrontal cortex not yet fully developed',
      }),
    ],
    human:
      '## Persönliche Notizen\n\nBeen practicing this since January — subjectively noticeable effect before presentations.',
    ...overrides,
  };
}

describe('parseNote round-trip', () => {
  it('entity page with claims, open questions, and human note survives round-trip', () => {
    assertRoundTrip('entity-page-output.njk', makeFullEntityNote());
  });

  it('concept page with claims, open questions, and human note survives round-trip', () => {
    assertRoundTrip('concept-page-output.njk', makeFullConceptNote());
  });

  it('entity page with no claims, no open questions, and no human note survives round-trip', () => {
    assertRoundTrip(
      'entity-page-output.njk',
      makeFullEntityNote({ claims: [], openQuestions: [], human: '## Personal Notes' }),
    );
  });

  it('entity page with claims but no open questions and no human note survives round-trip', () => {
    assertRoundTrip(
      'entity-page-output.njk',
      makeFullEntityNote({ openQuestions: [], human: '## Personal Notes' }),
    );
  });

  it('entity page with open questions but no claims and no human note survives round-trip', () => {
    assertRoundTrip(
      'entity-page-output.njk',
      makeFullEntityNote({ claims: [], human: '## Personal Notes' }),
    );
  });

  it('entity page with claim that has no evidenceLocation and no limitation survives round-trip', () => {
    assertRoundTrip(
      'entity-page-output.njk',
      makeFullEntityNote({
        claims: [makeClaim({ evidenceLocation: undefined, limitation: undefined })],
        openQuestions: [],
        human: '## Personal Notes',
      }),
    );
  });

  it('parseNote returns sensible defaults for an empty page', () => {
    const result = parseNote('');

    expect(result.frontmatter.id).toBe('');
    expect(result.frontmatter.title).toBe('');
    expect(result.frontmatter.type).toBe('');
    expect(result.tldr).toBe('');
    expect(result.frontmatter.status).toBe('active');
    expect(result.frontmatter.tags).toEqual([]);
    expect(result.frontmatter.confidence).toBe(0);
    expect(result.frontmatter.created).toBe('');
    expect(result.frontmatter.updated).toBe('');
    expect(result.content).toBe('');
    expect(result.claims).toEqual([]);
    expect(result.openQuestions).toEqual([]);
    expect(result.human).toBe('');
  });
});

describe('frontmatter parsing via parseNote', () => {
  /** Wraps a YAML string in frontmatter delimiters with a minimal body. */
  function wrap(yaml: string): string {
    return `---\n${yaml}\n---\n\n# Test\n\nContent.`;
  }

  it('parses valid YAML frontmatter with all fields', () => {
    const yaml = [
      'id: entity.seneca',
      'title: Seneca',
      'type: entity',
      'status: active',
      'tags:',
      '  - philosophie',
      '  - stoizismus',
      'confidence: 0.9',
      'created: 2026-04-15',
      'updated: 2026-05-02',
    ].join('\n');

    const result = parseNote(wrap(yaml));

    expect(result.frontmatter.id).toBe('entity.seneca');
    expect(result.frontmatter.title).toBe('Seneca');
    expect(result.frontmatter.type).toBe('entity');
    expect(result.frontmatter.status).toBe('active');
    expect(result.frontmatter.tags).toEqual(['philosophie', 'stoizismus']);
    expect(result.frontmatter.confidence).toBe(0.9);
    expect(result.frontmatter.created).toBe('2026-04-15');
    expect(result.frontmatter.updated).toBe('2026-05-02');
    expect(result.content).toBe('Content.');
  });

  it('applies defaults for missing optional fields', () => {
    const yaml =
      'id: entity.test\ntitle: Test\ntype: entity\nstatus: active\ntags:\nconfidence: 0.5\ncreated: 2026-01-01\nupdated: 2026-01-01';

    const result = parseNote(wrap(yaml));

    expect(result.frontmatter.status).toBe('active');
    expect(result.frontmatter.confidence).toBe(0.5);
    expect(result.frontmatter.tags).toEqual([]);
  });

  it('rejects unknown keys in strict mode', () => {
    const yaml =
      'id: entity.test\ntitle: Test\ntype: entity\nstatus: active\ncreated: 2026-01-01\nupdated: 2026-01-01\nunknown_field: value';

    expect(() => parseNote(wrap(yaml))).toThrow();
  });

  it('rejects malformed YAML', () => {
    const yaml =
      'id: entity.test\ntitle: Test\ntype: entity\nstatus: active\ncreated: 2026-01-01\nupdated: 2026-01-01\nbad: [unclosed';

    expect(() => parseNote(wrap(yaml))).toThrow();
  });

  it('rejects frontmatter that is not a mapping', () => {
    expect(() => parseNote(wrap('- list_item'))).toThrow();
  });

  it('parses tags as an array', () => {
    const yaml = [
      'id: entity.test',
      'title: Test',
      'type: entity',
      'status: active',
      'tags:',
      '  - alpha',
      '  - beta',
      'created: 2026-01-01',
      'updated: 2026-01-01',
    ].join('\n');

    const result = parseNote(wrap(yaml));

    expect(result.frontmatter.tags).toEqual(['alpha', 'beta']);
  });
});
