export interface Shortcut {
  // The letter, in lower case, pressed together with Cmd on a Mac or Ctrl elsewhere.
  key: string;
  hasShift: boolean;
}

export const SHORTCUTS = {
  SAVE: { key: 's', hasShift: false },
  QUICK_OPEN: { key: 'p', hasShift: false },
  SEARCH: { key: 'f', hasShift: true },
  TOGGLE_PREVIEW: { key: 'v', hasShift: true },
} as const satisfies Record<string, Shortcut>;
