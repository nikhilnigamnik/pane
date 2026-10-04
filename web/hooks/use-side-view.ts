import { useCallback, useEffect, useState } from 'react';

import type { EditorTab } from '@/types/editor';
import { isSameOrInside, remapPath } from '@/web/lib/path';
import { isImagePath, previewKind } from '@/web/lib/preview';

import type { EditorTabsState } from './use-editor-tabs';

export interface SideView {
  path: string;
  // Shows the rendered file instead of its source. Pictures are always shown rendered.
  isPreviewing: boolean;
}

export interface SideViewState {
  sideView: SideView | null;
  sideTab: EditorTab | null;
  // Opens a file in the right half. Resolves to false when the file cannot be opened.
  openToSide: (path: string, shouldPreview: boolean) => Promise<boolean>;
  closeSide: () => void;
  setSidePreviewing: (isPreviewing: boolean) => void;
  followRename: (fromPath: string, toPath: string) => void;
  followDelete: (path: string) => void;
}

// The second view to the right of the tabs. It shows a file that is also open as a tab, so
// both views share one Monaco model and edits in either appear in both.
export function useSideView(editorTabs: EditorTabsState): SideViewState {
  const [sideView, setSideView] = useState<SideView | null>(null);
  const { tabs, loadFile } = editorTabs;
  const sideTab = sideView ? (tabs.find((tab) => tab.path === sideView.path) ?? null) : null;

  // Closing the file's tab closes the side view too, since its text goes with the tab.
  const hasLostTab = sideView !== null && sideTab === null;
  useEffect(() => {
    if (hasLostTab) setSideView(null);
  }, [hasLostTab]);

  const openToSide = useCallback(
    async (path: string, shouldPreview: boolean) => {
      if (!(await loadFile(path))) return false;
      const canPreview = previewKind(path) !== null;
      setSideView({ path, isPreviewing: isImagePath(path) || (shouldPreview && canPreview) });
      return true;
    },
    [loadFile],
  );

  const closeSide = useCallback(() => setSideView(null), []);

  const setSidePreviewing = useCallback((isPreviewing: boolean) => {
    setSideView((current) => {
      if (!current || !previewKind(current.path)) return current;
      return { ...current, isPreviewing };
    });
  }, []);

  const followRename = useCallback((fromPath: string, toPath: string) => {
    setSideView((current) => {
      const path = current ? remapPath(current.path, fromPath, toPath) : null;
      return current && path ? { ...current, path } : current;
    });
  }, []);

  const followDelete = useCallback((path: string) => {
    setSideView((current) => (current && isSameOrInside(current.path, path) ? null : current));
  }, []);

  return { sideView, sideTab, openToSide, closeSide, setSidePreviewing, followRename, followDelete };
}
