/** Specification: docs/operations/compile.md */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import pino from 'pino';
import type { Logger } from 'pino';
import type { PipelineEvent, Question } from '../pipeline-presentation';
import type { CompileConfig, CompileService } from './compile-service';

/** A parsed claim from the ## Claims chapter. */
interface ParsedClaim {
  id: string;
  confidence: number;
  status: string;
  text: string;
  evidence: string;
  evidenceLocation: string;
  limitation: string;
  context: string;
  updated: string;
}

/** A parsed open question from the ## Offene Fragen chapter. */
interface ParsedQuestion {
  question: string;
  context: string;
}

/** In-memory model of a wiki page, built during parseAllPages. */
interface WikiPage {
  id: string;
  slug: string;
  title: string;
  pageType: string;
  summary: string;
  path: string;
  claims: ParsedClaim[];
  claimIds: string[];
  hasOpenQuestions: boolean;
  openQuestions: ParsedQuestion[];
  confidence: number | null;
  status: string;
  tags: string[];
  updatedAt: string;
  linkedSources: string[];
}

const CONTENT_DIRS = ['sources', 'entities', 'concepts', 'syntheses'];

const DIR_TO_PAGE_TYPE: Record<string, string> = {
  sources: 'source',
  entities: 'entity',
  concepts: 'concept',
  syntheses: 'synthesis',
};

