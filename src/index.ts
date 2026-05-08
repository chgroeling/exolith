#!/usr/bin/env node
import { createWriteStream } from 'node:fs';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { program } from 'commander';
import pino from 'pino';

let logger = pino({ name: 'hello-world' });

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
  program
    .name('hello-world')
    .description('A CLI that greets and asks an AI question')
    .option('-l, --log-file <path>', 'path to log file', 'exolith.log')
    .option('--log-level <level>', 'log level', 'info')
    .action(async (options) => {
      const logStream = createWriteStream(options.logFile, { flags: 'w' });
      logger = pino({ name: 'hello-world', level: options.logLevel }, logStream);

      logger.info('CLI started');
      console.log(greet());
      const answer = await askQuestion();
      console.log(answer);
      logger.info('CLI finished');
    });

  program.parse();
}
