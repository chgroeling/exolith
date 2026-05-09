#!/usr/bin/env node
import { createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText } from 'ai';
import { program } from 'commander';
import pino from 'pino';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { EXIT, visit } from 'unist-util-visit';
import { Identifier } from './identifier';
import { Ingest, type IngestConfig } from './operations/ingest';
import { VercelLlmService } from './providers/vercel-llm-service';
import { Slugger } from './slugger';

let logger = pino({ name: 'hello-world' });

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export function greet(name = 'world'): string {
  logger.info({ name }, 'Generating greeting');
  return `Hello, ${name}!`;
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

async function streamAndCollect(
  model: ReturnType<typeof openrouter>,
  prompt: string,
  onChunk?: (chunk: string) => void,
): Promise<string> {
  const result = streamText({ model, prompt });
  let text = '';
  for await (const chunk of result.textStream) {
    onChunk?.(chunk);
    text += chunk;
  }
  return text;
}

export async function agenticLoop(
  prompt: string,
  maxRetries = 3,
  onChunk?: (chunk: string) => void,
): Promise<AgenticLoopResult> {
  const model = openrouter('deepseek/deepseek-v4-pro');
  let currentPrompt = prompt;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    logger.info({ attempt, prompt: currentPrompt }, 'Agentic loop attempt');
    const text = await streamAndCollect(model, currentPrompt, onChunk);
    logger.info({ text, attempt }, 'Agent response');

    if (hasMarkdownHeading(text)) {
      return { answer: text, attempts: attempt };
    }

    logger.warn({ attempt }, 'Response missing markdown heading, retrying');
    currentPrompt = `Your previous response did not include a markdown headline (e.g. # Title or ## Subtitle) above the calculation. Please redo your response and make sure to include a markdown heading before the calculation.\n\nOriginal prompt: ${prompt}`;
  }

  const text = await streamAndCollect(model, currentPrompt, onChunk);

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
    .option('-i, --inbox <path>', 'run the ingest pipeline on a raw source file')
    .option('--max-source-size <bytes>', 'maximum source file size in bytes', '10485760')
    .option('--vault <path>', 'path to the vault directory', '.')
    .action(async (options) => {
      const logStream = createWriteStream(options.logFile, { flags: 'w' });
      logger = pino({ name: 'hello-world', level: options.logLevel }, logStream);

      logger.info('CLI started');
      console.log(greet());

      const write = (chunk: string) => process.stdout.write(chunk);

      if (options.agentic) {
        await agenticLoop(options.agentic, Number.parseInt(options.maxRetries), write);
        process.stdout.write('\n');
      }

      if (options.inbox) {
        const model = openrouter('deepseek/deepseek-v4-pro');
        const slugger = new Slugger();
        const identifier = new Identifier(slugger);
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const config: IngestConfig = {
          maxSourceSize: Number.parseInt(options.maxSourceSize),
          vaultPath: options.vault,
          onChunk: write,
          readInput: () => rl.question('> '),
        };
        const vercelLlm = new VercelLlmService(model);
        const ingest = new Ingest(vercelLlm, identifier, config);
        await ingest.process(options.inbox);
        rl.close();
      }

      logger.info('CLI finished');
    });

  program.parse();
}
