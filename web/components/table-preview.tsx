import { ArrowDown, ArrowUp } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';

import { COPY } from '@/config/copy';
import { ICON_SIZE_SMALL, ICON_STROKE_WIDTH, MAX_TABLE_ROWS } from '@/config/ui';
import { useModelText } from '@/web/hooks/use-model-text';
import { cn } from '@/web/lib/cn';
import { parseDelimited, sortRows } from '@/web/lib/delimited';
import type { SortDirection, TableRow } from '@/web/lib/delimited';

import { ScrollArea } from './ui/scroll-area';

interface TablePreviewProps {
  path: string;
  delimiter: string;
}

interface SortState {
  column: number;
  direction: SortDirection;
}

const BORDER_CLASSES = 'border-b border-r border-theme-border-01-5';
const CELL_CLASSES = `${BORDER_CLASSES} max-w-80 truncate px-3 py-1.5`;

// Clicking a header sorts up, then down, then back to the order of the file.
function nextSort(current: SortState | null, column: number): SortState | null {
  if (current?.column !== column) return { column, direction: 'ascending' };
  return current.direction === 'ascending' ? { column, direction: 'descending' } : null;
}

// Shows a CSV or TSV file as a table, unsaved edits included. The first row is the header.
export function TablePreview({ path, delimiter }: TablePreviewProps) {
  // Parsing a large file on every keystroke would make typing lag, so it trails behind.
  const text = useDeferredValue(useModelText(path));
  const [sort, setSort] = useState<SortState | null>(null);

  const { header, body, columnCount } = useMemo(() => {
    const [first = [], ...rest] = parseDelimited(text, delimiter);
    const rows: TableRow[] = rest.map((cells, index) => ({ lineNumber: index + 2, cells }));
    const width = Math.max(first.length, ...rows.map((row) => row.cells.length));
    return { header: first, body: rows, columnCount: width };
  }, [text, delimiter]);

  const shownRows = useMemo(() => {
    const ordered = sort ? sortRows(body, sort.column, sort.direction) : body;
    return ordered.slice(0, MAX_TABLE_ROWS);
  }, [body, sort]);

  if (columnCount === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-theme-product-editor">
        <p className="text-sm text-theme-text-sec">{COPY.TABLE_EMPTY}</p>
      </div>
    );
  }

  const columns = Array.from({ length: columnCount }, (_, index) => index);
  const isTruncated = body.length > MAX_TABLE_ROWS;

  return (
    <div className="absolute inset-0 flex flex-col bg-theme-product-editor">
      <ScrollArea isHorizontal className="min-h-0 flex-1">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left text-product-lg text-theme-text">
          <thead className="sticky top-0 z-10 bg-theme-card-02">
            <tr>
              <th
                scope="col"
                className={cn(CELL_CLASSES, 'w-0 text-right font-normal text-theme-text-tertiary')}
              >
                {COPY.TABLE_LINE_NUMBER}
              </th>
              {columns.map((column) => {
                const direction = sort?.column === column ? sort.direction : null;
                const SortIcon = direction === 'descending' ? ArrowDown : ArrowUp;
                return (
                  <th
                    key={column}
                    scope="col"
                    aria-sort={direction ?? 'none'}
                    // The button inside carries the padding, so the whole cell is clickable.
                    className={cn(BORDER_CLASSES, 'max-w-80 font-medium')}
                  >
                    <button
                      type="button"
                      title={COPY.TABLE_SORT_HINT}
                      onClick={() => setSort((current) => nextSort(current, column))}
                      className="flex w-full cursor-pointer items-center gap-1.5 px-3 py-1.5 text-left outline-none hover:bg-theme-fg-05 focus-visible:shadow-focus-ring"
                    >
                      <span className="truncate">{header[column] ?? ''}</span>
                      <SortIcon
                        size={ICON_SIZE_SMALL}
                        strokeWidth={ICON_STROKE_WIDTH}
                        className={cn('shrink-0 text-theme-text-sec', !direction && 'invisible')}
                        aria-hidden
                      />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shownRows.map((row) => (
              <tr key={row.lineNumber} className="hover:bg-theme-fg-05">
                <td
                  className={cn(
                    CELL_CLASSES,
                    'text-right font-mono text-product-base tabular-nums text-theme-text-tertiary',
                  )}
                >
                  {row.lineNumber}
                </td>
                {columns.map((column) => (
                  <td key={column} title={row.cells[column]} className={CELL_CLASSES}>
                    {row.cells[column] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      <p className="shrink-0 border-t border-theme-border-02 bg-theme-product-chrome px-3 py-1.5 text-product-base text-theme-text-sec">
        {isTruncated
          ? COPY.TABLE_TRUNCATED(MAX_TABLE_ROWS, body.length)
          : COPY.TABLE_ROW_COUNT(body.length)}
      </p>
    </div>
  );
}
