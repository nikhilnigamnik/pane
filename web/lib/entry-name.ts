import { COPY } from '@/config/copy';
import { IGNORED_ENTRY_NAMES } from '@/config/server';

const PATH_SEPARATOR = /[/\\]/;
const RESERVED_NAMES = ['.', '..', ...IGNORED_ENTRY_NAMES];

// Names are trimmed, as in other editors: spaces at either end are almost always a typo.
export function normalizeEntryName(name: string): string {
  return name.trim();
}

// Returns why a new file or folder name is not allowed, or null when it is fine.
export function entryNameError(name: string): string | null {
  const normalized = normalizeEntryName(name);
  if (normalized === '') return COPY.NAME_EMPTY;
  if (PATH_SEPARATOR.test(normalized)) return COPY.NAME_HAS_SEPARATOR;
  if (RESERVED_NAMES.includes(normalized)) return COPY.NAME_RESERVED;
  return null;
}

// The part of a file name to select for renaming: everything before the extension, so typing
// replaces the name and keeps ".ts". Hidden files (".env") and folders select everything.
export function nameSelectionEnd(name: string, isDirectory: boolean): number {
  const dotIndex = name.lastIndexOf('.');
  return isDirectory || dotIndex <= 0 ? name.length : dotIndex;
}
