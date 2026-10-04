import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MAX_IMAGE_BYTES } from '@/config/preview';
import { MAX_FILE_BYTES } from '@/config/server';
import type { Result } from '@/types/api';

import {
  createWorkspace,
  listDirectory,
  listFiles,
  readFile,
  readImage,
  writeFile,
} from './workspace';
import type { Workspace } from './workspace';

let sandbox: string;
let workspace: Workspace;

function expectFailure<T>(result: Result<T>, code: string): void {
  expect(result.success).toBe(false);
  if (!result.success) expect(result.error.code).toBe(code);
}

function expectData<T>(result: Result<T>): T {
  if (!result.success) throw new Error(`Expected success, got ${result.error.code}`);
  return result.data;
}

beforeEach(async () => {
  sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'pane-test-'));
  const root = path.join(sandbox, 'project');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.mkdir(path.join(root, '.git'));
  await fs.writeFile(path.join(root, 'readme.md'), '# hello\n');
  await fs.writeFile(path.join(root, '.dev.vars'), 'KEY=value\n');
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const a = 1;\n');
  await fs.writeFile(path.join(sandbox, 'secret.txt'), 'outside\n');
  workspace = await createWorkspace(root);
});

afterEach(async () => {
  await fs.rm(sandbox, { recursive: true, force: true });
});

describe('listDirectory', () => {
  it('lists folders first, keeps dotfiles and hides .git', async () => {
    const entries = expectData(await listDirectory(workspace, ''));
    expect(entries.map((entry) => entry.name)).toEqual(['src', '.dev.vars', 'readme.md']);
    expect(entries[0]).toEqual({ name: 'src', path: 'src', kind: 'directory' });
  });

  it('returns workspace-relative paths for nested entries', async () => {
    const entries = expectData(await listDirectory(workspace, 'src'));
    expect(entries).toEqual([{ name: 'index.ts', path: 'src/index.ts', kind: 'file' }]);
  });

  it('rejects a file path', async () => {
    expectFailure(await listDirectory(workspace, 'readme.md'), 'not_a_directory');
  });
});

describe('listFiles', () => {
  it('lists every file with its workspace-relative path', async () => {
    const index = expectData(await listFiles(workspace));
    expect(index).toEqual({
      paths: ['.dev.vars', 'readme.md', 'src/index.ts'],
      isTruncated: false,
    });
  });

  it('leaves out .git, dependencies and build output', async () => {
    await fs.writeFile(path.join(workspace.root, '.git', 'config'), '[core]\n');
    await fs.mkdir(path.join(workspace.root, 'node_modules', 'left-pad'), { recursive: true });
    await fs.writeFile(path.join(workspace.root, 'node_modules', 'left-pad', 'index.js'), '');
    await fs.mkdir(path.join(workspace.root, 'src', 'dist'));
    await fs.writeFile(path.join(workspace.root, 'src', 'dist', 'bundle.js'), '');

    const { paths } = expectData(await listFiles(workspace));
    expect(paths).toEqual(['.dev.vars', 'readme.md', 'src/index.ts']);
  });

  it('does not follow symlinks, so nothing outside the workspace is listed', async () => {
    await fs.mkdir(path.join(sandbox, 'outside'));
    await fs.writeFile(path.join(sandbox, 'outside', 'private.txt'), 'outside\n');
    await fs.symlink(path.join(sandbox, 'outside'), path.join(workspace.root, 'linked-folder'));
    await fs.symlink(path.join(sandbox, 'secret.txt'), path.join(workspace.root, 'linked.txt'));
    // A link back to the workspace itself would make a walk that follows links run forever.
    await fs.symlink(workspace.root, path.join(workspace.root, 'src', 'loop'));

    const { paths } = expectData(await listFiles(workspace));
    expect(paths).toEqual(['.dev.vars', 'readme.md', 'src/index.ts']);
  });
});

describe('readImage', () => {
  // The first bytes of every PNG file.
  const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it('returns the bytes and content type of an image', async () => {
    await fs.writeFile(path.join(workspace.root, 'Logo.PNG'), pngBytes);

    const image = expectData(await readImage(workspace, 'Logo.PNG'));
    expect(image.mimeType).toBe('image/png');
    expect(Buffer.from(image.bytes)).toEqual(pngBytes);
  });

  it('refuses files that are not images, so it cannot be used to download anything else', async () => {
    expectFailure(await readImage(workspace, '.dev.vars'), 'not_an_image');
    expectFailure(await readImage(workspace, 'src/index.ts'), 'not_an_image');
  });

  it('rejects paths and symlinks that leave the workspace', async () => {
    await fs.writeFile(path.join(sandbox, 'outside.png'), pngBytes);
    await fs.symlink(path.join(sandbox, 'outside.png'), path.join(workspace.root, 'link.png'));

    expectFailure(await readImage(workspace, '../outside.png'), 'outside_workspace');
    expectFailure(await readImage(workspace, path.join(sandbox, 'outside.png')), 'outside_workspace');
    expectFailure(await readImage(workspace, 'link.png'), 'outside_workspace');
  });

  it('reports missing, oversized and folder paths', async () => {
    await fs.mkdir(path.join(workspace.root, 'folder.png'));
    await fs.writeFile(path.join(workspace.root, 'huge.png'), Buffer.alloc(MAX_IMAGE_BYTES + 1));

    expectFailure(await readImage(workspace, 'nope.png'), 'not_found');
    expectFailure(await readImage(workspace, 'folder.png'), 'not_a_file');
    expectFailure(await readImage(workspace, 'huge.png'), 'too_large');
  });
});

