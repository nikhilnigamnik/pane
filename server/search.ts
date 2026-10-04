import {
  MAX_SEARCH_MATCHES,
  SEARCH_CONCURRENCY,
  SEARCH_PREVIEW_LEAD,
  SEARCH_PREVIEW_MAX_LENGTH,
} from '@/config/server';
import type { Result, SearchFileResult, SearchMatch, SearchResults } from '@/types/api';

import { ok } from './result';
import { listFiles, readFile } from './workspace';
import type { Workspace } from './workspace';

export interface SearchOptions {
  query: string;
  isCaseSensitive: boolean;
  // Fires when the caller no longer wants the answer, so the remaining files are skipped.
  signal?: AbortSignal;
}

// Characters that mean something in a regular expression. The query is plain text, so each
// one is escaped before the pattern is built.
const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;
const BYTE_ORDER_MARK = '﻿';
const LINE_FEED = '\n';
const TRAILING_CARRIAGE_RETURN = /\r$/;

function toPattern(query: string, isCaseSensitive: boolean): RegExp {
  const escaped = query.replace(REGEX_SPECIAL_CHARACTERS, '\\$&');
  return new RegExp(escaped, isCaseSensitive ? 'g' : 'gi');
}

function toMatch(line: string, lineNumber: number, index: number, length: number): SearchMatch {
  const indentLength = line.length - line.trimStart().length;
  // The preview begins shortly before the match, or at the first word of the line when that
  // is closer. A match inside the indentation is the one case where it begins earlier.
  let start = Math.min(index, Math.max(indentLength, index - SEARCH_PREVIEW_LEAD));

  // A cut that lands inside a word moves on to the next word, when there is one before the match.
  const nextSpace = start > indentLength ? line.indexOf(' ', start) : -1;
  if (nextSpace !== -1 && nextSpace < index) start = nextSpace + 1;

  return {
    line: lineNumber,
    column: index + 1,
    length,
    preview: line.slice(start, start + SEARCH_PREVIEW_MAX_LENGTH),
    previewOffset: index - start,
    isClippedAtStart: start > indentLength,
  };
}

export function findMatches(content: string, pattern: RegExp, limit: number): SearchMatch[] {
  // The editor does not count a byte order mark as a character, so columns must not either.
  const text = content.startsWith(BYTE_ORDER_MARK) ? content.slice(1) : content;
  const matches: SearchMatch[] = [];
  let lineNumber = 1;
  let lineStart = 0;

  for (const found of text.matchAll(pattern)) {
    if (matches.length >= limit) break;

    // Matches arrive in order, so the line counter only ever moves forward.
    let lineEnd = text.indexOf(LINE_FEED, lineStart);
    while (lineEnd !== -1 && lineEnd < found.index) {
      lineNumber += 1;
      lineStart = lineEnd + 1;
      lineEnd = text.indexOf(LINE_FEED, lineStart);
    }

    const line = text
      .slice(lineStart, lineEnd === -1 ? text.length : lineEnd)
      .replace(TRAILING_CARRIAGE_RETURN, '');
    matches.push(toMatch(line, lineNumber, found.index - lineStart, found[0].length));
  }

  return matches;
}

async function searchFile(
  workspace: Workspace,
  path: string,
  pattern: RegExp,
): Promise<SearchMatch[]> {
  // readFile refuses binary, oversized and non-UTF-8 files; those simply have no matches.
  const file = await readFile(workspace, path);
  return file.success ? findMatches(file.data.content, pattern, MAX_SEARCH_MATCHES) : [];
}

// Looks for plain text in every indexed file. Files are read through the same guarded
// readFile the editor uses, so search can never see more than the editor can open.
export async function searchWorkspace(
  workspace: Workspace,
  { query, isCaseSensitive, signal }: SearchOptions,
): Promise<Result<SearchResults>> {
  const index = await listFiles(workspace);
  if (!index.success) return index;

  const { paths } = index.data;
  const pattern = toPattern(query, isCaseSensitive);
  const files: SearchFileResult[] = [];
  let matchCount = 0;
  let hasReachedLimit = false;

  for (let start = 0; start < paths.length && !hasReachedLimit; start += SEARCH_CONCURRENCY) {
    if (signal?.aborted) break;

    const batch = paths.slice(start, start + SEARCH_CONCURRENCY);
    const batchMatches = await Promise.all(
      batch.map((path) => searchFile(workspace, path, pattern)),
    );

    for (const [position, fileMatches] of batchMatches.entries()) {
      const path = batch[position];
      if (path === undefined || fileMatches.length === 0) continue;

      const matches = fileMatches.slice(0, MAX_SEARCH_MATCHES - matchCount);
      files.push({ path, matches });
      matchCount += matches.length;
      if (matchCount >= MAX_SEARCH_MATCHES) {
        hasReachedLimit = true;
        break;
      }
    }
  }

  return ok({ files, matchCount, isTruncated: hasReachedLimit || index.data.isTruncated });
}
