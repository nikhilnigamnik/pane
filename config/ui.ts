export const ICON_SIZE = 16;
export const ICON_SIZE_SMALL = 14;
export const ICON_STROKE_WIDTH = 1.5;

export const MAC_PLATFORM_PATTERN = /Mac|iPhone|iPad/;

export const QUICK_OPEN_MAX_RESULTS = 50;

export const SEARCH_MIN_QUERY_LENGTH = 2;
// How long typing must pause before a search is sent.
export const SEARCH_DEBOUNCE_MS = 250;

export const MARKDOWN_CODE_TAB_SIZE = 2;

// A table preview draws at most this many rows. Sorting still covers every row.
export const MAX_TABLE_ROWS = 1000;
// How deep the JSON tree is open at first, and how deep "Expand all" goes.
export const JSON_DEFAULT_EXPAND_DEPTH = 2;
export const JSON_EXPAND_ALL_DEPTH = 32;
// An object or array lists this many entries, then offers to show more.
export const JSON_CHILDREN_PAGE_SIZE = 200;

export const SIDEBAR_DEFAULT_WIDTH = 256;
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 560;
// How far one arrow key press moves the sidebar edge.
export const SIDEBAR_KEYBOARD_STEP = 16;
export const SIDEBAR_WIDTH_STORAGE_KEY = 'pane-sidebar-width';
// Must match the w-(--sidebar-width) class on the sidebar.
export const SIDEBAR_WIDTH_VARIABLE = '--sidebar-width';
