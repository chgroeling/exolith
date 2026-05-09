// Specification: docs/cross-cutting/identifier-spec.md

import { describe, expect, it } from 'vitest';
import { IdentifierServiceImpl } from '../src/services/identifier-service-impl';
import type { SluggerService } from '../src/slugger-service';

const mockSlugger: SluggerService = {
  slugify(_text: string) {
    return '<slug>';
  },
};

const id = new IdentifierServiceImpl(mockSlugger);

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

describe('decomposeId', () => {
  it('splits a valid id into type and slug', () => {
    expect(id.decomposeId('entity.seneca')).toEqual({ type: 'entity', slug: 'seneca' });
  });

  it('works for all types', () => {
    expect(id.decomposeId('concept.foo')).toEqual({ type: 'concept', slug: 'foo' });
    expect(id.decomposeId('source.foo')).toEqual({ type: 'source', slug: 'foo' });
    expect(id.decomposeId('synthesis.foo')).toEqual({ type: 'synthesis', slug: 'foo' });
    expect(id.decomposeId('report.foo')).toEqual({ type: 'report', slug: 'foo' });
    expect(id.decomposeId('claim.foo')).toEqual({ type: 'claim', slug: 'foo' });
  });

  it('preserves slugs containing dots', () => {
    expect(id.decomposeId('entity.a.b.c')).toEqual({ type: 'entity', slug: 'a.b.c' });
  });

  it('throws when the id has no dot separator', () => {
    expect(() => id.decomposeId('noprefix')).toThrow(
      "Malformed identifier: missing type prefix in 'noprefix'",
    );
  });

  it('throws when the type is invalid', () => {
    expect(() => id.decomposeId('invalid.slug')).toThrow('Invalid identifier type: invalid');
  });

  it('throws when the slug is empty', () => {
    expect(() => id.decomposeId('entity.')).toThrow(
      "Malformed identifier: missing slug in 'entity.'",
    );
  });
});
