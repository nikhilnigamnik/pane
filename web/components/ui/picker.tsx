import { Search } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import { ICON_SIZE, ICON_STROKE_WIDTH } from '@/config/ui';
import { cn } from '@/web/lib/cn';

import { ScrollArea } from './scroll-area';

interface PickerProps<Item> {
  isOpen: boolean;
  label: string;
  listLabel: string;
  placeholder: string;
  // The items to list for what has been typed, best first. Keep it stable with useCallback.
  filterItems: (query: string) => Item[];
  itemKey: (item: Item) => string;
  renderItem: (item: Item, query: string) => ReactNode;
  itemTitle?: (item: Item) => string;
  // Shown when nothing matches, unless `isLoading` is set.
  emptyMessage: string;
  isLoading?: boolean;
  loadingMessage?: string;
  error?: string | null;
  // A note under the list, such as "some files are missing".
  footer?: ReactNode;
  onChoose: (item: Item) => void;
  onClose: () => void;
}

type PickerPanelProps<Item> = Omit<PickerProps<Item>, 'isOpen' | 'label' | 'onClose'>;

const STATUS_CLASSES = 'px-3.5 py-3 text-product-lg text-theme-text-sec';

// Mounted each time the picker opens, so every visit starts with an empty box.
function PickerPanel<Item>({
  listLabel,
  placeholder,
  filterItems,
  itemKey,
  renderItem,
  itemTitle,
  emptyMessage,
  isLoading = false,
  loadingMessage,
  error = null,
  footer,
  onChoose,
}: PickerPanelProps<Item>) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const items = useMemo(() => filterItems(query), [filterItems, query]);
  const activeIndex = Math.min(selectedIndex, items.length - 1);
  const optionId = (position: number) => `${listId}-${position}`;

  useEffect(() => {
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // While an input method is composing text, Enter and the arrows belong to it.
    if (event.nativeEvent.isComposing) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (items.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setSelectedIndex((activeIndex + step + items.length) % items.length);
      return;
    }

    if (event.key !== 'Enter') return;
    event.preventDefault();
    const item = items[activeIndex];
    if (item !== undefined) onChoose(item);
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
          aria-label={placeholder}
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={items.length > 0 ? optionId(activeIndex) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
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
        <ul ref={listRef} id={listId} role="listbox" aria-label={listLabel} className="empty:hidden p-1.5">
          {items.map((item, position) => (
            <li
              key={itemKey(item)}
              id={optionId(position)}
              role="option"
              aria-selected={position === activeIndex}
              title={itemTitle?.(item)}
              // Moving the pointer selects, so the keyboard and the mouse always agree on one row.
              onMouseMove={() => setSelectedIndex(position)}
              onClick={() => onChoose(item)}
              className={cn(
                'flex h-8 cursor-pointer items-center gap-2 rounded-xs px-2 text-product-lg',
                position === activeIndex && 'bg-theme-fg-10',
              )}
            >
              {renderItem(item, query)}
            </li>
          ))}
        </ul>
        {error && <p className={cn(STATUS_CLASSES, 'text-theme-error')}>{error}</p>}
        {!error && isLoading && <p className={STATUS_CLASSES}>{loadingMessage}</p>}
        {!error && !isLoading && items.length === 0 && <p className={STATUS_CLASSES}>{emptyMessage}</p>}
        {footer && <div className={cn(STATUS_CLASSES, 'border-t border-theme-border-02')}>{footer}</div>}
      </ScrollArea>
    </>
  );
}

// A search box over a list, in a dialog near the top of the window: quick open and the
// command palette.
export function Picker<Item>({ isOpen, label, onClose, onChoose, ...panelProps }: PickerProps<Item>) {
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

  function handleChoose(item: Item) {
    // Closed right away, so whatever the choice opens next (another dialog, the editor) gets
    // the keyboard instead of having it handed back to where it was before the picker.
    dialogRef.current?.close();
    onClose();
    onChoose(item);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
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
      {isOpen && <PickerPanel {...panelProps} onChoose={handleChoose} />}
    </dialog>
  );
}
