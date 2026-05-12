// Specification: docs/cross-cutting/vault-layout.md

import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { FileListServiceImpl } from '../src/core/file-list-service-impl';

describe('FileListService', () => {
  describe('listFiles', () => {
    it('returns an empty array for a non-existent directory', async () => {
      const svc = new FileListServiceImpl();
      const files = await svc.listFiles(join(tmpdir(), `nonexistent-${Date.now()}`));
      expect(files).toEqual([]);
    });

    it('returns an empty array for an empty directory', async () => {
      const dir = join(tmpdir(), `exolith-test-${Date.now()}`);
      await mkdir(dir, { recursive: true });
      const svc = new FileListServiceImpl();
      const files = await svc.listFiles(dir);
      expect(files).toEqual([]);
    });

    it('lists files with allowed extensions sorted alphabetically', async () => {
      const dir = join(tmpdir(), `exolith-test-${Date.now()}`);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'c.md'), 'content c', 'utf-8');
      await writeFile(join(dir, 'a.txt'), 'content a', 'utf-8');
      await writeFile(join(dir, 'b.textile'), 'content b', 'utf-8');

      const svc = new FileListServiceImpl();
      const files = await svc.listFiles(dir);

      expect(files).toHaveLength(3);
      expect(files[0].fileName).toBe('a.txt');
      expect(files[1].fileName).toBe('b.textile');
      expect(files[2].fileName).toBe('c.md');
    });

    it('skips files with disallowed extensions', async () => {
      const dir = join(tmpdir(), `exolith-test-${Date.now()}`);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'doc.md'), 'content', 'utf-8');
      await writeFile(join(dir, 'data.json'), '{}', 'utf-8');
      await writeFile(join(dir, 'image.png'), 'binary', 'utf-8');

      const svc = new FileListServiceImpl();
      const files = await svc.listFiles(dir);

      expect(files).toHaveLength(1);
      expect(files[0].fileName).toBe('doc.md');
    });

    it('skips dotfiles', async () => {
      const dir = join(tmpdir(), `exolith-test-${Date.now()}`);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, '.hidden.md'), 'hidden', 'utf-8');
      await writeFile(join(dir, 'visible.md'), 'visible', 'utf-8');

      const svc = new FileListServiceImpl();
      const files = await svc.listFiles(dir);

      expect(files).toHaveLength(1);
      expect(files[0].fileName).toBe('visible.md');
    });

    it('skips subdirectories', async () => {
      const dir = join(tmpdir(), `exolith-test-${Date.now()}`);
      await mkdir(dir, { recursive: true });
      await mkdir(join(dir, 'subdir'), { recursive: true });
      await writeFile(join(dir, 'file.md'), 'content', 'utf-8');

      const svc = new FileListServiceImpl();
      const files = await svc.listFiles(dir);

      expect(files).toHaveLength(1);
      expect(files[0].fileName).toBe('file.md');
    });

    it('assigns a stable 6-character hex ID', async () => {
      const dir = join(tmpdir(), `exolith-test-${Date.now()}`);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'test.md'), 'hello world', 'utf-8');

      const svc = new FileListServiceImpl();
      const files = await svc.listFiles(dir);

      expect(files).toHaveLength(1);
      expect(files[0].id).toMatch(/^[0-9a-f]{6}$/);
      expect(files[0].fullPath).toBe(join(dir, 'test.md'));
    });

    it('produces the same ID for the same file name and content across calls', async () => {
      const dir = join(tmpdir(), `exolith-test-${Date.now()}`);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'source.txt'), 'deterministic content', 'utf-8');

      const svc = new FileListServiceImpl();
      const first = await svc.listFiles(dir);
      const second = await svc.listFiles(dir);

      expect(first[0].id).toBe(second[0].id);
    });

    it('produces different IDs for different filenames', async () => {
      const dir = join(tmpdir(), `exolith-test-${Date.now()}`);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'alpha.md'), 'content', 'utf-8');
      await writeFile(join(dir, 'beta.md'), 'content', 'utf-8');

      const svc = new FileListServiceImpl();
      const files = await svc.listFiles(dir);

      expect(files).toHaveLength(2);
      expect(files[0].id).not.toBe(files[1].id);
    });

    it('respects custom allowedExtensions', async () => {
      const dir = join(tmpdir(), `exolith-test-${Date.now()}`);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'notes.md'), 'md', 'utf-8');
      await writeFile(join(dir, 'notes.org'), 'org', 'utf-8');

      const svc = new FileListServiceImpl({ allowedExtensions: ['.org'] });
      const files = await svc.listFiles(dir);

      expect(files).toHaveLength(1);
      expect(files[0].fileName).toBe('notes.org');
    });

    it('produces the same ID regardless of other files in the directory', async () => {
      const dir = join(tmpdir(), `exolith-test-${Date.now()}`);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'core.md'), 'foundational text', 'utf-8');

      const svc = new FileListServiceImpl();
      const soloId = (await svc.listFiles(dir))[0].id;

      await writeFile(join(dir, 'extra.md'), 'additional text', 'utf-8');
      const withExtraId = (await svc.listFiles(dir)).find((f) => f.fileName === 'core.md')?.id;

      expect(soloId).toBe(withExtraId);
    });
  });

  describe('collision', () => {
    it('disambiguates duplicate IDs with -N suffix', async () => {
      const dir = join(tmpdir(), `exolith-test-${Date.now()}`);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'alpha.md'), 'content a', 'utf-8');
      await writeFile(join(dir, 'beta.md'), 'content b', 'utf-8');
      await writeFile(join(dir, 'gamma.md'), 'content c', 'utf-8');

      vi.resetModules();

      vi.doMock('node:crypto', () => ({
        createHash: () => ({
          update: () => ({
            digest: () => 'aaaaaaaa0000000000000000',
          }),
        }),
      }));

      const { FileListServiceImpl: MockedImpl } = await import(
        '../src/core/file-list-service-impl'
      );

      const mocked = new MockedImpl();
      const files = await mocked.listFiles(dir);

      expect(files).toHaveLength(3);
      expect(files[0].id).toBe('aaaaaa');
      expect(files[1].id).toBe('aaaaaa-2');
      expect(files[2].id).toBe('aaaaaa-3');
    });
  });
});
