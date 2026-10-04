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

import { findMatches, searchWorkspace, toPattern } from './search';
import type { SearchOptions } from './search';
import { createWorkspace } from './workspace';
import type { Workspace } from './workspace';

const TEN_MATCHES = { isWholeWord: false, limit: 10 };

let root: string;
let workspace: Workspace;

const PLAIN_TEXT: Omit<SearchOptions, 'query'> = {
  isCaseSensitive: false,
  isWholeWord: false,
  isRegex: false,
  include: '',
  exclude: '',
};

async function search(
  query: string,
  options: Partial<Omit<SearchOptions, 'query'>> = {},
): Promise<SearchResults> {
  const result = await searchWorkspace(workspace, { ...PLAIN_TEXT, ...options, query });
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
    const matches = findMatches('one two\ntwo one two\n', /two/g, TEN_MATCHES);
    expect(matches.map(({ line, column, length }) => ({ line, column, length }))).toEqual([
      { line: 1, column: 5, length: 3 },
      { line: 2, column: 1, length: 3 },
      { line: 2, column: 9, length: 3 },
    ]);
  });

  it('drops indentation from the preview and says where the match sits in it', () => {
    const [match] = findMatches('    const value = 1;\r\n', /value/g, TEN_MATCHES);
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
    const [match] = findMatches('  const first = 1; const second = 2; const needle = 3;', /needle/g, TEN_MATCHES);

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
    const [match] = findMatches(line, /needle/g, TEN_MATCHES);

    expect(match?.column).toBe(5001);
    expect(match?.preview).toHaveLength(SEARCH_PREVIEW_MAX_LENGTH);
    expect(match?.previewOffset).toBe(SEARCH_PREVIEW_LEAD);
    expect(match?.preview.slice(match.previewOffset, match.previewOffset + 6)).toBe('needle');
    expect(match?.isClippedAtStart).toBe(true);
  });

  it('keeps a match that sits inside the indentation', () => {
    const [match] = findMatches('\t\tvalue', /\t/g, TEN_MATCHES);
    expect(match).toMatchObject({ column: 1, preview: '\t\tvalue', previewOffset: 0 });
  });

  it('does not count a byte order mark as a column', () => {
    const [match] = findMatches('﻿hello\n', /hello/g, TEN_MATCHES);
    expect(match?.column).toBe(1);
  });

  it('skips matches that are empty', () => {
    expect(findMatches('abc', /x*/g, TEN_MATCHES)).toEqual([]);
  });

  it('marks only the first line of a match that runs over several lines', () => {
    const [match] = findMatches('one two\nthree', /two\nthree/g, TEN_MATCHES);
    expect(match).toMatchObject({ line: 1, column: 5, length: 3 });
  });

  it('keeps only whole words when asked to', () => {
    const options = { isWholeWord: true, limit: 10 };
    const columns = (text: string) => findMatches(text, /cat/g, options).map((match) => match.column);

    expect(columns('cat concat cats cat_ (cat) café_cat')).toEqual([1, 23]);
    expect(columns('über-cat')).toEqual([6]);
    expect(columns('écat cat')).toEqual([6]);
  });

  it('stops at the limit', () => {
    expect(findMatches('a a a a a', /a/g, { isWholeWord: false, limit: 3 })).toHaveLength(3);
  });
});

describe('toPattern', () => {
  it('escapes plain text and keeps regular expressions as written', () => {
    const plain = { isRegex: false, isCaseSensitive: true };
    const regex = { isRegex: true, isCaseSensitive: false };

    expect(toPattern('a.b', plain)?.source).toBe('a\\.b');
    expect(toPattern('a.b', regex)?.source).toBe('a.b');
    expect(toPattern('a.b', regex)?.flags).toBe('gi');
  });

  it('returns null for a regular expression that does not compile', () => {
    expect(toPattern('(unclosed', { isRegex: true, isCaseSensitive: false })).toBeNull();
    expect(toPattern('(unclosed', { isRegex: false, isCaseSensitive: false })).not.toBeNull();
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
    const results = await search('Widget', { isCaseSensitive: true });
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

  it('searches with a regular expression', async () => {
    const results = await search('func\\w+\\s+widget', { isRegex: true });
    expect(results.files.map((file) => [file.path, file.matches[0]?.length])).toEqual([
      ['src/widget.ts', 15],
    ]);
  });

  it('reports a regular expression that does not compile', async () => {
    const result = await searchWorkspace(workspace, { ...PLAIN_TEXT, query: '([', isRegex: true });
    expect(result.success ? null : result.error.code).toBe('invalid_pattern');
  });

  it('matches whole words only when asked to', async () => {
    await fs.writeFile(path.join(root, 'words.txt'), 'widgets\n');

    const loose = await search('widget');
    const whole = await search('widget', { isWholeWord: true });
    expect(loose.files.map((file) => file.path)).toContain('words.txt');
    expect(whole.files.map((file) => file.path)).not.toContain('words.txt');
    expect(whole.matchCount).toBe(3);
  });

  it('limits the files searched with include and exclude patterns', async () => {
    const paths = async (options: Partial<SearchOptions>) =>
      (await search('widget', options)).files.map((file) => file.path);

    expect(await paths({ include: '*.ts' })).toEqual(['src/widget.ts']);
    expect(await paths({ include: 'src' })).toEqual(['src/widget.ts']);
    expect(await paths({ exclude: 'src/' })).toEqual(['readme.md']);
    expect(await paths({ include: '*.md, *.ts', exclude: 'widget.ts' })).toEqual(['readme.md']);
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
      ...PLAIN_TEXT,
      query: 'widget',
      signal: controller.signal,
    });
    expect(result).toEqual({
      success: true,
      data: { files: [], matchCount: 0, isTruncated: false },
    });
  });
});