describe('readFile', () => {
  it('reads a text file with its modification time', async () => {
    const file = expectData(await readFile(workspace, 'src/index.ts'));
    expect(file.path).toBe('src/index.ts');
    expect(file.content).toBe('export const a = 1;\n');
    expect(file.mtimeMs).toBeGreaterThan(0);
  });

  it('rejects paths that climb out of the workspace', async () => {
    expectFailure(await readFile(workspace, '../secret.txt'), 'outside_workspace');
    expectFailure(await readFile(workspace, 'src/../../secret.txt'), 'outside_workspace');
    expectFailure(await readFile(workspace, path.join(sandbox, 'secret.txt')), 'outside_workspace');
  });

  it('rejects a symlink that points out of the workspace', async () => {
    await fs.symlink(path.join(sandbox, 'secret.txt'), path.join(workspace.root, 'link.txt'));
    expectFailure(await readFile(workspace, 'link.txt'), 'outside_workspace');
  });

  it('allows a file whose name merely starts with two dots', async () => {
    await fs.writeFile(path.join(workspace.root, '..notes'), 'fine\n');
    expect(expectData(await readFile(workspace, '..notes')).content).toBe('fine\n');
  });

  it('reports missing files, folders, binaries and oversized files', async () => {
    await fs.writeFile(path.join(workspace.root, 'image.bin'), Buffer.from([1, 0, 2, 3]));
    await fs.writeFile(path.join(workspace.root, 'huge.txt'), 'a'.repeat(MAX_FILE_BYTES + 1));

    expectFailure(await readFile(workspace, 'nope.ts'), 'not_found');
    expectFailure(await readFile(workspace, 'src'), 'not_a_file');
    expectFailure(await readFile(workspace, 'image.bin'), 'binary');
    expectFailure(await readFile(workspace, 'huge.txt'), 'too_large');
  });

  it('refuses text that is not UTF-8 and leaves the file untouched', async () => {
    // "café" in Latin-1: 0xe9 on its own is not valid UTF-8.
    const latin1 = Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x0a]);
    const target = path.join(workspace.root, 'latin1.txt');
    await fs.writeFile(target, latin1);

    expectFailure(await readFile(workspace, 'latin1.txt'), 'unsupported_encoding');
    expect(await fs.readFile(target)).toEqual(latin1);
  });

  it('reads UTF-8 with multibyte characters and keeps a byte order mark', async () => {
    await fs.writeFile(path.join(workspace.root, 'accents.txt'), 'café ✓\n');
    await fs.writeFile(path.join(workspace.root, 'bom.txt'), '﻿hello\n');

    expect(expectData(await readFile(workspace, 'accents.txt')).content).toBe('café ✓\n');
    expect(expectData(await readFile(workspace, 'bom.txt')).content).toBe('﻿hello\n');
  });
});

describe('writeFile', () => {
  it('saves when the file is unchanged since it was opened', async () => {
    const opened = expectData(await readFile(workspace, 'readme.md'));
    const saved = expectData(
      await writeFile(workspace, {
        path: 'readme.md',
        content: '# changed\n',
        expectedMtimeMs: opened.mtimeMs,
      }),
    );

    expect(await fs.readFile(path.join(workspace.root, 'readme.md'), 'utf8')).toBe('# changed\n');
    expect(saved.mtimeMs).toBe(expectData(await readFile(workspace, 'readme.md')).mtimeMs);
  });

  it('refuses to overwrite a file that changed on disk, unless told to', async () => {
    const target = path.join(workspace.root, 'readme.md');
    const opened = expectData(await readFile(workspace, 'readme.md'));
    await fs.writeFile(target, '# edited elsewhere\n');
    await fs.utimes(target, new Date(), new Date(opened.mtimeMs + 5000));

    const request = { path: 'readme.md', content: '# mine\n', expectedMtimeMs: opened.mtimeMs };
    expectFailure(await writeFile(workspace, request), 'conflict');
    expect(await fs.readFile(target, 'utf8')).toBe('# edited elsewhere\n');

    expectData(await writeFile(workspace, { ...request, expectedMtimeMs: null }));
    expect(await fs.readFile(target, 'utf8')).toBe('# mine\n');
  });

  it('never writes outside the workspace or creates new files', async () => {
    const outside = { path: '../secret.txt', content: 'pwned', expectedMtimeMs: null };
    expectFailure(await writeFile(workspace, outside), 'outside_workspace');
    expect(await fs.readFile(path.join(sandbox, 'secret.txt'), 'utf8')).toBe('outside\n');

    const missing = { path: 'new.txt', content: 'x', expectedMtimeMs: null };
    expectFailure(await writeFile(workspace, missing), 'not_found');
  });
});
