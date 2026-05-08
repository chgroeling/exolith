import { describe, expect, it, vi } from 'vitest';
import { agenticLoop, greet, hasMarkdownHeading } from '../src/index.js';

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

describe('greet', () => {
  it('returns default greeting when no name provided', () => {
    expect(greet()).toBe('Hello, world!');
  });

  it('returns personalized greeting when name provided', () => {
    expect(greet('Alice')).toBe('Hello, Alice!');
  });
});

describe('hasMarkdownHeading', () => {
  it('returns true when text contains an ATX heading', () => {
    expect(hasMarkdownHeading('# My Heading\nSome text')).toBe(true);
  });

  it('returns true for h2 heading', () => {
    expect(hasMarkdownHeading('## Calculation\n42')).toBe(true);
  });

  it('returns true for deep heading level', () => {
    expect(hasMarkdownHeading('###### Deep heading\nContent')).toBe(true);
  });

  it('returns false for text without a heading', () => {
    expect(hasMarkdownHeading('Just some plain text without heading')).toBe(false);
  });

  it('returns false for text with bold but no heading', () => {
    expect(hasMarkdownHeading('**bold** text')).toBe(false);
  });

  it('returns true when heading appears after other content', () => {
    expect(hasMarkdownHeading('Some preamble\n# Heading later')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(hasMarkdownHeading('')).toBe(false);
  });
});

describe('agenticLoop', () => {
  it('returns result on first attempt when heading is present', async () => {
    const { generateText } = await import('ai');
    const mockGenerate = vi.mocked(generateText);
    mockGenerate.mockResolvedValueOnce({
      text: '# Calculation Result\n10 * 5 = 50',
    } as never);

    const result = await agenticLoop('What is 10 * 5?');
    expect(result.attempts).toBe(1);
    expect(result.answer).toContain('# Calculation Result');
  });

  it('retries when response lacks a heading', async () => {
    const { generateText } = await import('ai');
    const mockGenerate = vi.mocked(generateText);
    mockGenerate
      .mockResolvedValueOnce({ text: '10 * 5 = 50 (no heading)' } as never)
      .mockResolvedValueOnce({ text: '## Calculation\n10 * 5 = 50' } as never);

    const result = await agenticLoop('What is 10 * 5?', 3);
    expect(result.attempts).toBe(2);
    expect(result.answer).toContain('## Calculation');
  });

  it('returns last response after max retries', async () => {
    const { generateText } = await import('ai');
    const mockGenerate = vi.mocked(generateText);
    mockGenerate
      .mockResolvedValueOnce({ text: 'no heading' } as never)
      .mockResolvedValueOnce({ text: '# Final\nWith heading' } as never);

    const result = await agenticLoop('prompt', 2);
    expect(result.attempts).toBe(2);
  });
});
