import { z } from 'zod';
import { loadSchemaFile } from '../schema-loader';

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

const descriptor = loadSchemaFile<SchemaDescriptor>('config.schema.json');

/** Zod schema mirroring {@link ExolithConfig} for runtime validation. */
export const ExolithConfigSchema = buildZodSchema(descriptor);
