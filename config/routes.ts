export const API_PREFIX = '/api';

export const API_ROUTES = {
  META: `${API_PREFIX}/meta`,
  TREE: `${API_PREFIX}/tree`,
  FILE: `${API_PREFIX}/file`,
  FILES: `${API_PREFIX}/files`,
  SEARCH: `${API_PREFIX}/search`,
  RAW: `${API_PREFIX}/raw`,
  CREATE: `${API_PREFIX}/create`,
  RENAME: `${API_PREFIX}/rename`,
  DELETE: `${API_PREFIX}/delete`,
  EVENTS: `${API_PREFIX}/events`,
} as const;

// Name of the server-sent event that reports files changing on disk.
export const CHANGE_EVENT_NAME = 'change';

// Query parameter the CLI uses to ask the UI to open a file on startup.
export const OPEN_FILE_PARAM = 'open';
