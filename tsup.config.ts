import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { cli: 'bin/pane.ts' },
  format: 'esm',
  target: 'node20',
  outDir: 'dist',
  // dist/web is produced by Vite first and must survive this step.
  clean: false,
});
