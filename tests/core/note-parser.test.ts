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
    id: note.id,
    title: note.title,
    status: note.status,
    tags: note.tags,
    confidence: note.confidence,
    created: note.created,
    updated: note.updated,
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

  expect(parsed.id).toBe(note.id);
  expect(parsed.title).toBe(note.title);
  expect(parsed.status).toBe(note.status);
  expect(parsed.tags).toEqual(note.tags);
  expect(parsed.confidence).toBe(note.confidence);
  expect(parsed.created).toBe(note.created);
  expect(parsed.updated).toBe(note.updated);
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
    id: 'entity.seneca',
    title: 'Seneca',
    status: 'active',
    tags: ['philosophie', 'stoizismus', 'antike'],
    confidence: 0.9,
    created: '2026-04-15',
    updated: '2026-05-02',
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
    id: 'concept.praemeditatio-malorum',
    title: 'Praemeditatio Malorum',
    status: 'active',
    tags: ['stoicism', 'psychology', 'anxiety-management'],
    confidence: 0.7,
    created: '2026-05-02',
    updated: '2026-05-02',
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

    expect(result.id).toBe('');
    expect(result.title).toBe('');
    expect(result.status).toBe('active');
    expect(result.tags).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(result.created).toBe('');
    expect(result.updated).toBe('');
    expect(result.content).toBe('');
    expect(result.claims).toEqual([]);
    expect(result.openQuestions).toEqual([]);
    expect(result.human).toBe('');
  });
});
