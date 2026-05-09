// Specification: docs/cross-cutting/slug-spec.md

import { describe, expect, it } from 'vitest';
import { slugify } from '../src/slug';

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
