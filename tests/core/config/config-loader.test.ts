// Specification: docs/cross-cutting/vault-layout.md

import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigLoaderServiceImpl } from '../../../src/core/config/config-loader-impl';
import { CONFIG_FILE_NAME } from '../../../src/core/config/config-types';

function makeLoader(): ConfigLoaderServiceImpl {
  return new ConfigLoaderServiceImpl();
}

async function writeConfig(dir: string, content: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, CONFIG_FILE_NAME), content, 'utf-8');
}

function testDir(): string {
  return join(tmpdir(), `exolith-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
}

describe('ConfigLoader', () => {
  describe('load', () => {
    it('finds exolith.json in cwd', async () => {
      const dir = testDir();
      await writeConfig(
        dir,
        JSON.stringify({ model: 'openrouter/deepseek/deepseek-v4-pro', maxSourceSize: 5000 }),
      );

      const result = await makeLoader().load(dir);

      expect(result.config).toEqual({
        model: 'openrouter/deepseek/deepseek-v4-pro',
        maxSourceSize: 5000,
      });
      expect(result.rootDir).toBe(dir);
    });

    it('throws for an empty config file (missing model)', async () => {
      const dir = testDir();
      await writeConfig(dir, '{}');

      await expect(makeLoader().load(dir)).rejects.toThrow(/model: Invalid input/);
    });

    it('supports JSON5 features (comments, trailing commas, unquoted keys)', async () => {
      const dir = testDir();
      const json5Content = `{
        // This is a comment
        model: "openrouter/deepseek/deepseek-v4-pro",
        maxSourceSize: 10000, // trailing comma
      }`;
      await writeConfig(dir, json5Content);

      const result = await makeLoader().load(dir);

      expect(result.config.model).toBe('openrouter/deepseek/deepseek-v4-pro');
      expect(result.config.maxSourceSize).toBe(10000);
    });

    it('bubbles up from a subdirectory to find exolith.json', async () => {
      const rootDir = testDir();
      await writeConfig(rootDir, JSON.stringify({ model: 'openrouter/deepseek/deepseek-v4-pro' }));

      const cwd = join(rootDir, 'deep', 'nested', 'dir');
      await mkdir(cwd, { recursive: true });

      const result = await makeLoader().load(cwd);

      expect(result.config).toEqual({
        model: 'openrouter/deepseek/deepseek-v4-pro',
      });
      expect(result.rootDir).toBe(rootDir);
    });

    it('throws when exolith.json cannot be found up to filesystem root', async () => {
      const emptyDir = testDir();
      await mkdir(emptyDir, { recursive: true });

      await expect(makeLoader().load(emptyDir)).rejects.toThrow(
        `Exolith root not found: ${CONFIG_FILE_NAME} missing`,
      );
    });

    it('throws when found config file has malformed JSON5', async () => {
      const dir = testDir();
      await writeConfig(dir, '{ invalid: }');

      await expect(makeLoader().load(dir)).rejects.toThrow(/Malformed configuration/);
    });

    it('accepts deepseek model format', async () => {
      const dir = testDir();
      await writeConfig(dir, JSON.stringify({ model: 'deepseek/deepseek-v4-flash' }));

      const result = await makeLoader().load(dir);

      expect(result.config.model).toBe('deepseek/deepseek-v4-flash');
      expect(result.rootDir).toBe(dir);
    });
  });

  describe('loadAt', () => {
    it('loads exolith.json from the specified directory', async () => {
      const dir = testDir();
      await writeConfig(
        dir,
        JSON.stringify({ model: 'openrouter/deepseek/deepseek-v4-pro', maxSourceSize: 5000 }),
      );

      const result = await makeLoader().loadAt(dir);

      expect(result.config).toEqual({
        model: 'openrouter/deepseek/deepseek-v4-pro',
        maxSourceSize: 5000,
      });
      expect(result.rootDir).toBe(dir);
    });

    it('throws for an empty config file (missing model)', async () => {
      const dir = testDir();
      await writeConfig(dir, '{}');

      await expect(makeLoader().loadAt(dir)).rejects.toThrow(/model: Invalid input/);
    });

    it('supports JSON5 features (comments, trailing commas, unquoted keys)', async () => {
      const dir = testDir();
      const json5Content = `{
        // This is a comment
        model: "openrouter/deepseek/deepseek-v4-pro",
        maxSourceSize: 10000, // trailing comma
      }`;
      await writeConfig(dir, json5Content);

      const result = await makeLoader().loadAt(dir);

      expect(result.config.model).toBe('openrouter/deepseek/deepseek-v4-pro');
      expect(result.config.maxSourceSize).toBe(10000);
    });

    it('throws when exolith.json does not exist at the specified directory', async () => {
      const emptyDir = testDir();
      await mkdir(emptyDir, { recursive: true });

      await expect(makeLoader().loadAt(emptyDir)).rejects.toThrow(`${CONFIG_FILE_NAME} not found`);
    });

    it('does not bubble up — throws even if exolith.json exists in a parent', async () => {
      const rootDir = testDir();
      await writeConfig(rootDir, JSON.stringify({ model: 'openrouter/deepseek/deepseek-v4-pro' }));

      const childDir = join(rootDir, 'subdir');
      await mkdir(childDir, { recursive: true });

      await expect(makeLoader().loadAt(childDir)).rejects.toThrow(`${CONFIG_FILE_NAME} not found`);
    });

    it('throws when config file has malformed JSON5', async () => {
      const dir = testDir();
      await writeConfig(dir, '{ invalid: }');

      await expect(makeLoader().loadAt(dir)).rejects.toThrow(/Malformed configuration/);
    });
  });
});
