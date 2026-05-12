/**
 * Specification: docs/cross-cutting/vault-layout.md
 *
 * Generic service for listing files in a directory with stable filename-based IDs.
 */

/** A file entry returned by the listing operation. */
export interface ListedFile {
  /** Stable filename-based ID: 6-char hex with optional -N suffix for hash collisions. */
  id: string;
  /** Base name of the file (without directory). */
  fileName: string;
  /** Absolute path to the file. */
  fullPath: string;
}

/** Optional configuration for file listing behavior. */
export interface FileListConfig {
  /** File extensions to include. Defaults to ['.md', '.txt', '.textile']. */
  allowedExtensions?: string[];
}

/** Lists files in a directory and assigns stable content-based IDs. */
export interface FileListService {
  listFiles(dirPath: string): Promise<ListedFile[]>;
}
