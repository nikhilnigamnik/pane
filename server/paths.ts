import path from 'node:path';

export function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  if (relative === '') return true;
  if (path.isAbsolute(relative)) return false;
  // Compare whole segments so a file literally named "..notes" is still allowed.
  return relative !== '..' && !relative.startsWith(`..${path.sep}`);
}

export function toPosixRelative(root: string, target: string): string {
  return path.relative(root, target).split(path.sep).join('/');
}
