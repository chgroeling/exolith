/** Shared frontmatter extraction utilities used by both note-parser and source-parser. */

/** Extracts the YAML frontmatter string between '---' delimiters. */
export function extractFrontmatterString(content: string): string {
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
export function extractBodyAfterFrontmatter(rawContent: string): string {
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
