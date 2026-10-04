import { COPY } from '@/config/copy';
import { SHORTCUTS } from '@/config/shortcuts';
import type { Command } from '@/types/ui';

export interface CommandActions {
  quickOpen: () => void;
  search: () => void;
  showFiles: () => void;
  save: () => void;
  togglePreview: () => void;
  goToLine: () => void;
  goToSymbol: () => void;
  openToSide: () => void;
  closeSideView: () => void;
  newFile: () => void;
  newFolder: () => void;
  renameFile: () => void;
  deleteFile: () => void;
  closeTab: () => void;
  refreshFiles: () => void;
  reloadFromDisk: () => void;
}

export interface CommandContext {
  // A text file is in the view used last (not a picture).
  hasTextFile: boolean;
  // A file of any kind is in the view used last.
  hasFile: boolean;
  canPreview: boolean;
  hasSideView: boolean;
  hasConflict: boolean;
  actions: CommandActions;
}

interface CommandEntry extends Command {
  isAvailable: boolean;
}

// Every command, in the order the palette lists them before anything is typed. Commands that
// cannot run right now (saving with no file open) are left out rather than shown disabled.
export function buildCommands({
  hasTextFile,
  hasFile,
  canPreview,
  hasSideView,
  hasConflict,
  actions,
}: CommandContext): Command[] {
  const entries: CommandEntry[] = [
    { id: 'quick-open', label: COPY.QUICK_OPEN, shortcut: SHORTCUTS.QUICK_OPEN, run: actions.quickOpen, isAvailable: true },
    { id: 'search', label: COPY.SEARCH, shortcut: SHORTCUTS.SEARCH, run: actions.search, isAvailable: true },
    { id: 'show-files', label: COPY.COMMAND_SHOW_FILES, run: actions.showFiles, isAvailable: true },
    { id: 'save', label: COPY.COMMAND_SAVE, shortcut: SHORTCUTS.SAVE, run: actions.save, isAvailable: hasTextFile },
    { id: 'go-to-line', label: COPY.GO_TO_LINE, shortcut: SHORTCUTS.GO_TO_LINE, run: actions.goToLine, isAvailable: hasTextFile },
    { id: 'go-to-symbol', label: COPY.GO_TO_SYMBOL, shortcut: SHORTCUTS.GO_TO_SYMBOL, run: actions.goToSymbol, isAvailable: hasTextFile },
    { id: 'toggle-preview', label: COPY.COMMAND_TOGGLE_PREVIEW, shortcut: SHORTCUTS.TOGGLE_PREVIEW, run: actions.togglePreview, isAvailable: canPreview },
    { id: 'open-to-side', label: COPY.OPEN_TO_SIDE, shortcut: SHORTCUTS.OPEN_TO_SIDE, run: actions.openToSide, isAvailable: hasFile },
    { id: 'close-side-view', label: COPY.CLOSE_SIDE_VIEW, run: actions.closeSideView, isAvailable: hasSideView },
    { id: 'reload-from-disk', label: COPY.COMMAND_RELOAD_FROM_DISK, run: actions.reloadFromDisk, isAvailable: hasConflict },
    { id: 'new-file', label: COPY.NEW_FILE, run: actions.newFile, isAvailable: true },
    { id: 'new-folder', label: COPY.NEW_FOLDER, run: actions.newFolder, isAvailable: true },
    { id: 'rename-file', label: COPY.COMMAND_RENAME_FILE, run: actions.renameFile, isAvailable: hasFile },
    { id: 'delete-file', label: COPY.COMMAND_DELETE_FILE, run: actions.deleteFile, isAvailable: hasFile },
    { id: 'close-tab', label: COPY.COMMAND_CLOSE_TAB, run: actions.closeTab, isAvailable: hasFile },
    { id: 'refresh-files', label: COPY.REFRESH_TREE, run: actions.refreshFiles, isAvailable: true },
  ];

  return entries.filter((entry) => entry.isAvailable).map(({ isAvailable: _isAvailable, ...command }) => command);
}
