import { useEffect } from 'react';

import { SHORTCUTS } from '@/config/shortcuts';
import type { Shortcut } from '@/config/shortcuts';
import { matchesShortcut } from '@/web/lib/shortcuts';

import { useLatest } from './use-latest';

interface ShortcutHandlers {
  onSave: () => void;
  onQuickOpen: () => void;
  onCommandPalette: () => void;
  onSearch: () => void;
  onTogglePreview: () => void;
  onGoToLine: () => void;
  onGoToSymbol: () => void;
  onOpenToSide: () => void;
}

const HANDLER_BY_SHORTCUT: [Shortcut, keyof ShortcutHandlers][] = [
  [SHORTCUTS.SAVE, 'onSave'],
  [SHORTCUTS.QUICK_OPEN, 'onQuickOpen'],
  [SHORTCUTS.COMMAND_PALETTE, 'onCommandPalette'],
  [SHORTCUTS.SEARCH, 'onSearch'],
  [SHORTCUTS.TOGGLE_PREVIEW, 'onTogglePreview'],
  [SHORTCUTS.GO_TO_LINE, 'onGoToLine'],
  [SHORTCUTS.GO_TO_SYMBOL, 'onGoToSymbol'],
  [SHORTCUTS.OPEN_TO_SIDE, 'onOpenToSide'],
];

export function useGlobalShortcuts(handlers: ShortcutHandlers): void {
  const latestHandlers = useLatest(handlers);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const match = HANDLER_BY_SHORTCUT.find(([shortcut]) => matchesShortcut(event, shortcut));
      if (!match) return;

      // Without this the browser runs its own action for the keys (save page, print).
      event.preventDefault();
      // Monaco binds some of the same keys. Stopping here keeps an action from running twice,
      // which for a picker means opening and closing it again.
      event.stopPropagation();
      latestHandlers.current[match[1]]();
    }

    // Capturing lets the shortcuts work while the editor has the keyboard.
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [latestHandlers]);
}
