#!/usr/bin/env node
import { createWriteStream } from 'node:fs';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import pino from 'pino';

const logStream = createWriteStream('exolith.log', { flags: 'w' });
const logger = pino({ name: 'hello-world' }, logStream);

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export function greet(name = 'world'): string {
  logger.info({ name }, 'Generating greeting');
  return `Hello, ${name}!`;
}

export async function askQuestion(): Promise<string> {
  logger.info('Calling OpenRouter API');
  const { text } = await generateText({
    model: openrouter('deepseek/deepseek-v4-pro'),
    prompt: 'What is 1+1',
  });
  logger.info({ text }, 'OpenRouter response');
  return text;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  logger.info('CLI started');
  console.log(greet());
  const answer = await askQuestion();
  console.log(answer);
  logger.info('CLI finished');
}
