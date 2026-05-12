import pc from 'picocolors';
import type { TableFileEntry, TableFormatter } from './table-formatter';

/** Truncates text to maxLen, appending "..." if shortened. */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  if (maxLen < 4) return '...'.slice(0, maxLen);
  return `${text.slice(0, maxLen - 3)}...`;
}

/** Renders column-aligned two-column tables to stdout and stderr. */
export class TableFormatterImpl implements TableFormatter {
  /** Renders a title line, column header, colored rows, and a hint. */
  renderFileList(title: string, files: TableFileEntry[], hint: string): void {
    const maxIdWidth = Math.max(8, ...files.map((f) => f.id.length));
    const termWidth = process.stdout.columns ?? 80;
    const fileMaxLen = Math.max(0, termWidth - 2 - maxIdWidth - 2);
    const headerId = pc.bold(pc.underline('ID'.padEnd(maxIdWidth)));
    const headerFile = pc.bold(pc.underline('File'));

    process.stderr.write(
      `\n${pc.bold(title)} (${files.length} file${files.length === 1 ? '' : 's'}):\n\n`,
    );
    process.stdout.write(`  ${headerId}  ${headerFile}\n`);

    for (const file of files) {
      process.stdout.write(
        `  ${pc.cyan(file.id.padEnd(maxIdWidth))}  ${pc.green(truncate(file.fileName, fileMaxLen))}\n`,
      );
    }

    if (hint) {
      process.stderr.write(`\n${pc.dim(hint)}\n`);
    }
  }

  /** Renders an ambiguous-ID error listing matching files. */
  renderAmbiguousIdError(id: string, matches: TableFileEntry[]): void {
    const maxIdWidth = Math.max(...matches.map((m) => m.id.length));
    process.stderr.write(`Error: ID prefix "${id}" matches multiple files:\n`);
    for (const m of matches) {
      process.stderr.write(`  ${m.id.padEnd(maxIdWidth)}  ${m.fileName}\n`);
    }
    process.stderr.write('Provide a longer ID prefix to disambiguate.\n');
  }
}
