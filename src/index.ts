#!/usr/bin/env node
import { createWriteStream } from 'node:fs';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { program } from 'commander';
import pino from 'pino';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { EXIT, visit } from 'unist-util-visit';

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

export function hasMarkdownHeading(text: string): boolean {
  const tree = unified().use(remarkParse).parse(text);
  let found = false;
  visit(tree, 'heading', () => {
    found = true;
    return EXIT;
  });
  return found;
}

export interface AgenticLoopResult {
  answer: string;
  attempts: number;
}

export async function agenticLoop(prompt: string, maxRetries = 3): Promise<AgenticLoopResult> {
  const model = openrouter('deepseek/deepseek-v4-pro');
  let currentPrompt = prompt;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    logger.info({ attempt, prompt: currentPrompt }, 'Agentic loop attempt');
    const { text } = await generateText({
      model,
      prompt: currentPrompt,
    });
    logger.info({ text, attempt }, 'Agent response');

    if (hasMarkdownHeading(text)) {
      return { answer: text, attempts: attempt };
    }

    logger.warn({ attempt }, 'Response missing markdown heading, retrying');
    currentPrompt = `Your previous response did not include a markdown headline (e.g. # Title or ## Subtitle) above the calculation. Please redo your response and make sure to include a markdown heading before the calculation.\n\nOriginal prompt: ${prompt}`;
  }

  const { text } = await generateText({
    model,
    prompt: currentPrompt,
  });

  return { answer: text, attempts: maxRetries };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  program
    .name('hello-world')
    .description('A CLI that greets and asks an AI question')
    .option('-l, --log-file <path>', 'path to log file', 'exolith.log')
    .option('--log-level <level>', 'log level', 'info')
    .option('-a, --agentic <prompt>', 'run the agentic loop with the given prompt')
    .option('--max-retries <number>', 'max retries for the agentic loop', '3')
    .action(async (options) => {
      const logStream = createWriteStream(options.logFile, { flags: 'w' });
      logger = pino({ name: 'hello-world', level: options.logLevel }, logStream);

      logger.info('CLI started');
      console.log(greet());

      if (options.agentic) {
        const result = await agenticLoop(options.agentic, Number.parseInt(options.maxRetries));
        console.log(`\n--- Agentic Loop Result (${result.attempts} attempt(s)) ---`);
        console.log(result.answer);
      } else {
        const answer = await askQuestion();
        console.log(answer);
      }

      logger.info('CLI finished');
    });

  program.parse();
}
