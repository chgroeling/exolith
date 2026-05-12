/** Shared JSON5 schema-file resolution and parsing. */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';

/** Resolves a JSON5 schema file by trying multiple candidate paths under `schemas/`. */
function resolveSchemaPath(fileName: string): string {
  const candidates = [
    fileURLToPath(new URL(`../../schemas/${fileName}`, import.meta.url)),
    fileURLToPath(new URL(`../../../../schemas/${fileName}`, import.meta.url)),
    join(process.cwd(), 'schemas', fileName),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(`Schema file not found: schemas/${fileName}`);
}

/** Reads and parses a JSON5 schema file from the `schemas/` directory. */
export function loadSchemaFile<T>(fileName: string): T {
  return JSON5.parse(readFileSync(resolveSchemaPath(fileName), 'utf-8')) as T;
}
