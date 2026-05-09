// Specification: docs/cross-cutting/slug-spec.md

import { describe, expect, it } from 'vitest';
import { Slugger } from '../src/slugger';

const s = new Slugger();

describe('Slugger', () => {
  describe('basic behavior', () => {
    it('replaces spaces with hyphens', () => {
      expect(s.slugify('hello world')).toBe('hello-world');
    });

    it('converts to lowercase', () => {
      expect(s.slugify('Hello World')).toBe('hello-world');
      expect(s.slugify('UPPERCASE')).toBe('uppercase');
    });

    it('preserves hyphens already in the text', () => {
      expect(s.slugify('already-hyphenated')).toBe('already-hyphenated');
    });

    it('lowercases hyphenated text', () => {
      expect(s.slugify('Telephone-Number')).toBe('telephone-number');
    });
  });

  describe('diacritics — transliterated to base ASCII', () => {
    it('transliterates é to e', () => {
      expect(s.slugify('café')).toBe('cafe');
    });

    it('transliterates ü to u', () => {
      expect(s.slugify('München')).toBe('munchen');
    });

    it('transliterates ø to o', () => {
      expect(s.slugify('smørrebrød')).toBe('smorrebrod');
    });

    it('transliterates ñ to n', () => {
      expect(s.slugify('mañana')).toBe('manana');
    });

    it('transliterates mixed diacritics', () => {
      expect(s.slugify('Ål Élü Ödéñ')).toBe('al-elu-oden');
    });
  });

  describe('non-Latin scripts — transliterated to Latin', () => {
    it('transliterates Cyrillic (Russian by default)', () => {
      expect(s.slugify('маленький подъезд')).toBe('malenkij-poduezd');
    });

    it('transliterates Cyrillic with explicit locale', () => {
      const sLocale = new Slugger({ locale: 'ru' });
      expect(sLocale.slugify('маленький подъезд')).toBe('malenkij-poduezd');
    });
  });

  describe('symbol removal — unrecognized characters are removed', () => {
    it('removes dollar sign', () => {
      expect(s.slugify('$100')).toBe('100');
    });

    it('removes angle brackets', () => {
      expect(s.slugify('<hello>')).toBe('hello');
    });

    it('removes punctuation and symbols, keeping alphanumerics', () => {
      expect(s.slugify('Price: $50! (incl. tax)')).toBe('price-50-incl-tax');
    });

    it('removes standalone punctuation', () => {
      expect(s.slugify('hello!!!')).toBe('hello');
    });
  });

  describe('collapse — consecutive non-word characters become a single hyphen', () => {
    it('collapses multiple spaces to a single hyphen', () => {
      expect(s.slugify('hello   world')).toBe('hello-world');
    });

    it('collapses mixed whitespace and punctuation to a single hyphen', () => {
      expect(s.slugify('hello---world')).toBe('hello-world');
    });

    it('collapses spaces and hyphens between words', () => {
      expect(s.slugify('hello  -  world')).toBe('hello-world');
    });
  });

  describe('trim — leading and trailing hyphens removed', () => {
    it('trims leading whitespace', () => {
      expect(s.slugify('  hello')).toBe('hello');
    });

    it('trims trailing punctuation', () => {
      expect(s.slugify('hello!!!')).toBe('hello');
    });

    it('trims both leading and trailing hyphens from surrounded text', () => {
      expect(s.slugify(' - hello - ')).toBe('hello');
    });

    it('trims leading punctuation before a word', () => {
      expect(s.slugify('...leading')).toBe('leading');
    });
  });

  describe('fallback hash — empty results get a predictable hash', () => {
    it('returns a non-empty hash for whitespace-only input', () => {
      const result = s.slugify('   ');
      expect(result).toBeTruthy();
      expect(result).not.toBe('');
    });

    it('returns a non-empty hash for punctuation-only input', () => {
      const result = s.slugify('!!!');
      expect(result).toBeTruthy();
      expect(result).not.toBe('');
    });

    it('returns a non-empty hash for emoji-only input', () => {
      const result = s.slugify('🎉');
      expect(result).toBeTruthy();
      expect(result).not.toBe('');
    });

    it('returns the same hash for identical input (deterministic)', () => {
      expect(s.slugify('!!!')).toBe(s.slugify('!!!'));
      expect(s.slugify('🎉')).toBe(s.slugify('🎉'));
    });

    it('returns different hashes for different inputs', () => {
      expect(s.slugify('!!!')).not.toBe(s.slugify('🎉'));
    });
  });
});
