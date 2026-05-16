/** Specification: docs/operations/ingest.md — entity and concept page parsing via remark */

import type { Emphasis, Heading, List, ListItem, Literal, Parent, Root } from 'mdast';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { extractBodyAfterFrontmatter, extractFrontmatterString } from './frontmatter-utils';
import { loadSchemaFile } from './schema-loader';

/** Structured JSON representation of a wiki page with all sections parsed. */
export interface ParsedNote {
  /** Validated YAML frontmatter fields. */
  frontmatter: ParsedFrontmatter;
  /** The prose body between the # Title heading and the first ## section heading. */
  content: string;
  /** Structured claims from the ## Claims section. */
  claims: ParsedClaim[];
  /** Structured open questions from the ## Offene Fragen section. */
  openQuestions: ParsedOpenQuestion[];
  /** The human-written personal note content as a single string (the only unstructured field). */
  human: string;
}

/** A single claim parsed from the ## Claims list. */
export interface ParsedClaim {
  slug: string;
  confidence: number;
  status: string;
  text: string;
  evidence: string;
  evidenceLocation?: string;
  limitation?: string;
}

/** A single open question parsed from the ## Offene Fragen list. */
export interface ParsedOpenQuestion {
  question: string;
  context?: string;
}

/** Validated YAML frontmatter fields extracted from a wiki page. */
export interface ParsedFrontmatter {
  id: string;
  title: string;
  status: string;
  tags: string[];
  confidence: number;
  created: string;
  updated: string;
}

/** Describes a single property in the frontmatter schema descriptor file. */
interface FrontmatterSchemaProperty {
  type: 'string' | 'number' | 'array';
  items?: { type: 'string' };
  optional?: boolean;
}

/** Top-level shape of the frontmatter schema descriptor file. */
interface FrontmatterSchemaDescriptor {
  properties: Record<string, FrontmatterSchemaProperty>;
}

/** Builds a strict Zod object schema from the frontmatter JSON5 descriptor at runtime. */
function buildFrontmatterSchema(): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const descriptor = loadSchemaFile<FrontmatterSchemaDescriptor>('frontmatter.schema.json');
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

/** Lazily initialized strict Zod schema for frontmatter validation. */
let _frontmatterSchema: z.ZodObject<Record<string, z.ZodTypeAny>> | undefined;
function getFrontmatterSchema(): z.ZodObject<Record<string, z.ZodTypeAny>> {
  if (!_frontmatterSchema) {
    _frontmatterSchema = buildFrontmatterSchema();
  }
  return _frontmatterSchema;
}

const HUMAN_START = '<!-- exolith:human:start -->';
const HUMAN_END = '<!-- exolith:human:end -->';

/** Collects the plain text content from a heading node's children. */
function headingPlainText(node: Heading): string {
  return node.children
    .map((c) => {
      if (c.type === 'text') return c.value;
      if (c.type === 'inlineCode') return c.value;
      return '';
    })
    .join('');
}

/** Collects the concatenated text content from an emphasis node. */
function emphasisText(node: Emphasis): string {
  return node.children
    .map((c) => {
      if (c.type === 'text') return c.value;
      if (c.type === 'inlineCode') return c.value;
      return '';
    })
    .join('');
}

/** Checks if a heading node's text matches one of the given names. */
function headingMatches(node: Heading, names: string[]): boolean {
  const text = headingPlainText(node);
  return names.includes(text);
}

/** Parses YAML frontmatter using the yaml library and validates against a strict Zod schema. */
function parseFrontmatter(fmString: string): ParsedFrontmatter {
  if (!fmString.trim()) {
    return {
      id: '',
      title: '',
      status: 'active',
      tags: [],
      confidence: 0,
      created: '',
      updated: '',
    };
  }

  const raw = parseYaml(fmString);
  const schema = getFrontmatterSchema();
  const validated = schema.parse(raw) as PartialParsedFrontmatter;

  return {
    id: validated.id ?? '',
    title: validated.title ?? '',
    status: validated.status ?? 'active',
    tags: validated.tags ?? [],
    confidence: validated.confidence ?? 0,
    created: validated.created ?? '',
    updated: validated.updated ?? '',
  };
}

/** Shape of frontmatter after Zod validation with optional fields potentially undefined. */
interface PartialParsedFrontmatter {
  id?: string;
  title?: string;
  status?: string;
  tags?: string[];
  confidence?: number;
  created?: string;
  updated?: string;
}

