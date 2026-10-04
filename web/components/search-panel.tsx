import { CaseSensitive, File, Search } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { COPY } from '@/config/copy';
import {
  ICON_SIZE,
  ICON_SIZE_SMALL,
  ICON_STROKE_WIDTH,
  SEARCH_MIN_QUERY_LENGTH,
} from '@/config/ui';
import type { SearchFileResult, SearchMatch } from '@/types/api';
import type { TextSelection } from '@/types/editor';
import type { ProjectSearchState } from '@/web/hooks/use-project-search';
import { cn } from '@/web/lib/cn';
import { fileName, parentPath } from '@/web/lib/path';

import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';

interface SearchPanelProps {
  search: ProjectSearchState;
  // Changes every time search is asked for, which puts the cursor back in the box.
  focusToken: number;
  onOpenFile: (path: string, selection?: TextSelection) => void;
}

interface FileResultProps {
  file: SearchFileResult;
  onOpenFile: (path: string, selection?: TextSelection) => void;
}

interface MatchPreviewProps {
  match: SearchMatch;
}

const ROW_CLASSES =
  'flex w-full cursor-pointer items-center rounded-xs text-left outline-none transition-colors hover:bg-theme-fg-05 focus-visible:shadow-focus-ring';

function statusMessage(search: ProjectSearchState): string {
  if (search.error) return search.error;
  if (search.isQueryTooShort) return COPY.SEARCH_TOO_SHORT(SEARCH_MIN_QUERY_LENGTH);
  if (search.isSearching || !search.results) return COPY.SEARCHING;
  if (search.results.matchCount === 0) return COPY.SEARCH_NO_RESULTS;
  return COPY.SEARCH_SUMMARY(search.results.matchCount, search.results.files.length);
}

function MatchPreview({ match }: MatchPreviewProps) {
  const matchEnd = match.previewOffset + match.length;

  return (
    <span className="truncate whitespace-pre text-theme-text-sec">
      {match.isClippedAtStart && COPY.SEARCH_CLIPPED}
      {match.preview.slice(0, match.previewOffset)}
      <mark className="rounded-xs bg-theme-accent/25 text-theme-text">
        {match.preview.slice(match.previewOffset, matchEnd)}
      </mark>
      {match.preview.slice(matchEnd)}
    </span>
  );
}

function FileResult({ file, onOpenFile }: FileResultProps) {
  return (
    <li>
      <button
        type="button"
        title={file.path}
        onClick={() => onOpenFile(file.path)}
        className={cn(ROW_CLASSES, 'h-7 gap-1.5 px-1.5 text-product-lg')}
      >
        <File
          size={ICON_SIZE}
          strokeWidth={ICON_STROKE_WIDTH}
          className="shrink-0 text-theme-text-sec"
          aria-hidden
        />
        <span className="shrink-0 text-theme-text">{fileName(file.path)}</span>
        <span className="min-w-0 flex-1 truncate text-theme-text-tertiary">
          {parentPath(file.path)}
        </span>
        <span className="shrink-0 text-product-base tabular-nums text-theme-text-sec">
          {file.matches.length}
        </span>
      </button>
      <ul>
        {file.matches.map((match) => (
          <li key={`${match.line}:${match.column}`}>
            <button
              type="button"
              onClick={() => onOpenFile(file.path, match)}
              className={cn(ROW_CLASSES, 'h-6 gap-2 pl-7 pr-1.5 font-mono text-product-base')}
            >
              <span className="shrink-0 tabular-nums text-theme-text-tertiary">{match.line}</span>
              <MatchPreview match={match} />
            </button>
          </li>
        ))}
      </ul>
    </li>
  );
}

export function SearchPanel({ search, focusToken, onOpenFile }: SearchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusToken]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-theme-border-02 p-2">
        <div className="flex h-7 items-center gap-1.5 rounded-md bg-theme-fg-05 pl-2 pr-0.5 focus-within:shadow-focus-ring">
          <Search
            size={ICON_SIZE_SMALL}
            strokeWidth={ICON_STROKE_WIDTH}
            className="shrink-0 text-theme-text-sec"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="text"
            aria-label={COPY.SEARCH}
            autoComplete="off"
            spellCheck={false}
            placeholder={COPY.SEARCH}
            value={search.query}
            onChange={(event) => search.setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) search.searchAgain();
            }}
            className="min-w-0 flex-1 bg-transparent text-product-lg text-theme-text outline-none placeholder:text-theme-text-tertiary"
          />
          <Button
            variant="tertiary"
            size="tiny"
            isSquare
            isPressed={search.isCaseSensitive}
            aria-label={COPY.SEARCH_MATCH_CASE}
            title={COPY.SEARCH_MATCH_CASE}
            onClick={search.toggleCaseSensitive}
          >
            <CaseSensitive size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
          </Button>
        </div>
        <p
          role="status"
          className={cn(
            'px-1 text-product-base',
            search.error ? 'text-theme-error' : 'text-theme-text-sec',
          )}
        >
          {statusMessage(search)}
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {search.results && (
          <ul aria-label={COPY.SEARCH_RESULTS_LABEL} className="flex flex-col gap-1.5 p-1.5">
            {search.results.files.map((file) => (
              <FileResult key={file.path} file={file} onOpenFile={onOpenFile} />
            ))}
          </ul>
        )}
        {search.results?.isTruncated && (
          <p className="border-t border-theme-border-02 px-3 py-2 text-product-base text-theme-text-sec">
            {COPY.SEARCH_TRUNCATED}
          </p>
        )}
      </ScrollArea>
    </div>
  );
}
