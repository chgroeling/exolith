/** Specification: docs/operations/compile.md */

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CompileConfig } from '../../../src/operations/compile/compile-service';
import { Compile } from '../../../src/operations/compile/compile-service-impl';
import type { PipelineEvent, Question } from '../../../src/operations/pipeline-presentation';

function makeMockEmit(): (event: PipelineEvent) => void {
  return () => {};
}

function makeMockAsk(): <T>(question: Question<T>) => Promise<T> {
  return <T>() => Promise.resolve(undefined as unknown as T);
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
      const emit = makeMockEmit();
      const ask = makeMockAsk();
      const compile = new Compile(config, emit, ask);

      await expect(compile.compile()).resolves.not.toThrow();
    });
  });
});
