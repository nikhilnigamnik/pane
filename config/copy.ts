import { APP_NAME } from './site';

export const COPY = {
  REFRESH_TREE: 'Refresh file list',
  RESIZE_SIDEBAR: 'Resize sidebar',
  EMPTY_FOLDER: 'Empty folder',
  LOADING: 'Loading...',
  FILE_TREE_LABEL: 'Files',

  EMPTY_STATE_TITLE: 'No file open',
  EMPTY_STATE_HINT: 'Pick a file from the sidebar to view or edit it.',
  SHORTCUT_HINT_QUICK_OPEN: 'to go to a file',
  SHORTCUT_HINT_SEARCH: 'to search in files',
  SHORTCUT_HINT_SAVE: 'to save',
  MODIFIER_KEY_MAC: '⌘',
  MODIFIER_KEY_OTHER: 'Ctrl',
  SHIFT_KEY_MAC: '⇧',
  SHIFT_KEY_OTHER: 'Shift',
  WITH_SHORTCUT: (label: string, shortcut: string) => `${label} (${shortcut})`,

  QUICK_OPEN: 'Go to file',
  QUICK_OPEN_PLACEHOLDER: 'Type a file name',
  QUICK_OPEN_RESULTS_LABEL: 'Matching files',
  QUICK_OPEN_EMPTY: 'No matching files',
  QUICK_OPEN_TRUNCATED: 'This folder has more files than can be listed, so some are missing.',

  SEARCH: 'Search in files',
  SEARCH_MATCH_CASE: 'Match case',
  SEARCH_RESULTS_LABEL: 'Search results',
  SEARCH_TOO_SHORT: (minLength: number) => `Type at least ${minLength} characters.`,
  SEARCHING: 'Searching...',
  SEARCH_NO_RESULTS: 'No results',
  SEARCH_SUMMARY: (matchCount: number, fileCount: number) =>
    `${matchCount} ${matchCount === 1 ? 'result' : 'results'} in ${fileCount} ${fileCount === 1 ? 'file' : 'files'}`,
  // Stands in for the start of a line that was left out of a search result.
  SEARCH_CLIPPED: '…',
  SEARCH_TRUNCATED: 'Only the first results are shown. Narrow the search to see the rest.',

  SHOW_PREVIEW: 'Preview',
  SHOW_SOURCE: 'Source',
  IMAGE_DIMENSIONS: (width: number, height: number) => `${width} x ${height}`,
  IMAGE_FAILED: 'This image could not be shown.',

  OPEN_TABS_LABEL: 'Open files',
  CLOSE_TAB: (name: string) => `Close ${name}`,
  UNSAVED_BADGE: 'Unsaved changes',

  STATUS_SAVED: 'Saved',
  STATUS_UNSAVED: 'Unsaved',
  STATUS_SAVING: 'Saving...',
  CURSOR_POSITION: (line: number, column: number) => `Ln ${line}, Col ${column}`,

  CONFLICT_MESSAGE: 'This file changed on disk after you opened it.',
  CONFLICT_RELOAD: 'Reload from disk',
  CONFLICT_OVERWRITE: 'Overwrite',
  DISMISS: 'Dismiss',

  DISCARD_TITLE: 'Discard unsaved changes?',
  DISCARD_DESCRIPTION: (name: string) =>
    `Your changes to ${name} will be lost if you close it without saving.`,
  DISCARD_CONFIRM: 'Discard changes',
  CANCEL: 'Cancel',

  SERVER_UNREACHABLE: `Could not reach the ${APP_NAME} server. Is it still running?`,
  PAGE_TITLE: (workspaceName: string) => `${workspaceName} - ${APP_NAME}`,
} as const;
