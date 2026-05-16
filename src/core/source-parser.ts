/** Specification: docs/operations/pre-ingest.md — source page parsing */

import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { extractBodyAfterFrontmatter, extractFrontmatterString } from './frontmatter-utils';
import { loadSchemaFile } from './schema-loader';

/** Validated YAML frontmatter fields extracted from a source page. */
export interface ParsedSourceFrontmatter {
  id: string;
  title: string;
  status: string;
  tags: string[];
  created: string;
  updated: string;
  authors?: string;
  url?: string;
  source?: string;
}

/** Structured JSON representation of a source page with parsed sections. */
export interface ParsedSource {
  /** Validated YAML frontmatter fields. */
  frontmatter: ParsedSourceFrontmatter;
  /** The summary text between the # Title heading and the first ## section heading. */
  summary: string;
}

/** Describes a single property in the source frontmatter schema descriptor file. */
interface SourceFrontmatterSchemaProperty {
  type: 'string' | 'number' | 'array';
  items?: { type: 'string' };
  optional?: boolean;
}

/** Top-level shape of the source frontmatter schema descriptor file. */
interface SourceFrontmatterSchemaDescriptor {
  properties: Record<string, SourceFrontmatterSchemaProperty>;
}

/** Builds a strict Zod object schema from the source frontmatter JSON5 descriptor at runtime. */
function buildSourceFrontmatterSchema(): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const descriptor = loadSchemaFile<SourceFrontmatterSchemaDescriptor>(
    'source-frontmatter.schema.json',
  );
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(descriptor.properties)) {
    let zodType: z.ZodTypeAny;

    switch (prop.type) {
      case 'string':
        zodType = z.string();
        break;
      case 'number':
        zodType = z.number();
        break;
      case 'array':
        zodType = z.array(z.string());
        break;
    }

    if (prop.optional) {
      zodType = zodType.nullable().optional();
    }

    shape[key] = zodType;
  }

  return z.object(shape).strict();
}

/** Lazily initialized strict Zod schema for source frontmatter validation. */
let _sourceFrontmatterSchema: z.ZodObject<Record<string, z.ZodTypeAny>> | undefined;
function getSourceFrontmatterSchema(): z.ZodObject<Record<string, z.ZodTypeAny>> {
  if (!_sourceFrontmatterSchema) {
    _sourceFrontmatterSchema = buildSourceFrontmatterSchema();
  }
  return _sourceFrontmatterSchema;
}

/** Parses YAML frontmatter for a source page using the yaml library and validates against a strict Zod schema. */
function parseSourceFrontmatter(fmString: string): ParsedSourceFrontmatter {
  if (!fmString.trim()) {
    return {
      id: '',
      title: '',
      status: 'active',
      tags: [],
      created: '',
      updated: '',
    };
  }

  const raw = parseYaml(fmString);
  const schema = getSourceFrontmatterSchema();
  const validated = schema.parse(raw) as Record<string, unknown>;

  return {
    id: (validated.id as string) ?? '',
    title: (validated.title as string) ?? '',
    status: (validated.status as string) ?? 'active',
    tags: Array.isArray(validated.tags) ? (validated.tags as string[]) : [],
    created: (validated.created as string) ?? '',
    updated: (validated.updated as string) ?? '',
    authors: validated.authors as string | undefined,
    url: validated.url as string | undefined,
    source: validated.source as string | undefined,
  };
}

/**
 * Parses a full source page markdown string into a structured {@link ParsedSource} JSON object.
 * Uses remark for stable markdown parsing.
 */
export function parseSource(markdown: string): ParsedSource {
  const fmString = extractFrontmatterString(markdown);

  const body = extractBodyAfterFrontmatter(markdown);

  const headingMatch = body.match(/^#\s+.+$/m);
  let summary = '';
  if (headingMatch && headingMatch.index !== undefined) {
    const afterHeading = body.slice(headingMatch.index + headingMatch[0].length);
    const firstSentence = afterHeading.match(/^[^.!?]+[.!?]/);
    if (firstSentence) {
      summary = firstSentence[0].trim();
    } else {
      const nextHeadingMatch = afterHeading.match(/\n##\s/);
      if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
        summary = afterHeading.slice(0, nextHeadingMatch.index).trim();
      } else {
        summary = afterHeading.trim();
      }
    }
  }

  return {
    frontmatter: parseSourceFrontmatter(fmString),
    summary,
  };
}
