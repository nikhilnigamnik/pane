import { useCallback, useEffect, useRef, useState } from 'react';

import type { TreeEntry } from '@/types/api';
import { fetchTree } from '@/web/lib/api';
import { ROOT_PATH, isSameOrInside, parentPath, remapPath } from '@/web/lib/path';
import { subscribeToWorkspaceChanges } from '@/web/lib/workspace-events';

import { useLatest } from './use-latest';

export interface FileTreeState {
  childrenByPath: Record<string, TreeEntry[]>;
  expandedPaths: ReadonlySet<string>;
  // The row used last. New files and folders go next to it, and Tab returns to it.
  focusedPath: string | null;
  error: string | null;
  toggleDirectory: (path: string) => void;
  // Opens a folder and every folder above it, so something inside it can be seen.
  expandDirectory: (path: string) => void;
  setFocusedPath: (path: string | null) => void;
  reloadDirectory: (path: string) => Promise<void>;
  // Follows a file or folder that was renamed from this app, keeping open folders open.
  renamePaths: (fromPath: string, toPath: string) => void;
  refresh: () => Promise<void>;
}

function ancestors(path: string): string[] {
  const folders: string[] = [];
  for (let folder = path; folder !== ROOT_PATH; folder = parentPath(folder)) folders.push(folder);
  return folders;
}

// Folders are loaded one level at a time, when expanded, so large projects open instantly.
export function useFileTree(): FileTreeState {
  const [childrenByPath, setChildrenByPath] = useState<Record<string, TreeEntry[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<ReadonlySet<string>>(() => new Set());
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const expandedRef = useLatest(expandedPaths);
  const latestRequests = useRef(new Map<string, number>());

  const loadDirectory = useCallback(async (path: string) => {
    const requestId = (latestRequests.current.get(path) ?? 0) + 1;
    latestRequests.current.set(path, requestId);
    const result = await fetchTree(path);
    // Disk changes can trigger several loads of one folder; only the newest answer is kept.
    if (latestRequests.current.get(path) !== requestId) return;
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    setError(null);
    setChildrenByPath((current) => ({ ...current, [path]: result.data }));
  }, []);

  useEffect(() => {
    void loadDirectory(ROOT_PATH);
  }, [loadDirectory]);

  const toggleDirectory = useCallback(
    (path: string) => {
      const isExpanding = !expandedRef.current.has(path);
      setExpandedPaths((current) => {
        const next = new Set(current);
        if (isExpanding) next.add(path);
        else next.delete(path);
        return next;
      });
      if (isExpanding) void loadDirectory(path);
    },
    [expandedRef, loadDirectory],
  );

  const expandDirectory = useCallback(
    (path: string) => {
      const folders = ancestors(path).filter((folder) => !expandedRef.current.has(folder));
      if (folders.length === 0) return;
      setExpandedPaths((current) => new Set([...current, ...folders]));
      for (const folder of folders) void loadDirectory(folder);
    },
    [expandedRef, loadDirectory],
  );

  const renamePaths = useCallback(
    (fromPath: string, toPath: string) => {
      const expanded = [...expandedRef.current].map((path) => remapPath(path, fromPath, toPath) ?? path);
      setExpandedPaths(new Set(expanded));
      setFocusedPath((current) => (current === null ? null : (remapPath(current, fromPath, toPath) ?? current)));
      // The moved folders are read again under their new names, along with both parents.
      const stale = expanded.filter((path) => isSameOrInside(path, toPath));
      for (const path of new Set([parentPath(fromPath), parentPath(toPath), ...stale])) {
        void loadDirectory(path);
      }
    },
    [expandedRef, loadDirectory],
  );

  // Keeps the folders on screen current when files are created, renamed or removed on disk.
  useEffect(() => {
    return subscribeToWorkspaceChanges((change) => {
      const loadedPaths = [ROOT_PATH, ...expandedRef.current];
      const changedFolders = new Set(change.paths.map(parentPath));
      const stalePaths = change.hasOverflowed
        ? loadedPaths
        : loadedPaths.filter((path) => changedFolders.has(path));
      for (const path of stalePaths) void loadDirectory(path);
    });
  }, [expandedRef, loadDirectory]);

  // Disk changes already keep open folders current, so the button is a way to start over:
  // every folder closes and the top level is read again.
  const refresh = useCallback(async () => {
    setExpandedPaths(new Set());
    await loadDirectory(ROOT_PATH);
  }, [loadDirectory]);

  return {
    childrenByPath,
    expandedPaths,
    focusedPath,
    error,
    toggleDirectory,
    expandDirectory,
    setFocusedPath,
    reloadDirectory: loadDirectory,
    renamePaths,
    refresh,
  };
}
