import { useCallback, useEffect, useRef, useState } from 'react';

import type { TreeEntry } from '@/types/api';
import { fetchTree } from '@/web/lib/api';
import { ROOT_PATH, parentPath } from '@/web/lib/path';
import { subscribeToWorkspaceChanges } from '@/web/lib/workspace-events';

import { useLatest } from './use-latest';

export interface FileTreeState {
  childrenByPath: Record<string, TreeEntry[]>;
  expandedPaths: ReadonlySet<string>;
  error: string | null;
  toggleDirectory: (path: string) => void;
  refresh: () => Promise<void>;
}

// Folders are loaded one level at a time, when expanded, so large projects open instantly.
export function useFileTree(): FileTreeState {
  const [childrenByPath, setChildrenByPath] = useState<Record<string, TreeEntry[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<ReadonlySet<string>>(() => new Set());
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

  return { childrenByPath, expandedPaths, error, toggleDirectory, refresh };
}
