import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts', 'src/index.ts', 'src/matchers/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20',
});
