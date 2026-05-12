/**
 * Specification: docs/cross-cutting/cli-output.md
 *
 * Two-column table rendering for CLI list commands and error messages.
 */

/** A file entry for table rendering. */
export interface TableFileEntry {
  /** Stable filename-based ID. */
  id: string;
  /** Base name of the file (without directory). */
  fileName: string;
}

/** Renders column-aligned two-column tables to stdout and stderr. */
export interface TableFormatter {
  /** Renders a title line, column header, colored rows, and a hint. */
  renderFileList(title: string, files: TableFileEntry[], hint: string): void;

  /** Renders an ambiguous-ID error listing matching files. */
  renderAmbiguousIdError(id: string, matches: TableFileEntry[]): void;
}
