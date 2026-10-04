import { COPY } from '@/config/copy';
import { API_ROUTES } from '@/config/routes';
import type {
  ApiError,
  EntryKind,
  FileContents,
  FileIndex,
  Result,
  SaveRequest,
  SaveResult,
  SearchOptions,
  SearchResults,
  TreeEntry,
  WorkspaceMeta,
} from '@/types/api';

const UNREACHABLE: ApiError = { code: 'io_error', message: COPY.SERVER_UNREACHABLE };

async function request<T>(url: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const response = await fetch(url, init);
    // Every API route answers with a Result, including on error statuses.
    const body: unknown = await response.json();
    return body as Result<T>;
  } catch {
    return { success: false, error: UNREACHABLE };
  }
}

function withPath(route: string, path: string): string {
  return `${route}?${new URLSearchParams({ path })}`;
}

export function fetchMeta(): Promise<Result<WorkspaceMeta>> {
  return request(API_ROUTES.META);
}

export function fetchTree(path: string): Promise<Result<TreeEntry[]>> {
  return request(withPath(API_ROUTES.TREE, path));
}

export function fetchFile(path: string): Promise<Result<FileContents>> {
  return request(withPath(API_ROUTES.FILE, path));
}

export function saveFile(body: SaveRequest): Promise<Result<SaveResult>> {
  return request(API_ROUTES.FILE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function fetchFiles(): Promise<Result<FileIndex>> {
  return request(API_ROUTES.FILES);
}

export function searchFiles(
  options: SearchOptions,
  signal: AbortSignal,
): Promise<Result<SearchResults>> {
  const params = new URLSearchParams({
    query: options.query,
    isCaseSensitive: String(options.isCaseSensitive),
    isWholeWord: String(options.isWholeWord),
    isRegex: String(options.isRegex),
    include: options.include,
    exclude: options.exclude,
  });
  return request(`${API_ROUTES.SEARCH}?${params}`, { signal });
}

function postJson<T>(route: string, body: unknown): Promise<Result<T>> {
  return request(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function createEntry(path: string, kind: EntryKind): Promise<Result<TreeEntry>> {
  return postJson(API_ROUTES.CREATE, { path, kind });
}

export function renameEntry(fromPath: string, toPath: string): Promise<Result<TreeEntry>> {
  return postJson(API_ROUTES.RENAME, { fromPath, toPath });
}

export function deleteEntry(path: string): Promise<Result<null>> {
  return postJson(API_ROUTES.DELETE, { path });
}

export function rawFileUrl(path: string): string {
  return withPath(API_ROUTES.RAW, path);
}

// Unlike the other routes, a successful answer here is the picture itself, not a Result.
export async function fetchImage(path: string): Promise<Result<Blob>> {
  try {
    const response = await fetch(rawFileUrl(path));
    if (response.ok) return { success: true, data: await response.blob() };
    const body: unknown = await response.json();
    return body as Result<Blob>;
  } catch {
    return { success: false, error: UNREACHABLE };
  }
}
