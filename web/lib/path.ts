// The opened folder itself. Every other path is relative to it.
export const ROOT_PATH = '';

export function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

// The workspace root is the empty path, so a top-level entry has '' as its parent.
export function parentPath(path: string): string {
  return path.slice(0, Math.max(0, path.lastIndexOf('/')));
}

export function joinPath(folder: string, name: string): string {
  return folder === ROOT_PATH ? name : `${folder}/${name}`;
}

// True for the path itself and for everything inside it when it is a folder.
export function isSameOrInside(path: string, folder: string): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}

// Where a path ends up after `from` is renamed to `to`, or null when the rename does not
// touch it.
export function remapPath(path: string, from: string, to: string): string | null {
  return isSameOrInside(path, from) ? `${to}${path.slice(from.length)}` : null;
}

// Lower case and with its dot (".md"), or '' when there is none.
export function fileExtension(path: string): string {
  const name = fileName(path);
  const dotIndex = name.lastIndexOf('.');
  // A leading dot marks a hidden file (".gitignore"), not an extension.
  return dotIndex > 0 ? name.slice(dotIndex).toLowerCase() : '';
}

const QUERY_OR_FRAGMENT = /[?#]/;

// Turns a link written inside a file ("../docs/setup.md#install") into a workspace path.
// Returns null when the link names no file or points above the opened folder.
export function resolveRelativePath(fromFile: string, link: string): string | null {
  const [encodedPath = ''] = link.split(QUERY_OR_FRAGMENT);
  let linkPath: string;
  try {
    linkPath = decodeURIComponent(encodedPath);
  } catch {
    return null;
  }

  // A leading slash means "from the opened folder", as it does on GitHub.
  const segments = linkPath.startsWith('/') ? [] : parentPath(fromFile).split('/').filter(Boolean);
  for (const segment of linkPath.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment !== '..') segments.push(segment);
    else if (segments.pop() === undefined) return null;
  }

  const hasFile = linkPath !== '' && segments.length > 0;
  return hasFile ? segments.join('/') : null;
}
