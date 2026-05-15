/** Specification: docs/operations/ingest.md — note parsing via remark */

import type { Emphasis, Heading, List, ListItem, Literal, Parent, Root } from 'mdast';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

/** Structured JSON representation of a wiki page with all sections parsed. */
export interface ParsedNote {
  id: string;
  title: string;
  status: string;
  tags: string[];
  confidence: number;
  created: string;
  updated: string;
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

const HUMAN_START = '<!-- exolith:human:start -->';
const HUMAN_END = '<!-- exolith:human:end -->';

/** Extracts the YAML frontmatter string between '---' delimiters. */
function extractFrontmatterString(content: string): string {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') return '';

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) return '';
  return lines.slice(1, endIndex).join('\n');
}

/** Extracts the body content after YAML frontmatter delimiters. */
function extractBodyAfterFrontmatter(rawContent: string): string {
  const lines = rawContent.split('\n');
  if (lines[0]?.trim() !== '---') return rawContent;

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) return rawContent;
  return lines
    .slice(endIndex + 1)
    .join('\n')
    .trim();
}

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

/** Parses YAML frontmatter key-value lines into a typed record. Handles string, number, boolean, null, and list values. */
function parseFrontmatter(fmString: string): Record<string, unknown> {
  if (!fmString) return {};

  const lines = fmString.split('\n');
  const result: Record<string, unknown> = {};
  let currentListKey: string | null = null;
  let currentList: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed === '') continue;

    if (trimmed.startsWith('- ') && currentListKey) {
      currentList.push(trimmed.slice(2).trim());
      continue;
    }

    if (currentListKey) {
      result[currentListKey] = [...currentList];
      currentListKey = null;
      currentList = [];
    }

    const colonIndex = rawLine.indexOf(':');
    if (colonIndex === -1) continue;

    const key = rawLine.slice(0, colonIndex).trim();
    const rawValue = rawLine.slice(colonIndex + 1).trim();

    if (rawValue === '' || rawValue === 'null') {
      if (currentListKey) {
        result[currentListKey] = [...currentList];
        currentListKey = null;
        currentList = [];
      }
      currentListKey = key;
      currentList = [];
      continue;
    }

    if (rawValue === 'true') {
      result[key] = true;
    } else if (rawValue === 'false') {
      result[key] = false;
    } else if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
      result[key] = Number(rawValue);
    } else {
      result[key] = rawValue;
    }
  }

  if (currentListKey) {
    result[currentListKey] = [...currentList];
  }

  return result;
}

/**
 * Parses a full wiki page markdown string into a structured {@link ParsedNote} JSON object.
 * Uses remark for stable markdown parsing.
 */
export function parseNote(markdown: string): ParsedNote {
  const fmString = extractFrontmatterString(markdown);
  const fm = parseFrontmatter(fmString);

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
    id: (fm.id as string) ?? '',
    title: (fm.title as string) ?? '',
    status: (fm.status as string) ?? 'active',
    tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : [],
    confidence: typeof fm.confidence === 'number' ? fm.confidence : 0,
    created: (fm.created as string) ?? '',
    updated: (fm.updated as string) ?? '',
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
  let content = body.slice(start, end);

  content = content.replace(/^## (?:Persönliche Notizen|Personal Notes)[^\n]*\n?/m, '');

  return content.trim();
}
