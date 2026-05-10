// Specification: docs/cross-cutting/vault-layout.md

import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigLoaderServiceImpl } from '../src/core/config/config-loader-impl';
import { CONFIG_FILE_NAME } from '../src/core/config/config-types';

function makeLoader(): ConfigLoaderServiceImpl {
  return new ConfigLoaderServiceImpl();
}

async function writeConfig(dir: string, content: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, CONFIG_FILE_NAME), content, 'utf-8');
}

describe('ConfigLoader', () => {
  describe('load', () => {
    it('finds exolith.json in cwd', async () => {
      const testDir = join(tmpdir(), `exolith-test-${Date.now()}`);
      await writeConfig(testDir, JSON.stringify({ maxSourceSize: 5000 }));

      const result = await makeLoader().load(testDir);

      expect(result.config).toEqual({ maxSourceSize: 5000 });
      expect(result.rootDir).toBe(testDir);
    });

    it('parses an empty config file as empty object', async () => {
      const testDir = join(tmpdir(), `exolith-test-${Date.now()}`);
      await writeConfig(testDir, '');

      const result = await makeLoader().load(testDir);

      expect(result.config).toEqual({});
      expect(result.rootDir).toBe(testDir);
    });

    it('supports JSON5 features (comments, trailing commas, unquoted keys)', async () => {
      const testDir = join(tmpdir(), `exolith-test-${Date.now()}`);
      const json5Content = `{
        // This is a comment
        maxSourceSize: 10000,
        logFile: "exolith.log", // trailing comma
      }`;
      await writeConfig(testDir, json5Content);

      const result = await makeLoader().load(testDir);

      expect(result.config.maxSourceSize).toBe(10000);
      expect(result.config.logFile).toBe('exolith.log');
    });

    it('bubbles up from a subdirectory to find exolith.json', async () => {
      const rootDir = join(tmpdir(), `exolith-test-${Date.now()}`);
      await writeConfig(rootDir, JSON.stringify({ logLevel: 'debug' }));

      const cwd = join(rootDir, 'deep', 'nested', 'dir');
      await mkdir(cwd, { recursive: true });

      const result = await makeLoader().load(cwd);

      expect(result.config).toEqual({ logLevel: 'debug' });
      expect(result.rootDir).toBe(rootDir);
    });

    it('throws when exolith.json cannot be found up to filesystem root', async () => {
      const emptyDir = join(tmpdir(), `exolith-test-${Date.now()}`);
      await mkdir(emptyDir, { recursive: true });

      await expect(makeLoader().load(emptyDir)).rejects.toThrow(
        `Exolith root not found: ${CONFIG_FILE_NAME} missing`,
      );
    });

    it('throws when found config file has malformed JSON5', async () => {
      const testDir = join(tmpdir(), `exolith-test-${Date.now()}`);
      await writeConfig(testDir, '{ invalid: }');

      await expect(makeLoader().load(testDir)).rejects.toThrow(/Malformed configuration/);
    });
  });
});
