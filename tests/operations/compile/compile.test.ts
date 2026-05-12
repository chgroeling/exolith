/** Specification: docs/operations/compile.md */

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  CompileConfig,
  CompilePresentation,
} from '../../../src/operations/compile/compile-service';
import { Compile } from '../../../src/operations/compile/compile-service-impl';

function makeMockPresentation(overrides?: Partial<CompilePresentation>): CompilePresentation {
  return {
    onError: () => {},
    ...overrides,
  };
}

function makeConfig(overrides?: Partial<CompileConfig>): CompileConfig {
  return {
    vaultPath: join(tmpdir(), `exolith-test-${Date.now()}`),
    ...overrides,
  };
}

describe('Compile', () => {
  describe('compile', () => {
    it('runs the full pipeline without throwing', async () => {
      const config = makeConfig();
      const presentation = makeMockPresentation();
      const compile = new Compile(config, presentation);

      await expect(compile.compile()).resolves.not.toThrow();
    });
  });
});