/**
 * Parses a full wiki page markdown string into a structured {@link ParsedNote} JSON object.
 * Uses remark for stable markdown parsing.
 */
export function parseNote(markdown: string): ParsedNote {
  const fmString = extractFrontmatterString(markdown);

  const body = extractBodyAfterFrontmatter(markdown);
  const ast = unified().use(remarkParse).parse(body) as Root;
  const children = ast.children;

  let h1Index = -1;
  let claimsHeadingIndex = -1;
  let openQuestionsHeadingIndex = -1;
  let humanStartIndex = -1;
  let humanEndIndex = -1;

  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.type === 'heading' && node.depth === 1 && h1Index === -1) {
      h1Index = i;
    }
    if (
      node.type === 'heading' &&
      node.depth === 2 &&
      headingMatches(node as Heading, ['Claims'])
    ) {
      claimsHeadingIndex = i;
    }
    if (
      node.type === 'heading' &&
      node.depth === 2 &&
      headingMatches(node as Heading, ['Offene Fragen', 'Open Questions'])
    ) {
      openQuestionsHeadingIndex = i;
    }
    if (node.type === 'html' && (node as unknown as Literal).value === HUMAN_START) {
      humanStartIndex = i;
    }
    if (node.type === 'html' && (node as unknown as Literal).value === HUMAN_END) {
      humanEndIndex = i;
    }
  }

  const content = extractContent(
    body,
    children,
    h1Index,
    claimsHeadingIndex,
    openQuestionsHeadingIndex,
    humanStartIndex,
  );
  const claims = extractClaimsFromList(children, claimsHeadingIndex);
  const openQuestions = extractOpenQuestionsFromList(children, openQuestionsHeadingIndex);
  const human = extractHuman(body, children, humanStartIndex, humanEndIndex);

  return {
    frontmatter: parseFrontmatter(fmString),
    content,
    claims,
    openQuestions,
    human,
  };
}

/** Extracts the prose body content between the h1 heading and the next section heading. */
function extractContent(
  body: string,
  children: Root['children'],
  h1Index: number,
  claimsHeadingIndex: number,
  openQuestionsHeadingIndex: number,
  humanStartIndex: number,
): string {
  if (h1Index === -1) return '';

  const h1Node = children[h1Index];
  if (!h1Node?.position) return '';

  const contentStart = h1Node.position.end.offset;

  const endCandidate = findNextHeadingPosition(
    children,
    h1Index,
    claimsHeadingIndex,
    openQuestionsHeadingIndex,
    humanStartIndex,
  );

  if (endCandidate === null) {
    return body.slice(contentStart).trim();
  }

  return body.slice(contentStart, endCandidate).trim();
}

/** Finds the position of the next section boundary after the content area. */
function findNextHeadingPosition(
  children: Root['children'],
  h1Index: number,
  claimsHeadingIndex: number,
  openQuestionsHeadingIndex: number,
  humanStartIndex: number,
): number | null {
  let earliest: number | null = null;

  for (const idx of [claimsHeadingIndex, openQuestionsHeadingIndex, humanStartIndex]) {
    if (idx > h1Index) {
      const pos = children[idx]?.position?.start.offset;
      if (pos !== undefined && (earliest === null || pos < earliest)) {
        earliest = pos;
      }
    }
  }

  return earliest;
}

/** Extracts structured claims from the list following a ## Claims heading. */
function extractClaimsFromList(
  children: Root['children'],
  claimsHeadingIndex: number,
): ParsedClaim[] {
  if (claimsHeadingIndex === -1 || claimsHeadingIndex + 1 >= children.length) return [];

  const listNode = children[claimsHeadingIndex + 1];
  if (listNode.type !== 'list') return [];

  return (listNode as List).children.map((item) => parseClaimListItem(item as ListItem));
}

