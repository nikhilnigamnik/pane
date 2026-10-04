import { useCallback, useEffect, useRef, useState } from 'react';

import type { FileContents } from '@/types/api';
import type { EditorTab, RevealRequest, TabKind, TextSelection } from '@/types/editor';
import { fetchFile, saveFile } from '@/web/lib/api';
import {
  createModel,
  disposeModel,
  getModel,
  moveModel,
  readModelValue,
  replaceModelValue,
} from '@/web/lib/models';
import { fileName, isSameOrInside, remapPath } from '@/web/lib/path';
import { isImagePath, previewKind } from '@/web/lib/preview';
import { subscribeToWorkspaceChanges } from '@/web/lib/workspace-events';

import { useLatest } from './use-latest';

export interface EditorTabsState {
  tabs: EditorTab[];
  activePath: string | null;
  activeTab: EditorTab | null;
  notice: string | null;
  isSaving: boolean;
  pendingCloseTab: EditorTab | null;
  revealRequest: RevealRequest | null;
  // Opens the file, or switches to its tab. With a selection the editor jumps to that text.
  openFile: (path: string, selection?: TextSelection) => Promise<void>;
  // Opens the file as a tab without switching to it. Resolves to false when it cannot be read.
  loadFile: (path: string) => Promise<boolean>;
  selectTab: (path: string) => void;
  setPreviewing: (path: string, isPreviewing: boolean) => void;
  syncDirtyState: (path: string) => void;
  saveTab: (path: string) => Promise<void>;
  overwriteTab: (path: string) => Promise<void>;
  reloadTab: (path: string) => Promise<void>;
  // Follows a file or folder that was renamed from this app.
  renamePaths: (fromPath: string, toPath: string) => void;
  // Closes the tabs of a deleted file or of everything inside a deleted folder, unsaved or not.
  closePaths: (path: string) => void;
  requestCloseTab: (path: string) => void;
  confirmPendingClose: () => void;
  cancelPendingClose: () => void;
  showNotice: (message: string) => void;
  dismissNotice: () => void;
}

// A version id no model ever has, which keeps a tab dirty until it is saved.
const NEVER_SAVED = -1;

// Returns the same array when nothing changes so React can skip the re-render. This matters
// because dirty state is re-checked on every keystroke.
function patchTab(tabs: EditorTab[], path: string, patch: Partial<EditorTab>): EditorTab[] {
  const index = tabs.findIndex((tab) => tab.path === path);
  const tab = tabs[index];
  if (!tab) return tabs;

  const keys = Object.keys(patch) as (keyof EditorTab)[];
  if (keys.every((key) => tab[key] === patch[key])) return tabs;
  return tabs.map((item, position) => (position === index ? { ...item, ...patch } : item));
}

function createTab(path: string, kind: TabKind, mtimeMs: number): EditorTab {
  return {
    path,
    name: fileName(path),
    kind,
    mtimeMs,
    isDirty: false,
    hasConflict: false,
    isPreviewing: false,
    revision: 0,
  };
}

