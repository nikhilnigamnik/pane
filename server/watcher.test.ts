import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WATCH_DEBOUNCE_MS } from '@/config/server';

import { createWatcher } from './watcher';
import type { WorkspaceWatcher } from './watcher';
import { createWorkspace } from './workspace';

const WRITE_INTERVAL_MS = 50;
const QUIET_PERIOD_MS = WATCH_DEBOUNCE_MS * 4;

let sandbox: string;
let root: string;
let watcher: WorkspaceWatcher;
let cleanups: (() => void)[];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The OS needs a moment before a new watcher reports anything, so the file is written
// repeatedly until the write shows up. Resolves with every path reported up to that point.
function writeUntilReported(relativePath: string): Promise<string[]> {
  return new Promise((resolve) => {
    const seen: string[] = [];
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      void fs.writeFile(path.join(root, relativePath), `write ${count}\n`);
    }, WRITE_INTERVAL_MS);
    cleanups.push(() => clearInterval(timer));

    const unsubscribe = watcher.subscribe((change) => {
      seen.push(...change.paths);
      if (!seen.includes(relativePath)) return;
      clearInterval(timer);
      resolve(seen);
    });
    cleanups.push(unsubscribe);
  });
}

beforeEach(async () => {
  sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'pane-watch-test-'));
  root = path.join(sandbox, 'project');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.mkdir(path.join(root, '.git'));
  await fs.mkdir(path.join(sandbox, 'outside'));
  watcher = createWatcher(await createWorkspace(root));
  cleanups = [];
});

afterEach(async () => {
  for (const cleanup of cleanups) cleanup();
  await fs.rm(sandbox, { recursive: true, force: true });
});

describe('createWatcher', () => {
  it('reports a changed file by its workspace-relative path', async () => {
    const seen = await writeUntilReported('src/index.ts');
    expect(seen).toContain('src/index.ts');
  });

  it('stays quiet about .git', async () => {
    const gitWrites = setInterval(() => {
      void fs.writeFile(path.join(root, '.git', 'index.lock'), 'x');
    }, WRITE_INTERVAL_MS);
    cleanups.push(() => clearInterval(gitWrites));

    const seen = await writeUntilReported('marker.txt');
    expect(seen.filter((item) => item.startsWith('.git'))).toEqual([]);
  });

  it('does not report changes behind a symlink that leaves the workspace', async () => {
    await fs.symlink(path.join(sandbox, 'outside'), path.join(root, 'link'));
    const outsideWrites = setInterval(() => {
      void fs.writeFile(path.join(sandbox, 'outside', 'secret.txt'), 'x');
    }, WRITE_INTERVAL_MS);
    cleanups.push(() => clearInterval(outsideWrites));

    const seen = await writeUntilReported('marker.txt');
    expect(seen.filter((item) => item.includes('secret.txt'))).toEqual([]);
  });

  it('stops reporting once the last subscriber leaves', async () => {
    await writeUntilReported('marker.txt');
    for (const cleanup of cleanups.splice(0)) cleanup();

    const late: string[] = [];
    const unsubscribe = watcher.subscribe((change) => late.push(...change.paths));
    unsubscribe();
    await fs.writeFile(path.join(root, 'after.txt'), 'x');
    await wait(QUIET_PERIOD_MS);
    expect(late).toEqual([]);
  });
});
