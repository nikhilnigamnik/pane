import { COPY } from '@/config/copy';
import type { Shortcut } from '@/config/shortcuts';
import { MAC_PLATFORM_PATTERN } from '@/config/ui';

export function isMac(): boolean {
  return MAC_PLATFORM_PATTERN.test(navigator.platform);
}

export function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
  // Ctrl on a Mac belongs to the text keys (Ctrl+P moves the cursor up a line), so only Cmd
  // counts there.
  const hasModifier = isMac()
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;

  return (
    hasModifier &&
    !event.altKey &&
    event.shiftKey === shortcut.hasShift &&
    event.key.toLowerCase() === shortcut.key
  );
}

// The keys to press, one entry per key cap.
export function shortcutKeys(shortcut: Shortcut): string[] {
  const keys: string[] = [isMac() ? COPY.MODIFIER_KEY_MAC : COPY.MODIFIER_KEY_OTHER];
  if (shortcut.hasShift) keys.push(isMac() ? COPY.SHIFT_KEY_MAC : COPY.SHIFT_KEY_OTHER);
  return [...keys, shortcut.key.toUpperCase()];
}

// Mac symbols sit side by side; key names elsewhere are joined with a plus sign.
export function shortcutLabel(shortcut: Shortcut): string {
  return shortcutKeys(shortcut).join(isMac() ? '' : '+');
}
