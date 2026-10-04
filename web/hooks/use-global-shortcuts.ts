import { useEffect } from 'react';

import { SHORTCUTS } from '@/config/shortcuts';
import { matchesShortcut } from '@/web/lib/shortcuts';

import { useLatest } from './use-latest';

interface ShortcutHandlers {
  onSave: () => void;
  onQuickOpen: () => void;
  onSearch: () => void;
  onTogglePreview: () => void;
}

export function useGlobalShortcuts(handlers: ShortcutHandlers): void {
  const latestHandlers = useLatest(handlers);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const { onSave, onQuickOpen, onSearch, onTogglePreview } = latestHandlers.current;
      const handler = [
        { shortcut: SHORTCUTS.SAVE, run: onSave },
        { shortcut: SHORTCUTS.QUICK_OPEN, run: onQuickOpen },
        { shortcut: SHORTCUTS.SEARCH, run: onSearch },
        { shortcut: SHORTCUTS.TOGGLE_PREVIEW, run: onTogglePreview },
      ].find(({ shortcut }) => matchesShortcut(event, shortcut));
      if (!handler) return;

      // Without this the browser runs its own action for the keys (save page, print).
      event.preventDefault();
      handler.run();
    }

    // Capturing lets the shortcuts work while the editor has the keyboard.
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [latestHandlers]);
}
