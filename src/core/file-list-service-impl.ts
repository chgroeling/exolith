import { createHash } from 'node:crypto';
import type { Stats } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { FileListConfig, FileListService, ListedFile } from './file-list-service';

/** Default file extensions included when listing. */
const DEFAULT_EXTENSIONS = ['.md', '.txt', '.textile'];

/** Creates a stable 6-character hex ID from file name. */
function computeId(fileName: string): string {
  return createHash('sha256').update(fileName).digest('hex').slice(0, 6);
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
    const seenCount = new Map<string, number>();

    for (const name of names) {
      const fullPath = join(dirPath, name);
      const content = await readFile(fullPath, 'utf-8');
      const baseId = computeId(name);

      const count = seenCount.get(baseId) ?? 0;
      seenCount.set(baseId, count + 1);

      const id = count === 0 ? baseId : `${baseId}-${count + 1}`;

      result.push({ id, fileName: name, fullPath });
    }

    return result;
  }
}
