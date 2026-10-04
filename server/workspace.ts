import { isUtf8 } from 'node:buffer';
import { promises as fs } from 'node:fs';
import type { Dirent } from 'node:fs';
import path from 'node:path';

import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from '@/config/preview';
import {
  BINARY_SNIFF_BYTES,
  IGNORED_ENTRY_NAMES,
  INDEX_SKIPPED_DIRECTORY_NAMES,
  MAX_FILE_BYTES,
  MAX_INDEXED_FILES,
} from '@/config/server';
import type {
  EntryKind,
  FileContents,
  FileIndex,
  Result,
  SaveRequest,
  SaveResult,
  TreeEntry,
} from '@/types/api';

import { isInside, toPosixRelative } from './paths';
import { errorCode, fail, ok } from './result';

export interface Workspace {
  root: string;
  name: string;
}

export interface ImageFile {
  bytes: Buffer;
  mimeType: string;
}

interface ResolvedPath {
  absolutePath: string;
  relativePath: string;
}

export async function createWorkspace(directory: string): Promise<Workspace> {
  const root = await fs.realpath(directory);
  return { root, name: path.basename(root) || root };
}

async function resolveInside(
  workspace: Workspace,
  requestedPath: string,
): Promise<Result<ResolvedPath>> {
  const candidate = path.resolve(workspace.root, requestedPath);
  if (!isInside(workspace.root, candidate)) return fail('outside_workspace');

  try {
    // realpath follows symlinks, so a link that points out of the workspace is caught here.
    const absolutePath = await fs.realpath(candidate);
    if (!isInside(workspace.root, absolutePath)) return fail('outside_workspace');
    return ok({ absolutePath, relativePath: toPosixRelative(workspace.root, candidate) });
  } catch (error) {
    return fail(errorCode(error) === 'ENOENT' ? 'not_found' : 'io_error');
  }
}

async function entryKind(directory: string, dirent: Dirent): Promise<EntryKind | null> {
  if (dirent.isDirectory()) return 'directory';
  if (dirent.isFile()) return 'file';
  if (!dirent.isSymbolicLink()) return null;

  try {
    const stats = await fs.stat(path.join(directory, dirent.name));
    if (stats.isDirectory()) return 'directory';
    return stats.isFile() ? 'file' : null;
  } catch {
    return null;
  }
}