export function useEditorTabs(): EditorTabsState {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingClosePath, setPendingClosePath] = useState<string | null>(null);
  const [revealRequest, setRevealRequest] = useState<RevealRequest | null>(null);

  // Monaco's version id at the last save or load. It returns to this value when edits are
  // undone, so a file that was changed and changed back counts as clean again.
  const savedVersions = useRef(new Map<string, number>());
  const latestSyncs = useRef(new Map<string, number>());
  const revealCount = useRef(0);
  const tabsRef = useLatest(tabs);
  const activePathRef = useLatest(activePath);

  const addTab = useCallback(
    (tab: EditorTab) => {
      setTabs((current) => (current.some((item) => item.path === tab.path) ? current : [...current, tab]));
      // With nothing on screen the new tab is shown, even when it was not asked for.
      if (activePathRef.current === null) setActivePath(tab.path);
      setNotice(null);
    },
    [activePathRef],
  );

  const loadFile = useCallback(
    async (path: string) => {
      if (tabsRef.current.some((tab) => tab.path === path)) return true;
      if (isImagePath(path)) {
        // A picture has no text to load. Its tab fetches the image when it is shown.
        addTab(createTab(path, 'image', 0));
        return true;
      }

      const result = await fetchFile(path);
      if (!result.success) {
        setNotice(result.error.message);
        return false;
      }
      const model = createModel(path, result.data.content);
      savedVersions.current.set(path, model.getAlternativeVersionId());
      addTab(createTab(path, 'text', result.data.mtimeMs));
      return true;
    },
    [addTab, tabsRef],
  );

  const openFile = useCallback(
    async (path: string, selection?: TextSelection) => {
      if (!(await loadFile(path))) return;
      setActivePath(path);
      if (!selection) return;

      revealCount.current += 1;
      setRevealRequest({ id: revealCount.current, path, ...selection });
      // The selected text only exists in the source, so a rendered preview steps aside.
      setTabs((current) => patchTab(current, path, { isPreviewing: false }));
    },
    [loadFile],
  );

  const setPreviewing = useCallback((path: string, isPreviewing: boolean) => {
    if (!previewKind(path)) return;
    setTabs((current) => patchTab(current, path, { isPreviewing }));
  }, []);

  const syncDirtyState = useCallback((path: string) => {
    const model = getModel(path);
    if (!model) return;
    const isDirty = model.getAlternativeVersionId() !== savedVersions.current.get(path);
    setTabs((current) => patchTab(current, path, { isDirty }));
  }, []);

  const writeTab = useCallback(
    async (path: string, shouldOverwrite: boolean) => {
      const tab = tabsRef.current.find((item) => item.path === path);
      const model = getModel(path);
      if (!tab || !model) return;

      const versionAtSave = model.getAlternativeVersionId();
      setIsSaving(true);
      const result = await saveFile({
        path,
        content: readModelValue(model),
        expectedMtimeMs: shouldOverwrite ? null : tab.mtimeMs,
      });
      setIsSaving(false);

      if (!result.success) {
        if (result.error.code === 'conflict') {
          setTabs((current) => patchTab(current, path, { hasConflict: true }));
          return;
        }
        setNotice(result.error.message);
        return;
      }

      savedVersions.current.set(path, versionAtSave);
      setTabs((current) =>
        patchTab(current, path, {
          mtimeMs: result.data.mtimeMs,
          hasConflict: false,
          // The user may have kept typing while the save was in flight.
          isDirty: model.getAlternativeVersionId() !== versionAtSave,
        }),
      );
      setNotice(null);
    },
    [tabsRef],
  );

  const saveTab = useCallback((path: string) => writeTab(path, false), [writeTab]);
  const overwriteTab = useCallback((path: string) => writeTab(path, true), [writeTab]);

  const applyDiskContent = useCallback((path: string, file: FileContents) => {
    const model = getModel(path);
    if (!model) return;

    // Identical text is left alone so the undo history survives.
    if (readModelValue(model) !== file.content) replaceModelValue(model, file.content);
    savedVersions.current.set(path, model.getAlternativeVersionId());
    setTabs((current) =>
      patchTab(current, path, { mtimeMs: file.mtimeMs, isDirty: false, hasConflict: false }),
    );
  }, []);

  const reloadTab = useCallback(
    async (path: string) => {
      const result = await fetchFile(path);
      if (!result.success) {
        setNotice(result.error.message);
        return;
      }

      applyDiskContent(path, result.data);
      setNotice(null);
    },
    [applyDiskContent],
  );

  // Brings an open tab in line with a file that changed on disk. Untouched tabs follow the
  // disk silently; tabs with unsaved edits keep them and show the conflict banner instead.
  const syncTabWithDisk = useCallback(
    async (path: string) => {
      const syncId = (latestSyncs.current.get(path) ?? 0) + 1;
      latestSyncs.current.set(path, syncId);
      const result = await fetchFile(path);
      // Changes can arrive in quick succession; an older answer must not replace a newer one.
      if (latestSyncs.current.get(path) !== syncId) return;
      // A file that is gone or unreadable stays open as it is. Saving it reports the problem.
      if (!result.success) return;

      const tab = tabsRef.current.find((item) => item.path === path);
      const model = getModel(path);
      // An unchanged modification time means the event came from this tab's own save.
      if (!tab || !model || result.data.mtimeMs === tab.mtimeMs) return;

      const hasUnsavedEdits = model.getAlternativeVersionId() !== savedVersions.current.get(path);
      if (hasUnsavedEdits && readModelValue(model) !== result.data.content) {
        setTabs((current) => patchTab(current, path, { hasConflict: true }));
        return;
      }
      applyDiskContent(path, result.data);
    },
    [applyDiskContent, tabsRef],
  );

  useEffect(() => {
    return subscribeToWorkspaceChanges((change) => {
      const changedPaths = new Set(change.paths);
      for (const tab of tabsRef.current) {
        if (!change.hasOverflowed && !changedPaths.has(tab.path)) continue;
        if (tab.kind === 'text') {
          void syncTabWithDisk(tab.path);
          continue;
        }
        // A picture has nothing to merge: a new revision makes its tab fetch it again.
        setTabs((current) => patchTab(current, tab.path, { revision: tab.revision + 1 }));
      }
    });
  }, [syncTabWithDisk, tabsRef]);

  const forgetPath = useCallback((path: string) => {
    savedVersions.current.delete(path);
    latestSyncs.current.delete(path);
  }, []);

  const renamePaths = useCallback(
    (fromPath: string, toPath: string) => {
      const moved = new Map<string, string>();

      for (const tab of tabsRef.current) {
        const newPath = remapPath(tab.path, fromPath, toPath);
        if (newPath === null) continue;
        moved.set(tab.path, newPath);
        if (tab.kind === 'image') continue;

        const model = moveModel(tab.path, newPath);
        // The text is unchanged, so a clean tab stays clean. A dirty one stays dirty until saved.
        if (model) savedVersions.current.set(newPath, tab.isDirty ? NEVER_SAVED : model.getAlternativeVersionId());
        forgetPath(tab.path);
      }
      if (moved.size === 0) return;

      setTabs((current) =>
        current.map((tab) => {
          const newPath = moved.get(tab.path);
          return newPath ? { ...tab, path: newPath, name: fileName(newPath) } : tab;
        }),
      );
      const active = activePathRef.current;
      if (active !== null && moved.has(active)) setActivePath(moved.get(active) ?? null);
    },
    [activePathRef, forgetPath, tabsRef],
  );

  const closeTabs = useCallback(
    (shouldClose: (tab: EditorTab) => boolean) => {
      const current = tabsRef.current;
      const remaining = current.filter((tab) => !shouldClose(tab));
      if (remaining.length === current.length) return;

      setTabs(remaining);
      const active = activePathRef.current;
      if (!remaining.some((tab) => tab.path === active)) {
        // The tab that took the closed one's place, or the last one when it was at the end.
        const index = current.findIndex((tab) => tab.path === active);
        const neighbor = current.slice(index).find((tab) => !shouldClose(tab)) ?? remaining.at(-1);
        setActivePath(neighbor?.path ?? null);
      }
      for (const tab of current) {
        if (!shouldClose(tab)) continue;
        disposeModel(tab.path);
        forgetPath(tab.path);
      }
    },
    [activePathRef, forgetPath, tabsRef],
  );

  const closePaths = useCallback(
    (path: string) => closeTabs((tab) => isSameOrInside(tab.path, path)),
    [closeTabs],
  );

  const requestCloseTab = useCallback(
    (path: string) => {
      const tab = tabsRef.current.find((item) => item.path === path);
      if (!tab) return;
      if (tab.isDirty) setPendingClosePath(path);
      else closeTabs((item) => item.path === path);
    },
    [closeTabs, tabsRef],
  );

  const confirmPendingClose = useCallback(() => {
    if (pendingClosePath) closeTabs((tab) => tab.path === pendingClosePath);
    setPendingClosePath(null);
  }, [closeTabs, pendingClosePath]);

  const cancelPendingClose = useCallback(() => setPendingClosePath(null), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  return {
    tabs,
    activePath,
    activeTab: tabs.find((tab) => tab.path === activePath) ?? null,
    notice,
    isSaving,
    pendingCloseTab: tabs.find((tab) => tab.path === pendingClosePath) ?? null,
    revealRequest,
    openFile,
    loadFile,
    selectTab: setActivePath,
    setPreviewing,
    syncDirtyState,
    saveTab,
    overwriteTab,
    reloadTab,
    renamePaths,
    closePaths,
    requestCloseTab,
    confirmPendingClose,
    cancelPendingClose,
    showNotice: setNotice,
    dismissNotice,
  };
}
