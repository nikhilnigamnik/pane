import { useCallback, useState } from 'react';

import type { EntryKind, TreeEntry } from '@/types/api';
import type { EditorTab } from '@/types/editor';
import { createEntry, deleteEntry, renameEntry } from '@/web/lib/api';
import { normalizeEntryName } from '@/web/lib/entry-name';
import { ROOT_PATH, isSameOrInside, joinPath, parentPath } from '@/web/lib/path';
import { findEntry } from '@/web/lib/tree-rows';

import type { EditorTabsState } from './use-editor-tabs';
import type { FileTreeState } from './use-file-tree';

export type FileActionDialog =
  | { kind: 'create'; parentPath: string; entryKind: EntryKind }
  | { kind: 'rename'; entry: TreeEntry }
  | { kind: 'delete'; entry: TreeEntry; hasUnsavedChanges: boolean };

interface FileActionsOptions {
  tree: FileTreeState;
  editorTabs: EditorTabsState;
  // Lets views outside the tabs (the side view) follow a rename or a delete.
  onRenamed: (fromPath: string, toPath: string) => void;
  onDeleted: (path: string) => void;
}

export interface FileActionsState {
  dialog: FileActionDialog | null;
  // Without a folder, the new entry goes next to the row used last in the tree.
  requestCreate: (entryKind: EntryKind, parentPath?: string) => void;
  requestRename: (entry: TreeEntry) => void;
  requestDelete: (entry: TreeEntry) => void;
  // Each resolves to an error to show in the dialog, or null when it is done.
  submitCreate: (name: string) => Promise<string | null>;
  submitRename: (name: string) => Promise<string | null>;
  confirmDelete: () => Promise<void>;
  cancel: () => void;
}

function hasUnsavedTabsInside(tabs: EditorTab[], path: string): boolean {
  return tabs.some((tab) => tab.isDirty && isSameOrInside(tab.path, path));
}

export function useFileActions({
  tree,
  editorTabs,
  onRenamed,
  onDeleted,
}: FileActionsOptions): FileActionsState {
  const [dialog, setDialog] = useState<FileActionDialog | null>(null);
  const { childrenByPath, focusedPath } = tree;

  const requestCreate = useCallback(
    (entryKind: EntryKind, folder?: string) => {
      const focused = focusedPath ? findEntry(childrenByPath, focusedPath) : null;
      const fallback = focused?.kind === 'directory' ? focused.path : parentPath(focused?.path ?? ROOT_PATH);
      setDialog({ kind: 'create', parentPath: folder ?? fallback, entryKind });
    },
    [childrenByPath, focusedPath],
  );

  const requestRename = useCallback((entry: TreeEntry) => setDialog({ kind: 'rename', entry }), []);

  const requestDelete = useCallback(
    (entry: TreeEntry) => {
      const hasUnsavedChanges = hasUnsavedTabsInside(editorTabs.tabs, entry.path);
      setDialog({ kind: 'delete', entry, hasUnsavedChanges });
    },
    [editorTabs.tabs],
  );

  const cancel = useCallback(() => setDialog(null), []);

  const submitCreate = useCallback(
    async (name: string) => {
      if (dialog?.kind !== 'create') return null;
      const path = joinPath(dialog.parentPath, normalizeEntryName(name));
      const result = await createEntry(path, dialog.entryKind);
      if (!result.success) return result.error.message;

      setDialog(null);
      await tree.reloadDirectory(dialog.parentPath);
      tree.expandDirectory(dialog.parentPath);
      tree.setFocusedPath(path);
      if (dialog.entryKind === 'file') await editorTabs.openFile(path);
      return null;
    },
    [dialog, editorTabs, tree],
  );

  const submitRename = useCallback(
    async (name: string) => {
      if (dialog?.kind !== 'rename') return null;
      const fromPath = dialog.entry.path;
      const toPath = joinPath(parentPath(fromPath), normalizeEntryName(name));
      if (toPath === fromPath) {
        setDialog(null);
        return null;
      }

      const result = await renameEntry(fromPath, toPath);
      if (!result.success) return result.error.message;

      setDialog(null);
      tree.renamePaths(fromPath, toPath);
      editorTabs.renamePaths(fromPath, toPath);
      onRenamed(fromPath, toPath);
      return null;
    },
    [dialog, editorTabs, onRenamed, tree],
  );

  const confirmDelete = useCallback(async () => {
    if (dialog?.kind !== 'delete') return;
    const { path } = dialog.entry;
    setDialog(null);

    const result = await deleteEntry(path);
    if (!result.success) {
      editorTabs.showNotice(result.error.message);
      return;
    }
    editorTabs.closePaths(path);
    onDeleted(path);
    if (focusedPath !== null && isSameOrInside(focusedPath, path)) tree.setFocusedPath(null);
    await tree.reloadDirectory(parentPath(path));
  }, [dialog, editorTabs, focusedPath, onDeleted, tree]);

  return {
    dialog,
    requestCreate,
    requestRename,
    requestDelete,
    submitCreate,
    submitRename,
    confirmDelete,
    cancel,
  };
}
