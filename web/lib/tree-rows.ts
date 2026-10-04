import type { TreeEntry } from '@/types/api';

import { ROOT_PATH } from './path';

export interface TreeRow {
  entry: TreeEntry;
  // The folder row this one sits under, or null at the top level.
  parentPath: string | null;
}

export type TreeKeyAction = { kind: 'focus'; path: string } | { kind: 'toggle'; path: string };

// The rows currently on screen, top to bottom: every entry whose parent folders are all open.
export function visibleRows(
  childrenByPath: Record<string, TreeEntry[]>,
  expandedPaths: ReadonlySet<string>,
): TreeRow[] {
  const rows: TreeRow[] = [];

  function addLevel(folderPath: string, parentRowPath: string | null): void {
    for (const entry of childrenByPath[folderPath] ?? []) {
      rows.push({ entry, parentPath: parentRowPath });
      if (entry.kind === 'directory' && expandedPaths.has(entry.path)) {
        addLevel(entry.path, entry.path);
      }
    }
  }

  addLevel(ROOT_PATH, null);
  return rows;
}

// What a key press on a row should do, following the usual tree keys: up and down move
// between rows, right opens a folder and then steps into it, left closes a folder and then
// steps out to its parent. Returns null for keys the tree does not handle.
export function treeKeyAction(
  rows: TreeRow[],
  expandedPaths: ReadonlySet<string>,
  path: string,
  key: string,
): TreeKeyAction | null {
  const index = rows.findIndex((row) => row.entry.path === path);
  const row = rows[index];
  if (!row) return null;

  function focusAt(target: number): TreeKeyAction {
    const clamped = Math.min(Math.max(target, 0), rows.length - 1);
    return { kind: 'focus', path: rows[clamped]?.entry.path ?? path };
  }

  const isDirectory = row.entry.kind === 'directory';
  const isExpanded = isDirectory && expandedPaths.has(path);

  switch (key) {
    case 'ArrowDown':
      return focusAt(index + 1);
    case 'ArrowUp':
      return focusAt(index - 1);
    case 'Home':
      return focusAt(0);
    case 'End':
      return focusAt(rows.length - 1);
    case 'ArrowRight': {
      if (!isDirectory) return focusAt(index);
      if (!isExpanded) return { kind: 'toggle', path };
      // The next row is this folder's first child, unless the folder is empty or still loading.
      return rows[index + 1]?.parentPath === path ? focusAt(index + 1) : focusAt(index);
    }
    case 'ArrowLeft': {
      if (isExpanded) return { kind: 'toggle', path };
      return { kind: 'focus', path: row.parentPath ?? path };
    }
    default:
      return null;
  }
}

// The entry at a path among the folders loaded so far, or null when it is not loaded.
export function findEntry(
  childrenByPath: Record<string, TreeEntry[]>,
  path: string,
): TreeEntry | null {
  for (const entries of Object.values(childrenByPath)) {
    const entry = entries.find((item) => item.path === path);
    if (entry) return entry;
  }
  return null;
}