/** Parses YAML frontmatter into a key-value map. Handles string, number, boolean, null, and list values. */
function parseFrontmatter(rawContent: string): Record<string, unknown> {
  const lines = rawContent.split('\n');
  if (lines[0]?.trim() !== '---') return {};

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) return {};

  const result: Record<string, unknown> = {};
  let currentListKey: string | null = null;
  let currentList: string[] = [];

  for (let i = 1; i < endIndex; i++) {
    const line = lines[i];
    const trimmed = line.trim();
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

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const rawValue = line.slice(colonIndex + 1).trim();

    if (rawValue === '' || rawValue === 'null') {
      if (i + 1 < endIndex && lines[i + 1].trim().startsWith('- ')) {
        currentListKey = key;
        currentList = [];
      } else {
        result[key] = null;
      }
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

/** Extracts the first sentence after the first # heading as the page summary. */
function extractSummary(body: string): string {
  const headingMatch = body.match(/^#\s+.+$/m);
  if (!headingMatch) return '';

  const afterHeading = body.slice((headingMatch.index ?? 0) + headingMatch[0].length);
  const lines = afterHeading.split('\n');

  let text = '';
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('## ') || line.startsWith('#')) {
      if (text) break;
      continue;
    }
    if (line.startsWith('*') && line.endsWith(':*')) continue;
    text += (text ? ' ' : '') + line;

    if (/[.!?]\s/.test(line) || /[.!?]$/.test(line)) {
      const sentenceMatch = text.match(/^(.*?[.!?])(?:\s|$)/);
      if (sentenceMatch) {
        return sentenceMatch[1].replace(/\n/g, ' ').trim();
      }
    }
  }

  const sentenceMatch = text.match(/^(.*?[.!?])(?:\s|$)/);
  if (sentenceMatch) {
    return sentenceMatch[1].replace(/\n/g, ' ').trim();
  }
  return text.replace(/\n/g, ' ').trim().slice(0, 200);
}

/** Finds a chapter section by heading name and returns its body text, or empty string if not found. */
function extractSection(body: string, headingPattern: RegExp): string {
  const match = body.match(headingPattern);
  if (!match || match.index === undefined) return '';

  const start = match.index + match[0].length;
  const remaining = body.slice(start);

  const nextHeadingMatch = remaining.match(/\n##\s/);
  if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
    return remaining.slice(0, nextHeadingMatch.index);
  }
  return remaining;
}

/** Parses claims from the ## Claims chapter. */
function parseClaims(body: string): ParsedClaim[] {
  const section = extractSection(body, /\n##\s+Claims\s*\n/i);
  if (!section) return [];

  const normalizedSection = section.startsWith('\n') ? section : `\n${section}`;
  const claims: ParsedClaim[] = [];
  const claimBlocks = normalizedSection.split(/\n-\s+(?=`id:claim\.)/);

  for (let i = 1; i < claimBlocks.length; i++) {
    const block = claimBlocks[i];
    const lines = block.split('\n');

    const metadataLine = lines[0] ?? '';
    let claimId = '';
    let claimConfidence = 0;
    let claimStatus = 'active';

    const idMatch = metadataLine.match(/`(id:claim\.[^`]+)`/);
    if (idMatch) claimId = idMatch[1];

    const confMatch = metadataLine.match(/`conf:([\d.]+)`/);
    if (confMatch) claimConfidence = Number(confMatch[1]);

    const statusMatch = metadataLine.match(/`status:(\w+)`/);
    if (statusMatch) claimStatus = statusMatch[1];

    if (!claimId) continue;

    const metaEnd = metadataLine.lastIndexOf('`');
    let textAfterMeta = '';
    if (metaEnd >= 0) {
      textAfterMeta = metadataLine.slice(metaEnd + 1).trim();
    }

    const textLines: string[] = [];
    if (textAfterMeta) textLines.push(textAfterMeta);

    let evidence = '';
    let evidenceLocation = '';
    let limitation = '';
    let context = '';
    let updated = '';

    for (let j = 1; j < lines.length; j++) {
      const line = lines[j].trim();
      if (!line) continue;

      if (/^\*(Evidence|Beleg):\*/i.test(line) || /^\*(Evidence|Beleg):/i.test(line)) {
        const evMatch = line.match(/\[\[([^\]]+)\]\]/);
        if (evMatch) evidence = evMatch[1];
        const locMatch = line.match(/\]\]\s*(.*)/);
        if (locMatch?.[1]) evidenceLocation = locMatch[1].trim();
        continue;
      }

      if (
        /^\*(Limitation|Einschränkung):\*/i.test(line) ||
        /^\*(Limitation|Einschränkung):/i.test(line)
      ) {
        limitation = line.replace(/^\*(Limitation|Einschränkung):[\s*]*/i, '').trim();
        continue;
      }

      if (/^\*(Context|Kontext):\*/i.test(line) || /^\*(Context|Kontext):/i.test(line)) {
        context = line.replace(/^\*(Context|Kontext):[\s*]*/i, '').trim();
        continue;
      }

      if (/^\*(updated|aktualisiert):\*/i.test(line) || /^\*(updated|aktualisiert):/i.test(line)) {
        updated = line.replace(/^\*(updated|aktualisiert):[\s*]*/i, '').trim();
        continue;
      }

      textLines.push(line);
    }

    claims.push({
      id: claimId,
      confidence: claimConfidence,
      status: claimStatus,
      text: textLines.join(' ').trim(),
      evidence,
      evidenceLocation,
      limitation,
      context,
      updated,
    });
  }

  return claims;
}

/** Parses open questions from the ## Offene Fragen (or ## Open Questions) chapter. */
function parseOpenQuestions(body: string): ParsedQuestion[] {
  const section =
    extractSection(body, /\n##\s+(Offene\s+Fragen|Open\s+Questions)\s*\n/i) ||
    extractSection(body, /\n##\s+Offene\s+Fragen\s*\n/i) ||
    extractSection(body, /\n##\s+Open\s+Questions\s*\n/i);
  if (!section) return [];

  const normalizedSection = section.startsWith('\n') ? section : `\n${section}`;
  const questions: ParsedQuestion[] = [];
  const questionBlocks = normalizedSection.split(/\n-\s+/);

  for (let i = 1; i < questionBlocks.length; i++) {
    const block = questionBlocks[i];
    const lines = block.split('\n');

    const question = (lines[0] ?? '').trim();
    let context = '';

    for (let j = 1; j < lines.length; j++) {
      const line = lines[j].trim();
      if (!line) continue;

      if (/^\*(Context|Kontext):\*/i.test(line)) {
        context = line.replace(/^\*(Context|Kontext):[\s*]*/i, '').trim();
      }
    }

    if (question) {
      questions.push({ question, context });
    }
  }

  return questions;
}

/** Extracts source wikilinks that a page's claims reference. */
function extractLinkedSources(claims: ParsedClaim[]): string[] {
  const sources = new Set<string>();
  for (const claim of claims) {
    if (claim.evidence?.startsWith('sources/')) {
      sources.add(claim.evidence);
    }
  }
  return Array.from(sources).sort();
}

export class Compile implements CompileService {
  private logger: Logger;
  private pages: Map<string, WikiPage> = new Map();

  constructor(
    private config: CompileConfig,
    private emit: (event: PipelineEvent) => void,
    private ask: <T>(question: Question<T>) => Promise<T>,
    parentLogger?: Logger,
  ) {
    this.logger = parentLogger?.child({ logger: 'compile' }) ?? pino({ enabled: false });
  }

  /**
   * Regenerates index.md, backlinks, dashboards, and machine-readable digests
   * from the full vault.
   */
  async compile(): Promise<void> {
    this.logger.info({ vaultPath: this.config.vaultPath }, 'Compile process started');

    try {
      await mkdir(this.config.vaultPath, { recursive: true });
      await this.parseAllPages();
      await this.generateIndex();
      await this.writeBacklinks();
    } catch (err) {
      this.emit({ type: 'error', error: err as Error });
      this.logger.error({ err }, 'Compile process failed');
      throw err;
    }
  }

  /** Reads every .md file in content directories and populates the in-memory page registry. */
  private async parseAllPages(): Promise<void> {
    this.emit({ type: 'step_start', step: 'Parsing' });
    const vaultPath = this.config.vaultPath;

    for (const dir of CONTENT_DIRS) {
      const dirPath = join(vaultPath, dir);
      try {
        const entries = await readdir(dirPath, { withFileTypes: true, recursive: true });
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

          const fullEntryPath = join(entry.parentPath ?? dirPath, entry.name);
          const rawContent = await readFile(fullEntryPath, 'utf-8');
          const fm = parseFrontmatter(rawContent);

          const id = (fm.id as string) ?? '';
          const pageType = (fm.page as string) ?? DIR_TO_PAGE_TYPE[dir] ?? 'entity';
          const slug = id.includes('.')
            ? id.slice(id.indexOf('.') + 1)
            : ((fm.title as string)?.toLowerCase().replace(/\s+/g, '-') ?? '');
          const title = (fm.title as string) ?? entry.name.replace(/\.md$/, '');
          const status = (fm.status as string) ?? 'active';
          const tags = Array.isArray(fm.tags) ? (fm.tags as string[]) : [];
          const confidence = fm.confidence !== undefined ? (fm.confidence as number | null) : null;
          const updatedAt = (fm.updated as string) ?? '';
          const pagePath = relative(vaultPath, fullEntryPath);

          const body = extractBodyAfterFrontmatter(rawContent);
          const summary = extractSummary(body);
          const claims = parseClaims(body);
          const claimIds = claims.map((c) => c.id);
          const openQuestions = parseOpenQuestions(body);
          const linkedSources = extractLinkedSources(claims);

          this.pages.set(pagePath, {
            id,
            slug,
            title,
            pageType,
            summary,
            path: pagePath,
            claims,
            claimIds,
            hasOpenQuestions: openQuestions.length > 0,
            openQuestions,
            confidence,
            status,
            tags,
            updatedAt,
            linkedSources,
          });
        }
      } catch {
        this.logger.debug({ dir: dirPath }, 'Directory not found, skipping');
      }
    }

    this.logger.info({ pageCount: this.pages.size }, 'Pages parsed');
    this.emit({ type: 'step_end', step: 'Parsing' });
  }

  /** Generates index.md from the parsed page registry. */
  private async generateIndex(): Promise<void> {
    this.emit({ type: 'step_start', step: 'GeneratingIndex' });

    const categoryOrder = ['source', 'entity', 'concept', 'synthesis'] as const;
    const categoryHeadings: Record<string, string> = {
      source: 'Sources',
      entity: 'Entities',
      concept: 'Concepts',
      synthesis: 'Syntheses',
    };

    const grouped = new Map<string, WikiPage[]>();
    for (const pageType of categoryOrder) {
      const pages = Array.from(this.pages.values())
        .filter((p) => p.pageType === pageType)
        .sort((a, b) => a.title.localeCompare(b.title));
      if (pages.length > 0) grouped.set(pageType, pages);
    }

    const totalPages = this.pages.size;
    const sourceCount = (grouped.get('source') ?? []).length;
    const totalClaims = Array.from(this.pages.values()).reduce(
      (sum, p) => sum + p.claims.length,
      0,
    );

    const generatedAt = new Date().toISOString();

    let indexContent = '# Wiki Index\n\n';
    indexContent += `> Auto-generated at ${generatedAt} | ${totalPages} pages | ${sourceCount} sources | ${totalClaims} claims\n\n`;

    for (const pageType of categoryOrder) {
      const pages = grouped.get(pageType);
      if (!pages) continue;

      const heading = categoryHeadings[pageType] ?? pageType;
      indexContent += `## ${heading}\n\n`;

      for (const page of pages) {
        const wikiPath = page.path.replace(/\.md$/, '');
        indexContent += `- [[${wikiPath}]]\n`;

        const metaParts: string[] = [];
        const claimWord = page.claims.length === 1 ? 'claim' : 'claims';
        metaParts.push(`\`${page.claims.length} ${claimWord}\``);

        if (page.hasOpenQuestions) metaParts.push('`❓`');
        if (page.confidence !== null) metaParts.push(`\`conf:${page.confidence}\``);
        metaParts.push(`\`${page.status}\``);

        if (page.updatedAt) {
          const datePart = page.updatedAt.slice(0, 10);
          metaParts.push(`\`${datePart}\``);
        }

        if (page.tags.length > 0) {
          const tagStr = page.tags.map((t) => `#${t}`).join(' ');
          metaParts.push(`\`${tagStr}\``);
        }

        indexContent += `  ${metaParts.join(' ')}\n`;

        if (page.summary) {
          indexContent += `  — ${page.summary}\n`;
        }

        indexContent += '\n';
      }
    }

    const allClaims = Array.from(this.pages.values())
      .filter((p) => p.claims.length > 0)
      .flatMap((p) => p.claims.map((c) => ({ claim: c, sourcePath: p.path })))
      .sort((a, b) => a.claim.id.localeCompare(b.claim.id));

    if (allClaims.length > 0) {
      indexContent += '## Claims\n\n';
      for (const { claim, sourcePath } of allClaims) {
        const wikiPath = sourcePath.replace(/\.md$/, '');
        indexContent += `- \`${claim.id}\` \`conf:${claim.confidence}\` \`status:${claim.status}\` → [[${wikiPath}]]\n`;
        if (claim.text) {
          indexContent += `  ${claim.text}\n`;
        }
        indexContent += '\n';
      }
    }

    const indexPath = join(this.config.vaultPath, 'index.md');
    await writeFile(indexPath, indexContent, 'utf-8');

    this.logger.info('Index generated');
    this.emit({ type: 'step_end', step: 'GeneratingIndex' });
  }

  /** Inserts ## Related blocks into each page. Not yet implemented. */
  private async writeBacklinks(): Promise<void> {
    this.emit({ type: 'step_start', step: 'WritingBacklinks' });
    this.emit({ type: 'step_end', step: 'WritingBacklinks' });
  }
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
