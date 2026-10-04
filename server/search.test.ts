import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  MAX_FILE_BYTES,
  MAX_SEARCH_MATCHES,
  SEARCH_PREVIEW_LEAD,
  SEARCH_PREVIEW_MAX_LENGTH,
} from '@/config/server';
import type { SearchResults } from '@/types/api';

import { findMatches, searchWorkspace } from './search';
import { createWorkspace } from './workspace';
import type { Workspace } from './workspace';

let root: string;
let workspace: Workspace;

async function search(query: string, isCaseSensitive = false): Promise<SearchResults> {
  const result = await searchWorkspace(workspace, { query, isCaseSensitive });
  if (!result.success) throw new Error(`Expected success, got ${result.error.code}`);
  return result.data;
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'pane-search-test-'));
  await fs.mkdir(path.join(root, 'src'));
  await fs.writeFile(path.join(root, 'readme.md'), '# Title\n\nUse the Widget here.\n');
  await fs.writeFile(
    path.join(root, 'src', 'widget.ts'),
    'export function widget() {\n  return "widget";\n}\n',
  );
  workspace = await createWorkspace(root);
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('findMatches', () => {
  it('reports the line, column and length of every match', () => {
    const matches = findMatches('one two\ntwo one two\n', /two/g, 10);
    expect(matches.map(({ line, column, length }) => ({ line, column, length }))).toEqual([
      { line: 1, column: 5, length: 3 },
      { line: 2, column: 1, length: 3 },
      { line: 2, column: 9, length: 3 },
    ]);
  });

  it('drops indentation from the preview and says where the match sits in it', () => {
    const [match] = findMatches('    const value = 1;\r\n', /value/g, 10);
    expect(match).toEqual({
      line: 1,
      column: 11,
      length: 5,
      preview: 'const value = 1;',
      previewOffset: 6,
      isClippedAtStart: false,
    });
  });

  it('starts the preview shortly before a match that sits far into the line', () => {
    const [match] = findMatches('  const first = 1; const second = 2; const needle = 3;', /needle/g, 10);

    // The cut falls 12 characters before the match and then moves on to the next word.
    expect(match).toEqual({
      line: 1,
      column: 44,
      length: 6,
      preview: '= 2; const needle = 3;',
      previewOffset: 11,
      isClippedAtStart: true,
    });
  });

  it('cuts a long line to a window around the match', () => {
    const line = `${'a'.repeat(5000)}needle${'b'.repeat(5000)}`;
    const [match] = findMatches(line, /needle/g, 10);

    expect(match?.column).toBe(5001);
    expect(match?.preview).toHaveLength(SEARCH_PREVIEW_MAX_LENGTH);
    expect(match?.previewOffset).toBe(SEARCH_PREVIEW_LEAD);
    expect(match?.preview.slice(match.previewOffset, match.previewOffset + 6)).toBe('needle');
    expect(match?.isClippedAtStart).toBe(true);
  });

  it('keeps a match that sits inside the indentation', () => {
    const [match] = findMatches('\t\tvalue', /\t/g, 10);
    expect(match).toMatchObject({ column: 1, preview: '\t\tvalue', previewOffset: 0 });
  });

  it('does not count a byte order mark as a column', () => {
    const [match] = findMatches('﻿hello\n', /hello/g, 10);
    expect(match?.column).toBe(1);
  });

  it('stops at the limit', () => {
    expect(findMatches('a a a a a', /a/g, 3)).toHaveLength(3);
  });
});

describe('searchWorkspace', () => {
  it('finds matches across files, ignoring case by default', async () => {
    const results = await search('widget');

    expect(results.matchCount).toBe(3);
    expect(results.isTruncated).toBe(false);
    expect(results.files.map((file) => [file.path, file.matches.length])).toEqual([
      ['readme.md', 1],
      ['src/widget.ts', 2],
    ]);
  });

  it('matches case exactly when asked to', async () => {
    const results = await search('Widget', true);
    expect(results.files.map((file) => file.path)).toEqual(['readme.md']);
  });

  it('treats the query as plain text, not as a pattern', async () => {
    await fs.writeFile(path.join(root, 'pattern.txt'), 'a.c\nabc\n(x|y)\n');

    expect((await search('a.c')).matchCount).toBe(1);
    expect((await search('(x|y)')).matchCount).toBe(1);
    expect((await search('.*')).matchCount).toBe(0);
  });

  it('skips binary files, oversized files, dependencies and .git', async () => {
    await fs.writeFile(path.join(root, 'data.bin'), Buffer.from([0, 1, 2, ...Buffer.from('widget')]));
    await fs.writeFile(path.join(root, 'huge.txt'), `widget${'a'.repeat(MAX_FILE_BYTES)}`);
    await fs.mkdir(path.join(root, 'node_modules', 'pkg'), { recursive: true });
    await fs.writeFile(path.join(root, 'node_modules', 'pkg', 'index.js'), 'widget\n');
    await fs.mkdir(path.join(root, '.git'));
    await fs.writeFile(path.join(root, '.git', 'HEAD'), 'widget\n');

    const results = await search('widget');
    expect(results.files.map((file) => file.path)).toEqual(['readme.md', 'src/widget.ts']);
  });

  it('never reads through a symlink that leaves the workspace', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'pane-search-outside-'));
    try {
      await fs.writeFile(path.join(outside, 'private.txt'), 'the password is hunter2\n');
      await fs.symlink(path.join(outside, 'private.txt'), path.join(root, 'linked.txt'));
      await fs.symlink(outside, path.join(root, 'linked-folder'));

      expect(await search('hunter2')).toEqual({ files: [], matchCount: 0, isTruncated: false });
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it('stops at the match limit and says the answer is incomplete', async () => {
    await fs.writeFile(path.join(root, 'many.txt'), 'zz\n'.repeat(MAX_SEARCH_MATCHES + 50));

    const results = await search('zz');
    expect(results.matchCount).toBe(MAX_SEARCH_MATCHES);
    expect(results.isTruncated).toBe(true);
  });

  it('stops early when the caller gives up', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await searchWorkspace(workspace, {
      query: 'widget',
      isCaseSensitive: false,
      signal: controller.signal,
    });
    expect(result).toEqual({
      success: true,
      data: { files: [], matchCount: 0, isTruncated: false },
    });
  });
});
