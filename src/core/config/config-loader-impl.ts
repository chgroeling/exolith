// Specification: docs/cross-cutting/vault-layout.md

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import JSON5 from 'json5';
import type { Logger } from 'pino';
import type { ConfigLoaderService } from './config-loader';
import { CONFIG_FILE_NAME } from './config-types';
import type { ConfigLoadResult, ExolithConfig } from './config-types';

export class ConfigLoaderServiceImpl implements ConfigLoaderService {
  constructor(private logger?: Logger) {}

  /**
   * Searches upward from `cwd` for {@link CONFIG_FILE_NAME}.
   * @param cwd Starting directory for the bubble-up search.
   * @returns The parsed configuration and the discovered root directory.
   * @throws If {@link CONFIG_FILE_NAME} is not found up to the filesystem boundary.
   */
  async load(cwd: string): Promise<ConfigLoadResult> {
    let current = resolve(cwd);

    while (true) {
      const candidate = join(current, CONFIG_FILE_NAME);

      try {
        const raw = await readFile(candidate, 'utf-8');
        const config = this.parseConfig(candidate, raw);

        this.logger?.info({ configPath: candidate, rootDir: current }, 'Configuration loaded');

        return { config, rootDir: current };
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err;
        }
      }

      const parent = resolve(current, '..');
      if (parent === current) {
        throw new Error(
          `Exolith root not found: ${CONFIG_FILE_NAME} missing. Place ${CONFIG_FILE_NAME} in the project root.`,
        );
      }
      current = parent;
    }
  }

  /**
   * Loads configuration from an explicit directory without bubble-up search.
   * @param dir Absolute or relative path to the vault directory.
   * @returns The parsed configuration and the resolved root directory.
   * @throws If {@link CONFIG_FILE_NAME} does not exist at `dir`.
   */
  async loadAt(dir: string): Promise<ConfigLoadResult> {
    const rootDir = resolve(dir);
    const candidate = join(rootDir, CONFIG_FILE_NAME);

    let raw: string;

    try {
      raw = await readFile(candidate, 'utf-8');
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(
          `${CONFIG_FILE_NAME} not found at ${rootDir}.` +
            ` Place ${CONFIG_FILE_NAME} at the specified vault directory.`,
        );
      }
      throw err;
    }

    const config = this.parseConfig(candidate, raw);

    this.logger?.info(
      { configPath: candidate, rootDir },
      'Configuration loaded from explicit path',
    );

    return { config, rootDir };
  }

  private parseConfig(path: string, raw: string): ExolithConfig {
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON5.parse(raw.trim() || '{}');
    } catch (err) {
      throw new Error(`Malformed configuration at ${path}: ${(err as Error).message}`);
    }

    this.validateConfig(path, parsed);

    return parsed as unknown as ExolithConfig;
  }

  private validateConfig(path: string, config: Record<string, unknown>): void {
    if (!config.provider) {
      throw new Error(
        `Invalid configuration at ${path}: missing required field "provider". Must be "openrouter" or "deepseek".`,
      );
    }

    if (config.provider !== 'openrouter' && config.provider !== 'deepseek') {
      throw new Error(
        `Invalid configuration at ${path}: provider "${config.provider}" is not supported. Must be "openrouter" or "deepseek".`,
      );
    }
  }
}
