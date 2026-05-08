import { describe, expect, it, vi } from 'vitest';
import { agenticLoop, greet, hasMarkdownHeading } from '../src/index.js';

vi.mock('ai', () => ({
  streamText: vi.fn(),
}));

function textStreamFrom(...chunks: string[]): AsyncIterable<string> {
  return (async function* () {
    for (const chunk of chunks) {
      yield chunk;
    }
  })();
}

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
    const { streamText } = await import('ai');
    const mockStreamText = vi.mocked(streamText);
    mockStreamText.mockReturnValueOnce({
      textStream: textStreamFrom('# Calculation Result\n', '10 * 5 = 50'),
    } as never);

    const result = await agenticLoop('What is 10 * 5?');
    expect(result.attempts).toBe(1);
    expect(result.answer).toBe('# Calculation Result\n10 * 5 = 50');
  });

  it('retries when response lacks a heading', async () => {
    const { streamText } = await import('ai');
    const mockStreamText = vi.mocked(streamText);
    mockStreamText
      .mockReturnValueOnce({
        textStream: textStreamFrom('10 * 5 = 50 (no heading)'),
      } as never)
      .mockReturnValueOnce({
        textStream: textStreamFrom('## Calculation\n', '10 * 5 = 50'),
      } as never);

    const result = await agenticLoop('What is 10 * 5?', 3);
    expect(result.attempts).toBe(2);
    expect(result.answer).toBe('## Calculation\n10 * 5 = 50');
  });

  it('returns last response after max retries', async () => {
    const { streamText } = await import('ai');
    const mockStreamText = vi.mocked(streamText);
    mockStreamText
      .mockReturnValueOnce({
        textStream: textStreamFrom('no heading'),
      } as never)
      .mockReturnValueOnce({
        textStream: textStreamFrom('# Final\n', 'With heading'),
      } as never);

    const result = await agenticLoop('prompt', 2);
    expect(result.attempts).toBe(2);
    expect(result.answer).toBe('# Final\nWith heading');
  });
});
