export type EntryKind = 'file' | 'directory';

export interface TreeEntry {
  name: string;
  path: string;
  kind: EntryKind;
}

export interface WorkspaceMeta {
  name: string;
  rootPath: string;
}

export interface FileContents {
  path: string;
  content: string;
  mtimeMs: number;
}

export interface SaveRequest {
  path: string;
  content: string;
  // null skips the "changed on disk" check and overwrites.
  expectedMtimeMs: number | null;
}

export interface SaveResult {
  mtimeMs: number;
}

export interface FileIndex {
  // Workspace-relative paths of every file that quick open and search cover.
  paths: string[];
  // The folder holds more files than are listed.
  isTruncated: boolean;
}

export interface SearchMatch {
  // Both count from 1, the way editors do.
  line: number;
  column: number;
  length: number;
  // The part of the matching line around the match, without the line's indentation.
  preview: string;
  // Where the match starts inside `preview`.
  previewOffset: number;
  // Text in front of the preview was left out to keep the match near its start.
  isClippedAtStart: boolean;
}

export interface SearchFileResult {
  path: string;
  matches: SearchMatch[];
}

export interface SearchResults {
  files: SearchFileResult[];
  matchCount: number;
  // There are more matches, or more files, than this answer covers.
  isTruncated: boolean;
}

export interface WorkspaceChange {
  // Workspace-relative paths that were created, changed or removed.
  paths: string[];
  // Too much changed at once to list, so everything on screen should be re-checked.
  hasOverflowed: boolean;
}

export type ApiErrorCode =
  | 'invalid_request'
  | 'forbidden'
  | 'outside_workspace'
  | 'not_found'
  | 'not_a_file'
  | 'not_a_directory'
  | 'too_large'
  | 'binary'
  | 'not_an_image'
  | 'unsupported_encoding'
  | 'conflict'
  | 'io_error';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
}

export type Result<T> = { success: true; data: T } | { success: false; error: ApiError };
