import { spawn } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { serve } from '@hono/node-server';
import type { Hono } from 'hono';
import { z } from 'zod';

import { CLI_MESSAGES, CLI_USAGE } from '@/config/messages';
import { OPEN_FILE_PARAM } from '@/config/routes';
import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  DEV_API_PORT,
  STATIC_DIR_NAME,
  STATIC_INDEX_FILE,
} from '@/config/server';

import { createApp } from './app';
import { errorCode } from './result';
import { createWorkspace } from './workspace';

interface Target {
  directory: string;
  // Set when the CLI was pointed at a file: its folder becomes the workspace.
  file: string | null;
}

const portSchema = z.coerce.number().int().min(0).max(65535);

const ARG_OPTIONS = {
  port: { type: 'string', short: 'p' },
  'no-open': { type: 'boolean' },
  dev: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const;

async function resolveTarget(input: string): Promise<Target | null> {
  const absolutePath = path.resolve(input);
  try {
    const stats = await fs.stat(absolutePath);
    if (stats.isDirectory()) return { directory: absolutePath, file: null };
    return { directory: path.dirname(absolutePath), file: path.basename(absolutePath) };
  } catch {
    return null;
  }
}

// The built UI sits next to the bundled CLI (dist/web). It is absent when running from source.
function findStaticDir(): string | null {
  const staticDir = path.join(path.dirname(fileURLToPath(import.meta.url)), STATIC_DIR_NAME);
  return existsSync(path.join(staticDir, STATIC_INDEX_FILE)) ? staticDir : null;
}

function listen(app: Hono, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, hostname: DEFAULT_HOST, port }, (info) => {
      resolve(info.port);
    });
    server.once('error', reject);
  });
}

async function listenWithFallback(app: Hono, port: number): Promise<number> {
  try {
    return await listen(app, port);
  } catch (error) {
    const canFallBack = errorCode(error) === 'EADDRINUSE' && port !== 0;
    if (!canFallBack) throw error;
    return listen(app, 0);
  }
}

function buildUrl(port: number, file: string | null): string {
  const url = new URL(`http://${DEFAULT_HOST}:${port}/`);
  if (file) url.searchParams.set(OPEN_FILE_PARAM, file);
  return url.toString();
}

function openBrowser(url: string): void {
  const isWindows = process.platform === 'win32';
  const command = process.platform === 'darwin' ? 'open' : isWindows ? 'cmd' : 'xdg-open';
  const args = isWindows ? ['/c', 'start', '', url] : [url];

  const child = spawn(command, args, { stdio: 'ignore', detached: true });
  // The URL is already printed, so a missing opener is not worth failing over.
  child.on('error', () => undefined);
  child.unref();
}

export async function runCli(argv: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: ARG_OPTIONS, allowPositionals: true });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(`\n${CLI_USAGE}`);
    return 1;
  }

  const { values, positionals } = parsed;
  if (values.help) {
    console.log(CLI_USAGE);
    return 0;
  }

  const isDev = values.dev === true;
  const port = portSchema.safeParse(values.port ?? (isDev ? DEV_API_PORT : DEFAULT_PORT));
  if (!port.success) {
    console.error(CLI_MESSAGES.INVALID_PORT);
    return 1;
  }

  const input = positionals[0] ?? '.';
  const target = await resolveTarget(input);
  if (!target) {
    console.error(CLI_MESSAGES.PATH_NOT_FOUND(input));
    return 1;
  }

  const staticDir = isDev ? null : findStaticDir();
  if (!isDev && !staticDir) {
    console.error(CLI_MESSAGES.UI_NOT_BUILT);
    return 1;
  }

  const workspace = await createWorkspace(target.directory);
  const app = createApp({ workspace, staticDir });

  let actualPort: number;
  try {
    // The Vite dev server proxies to a fixed port, so dev mode must not move to another one.
    actualPort = isDev ? await listen(app, port.data) : await listenWithFallback(app, port.data);
  } catch (error) {
    console.error(CLI_MESSAGES.START_FAILED(error instanceof Error ? error.message : String(error)));
    return 1;
  }

  const url = buildUrl(actualPort, target.file);
  if (isDev) {
    console.log(CLI_MESSAGES.DEV_API(url));
    return 0;
  }

  console.log(CLI_MESSAGES.SERVING(workspace.root));
  console.log(`      ${url}`);
  console.log(`      ${CLI_MESSAGES.STOP_HINT}`);
  if (!values['no-open']) openBrowser(url);
  return 0;
}
