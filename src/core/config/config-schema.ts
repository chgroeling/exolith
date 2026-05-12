import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';
import { z } from 'zod';

/** Describes a single property in the schema descriptor file. */
interface SchemaProperty {
  type: 'string' | 'number' | 'enum';
  values?: string[];
  optional?: boolean;
}

/** Top-level shape of the schema descriptor file. */
interface SchemaDescriptor {
  properties: Record<string, SchemaProperty>;
}

/** Path resolution following the same pattern as {@link resolveTemplateDir}. */
function resolveSchemaPath(): string {
  /* eslint-disable no-restricted-globals */
  const candidates = [
    fileURLToPath(new URL('./schemas/config.schema.json', import.meta.url)),
    fileURLToPath(new URL('../../../../schemas/config.schema.json', import.meta.url)),
    join(process.cwd(), 'schemas/config.schema.json'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error('Schema descriptor not found: schemas/config.schema.json');
}

/** Builds a Zod object schema from the JSON descriptor at runtime. */
function buildZodSchema(descriptor: SchemaDescriptor): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(descriptor.properties)) {
    let zodType: z.ZodTypeAny;

    switch (prop.type) {
      case 'enum':
        zodType = z.enum(prop.values as [string, ...string[]]);
        break;
      case 'string':
        zodType = z.string();
        break;
      case 'number':
        zodType = z.number().int().positive();
        break;
    }

    if (prop.optional) {
      zodType = zodType.optional();
    }

    shape[key] = zodType;
  }

  return z.object(shape);
}

const descriptor = JSON5.parse(readFileSync(resolveSchemaPath(), 'utf-8')) as SchemaDescriptor;

/** Zod schema mirroring {@link ExolithConfig} for runtime validation. */
export const ExolithConfigSchema = buildZodSchema(descriptor);
