/** Specification: docs/operations/compile.md */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import pino from 'pino';
import type { Logger } from 'pino';
import { extractBodyAfterFrontmatter, parseNote } from '../../core/note-parser';
import type { ParsedOpenQuestion } from '../../core/note-parser';
import type { PipelineEvent, Question } from '../pipeline-presentation';
import type { CompileConfig, CompileService } from './compile-service';

/** In-memory model of a wiki page, built during parseAllPages. */
interface WikiPage {
  id: string;
  slug: string;
  title: string;
  pageType: string;
  summary: string;
  path: string;
  hasOpenQuestions: boolean;
  openQuestions: ParsedOpenQuestion[];
  confidence: number;
  status: string;
  tags: string[];
  updatedAt: string;
}

const CONTENT_DIRS = ['sources', 'entities', 'concepts', 'syntheses'];

const DIR_TO_PAGE_TYPE: Record<string, string> = {
  sources: 'source',
  entities: 'entity',
  concepts: 'concept',
  syntheses: 'synthesis',
};

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

/** Extracts the YAML frontmatter `page` field override for page type, or null if not present. */
function extractPageType(rawContent: string): string | null {
  const match = rawContent.match(/^page:\s*(\S.+)$/m);
  return match?.[1]?.trim() ?? null;
}

/** Extracts the first sentence after the first # heading as the page summary. */
function extractSummary(body: string): string {
  const summarySection = extractSection(body, /\n##\s+Summary\s*\n/i);
  if (summarySection) {
    const mainPointsSection = extractSection(body, /\n##\s+Main\s+Points\s*\n/i);
    const parts: string[] = [summarySection.trim()];
    if (mainPointsSection) {
      const points = mainPointsSection
        .split('\n')
        .map((l) => l.replace(/^-\s+/, '').trim())
        .filter(Boolean);
      if (points.length > 0) {
        parts.push(points.join(', '));
      }
    }
    return parts.join(' ').slice(0, 200);
  }

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
    if (line.startsWith('*') && /^\*[^:]+:\*/.test(line)) continue;
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
          const parsed = parseNote(rawContent);
          const body = extractBodyAfterFrontmatter(rawContent);

          const pageType = extractPageType(rawContent) ?? DIR_TO_PAGE_TYPE[dir] ?? 'entity';
          const slug = parsed.frontmatter.id.includes('.')
            ? parsed.frontmatter.id.slice(parsed.frontmatter.id.indexOf('.') + 1)
            : parsed.frontmatter.title.toLowerCase().replace(/\s+/g, '-');
          const summary = extractSummary(body);
          const pagePath = relative(vaultPath, fullEntryPath);

          this.pages.set(pagePath, {
            id: parsed.frontmatter.id,
            slug,
            title: parsed.frontmatter.title,
            pageType,
            summary,
            path: pagePath,
            hasOpenQuestions: parsed.openQuestions.length > 0,
            openQuestions: parsed.openQuestions,
            confidence: parsed.frontmatter.confidence,
            status: parsed.frontmatter.status,
            tags: parsed.frontmatter.tags,
            updatedAt: parsed.frontmatter.updated,
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

    const generatedAt = new Date().toISOString();

    let indexContent = '# Wiki Index\n\n';
    indexContent += `> Auto-generated at ${generatedAt} | ${totalPages} pages | ${sourceCount} sources\n\n`;

    for (const pageType of categoryOrder) {
      const pages = grouped.get(pageType);
      if (!pages) continue;

      const heading = categoryHeadings[pageType] ?? pageType;
      indexContent += `## ${heading}\n\n`;

      for (const page of pages) {
        const wikiPath = page.path.replace(/\.md$/, '');
        indexContent += `- [[${wikiPath}]]\n`;

        const metaParts: string[] = [];

        if (page.hasOpenQuestions) metaParts.push('`❓`');
        if (page.confidence > 0) metaParts.push(`\`conf:${page.confidence}\``);
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
