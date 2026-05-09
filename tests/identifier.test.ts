// Specification: docs/cross-cutting/identifier-spec.md
// Specification: docs/cross-cutting/slug-spec.md

import { describe, expect, it } from 'vitest';
import { createClaimSlug, createPageId } from '../src/identifier';

describe('createPageId', () => {
  it('creates a page ID for an entity', () => {
    expect(createPageId('entity', 'Seneca')).toBe('entity.seneca');
  });

  it('creates a page ID for a concept', () => {
    expect(createPageId('concept', 'Praemeditatio Malorum')).toBe('concept.praemeditatio-malorum');
  });

  it('creates a page ID for a source with complex title', () => {
    expect(createPageId('source', 'Schneider Metastudie 2024')).toBe(
      'source.schneider-metastudie-2024',
    );
  });

  it('creates a page ID for a synthesis', () => {
    expect(createPageId('synthesis', 'Stoizismus und Empirie')).toBe(
      'synthesis.stoizismus-und-empirie',
    );
  });

  it('creates a page ID for a report', () => {
    expect(createPageId('report', 'Jahresübersicht')).toBe('report.jahresubersicht');
  });

  it('slugifies the title with diacritics in the page ID', () => {
    expect(createPageId('entity', 'Münchner')).toBe('entity.munchner');
  });

  it('throws for an invalid page type', () => {
    expect(() => createPageId('invalid' as never, 'Test')).toThrow('Invalid page type: invalid');
  });
});

describe('createClaimSlug', () => {
  it('prepends claim. to the slugified description', () => {
    expect(createClaimSlug('Cortisol Senkung')).toBe('claim.cortisol-senkung');
  });

  it('slugifies complex descriptions', () => {
    expect(createClaimSlug('Senkung des Cortisol-Spiegels um 26%')).toBe(
      'claim.senkung-des-cortisol-spiegels-um-26',
    );
  });

  it('handles descriptions with special characters', () => {
    expect(createClaimSlug('Preis: >50€')).toBe('claim.preis-50');
  });
});
