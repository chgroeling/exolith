import { createHash } from 'node:crypto';
import type { Stats } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { FileListConfig, FileListService, ListedFile } from './file-list-service';

/** Default file extensions included when listing. */
const DEFAULT_EXTENSIONS = ['.md', '.txt', '.textile'];

/** Creates a stable 8-character hex ID from file name and content. */
function computeId(fileName: string, content: string): string {
  return createHash('sha256').update(`${fileName}:${content}`).digest('hex').slice(0, 8);
}

/** Implementation of {@link FileListService} using the local filesystem. */
export class FileListServiceImpl implements FileListService {
  private readonly allowedExtensions: string[];

  constructor(config: FileListConfig = {}) {
    this.allowedExtensions = config.allowedExtensions ?? DEFAULT_EXTENSIONS;
  }

  async listFiles(dirPath: string): Promise<ListedFile[]> {
    let entries: string[];

    try {
      entries = await readdir(dirPath);
    } catch {
      return [];
    }

    const names: string[] = [];

    for (const entry of entries) {
      if (entry.startsWith('.')) continue;

      const fullPath = join(dirPath, entry);

      let s: Stats;
      try {
        s = await stat(fullPath);
      } catch {
        continue;
      }

      if (!s.isFile()) continue;

      const ext = extname(entry).toLowerCase();
      if (!this.allowedExtensions.includes(ext)) continue;

      names.push(entry);
    }

    names.sort((a, b) => a.localeCompare(b));

    const result: ListedFile[] = [];
    const seen = new Map<string, string>();

    for (const name of names) {
      const fullPath = join(dirPath, name);
      const content = await readFile(fullPath, 'utf-8');
      const id = computeId(name, content);

      const existing = seen.get(id);
      if (existing) {
        throw new Error(
          `Hash collision: files "${existing}" and "${name}" both produce ID "${id}"`,
        );
      }
      seen.set(id, name);

      result.push({ id, fileName: name, fullPath });
    }

    return result;
  }
}
