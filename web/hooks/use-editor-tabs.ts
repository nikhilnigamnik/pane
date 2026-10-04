import { useCallback, useEffect, useRef, useState } from 'react';

import type { FileContents } from '@/types/api';
import type { EditorTab, RevealRequest, TabKind, TextSelection } from '@/types/editor';
import { fetchFile, saveFile } from '@/web/lib/api';
import {
  createModel,
  disposeModel,
  getModel,
  readModelValue,
  replaceModelValue,
} from '@/web/lib/models';
import { fileName } from '@/web/lib/path';
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
  selectTab: (path: string) => void;
  toggleActivePreview: () => void;
  syncDirtyState: (path: string) => void;
  saveActiveTab: () => Promise<void>;
  overwriteActiveTab: () => Promise<void>;
  reloadActiveTab: () => Promise<void>;
  requestCloseTab: (path: string) => void;
  confirmPendingClose: () => void;
  cancelPendingClose: () => void;
  dismissNotice: () => void;
}

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

  const addTab = useCallback((tab: EditorTab) => {
    setTabs((current) => (current.some((item) => item.path === tab.path) ? current : [...current, tab]));
    setActivePath(tab.path);
    setNotice(null);
  }, []);

  const openFile = useCallback(
    async (path: string, selection?: TextSelection) => {
      const isOpen = tabsRef.current.some((tab) => tab.path === path);
      if (!isOpen && isImagePath(path)) {
        // A picture has no text to load. Its tab fetches the image when it is shown.
        addTab(createTab(path, 'image', 0));
        return;
      }

      if (!isOpen) {
        const result = await fetchFile(path);
        if (!result.success) {
          setNotice(result.error.message);
          return;
        }
        const model = createModel(path, result.data.content);
        savedVersions.current.set(path, model.getAlternativeVersionId());
        addTab(createTab(path, 'text', result.data.mtimeMs));
      }

      setActivePath(path);
      if (!selection) return;

      revealCount.current += 1;
      setRevealRequest({ id: revealCount.current, path, ...selection });
      // The selected text only exists in the source, so a rendered preview steps aside.
      setTabs((current) => patchTab(current, path, { isPreviewing: false }));
    },
    [addTab, tabsRef],
  );

  const toggleActivePreview = useCallback(() => {
    const tab = tabsRef.current.find((item) => item.path === activePathRef.current);
    if (!tab || tab.kind !== 'text' || !previewKind(tab.path)) return;
    setTabs((current) => patchTab(current, tab.path, { isPreviewing: !tab.isPreviewing }));
  }, [activePathRef, tabsRef]);

  const syncDirtyState = useCallback((path: string) => {
    const model = getModel(path);
    if (!model) return;
    const isDirty = model.getAlternativeVersionId() !== savedVersions.current.get(path);
    setTabs((current) => patchTab(current, path, { isDirty }));
  }, []);

  const saveTab = useCallback(
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

  const saveActiveTab = useCallback(async () => {
    const path = activePathRef.current;
    if (path) await saveTab(path, false);
  }, [activePathRef, saveTab]);

  const overwriteActiveTab = useCallback(async () => {
    const path = activePathRef.current;
    if (path) await saveTab(path, true);
  }, [activePathRef, saveTab]);

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

  const reloadActiveTab = useCallback(async () => {
    const path = activePathRef.current;
    if (!path) return;

    const result = await fetchFile(path);
    if (!result.success) {
      setNotice(result.error.message);
      return;
    }

    applyDiskContent(path, result.data);
    setNotice(null);
  }, [activePathRef, applyDiskContent]);

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

  const closeTab = useCallback(
    (path: string) => {
      const current = tabsRef.current;
      const index = current.findIndex((tab) => tab.path === path);
      if (index === -1) return;

      const remaining = current.filter((tab) => tab.path !== path);
      setTabs(remaining);
      if (activePathRef.current === path) {
        const neighbor = remaining[Math.min(index, remaining.length - 1)];
        setActivePath(neighbor?.path ?? null);
      }
      disposeModel(path);
      savedVersions.current.delete(path);
      latestSyncs.current.delete(path);
    },
    [activePathRef, tabsRef],
  );

  const requestCloseTab = useCallback(
    (path: string) => {
      const tab = tabsRef.current.find((item) => item.path === path);
      if (!tab) return;
      if (tab.isDirty) setPendingClosePath(path);
      else closeTab(path);
    },
    [closeTab, tabsRef],
  );

  const confirmPendingClose = useCallback(() => {
    if (pendingClosePath) closeTab(pendingClosePath);
    setPendingClosePath(null);
  }, [closeTab, pendingClosePath]);

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
    selectTab: setActivePath,
    toggleActivePreview,
    syncDirtyState,
    saveActiveTab,
    overwriteActiveTab,
    reloadActiveTab,
    requestCloseTab,
    confirmPendingClose,
    cancelPendingClose,
    dismissNotice,
  };
}
