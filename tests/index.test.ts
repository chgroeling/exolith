import { describe, expect, it } from 'vitest';
import { greet } from '../src/index.js';

describe('greet', () => {
  it('returns default greeting when no name provided', () => {
    expect(greet()).toBe('Hello, world!');
  });

  it('returns personalized greeting when name provided', () => {
    expect(greet('Alice')).toBe('Hello, Alice!');
  });
});
