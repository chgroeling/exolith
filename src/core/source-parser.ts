/** Specification: docs/operations/enqueue.md — source page parsing */

import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { extractBodyAfterFrontmatter, extractFrontmatterString } from './frontmatter-utils';
import { loadSchemaFile } from './schema-loader';

/** Validated YAML frontmatter fields extracted from a source page. */
export interface ParsedSourceFrontmatter {
  id: string;
  title: string;
  type: string;
  status: string;
  tags: string[];
  created: string;
  updated: string;
  authors: string[];
  reference: string;
  rawSource: string;
}

/** Structured JSON representation of a source page with parsed sections. */
export interface ParsedSource {
  /** Validated YAML frontmatter fields. */
  frontmatter: ParsedSourceFrontmatter;
  /** The TL;DR one-sentence summary extracted from the blockquote under the title. */
  tldr: string;
  /** The prose body between the # Title heading and the first ## section heading. */
  body: string;
  /** The list items from the ## Main Points section. */
  mainPoints: string[];
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
      type: '',
      status: 'active',
      tags: [],
      created: '',
      updated: '',
      authors: [],
      reference: '',
      rawSource: '',
    };
  }

  const raw = parseYaml(fmString);
  const schema = getSourceFrontmatterSchema();
  const validated = schema.parse(raw) as Record<string, unknown>;

  return {
    id: (validated.id as string) ?? '',
    title: (validated.title as string) ?? '',
    type: (validated.type as string) ?? '',
    status: (validated.status as string) ?? 'active',
    tags: Array.isArray(validated.tags) ? (validated.tags as string[]) : [],
    created: (validated.created as string) ?? '',
    updated: (validated.updated as string) ?? '',
    authors: Array.isArray(validated.authors) ? (validated.authors as string[]) : [],
    reference: (validated.reference as string) ?? '',
    rawSource: (validated.rawSource as string) ?? '',
  };
}

/** Extracts the TL;DR blockquote from the body. Returns the extracted text and the body with the blockquote removed. */
function extractSourceTldr(body: string): { tldr: string; cleanBody: string } {
  const tldrMatch = body.match(/^>\s*\*\*TL;DR:\*\*\s*(.+)/m);
  if (!tldrMatch || tldrMatch.index === undefined) {
    return { tldr: '', cleanBody: body };
  }

  const start = tldrMatch.index;
  const end = start + tldrMatch[0].length;
  const tldr = (tldrMatch[1] ?? '').trim();
  const cleanBody = (body.slice(0, start) + body.slice(end)).trim();

  return { tldr, cleanBody };
}

/**
 * Parses a full source page markdown string into a structured {@link ParsedSource} JSON object.
 */
export function parseSource(markdown: string): ParsedSource {
  const fmString = extractFrontmatterString(markdown);

  const rawBody = extractBodyAfterFrontmatter(markdown);

  const { tldr, cleanBody } = extractSourceTldr(rawBody);

  const body = cleanBody;

  const headingMatch = body.match(/^#\s+.+$/m);
  let sourceBody = '';
  let mainPoints: string[] = [];
  if (headingMatch && headingMatch.index !== undefined) {
    const afterHeading = body.slice(headingMatch.index + headingMatch[0].length);

    const mainPointsMatch = afterHeading.match(/\n##\s+Main\s+Points\s*\n/i);
    if (mainPointsMatch && mainPointsMatch.index !== undefined) {
      sourceBody = afterHeading.slice(0, mainPointsMatch.index).trim();
      const pointsSection = afterHeading.slice(mainPointsMatch.index + mainPointsMatch[0].length);
      mainPoints = pointsSection
        .split('\n')
        .map((l) => l.replace(/^-\s+/, '').trim())
        .filter(Boolean);
    } else {
      sourceBody = afterHeading.trim();
    }
  }

  return {
    frontmatter: parseSourceFrontmatter(fmString),
    tldr,
    body: sourceBody,
    mainPoints,
  };
}
