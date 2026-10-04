import picomatch from 'picomatch';

// Splits "src, *.test.ts" into patterns. Commas separate patterns, as in VS Code.
const PATTERN_SEPARATOR = ',';
const LEADING_PATH_MARKERS = /^(\.\/|\/)+/;
const TRAILING_SLASHES = /\/+$/;

type PathTest = (path: string) => boolean;

// Every folder above the file, then the file itself: "a/b/c.ts" gives "a", "a/b", "a/b/c.ts".
function pathPrefixes(path: string): string[] {
  const segments = path.split('/');
  return segments.map((_, index) => segments.slice(0, index + 1).join('/'));
}

// A pattern without a slash ("*.md", "fixtures") is matched against every file and folder name
// in the path. A pattern with a slash ("web/lib", "src/**/*.ts") is matched against the path
// from the opened folder, and naming a folder that way covers everything inside it.
function compilePattern(pattern: string): PathTest {
  const isMatch = picomatch(pattern, { dot: true });
  if (!pattern.includes('/')) return (path) => path.split('/').some((segment) => isMatch(segment));
  return (path) => pathPrefixes(path).some((prefix) => isMatch(prefix));
}

function compileList(list: string): PathTest[] {
  return list
    .split(PATTERN_SEPARATOR)
    .map((pattern) => pattern.trim().replace(LEADING_PATH_MARKERS, '').replace(TRAILING_SLASHES, ''))
    .filter((pattern) => pattern !== '')
    .map(compilePattern);
}

// Returns whether a workspace-relative file path passes the include and exclude lists. An empty
// include list lets every path in.
export function createPathFilter(include: string, exclude: string): PathTest {
  const includes = compileList(include);
  const excludes = compileList(exclude);

  return (path) => {
    if (includes.length > 0 && !includes.some((test) => test(path))) return false;
    return !excludes.some((test) => test(path));
  };
}
