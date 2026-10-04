export interface FuzzyMatch {
  path: string;
  score: number;
  // Indexes into `path` of the characters that matched the query, in order.
  positions: number[];
}

// The scoring follows fzy (github.com/jhawthorn/fzy): letters that follow each other, or
// that start a path segment or word, count for more than letters scattered through a name.
const SCORE_GAP_LEADING = -0.005;
const SCORE_GAP_TRAILING = -0.005;
const SCORE_GAP_INNER = -0.01;
const SCORE_MATCH_CONSECUTIVE = 1;
const SCORE_MATCH_SLASH = 0.9;
const SCORE_MATCH_WORD = 0.8;
const SCORE_MATCH_CAPITAL = 0.7;
const SCORE_MATCH_DOT = 0.6;
const NO_MATCH = -Infinity;

// Scoring a path costs its length times the query length, so absurdly long ones are only
// checked for containing the letters.
const MAX_SCORED_PATH_LENGTH = 1024;
const WHITESPACE = /\s+/g;
const WORD_SEPARATORS = '-_ ';

function boundaryBonus(previous: string, current: string): number {
  if (previous === '/') return SCORE_MATCH_SLASH;
  if (WORD_SEPARATORS.includes(previous)) return SCORE_MATCH_WORD;
  if (previous === '.') return SCORE_MATCH_DOT;
  // camelCase: a capital that follows a lower-case letter starts a new word.
  const isHump = previous !== previous.toUpperCase() && current !== current.toLowerCase();
  return isHump ? SCORE_MATCH_CAPITAL : 0;
}

function hasLettersInOrder(needle: string, haystack: string): boolean {
  let from = 0;
  for (const letter of needle) {
    const found = haystack.indexOf(letter, from);
    if (found === -1) return false;
    from = found + letter.length;
  }
  return true;
}

// Returns null when the letters of `query` do not all appear in `path` in that order.
export function fuzzyMatch(path: string, query: string): FuzzyMatch | null {
  const needle = query.toLowerCase();
  const lowered = path.toLowerCase();
  // Lower-casing changes the length of a few rare characters, which would shift every index.
  const haystack = lowered.length === path.length ? lowered : path;
  const needleLength = needle.length;
  const pathLength = haystack.length;

  if (needleLength === 0) return { path, score: 0, positions: [] };
  if (needleLength > pathLength || !hasLettersInOrder(needle, haystack)) return null;
  if (pathLength > MAX_SCORED_PATH_LENGTH) return { path, score: NO_MATCH, positions: [] };

  // endingHere: the best score when query letter i is matched to path letter j.
  // bestSoFar: the best score for query letters 0..i using path letters 0..j.
  const endingHere = new Float64Array(needleLength * pathLength);
  const bestSoFar = new Float64Array(needleLength * pathLength);
  const cell = (table: Float64Array, i: number, j: number) => table[i * pathLength + j] ?? NO_MATCH;

  for (let i = 0; i < needleLength; i += 1) {
    const gapScore = i === needleLength - 1 ? SCORE_GAP_TRAILING : SCORE_GAP_INNER;
    let running = NO_MATCH;

    for (let j = 0; j < pathLength; j += 1) {
      let score = NO_MATCH;
      if (needle.charAt(i) === haystack.charAt(j)) {
        const bonus = boundaryBonus(j === 0 ? '/' : path.charAt(j - 1), path.charAt(j));
        if (i === 0) {
          score = j * SCORE_GAP_LEADING + bonus;
        } else if (j > 0) {
          score = Math.max(
            cell(bestSoFar, i - 1, j - 1) + bonus,
            cell(endingHere, i - 1, j - 1) + SCORE_MATCH_CONSECUTIVE,
          );
        }
      }
      running = Math.max(score, running + gapScore);
      endingHere[i * pathLength + j] = score;
      bestSoFar[i * pathLength + j] = running;
    }
  }

  // Walk back from the end to find which path letters produced the best score.
  const positions = new Array<number>(needleLength).fill(0);
  let mustMatch = false;
  for (let i = needleLength - 1, j = pathLength - 1; i >= 0; i -= 1) {
    for (; j >= 0; j -= 1) {
      const score = cell(endingHere, i, j);
      if (score === NO_MATCH || (!mustMatch && score !== cell(bestSoFar, i, j))) continue;

      // If this letter was scored as following the previous one, the previous letter has to
      // sit right before it.
      mustMatch =
        i > 0 &&
        j > 0 &&
        cell(bestSoFar, i, j) === cell(endingHere, i - 1, j - 1) + SCORE_MATCH_CONSECUTIVE;
      positions[i] = j;
      j -= 1;
      break;
    }
  }

  return { path, score: cell(bestSoFar, needleLength - 1, pathLength - 1), positions };
}

// The best matches first. With nothing typed, the first paths in their given order.
export function rankPaths(paths: readonly string[], query: string, limit: number): FuzzyMatch[] {
  const needle = query.replace(WHITESPACE, '');
  if (needle === '') {
    return paths.slice(0, limit).map((path) => ({ path, score: 0, positions: [] }));
  }

  const matches: FuzzyMatch[] = [];
  for (const path of paths) {
    const match = fuzzyMatch(path, needle);
    if (match) matches.push(match);
  }

  // Equal scores go to the shorter path, then keep the order they came in.
  matches.sort((a, b) => b.score - a.score || a.path.length - b.path.length);
  return matches.slice(0, limit);
}