/** Parses a single claim from a list item's inline children. */
function parseClaimListItem(item: ListItem): ParsedClaim {
  const paragraph = item.children[0];
  if (!paragraph || paragraph.type !== 'paragraph') {
    return emptyClaim();
  }

  const inlines = (paragraph as Parent).children;
  let slug = '';
  let confidence = 0;
  let status = 'active';
  let claimText = '';
  let evidence = '';
  let evidenceLocation: string | undefined;
  let limitation: string | undefined;

  let currentField: 'heading' | 'claimText' | 'evidence' | 'limitation' = 'heading';

  for (const node of inlines) {
    if (node.type === 'inlineCode') {
      const codeVal = (node as unknown as Literal).value || '';
      if (codeVal.startsWith('id:claim.')) {
        slug = codeVal.slice('id:claim.'.length);
      } else if (codeVal.startsWith('conf:')) {
        confidence = Number.parseFloat(codeVal.slice('conf:'.length));
      } else if (codeVal.startsWith('status:')) {
        status = codeVal.slice('status:'.length);
      }
      continue;
    }

    if (node.type === 'text') {
      const text = (node as unknown as Literal).value || '';
      if (currentField === 'evidence') {
        const parsed = parseEvidenceLine(text);
        if (parsed.evidence) {
          evidence = parsed.evidence;
          evidenceLocation = parsed.evidenceLocation;
        }
        currentField = 'claimText';
      } else if (currentField === 'limitation') {
        limitation = ((limitation ?? '') + text).trim() || undefined;
        currentField = 'claimText';
      } else {
        if (currentField === 'heading') {
          currentField = 'claimText';
        }
        claimText += text;
      }
      continue;
    }

    if (node.type === 'emphasis') {
      const emText = emphasisText(node as Emphasis);
      if (emText === 'Evidence:' || emText === 'Beleg:') {
        currentField = 'evidence';
      } else if (emText === 'Limitation:' || emText === 'Einschränkung:') {
        currentField = 'limitation';
      }
    }
  }

  return {
    slug,
    confidence: Number.isNaN(confidence) ? 0 : confidence,
    status,
    text: claimText.trim(),
    evidence,
    evidenceLocation,
    limitation,
  };
}

/** Parses a wikilink + optional location from a text fragment following an evidence marker. */
function parseEvidenceLine(text: string): { evidence: string; evidenceLocation?: string } {
  const linkMatch = text.match(/\[\[([^\]]+)\]\]/);
  if (!linkMatch) return { evidence: '' };

  const evidence = linkMatch[1] ?? '';
  const locationMatch = text.match(/\(([^)]+)\)\s*$/);
  const evidenceLocation = locationMatch?.[1]?.trim() || undefined;

  return { evidence, evidenceLocation };
}

/** Creates an empty claim with sensible defaults. */
function emptyClaim(): ParsedClaim {
  return {
    slug: '',
    confidence: 0,
    status: 'active',
    text: '',
    evidence: '',
  };
}

/** Extracts structured open questions from the list following a ## Offene Fragen heading. */
function extractOpenQuestionsFromList(
  children: Root['children'],
  openQuestionsHeadingIndex: number,
): ParsedOpenQuestion[] {
  if (openQuestionsHeadingIndex === -1 || openQuestionsHeadingIndex + 1 >= children.length)
    return [];

  const listNode = children[openQuestionsHeadingIndex + 1];
  if (listNode.type !== 'list') return [];

  return (listNode as List).children.map((item) => parseOpenQuestionListItem(item as ListItem));
}

/** Parses a single open question from a list item's inline children. */
function parseOpenQuestionListItem(item: ListItem): ParsedOpenQuestion {
  const paragraph = item.children[0];
  if (!paragraph || paragraph.type !== 'paragraph') {
    return { question: '', context: undefined };
  }

  const inlines = (paragraph as Parent).children;
  let question = '';
  let context: string | undefined;
  let afterContext = false;

  for (const node of inlines) {
    if (node.type === 'text') {
      const text = (node as unknown as Literal).value || '';
      if (afterContext) {
        context = ((context ?? '') + text).trim() || undefined;
      } else {
        question += text;
      }
    } else if (node.type === 'emphasis') {
      const emText = emphasisText(node as Emphasis);
      if (emText === 'Kontext:' || emText === 'Context:') {
        afterContext = true;
      } else {
        if (!afterContext) {
          question += emText;
        }
      }
    }
  }

  return {
    question: question.trim(),
    context,
  };
}

/** Extracts the human-written personal note from between the human block HTML comment markers. */
function extractHuman(
  body: string,
  children: Root['children'],
  humanStartIndex: number,
  humanEndIndex: number,
): string {
  if (humanStartIndex === -1 || humanEndIndex === -1) return '';

  const startNode = children[humanStartIndex];
  const endNode = children[humanEndIndex];

  if (!startNode?.position || !endNode?.position) return '';

  const start = startNode.position.end.offset;
  const end = endNode.position.start.offset;
  const content = body.slice(start, end);

  return content.trim();
}
