export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 7878;
export const DEV_API_PORT = 7879;
export const DEV_WEB_PORT = 5173;

// Requests are only accepted when addressed to one of these hostnames.
export const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'];

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
// A save body is JSON, so escaping can make it larger than the file itself.
export const MAX_SAVE_BODY_BYTES = MAX_FILE_BYTES * 3;
export const BINARY_SNIFF_BYTES = 8000;
export const MAX_PATH_LENGTH = 4096;

export const IGNORED_ENTRY_NAMES = ['.git', '.DS_Store'];

// Disk changes are collected for this long and sent to the browser as one batch.
export const WATCH_DEBOUNCE_MS = 100;
// Past this many paths in one batch (a dependency install, a branch switch) the batch says
// "everything may have changed" instead of listing them.
export const MAX_WATCH_BATCH_PATHS = 500;

// Folders that quick open and search leave out: dependencies and build output are large and
// rarely what someone is looking for. They can still be browsed in the file tree.
export const INDEX_SKIPPED_DIRECTORY_NAMES = [
  'node_modules',
  'dist',
  'build',
  'out',
  'target',
  'coverage',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  '.venv',
  '__pycache__',
];
// Past this many files the list is cut short and marked as incomplete.
export const MAX_INDEXED_FILES = 20000;

export const MAX_SEARCH_QUERY_LENGTH = 200;
// Past this many matches a search stops and marks its answer as incomplete.
export const MAX_SEARCH_MATCHES = 1000;
// Longest stretch of a matching line that is sent back as its preview.
export const SEARCH_PREVIEW_MAX_LENGTH = 200;
// How much of the line is kept in front of the match. It is short so that the match stays in
// view in a narrow results list.
export const SEARCH_PREVIEW_LEAD = 12;
// How many files a search reads at the same time.
export const SEARCH_CONCURRENCY = 8;

export const STATIC_DIR_NAME = 'web';
export const STATIC_INDEX_FILE = 'index.html';

export const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
};
export const FALLBACK_MIME_TYPE = 'application/octet-stream';
