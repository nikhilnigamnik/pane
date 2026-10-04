import { describe, expect, it } from 'vitest';

import { fuzzyMatch, rankPaths } from './fuzzy';

const PATHS = [
  'server/app.test.ts',
  'server/app.ts',
  'web/app.tsx',
  'web/components/file-tree.tsx',
  'web/components/tab-bar.tsx',
  'web/hooks/use-file-tree.ts',
  'web/lib/tree-rows.ts',
  'config/routes.ts',
  'README.md',
];

function ranked(query: string, limit = 10): string[] {
  return rankPaths(PATHS, query, limit).map((match) => match.path);
}

describe('fuzzyMatch', () => {
  it('needs every letter of the query, in order', () => {
    expect(fuzzyMatch('web/app.tsx', 'wat')).not.toBeNull();
    expect(fuzzyMatch('web/app.tsx', 'taw')).toBeNull();
    expect(fuzzyMatch('web/app.tsx', 'appz')).toBeNull();
  });

  it('ignores case', () => {
    expect(fuzzyMatch('README.md', 'readme')?.positions).toEqual([0, 1, 2, 3, 4, 5]);
    expect(fuzzyMatch('web/app.tsx', 'APP')?.positions).toEqual([4, 5, 6]);
  });

  it('points at the letters that start words, not the first ones it meets', () => {
    // "ft" should light up File and Tree, not the "f" and the first "t" after it.
    expect(fuzzyMatch('web/components/file-tree.tsx', 'ft')?.positions).toEqual([15, 20]);
    expect(fuzzyMatch('useFileTree.ts', 'ft')?.positions).toEqual([3, 7]);
  });

  it('prefers letters that sit together over letters that are spread out', () => {
    const together = fuzzyMatch('config/routes.ts', 'route');
    const spread = fuzzyMatch('readme-old-utilities-test-end.md', 'route');
    expect(together?.score).toBeGreaterThan(spread?.score ?? Infinity);
  });
});

describe('rankPaths', () => {
  it('puts the best match first', () => {
    expect(ranked('app')[0]).toBe('web/app.tsx');
    expect(ranked('filetree')[0]).toBe('web/components/file-tree.tsx');
    expect(ranked('rows')[0]).toBe('web/lib/tree-rows.ts');
  });

  it('leaves out paths that do not match', () => {
    expect(ranked('readme')).toEqual(['README.md']);
    expect(ranked('zzz')).toEqual([]);
  });

  it('ignores spaces in the query', () => {
    expect(ranked('tab bar')[0]).toBe('web/components/tab-bar.tsx');
  });

  it('keeps the given order when nothing is typed, and honors the limit', () => {
    expect(ranked('', 2)).toEqual(['server/app.test.ts', 'server/app.ts']);
    expect(ranked('t', 3)).toHaveLength(3);
  });
});
