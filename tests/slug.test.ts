import { describe, expect, it } from 'vitest';
import { createClaimSlug, createPageId, slugify } from '../src/slug.js';

describe('slugify', () => {
  describe('basic behavior', () => {
    it('replaces spaces with hyphens', () => {
      expect(slugify('hello world')).toBe('hello-world');
    });

    it('converts to lowercase', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('UPPERCASE')).toBe('uppercase');
    });

    it('preserves hyphens already in the text', () => {
      expect(slugify('already-hyphenated')).toBe('already-hyphenated');
    });

    it('lowercases hyphenated text', () => {
      expect(slugify('Telephone-Number')).toBe('telephone-number');
    });
  });

  describe('diacritics — transliterated to base ASCII', () => {
    it('transliterates é to e', () => {
      expect(slugify('café')).toBe('cafe');
    });

    it('transliterates ü to u', () => {
      expect(slugify('München')).toBe('munchen');
    });

    it('transliterates ø to o', () => {
      expect(slugify('smørrebrød')).toBe('smorrebrod');
    });

    it('transliterates ñ to n', () => {
      expect(slugify('mañana')).toBe('manana');
    });

    it('transliterates mixed diacritics', () => {
      expect(slugify('Ål Élü Ödéñ')).toBe('al-elu-oden');
    });
  });

  describe('non-Latin scripts — transliterated to Latin', () => {
    it('transliterates Cyrillic (Russian by default)', () => {
      expect(slugify('маленький подъезд')).toBe('malenkij-poduezd');
    });

    it('transliterates Cyrillic with explicit locale', () => {
      expect(slugify('маленький подъезд', { locale: 'ru' })).toBe('malenkij-poduezd');
    });
  });

  describe('symbol removal — unrecognized characters are removed', () => {
    it('removes dollar sign', () => {
      expect(slugify('$100')).toBe('100');
    });

    it('removes angle brackets', () => {
      expect(slugify('<hello>')).toBe('hello');
    });

    it('removes punctuation and symbols, keeping alphanumerics', () => {
      expect(slugify('Price: $50! (incl. tax)')).toBe('price-50-incl-tax');
    });

    it('removes standalone punctuation', () => {
      expect(slugify('hello!!!')).toBe('hello');
    });
  });

  describe('collapse — consecutive non-word characters become a single hyphen', () => {
    it('collapses multiple spaces to a single hyphen', () => {
      expect(slugify('hello   world')).toBe('hello-world');
    });

    it('collapses mixed whitespace and punctuation to a single hyphen', () => {
      expect(slugify('hello---world')).toBe('hello-world');
    });

    it('collapses spaces and hyphens between words', () => {
      expect(slugify('hello  -  world')).toBe('hello-world');
    });
  });

  describe('trim — leading and trailing hyphens removed', () => {
    it('trims leading whitespace', () => {
      expect(slugify('  hello')).toBe('hello');
    });

    it('trims trailing punctuation', () => {
      expect(slugify('hello!!!')).toBe('hello');
    });

    it('trims both leading and trailing hyphens from surrounded text', () => {
      expect(slugify(' - hello - ')).toBe('hello');
    });

    it('trims leading punctuation before a word', () => {
      expect(slugify('...leading')).toBe('leading');
    });
  });

  describe('fallback hash — empty results get a predictable hash', () => {
    it('returns a non-empty hash for whitespace-only input', () => {
      const result = slugify('   ');
      expect(result).toBeTruthy();
      expect(result).not.toBe('');
    });

    it('returns a non-empty hash for punctuation-only input', () => {
      const result = slugify('!!!');
      expect(result).toBeTruthy();
      expect(result).not.toBe('');
    });

    it('returns a non-empty hash for emoji-only input', () => {
      const result = slugify('🎉');
      expect(result).toBeTruthy();
      expect(result).not.toBe('');
    });

    it('returns the same hash for identical input (deterministic)', () => {
      expect(slugify('!!!')).toBe(slugify('!!!'));
      expect(slugify('🎉')).toBe(slugify('🎉'));
    });

    it('returns different hashes for different inputs', () => {
      expect(slugify('!!!')).not.toBe(slugify('🎉'));
    });
  });
});

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
