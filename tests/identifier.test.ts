// Specification: docs/cross-cutting/identifier-spec.md

import { describe, expect, it } from 'vitest';
import { Identifier, type Slugger } from '../src/identifier';

const mockSlugger: Slugger = {
  slugify(_text: string) {
    return '<slug>';
  },
};

const id = new Identifier(mockSlugger);

describe('createId', () => {
  it('formats {type}.{slug}', () => {
    expect(id.createId('entity', 'anything')).toBe('entity.<slug>');
  });

  it('works for all types', () => {
    expect(id.createId('concept', 'x')).toBe('concept.<slug>');
    expect(id.createId('source', 'x')).toBe('source.<slug>');
    expect(id.createId('synthesis', 'x')).toBe('synthesis.<slug>');
    expect(id.createId('report', 'x')).toBe('report.<slug>');
    expect(id.createId('claim', 'x')).toBe('claim.<slug>');
  });

  it('throws for an invalid type', () => {
    expect(() => id.createId('invalid' as never, 'Test')).toThrow(
      'Invalid identifier type: invalid',
    );
  });
});
