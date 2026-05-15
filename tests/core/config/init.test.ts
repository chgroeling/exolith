import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigLoaderServiceImpl } from '../../../src/core/config/config-loader-impl';
import { ExolithConfigSchema } from '../../../src/core/config/config-schema';
import { CONFIG_FILE_NAME } from '../../../src/core/config/config-types';

function testDir(): string {
  return join(
    tmpdir(),
    `exolith-init-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
}

/** Simulates the file written by the `init` command. */
async function writeInitConfig(dir: string, model: string): Promise<string> {
  const configPath = join(dir, CONFIG_FILE_NAME);
  await mkdir(dir, { recursive: true });
  await writeFile(configPath, `${JSON.stringify({ model }, null, 2)}\n`, 'utf-8');
  return configPath;
}

describe('init', () => {
  it('writes a valid exolith.json with deepseek model that the config loader can parse', async () => {
    const dir = testDir();
    const configPath = await writeInitConfig(dir, 'deepseek/deepseek-v4-flash');

    const raw = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const schemaResult = ExolithConfigSchema.safeParse(parsed);
    expect(schemaResult.success).toBe(true);

    const loader = new ConfigLoaderServiceImpl();
    const result = await loader.loadAt(dir);

    expect(result.config.model).toBe('deepseek/deepseek-v4-flash');
    expect(result.rootDir).toBe(dir);
  });

  it('writes a valid exolith.json with openrouter model that the config loader can parse', async () => {
    const dir = testDir();
    const configPath = await writeInitConfig(dir, 'openrouter/deepseek/deepseek-v4-pro');

    const raw = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const schemaResult = ExolithConfigSchema.safeParse(parsed);
    expect(schemaResult.success).toBe(true);

    const loader = new ConfigLoaderServiceImpl();
    const result = await loader.loadAt(dir);

    expect(result.config.model).toBe('openrouter/deepseek/deepseek-v4-pro');
    expect(result.rootDir).toBe(dir);
  });

  it('writes exact JSON format expected by the config loader', async () => {
    const dir = testDir();
    const configPath = await writeInitConfig(dir, 'deepseek/deepseek-v4-flash');

    const raw = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw);

    expect(parsed).toEqual({ model: 'deepseek/deepseek-v4-flash' });

    const schemaResult = ExolithConfigSchema.safeParse(parsed);
    expect(schemaResult.success).toBe(true);
  });

  it('writes JSON5-compatible format (trailing newline)', async () => {
    const dir = testDir();
    const configPath = await writeInitConfig(dir, 'deepseek/deepseek-v4-flash');

    const raw = await readFile(configPath, 'utf-8');
    expect(raw).toMatch(/\}\n$/);
  });

  it('empty config fails because model is required', async () => {
    const dir = testDir();
    const configPath = join(dir, CONFIG_FILE_NAME);
    await mkdir(dir, { recursive: true });
    await writeFile(configPath, `${JSON.stringify({}, null, 2)}\n`, 'utf-8');

    const raw = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const result = ExolithConfigSchema.safeParse(parsed);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Invalid input/);
    }
  });
});
