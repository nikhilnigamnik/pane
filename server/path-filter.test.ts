import { describe, expect, it } from 'vitest';

import { createPathFilter } from './path-filter';

function kept(include: string, exclude: string, paths: string[]): string[] {
  return paths.filter(createPathFilter(include, exclude));
}

const PATHS = [
  'readme.md',
  'docs/guide.md',
  'src/index.ts',
  'src/index.test.ts',
  'src/lib/util.ts',
  'web/lib/path.ts',
  '.github/workflows/ci.yml',
];

describe('createPathFilter', () => {
  it('keeps everything when both lists are empty or blank', () => {
    expect(kept('', '', PATHS)).toEqual(PATHS);
    expect(kept(' , ', ' ', PATHS)).toEqual(PATHS);
  });

  it('matches a pattern without a slash against every file and folder name', () => {
    expect(kept('*.md', '', PATHS)).toEqual(['readme.md', 'docs/guide.md']);
    expect(kept('lib', '', PATHS)).toEqual(['src/lib/util.ts', 'web/lib/path.ts']);
    expect(kept('', '*.test.ts', PATHS)).not.toContain('src/index.test.ts');
  });

  it('matches a pattern with a slash against the path, covering a named folder', () => {
    expect(kept('src/lib', '', PATHS)).toEqual(['src/lib/util.ts']);
    expect(kept('src/**/*.ts', '', PATHS)).toEqual([
      'src/index.ts',
      'src/index.test.ts',
      'src/lib/util.ts',
    ]);
    expect(kept('./web/', '', PATHS)).toEqual(['web/lib/path.ts']);
    expect(kept('/docs', '', PATHS)).toEqual(['docs/guide.md']);
  });

  it('includes hidden folders', () => {
    expect(kept('*.yml', '', PATHS)).toEqual(['.github/workflows/ci.yml']);
  });

  it('lets exclude win over include', () => {
    expect(kept('src', '*.test.ts, lib', PATHS)).toEqual(['src/index.ts']);
  });
});
