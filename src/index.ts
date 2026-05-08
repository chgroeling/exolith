#!/usr/bin/env node
import { createWriteStream } from 'node:fs';
import pino from 'pino';

const logStream = createWriteStream('exolith.log', { flags: 'w' });
const logger = pino({ name: 'hello-world' }, logStream);

export function greet(name = 'world'): string {
  logger.info({ name }, 'Generating greeting');
  return `Hello, ${name}!`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  logger.info('CLI started');
  console.log(greet());
  logger.info('CLI finished');
}