function compareEntries(a: TreeEntry, b: TreeEntry): number {
  if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

export async function listDirectory(
  workspace: Workspace,
  requestedPath: string,
): Promise<Result<TreeEntry[]>> {
  const resolved = await resolveInside(workspace, requestedPath);
  if (!resolved.success) return resolved;
  const { absolutePath, relativePath } = resolved.data;

  let dirents: Dirent[];
  try {
    dirents = await fs.readdir(absolutePath, { withFileTypes: true });
  } catch (error) {
    return fail(errorCode(error) === 'ENOTDIR' ? 'not_a_directory' : 'io_error');
  }

  const entries: TreeEntry[] = [];
  for (const dirent of dirents) {
    if (IGNORED_ENTRY_NAMES.includes(dirent.name)) continue;
    const kind = await entryKind(absolutePath, dirent);
    if (!kind) continue;
    entries.push({
      name: dirent.name,
      kind,
      path: relativePath ? `${relativePath}/${dirent.name}` : dirent.name,
    });
  }

  return ok(entries.sort(compareEntries));
}

// Every file under the opened folder, for quick open and search. Symlinks are neither followed
// nor listed, so the walk cannot leave the workspace or go round in circles.
export async function listFiles(workspace: Workspace): Promise<Result<FileIndex>> {
  const paths: string[] = [];
  const pendingDirectories = [''];

  for (
    let directory = pendingDirectories.pop();
    directory !== undefined;
    directory = pendingDirectories.pop()
  ) {
    const isRoot = directory === '';
    const resolved = await resolveInside(workspace, directory);
    if (!resolved.success) {
      if (isRoot) return resolved;
      continue;
    }

    let dirents: Dirent[];
    try {
      dirents = await fs.readdir(resolved.data.absolutePath, { withFileTypes: true });
    } catch {
      // A folder that cannot be read (permissions, removed mid-walk) is left out.
      if (isRoot) return fail('io_error');
      continue;
    }

    for (const dirent of dirents) {
      if (IGNORED_ENTRY_NAMES.includes(dirent.name)) continue;
      const entryPath = isRoot ? dirent.name : `${directory}/${dirent.name}`;

      if (dirent.isDirectory()) {
        if (!INDEX_SKIPPED_DIRECTORY_NAMES.includes(dirent.name)) pendingDirectories.push(entryPath);
        continue;
      }
      if (!dirent.isFile()) continue;
      if (paths.length >= MAX_INDEXED_FILES) return ok({ paths: paths.sort(), isTruncated: true });
      paths.push(entryPath);
    }
  }

  return ok({ paths: paths.sort(), isTruncated: false });
}

export async function readFile(
  workspace: Workspace,
  requestedPath: string,
): Promise<Result<FileContents>> {
  const resolved = await resolveInside(workspace, requestedPath);
  if (!resolved.success) return resolved;
  const { absolutePath, relativePath } = resolved.data;

  try {
    const handle = await fs.open(absolutePath, 'r');
    try {
      const stats = await handle.stat();
      if (!stats.isFile()) return fail('not_a_file');
      if (stats.size > MAX_FILE_BYTES) return fail('too_large');

      const buffer = await handle.readFile();
      if (buffer.subarray(0, BINARY_SNIFF_BYTES).includes(0)) return fail('binary');
      // Decoding other encodings as UTF-8 replaces bytes with U+FFFD, and a save would then
      // write those replacements back over the original text.
      if (!isUtf8(buffer)) return fail('unsupported_encoding');

      return ok({ path: relativePath, content: buffer.toString('utf8'), mtimeMs: stats.mtimeMs });
    } finally {
      await handle.close();
    }
  } catch {
    return fail('io_error');
  }
}

// Raw bytes are only handed out for known image types, so this cannot be used to download
// arbitrary files in a form the browser would run or render as a page.
export async function readImage(
  workspace: Workspace,
  requestedPath: string,
): Promise<Result<ImageFile>> {
  const resolved = await resolveInside(workspace, requestedPath);
  if (!resolved.success) return resolved;

  const mimeType = IMAGE_MIME_TYPES[path.extname(requestedPath).toLowerCase()];
  if (!mimeType) return fail('not_an_image');

  try {
    const handle = await fs.open(resolved.data.absolutePath, 'r');
    try {
      const stats = await handle.stat();
      if (!stats.isFile()) return fail('not_a_file');
      if (stats.size > MAX_IMAGE_BYTES) return fail('too_large');

      return ok({ bytes: await handle.readFile(), mimeType });
    } finally {
      await handle.close();
    }
  } catch {
    return fail('io_error');
  }
}

export async function writeFile(
  workspace: Workspace,
  request: SaveRequest,
): Promise<Result<SaveResult>> {
  if (Buffer.byteLength(request.content, 'utf8') > MAX_FILE_BYTES) return fail('too_large');

  const resolved = await resolveInside(workspace, request.path);
  if (!resolved.success) return resolved;
  const { absolutePath } = resolved.data;

  try {
    const before = await fs.stat(absolutePath);
    if (!before.isFile()) return fail('not_a_file');

    // Something else (an agent, git, another editor) wrote the file after it was opened here.
    const hasChangedOnDisk =
      request.expectedMtimeMs !== null && before.mtimeMs !== request.expectedMtimeMs;
    if (hasChangedOnDisk) return fail('conflict');

    await fs.writeFile(absolutePath, request.content, 'utf8');
    const after = await fs.stat(absolutePath);
    return ok({ mtimeMs: after.mtimeMs });
  } catch {
    return fail('io_error');
  }
}
