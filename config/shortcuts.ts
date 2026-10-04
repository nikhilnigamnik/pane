// "command" is Cmd on a Mac and Ctrl elsewhere. "control" is the Ctrl key everywhere.
export type ShortcutModifier = 'command' | 'control';

export interface Shortcut {
  // The key as KeyboardEvent.key reports it, in lower case.
  key: string;
  modifier: ShortcutModifier;
  hasShift: boolean;
}

export const SHORTCUTS = {
  SAVE: { key: 's', modifier: 'command', hasShift: false },
  QUICK_OPEN: { key: 'p', modifier: 'command', hasShift: false },
  SEARCH: { key: 'f', modifier: 'command', hasShift: true },
  TOGGLE_PREVIEW: { key: 'v', modifier: 'command', hasShift: true },
  // Ctrl+G on every platform, as in VS Code: Cmd+G is "find next" on a Mac.
  GO_TO_LINE: { key: 'g', modifier: 'control', hasShift: false },
  GO_TO_SYMBOL: { key: 'o', modifier: 'command', hasShift: true },
  OPEN_TO_SIDE: { key: '\\', modifier: 'command', hasShift: false },
  COMMAND_PALETTE: { key: 'p', modifier: 'command', hasShift: true },
} as const satisfies Record<string, Shortcut>;

// Keys that act on the focused row of the file tree.
export const TREE_RENAME_KEY = 'F2';
export const TREE_DELETE_KEYS = ['Delete'];
// Cmd+Backspace deletes on a Mac, where there is usually no Delete key.
export const TREE_DELETE_KEY_WITH_COMMAND = 'Backspace';
