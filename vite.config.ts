import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { API_PREFIX } from './config/routes.ts';
import { DEFAULT_HOST, DEV_API_PORT, DEV_WEB_PORT } from './config/server.ts';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
    // Monaco is large by nature and only ever loaded from this machine.
    chunkSizeWarningLimit: 6000,
  },
  server: {
    host: DEFAULT_HOST,
    port: DEV_WEB_PORT,
    proxy: {
      [API_PREFIX]: `http://${DEFAULT_HOST}:${DEV_API_PORT}`,
    },
  },
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts', 'web/**/*.test.{ts,tsx}'],
  },
});
