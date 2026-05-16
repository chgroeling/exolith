/** Specification: docs/pages/index-spec.md — index page parsing */

/** A parsed entry from index.md. */
export interface IndexEntry {
  slug: string;
  title: string;
  pageType: string;
  summary: string;
  path: string;
}

/** Maps index.md section headings to wiki page types. */
export const PAGE_TYPE_MAP: Record<string, string> = {
  Sources: 'source',
  Entities: 'entity',
  Concepts: 'concept',
  Syntheses: 'synthesis',
  Reports: 'report',
};

/** Parses index.md into a registry of entries grouped by page type. */
export function parseIndex(content: string): Map<string, IndexEntry[]> {
  const result = new Map<string, IndexEntry[]>();
  const sections = content.split(/\n(?=## )/);

  for (const section of sections) {
    const headingMatch = section.match(/^## (\w+)/);
    if (!headingMatch) continue;

    const headingName = headingMatch[1];
    const pageType = PAGE_TYPE_MAP[headingName];
    if (!pageType) continue;

    const entries: IndexEntry[] = [];
    const entryBlocks = section.split(/\n- \[\[/);
    for (let i = 1; i < entryBlocks.length; i++) {
      const blockLines = entryBlocks[i].split('\n');

      const linkMatch = blockLines[0]?.match(/^([^\]]+)\]\]/);
      if (!linkMatch) continue;

      const path = linkMatch[1];
      const slug = path.split('/').pop() ?? '';

      let summary = '';
      for (let j = 1; j < blockLines.length; j++) {
        const dashIdx = blockLines[j].indexOf('—');
        if (dashIdx !== -1) {
          summary = blockLines[j].slice(dashIdx + 1).trim();
          break;
        }
      }

      const fullPath = `${path}.md`;

      entries.push({
        slug,
        title: slug,
        pageType,
        summary,
        path: fullPath,
      });
    }

    result.set(pageType, entries);
  }

  return result;
}
