import { CaseSensitive, Ellipsis, File, Regex, Search, WholeWord } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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

interface OptionToggleProps {
  label: string;
  icon: LucideIcon;
  isPressed: boolean;
  onToggle: () => void;
}

interface FilterInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

const FIELD_CLASSES =
  'flex h-7 items-center gap-1.5 rounded-md bg-theme-fg-05 pl-2 pr-0.5 focus-within:shadow-focus-ring';
const INPUT_CLASSES =
  'min-w-0 flex-1 bg-transparent text-product-lg text-theme-text outline-none placeholder:text-theme-text-tertiary';

const ROW_CLASSES =
  'flex w-full cursor-pointer items-center rounded-xs text-left outline-none transition-colors hover:bg-theme-fg-05 focus-visible:shadow-focus-ring';

function statusMessage(search: ProjectSearchState): string {
  if (search.error) return search.error;
  if (search.isQueryTooShort && search.options.isRegex) return COPY.SEARCH_EMPTY_PATTERN;
  if (search.isQueryTooShort) return COPY.SEARCH_TOO_SHORT(SEARCH_MIN_QUERY_LENGTH);
  if (search.isSearching || !search.results) return COPY.SEARCHING;
  if (search.results.matchCount === 0) return COPY.SEARCH_NO_RESULTS;
  return COPY.SEARCH_SUMMARY(search.results.matchCount, search.results.files.length);
}

function OptionToggle({ label, icon: Icon, isPressed, onToggle }: OptionToggleProps) {
  return (
    <Button
      variant="tertiary"
      size="tiny"
      isSquare
      isPressed={isPressed}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
    </Button>
  );
}

function FilterInput({ label, placeholder, value, onChange }: FilterInputProps) {
  return (
    <div className={cn(FIELD_CLASSES, 'pr-2')}>
      <input
        type="text"
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASSES}
      />
    </div>
  );
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
  const { options } = search;
  const hasFilters = options.include.trim() !== '' || options.exclude.trim() !== '';

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusToken]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-theme-border-02 p-2">
        <div className="flex items-center gap-0.5">
          <div className={cn(FIELD_CLASSES, 'min-w-0 flex-1')}>
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
              value={options.query}
              onChange={(event) => search.setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) search.searchAgain();
              }}
              className={INPUT_CLASSES}
            />
            <OptionToggle
              label={COPY.SEARCH_MATCH_CASE}
              icon={CaseSensitive}
              isPressed={options.isCaseSensitive}
              onToggle={() => search.toggleFlag('isCaseSensitive')}
            />
            <OptionToggle
              label={COPY.SEARCH_WHOLE_WORD}
              icon={WholeWord}
              isPressed={options.isWholeWord}
              onToggle={() => search.toggleFlag('isWholeWord')}
            />
            <OptionToggle
              label={COPY.SEARCH_REGEX}
              icon={Regex}
              isPressed={options.isRegex}
              onToggle={() => search.toggleFlag('isRegex')}
            />
          </div>
          {/* Lit while hidden filters still narrow the search, so results are never a mystery. */}
          <OptionToggle
            label={COPY.SEARCH_FILTERS}
            icon={Ellipsis}
            isPressed={search.areFiltersVisible || hasFilters}
            onToggle={search.toggleFilters}
          />
        </div>
        {search.areFiltersVisible && (
          <>
            <FilterInput
              label={COPY.SEARCH_INCLUDE}
              placeholder={COPY.SEARCH_INCLUDE_PLACEHOLDER}
              value={options.include}
              onChange={(value) => search.setFilter('include', value)}
            />
            <FilterInput
              label={COPY.SEARCH_EXCLUDE}
              placeholder={COPY.SEARCH_EXCLUDE_PLACEHOLDER}
              value={options.exclude}
              onChange={(value) => search.setFilter('exclude', value)}
            />
          </>
        )}
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
