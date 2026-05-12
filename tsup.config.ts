import { cp } from 'node:fs/promises';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  treeshake: true,
  async onSuccess() {
    await cp('templates', 'dist/templates', { recursive: true });
    await cp('schemas', 'dist/schemas', { recursive: true });
  },
});
