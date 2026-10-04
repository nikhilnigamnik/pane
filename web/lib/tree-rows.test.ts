import { describe, expect, it } from 'vitest';

import type { TreeEntry } from '@/types/api';

import { treeKeyAction, visibleRows } from './tree-rows';

function directory(path: string): TreeEntry {
  return { name: path.slice(path.lastIndexOf('/') + 1), path, kind: 'directory' };
}

function file(path: string): TreeEntry {
  return { name: path.slice(path.lastIndexOf('/') + 1), path, kind: 'file' };
}

const CHILDREN: Record<string, TreeEntry[]> = {
  '': [directory('docs'), directory('src'), file('readme.md')],
  docs: [],
  src: [directory('src/lib'), file('src/main.ts')],
  'src/lib': [file('src/lib/util.ts')],
};

const EXPANDED = new Set(['src']);
const ROWS = visibleRows(CHILDREN, EXPANDED);

function act(path: string, key: string, expanded: ReadonlySet<string> = EXPANDED) {
  return treeKeyAction(visibleRows(CHILDREN, expanded), expanded, path, key);
}

describe('visibleRows', () => {
  it('lists entries top to bottom, going into open folders only', () => {
    expect(ROWS.map((row) => row.entry.path)).toEqual([
      'docs',
      'src',
      'src/lib',
      'src/main.ts',
      'readme.md',
    ]);
  });

  it('records the folder each row sits under', () => {
    expect(ROWS.map((row) => row.parentPath)).toEqual([null, null, 'src', 'src', null]);
  });

  it('skips an open folder whose contents have not loaded yet', () => {
    const rows = visibleRows({ '': [directory('src')] }, new Set(['src']));
    expect(rows.map((row) => row.entry.path)).toEqual(['src']);
  });
});

describe('treeKeyAction', () => {
  it('moves up and down and stops at the ends', () => {
    expect(act('src', 'ArrowDown')).toEqual({ kind: 'focus', path: 'src/lib' });
    expect(act('src', 'ArrowUp')).toEqual({ kind: 'focus', path: 'docs' });
    expect(act('docs', 'ArrowUp')).toEqual({ kind: 'focus', path: 'docs' });
    expect(act('readme.md', 'ArrowDown')).toEqual({ kind: 'focus', path: 'readme.md' });
  });

  it('jumps to the first and last row', () => {
    expect(act('src/main.ts', 'Home')).toEqual({ kind: 'focus', path: 'docs' });
    expect(act('src/main.ts', 'End')).toEqual({ kind: 'focus', path: 'readme.md' });
  });

  it('opens a closed folder, then steps into an open one', () => {
    expect(act('src/lib', 'ArrowRight')).toEqual({ kind: 'toggle', path: 'src/lib' });
    expect(act('src', 'ArrowRight')).toEqual({ kind: 'focus', path: 'src/lib' });
  });

  it('stays put when stepping into an empty folder or a file', () => {
    const expanded = new Set(['docs', 'src']);
    expect(act('docs', 'ArrowRight', expanded)).toEqual({ kind: 'focus', path: 'docs' });
    expect(act('readme.md', 'ArrowRight')).toEqual({ kind: 'focus', path: 'readme.md' });
  });

  it('closes an open folder, then steps out to the parent', () => {
    expect(act('src', 'ArrowLeft')).toEqual({ kind: 'toggle', path: 'src' });
    expect(act('src/main.ts', 'ArrowLeft')).toEqual({ kind: 'focus', path: 'src' });
    expect(act('src/lib', 'ArrowLeft')).toEqual({ kind: 'focus', path: 'src' });
    expect(act('readme.md', 'ArrowLeft')).toEqual({ kind: 'focus', path: 'readme.md' });
  });

  it('ignores other keys and rows that are not on screen', () => {
    expect(act('src', 'a')).toBeNull();
    expect(act('src', 'Enter')).toBeNull();
    expect(act('src/lib/util.ts', 'ArrowDown')).toBeNull();
  });
});
