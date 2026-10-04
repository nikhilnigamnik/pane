import { File, Search } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { COPY } from '@/config/copy';
import { ICON_SIZE, ICON_STROKE_WIDTH, QUICK_OPEN_MAX_RESULTS } from '@/config/ui';
import type { FileIndex } from '@/types/api';
import { fetchFiles } from '@/web/lib/api';
import { cn } from '@/web/lib/cn';
import { rankPaths } from '@/web/lib/fuzzy';
import type { FuzzyMatch } from '@/web/lib/fuzzy';
import { fileName, parentPath } from '@/web/lib/path';

import { HighlightedText } from './ui/highlighted-text';
import { ScrollArea } from './ui/scroll-area';

interface QuickOpenProps {
  isOpen: boolean;
  // Listed first while nothing has been typed, so recent work is one key press away.
  openPaths: string[];
  onClose: () => void;
  onOpenFile: (path: string) => void;
}

interface QuickOpenPanelProps {
  openPaths: string[];
  onChoose: (path: string) => void;
}

interface QuickOpenOptionProps {
  id: string;
  match: FuzzyMatch;
  isSelected: boolean;
  onSelect: () => void;
  onChoose: () => void;
}

const STATUS_CLASSES = 'px-3.5 py-3 text-product-lg text-theme-text-sec';

function QuickOpenOption({ id, match, isSelected, onSelect, onChoose }: QuickOpenOptionProps) {
  const name = fileName(match.path);
  const folder = parentPath(match.path);
  const nameStart = match.path.length - name.length;

  return (
    <li
      id={id}
      role="option"
      aria-selected={isSelected}
      title={match.path}
      // Moving the pointer selects, so the keyboard and the mouse always agree on one row.
      onMouseMove={onSelect}
      onClick={onChoose}
      className={cn(
        'flex h-8 cursor-pointer items-center gap-2 rounded-xs px-2 text-product-lg',
        isSelected && 'bg-theme-fg-10',
      )}
    >
      <File
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE_WIDTH}
        className="shrink-0 text-theme-text-sec"
        aria-hidden
      />
      <span className="shrink-0 text-theme-text">
        <HighlightedText
          text={name}
          positions={match.positions
            .filter((position) => position >= nameStart)
            .map((position) => position - nameStart)}
        />
      </span>
      <span className="truncate text-theme-text-tertiary">
        <HighlightedText
          text={folder}
          positions={match.positions.filter((position) => position < folder.length)}
        />
      </span>
    </li>
  );
}

// Mounted each time the dialog opens, so every visit starts with an empty box and a fresh
// list of files.
function QuickOpenPanel({ openPaths, onChoose }: QuickOpenPanelProps) {
  const [index, setIndex] = useState<FileIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => {
    let isCancelled = false;

    async function loadFiles() {
      const result = await fetchFiles();
      if (isCancelled) return;
      if (result.success) setIndex(result.data);
      else setError(result.error.message);
    }

    void loadFiles();
    return () => {
      isCancelled = true;
    };
  }, []);

  const candidates = useMemo(() => {
    if (!index) return [];
    const open = new Set(openPaths);
    return [...openPaths, ...index.paths.filter((path) => !open.has(path))];
  }, [index, openPaths]);

  const matches = useMemo(
    () => rankPaths(candidates, query, QUICK_OPEN_MAX_RESULTS),
    [candidates, query],
  );
  const activeIndex = Math.min(selectedIndex, matches.length - 1);
  const optionId = (position: number) => `${listId}-${position}`;

  useEffect(() => {
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // While an input method is composing text, Enter and the arrows belong to it.
    if (event.nativeEvent.isComposing) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (matches.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setSelectedIndex((activeIndex + step + matches.length) % matches.length);
      return;
    }

    if (event.key !== 'Enter') return;
    event.preventDefault();
    const match = matches[activeIndex];
    if (match) onChoose(match.path);
  }

  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-theme-border-02 px-3.5">
        <Search
          size={ICON_SIZE}
          strokeWidth={ICON_STROKE_WIDTH}
          className="shrink-0 text-theme-text-sec"
          aria-hidden
        />
        <input
          type="text"
          role="combobox"
          aria-label={COPY.QUICK_OPEN}
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={matches.length > 0 ? optionId(activeIndex) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={COPY.QUICK_OPEN_PLACEHOLDER}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent text-sm text-theme-text outline-none placeholder:text-theme-text-tertiary"
        />
      </div>

      {/* The flex column lets the list shrink to its rows and scroll once it reaches the cap. */}
      <ScrollArea className="flex max-h-96 flex-col">
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={COPY.QUICK_OPEN_RESULTS_LABEL}
          className="empty:hidden p-1.5"
        >
          {matches.map((match, position) => (
            <QuickOpenOption
              key={match.path}
              id={optionId(position)}
              match={match}
              isSelected={position === activeIndex}
              onSelect={() => setSelectedIndex(position)}
              onChoose={() => onChoose(match.path)}
            />
          ))}
        </ul>
        {error && <p className={cn(STATUS_CLASSES, 'text-theme-error')}>{error}</p>}
        {!error && !index && <p className={STATUS_CLASSES}>{COPY.LOADING}</p>}
        {index && matches.length === 0 && <p className={STATUS_CLASSES}>{COPY.QUICK_OPEN_EMPTY}</p>}
        {index?.isTruncated && (
          <p className={cn(STATUS_CLASSES, 'border-t border-theme-border-02')}>
            {COPY.QUICK_OPEN_TRUNCATED}
          </p>
        )}
      </ScrollArea>
    </>
  );
}

export function QuickOpen({ isOpen, openPaths, onClose, onOpenFile }: QuickOpenProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // An open modal keeps the rest of the page from taking focus. A layout effect closes it
  // before ordinary effects run, so the editor or the search box can take the keyboard in
  // the same update that dismisses the dialog.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  function handleChoose(path: string) {
    onClose();
    onOpenFile(path);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={COPY.QUICK_OPEN}
      // Escape fires "cancel"; state stays the single owner of whether the dialog is open.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click that lands on the dialog element itself hit the backdrop around the panel.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="mx-auto mt-[12vh] w-[560px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-theme-border-02 bg-theme-bg p-0 text-theme-text shadow-flyout backdrop:bg-black/50 open:flex"
    >
      {isOpen && <QuickOpenPanel openPaths={openPaths} onChoose={handleChoose} />}
    </dialog>
  );
}
