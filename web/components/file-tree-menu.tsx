import { COPY } from '@/config/copy';
import { TREE_RENAME_KEY } from '@/config/shortcuts';
import type { EntryKind, TreeEntry } from '@/types/api';
import { ROOT_PATH } from '@/web/lib/path';
import { isMac } from '@/web/lib/shortcuts';

import { ContextMenuItem, ContextMenuSeparator } from './ui/context-menu';

interface FileTreeMenuProps {
  // The row that was right-clicked, or null for the empty space below the rows.
  entry: TreeEntry | null;
  onCreate: (kind: EntryKind, parentPath: string) => void;
  onRename: (entry: TreeEntry) => void;
  onDelete: (entry: TreeEntry) => void;
  onOpenToSide: (path: string) => void;
}

export function FileTreeMenu({ entry, onCreate, onRename, onDelete, onOpenToSide }: FileTreeMenuProps) {
  const folder = entry === null ? ROOT_PATH : entry.kind === 'directory' ? entry.path : null;

  return (
    <>
      {folder !== null && (
        <>
          <ContextMenuItem onSelect={() => onCreate('file', folder)}>{COPY.NEW_FILE}</ContextMenuItem>
          <ContextMenuItem onSelect={() => onCreate('directory', folder)}>{COPY.NEW_FOLDER}</ContextMenuItem>
        </>
      )}
      {entry?.kind === 'file' && (
        <ContextMenuItem onSelect={() => onOpenToSide(entry.path)}>{COPY.OPEN_TO_SIDE}</ContextMenuItem>
      )}
      {entry && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem shortcut={TREE_RENAME_KEY} onSelect={() => onRename(entry)}>
            {COPY.RENAME}
          </ContextMenuItem>
          <ContextMenuItem
            shortcut={isMac() ? COPY.DELETE_KEY_MAC : COPY.DELETE_KEY_OTHER}
            isDestructive
            onSelect={() => onDelete(entry)}
          >
            {COPY.DELETE}
          </ContextMenuItem>
        </>
      )}
    </>
  );
}
