export type SortDirection = 'ascending' | 'descending';

export interface TableRow {
  // Where the row sits in the file, counting the header as 0. It stays put when sorting.
  lineNumber: number;
  cells: string[];
}

const QUOTE = '"';
const BYTE_ORDER_MARK = '﻿';

// Splits CSV or TSV text into rows of cells, following RFC 4180: a quoted cell can hold the
// delimiter, line breaks and doubled quotes. Blank lines are dropped.
export function parseDelimited(text: string, delimiter: string): string[][] {
  const source = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let isQuoted = false;

  function endRow() {
    row.push(cell);
    const isBlank = row.length === 1 && row[0] === '';
    if (!isBlank) rows.push(row);
    row = [];
    cell = '';
  }

  for (let index = 0; index < source.length; index += 1) {
    const character = source.charAt(index);

    if (isQuoted) {
      if (character !== QUOTE) cell += character;
      else if (source.charAt(index + 1) === QUOTE) {
        cell += QUOTE;
        index += 1;
      } else isQuoted = false;
      continue;
    }

    if (character === QUOTE && cell === '') isQuoted = true;
    else if (character === delimiter) {
      row.push(cell);
      cell = '';
    } else if (character === '\n') endRow();
    else if (character === '\r' && source.charAt(index + 1) === '\n') {
      endRow();
      index += 1;
    } else cell += character;
  }

  if (cell !== '' || row.length > 0) endRow();
  return rows;
}

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

// Sorts by one column. A column where every filled cell is a number sorts as numbers;
// anything else sorts as text, with "item 2" before "item 10". Empty cells go last either way.
export function sortRows(rows: TableRow[], column: number, direction: SortDirection): TableRow[] {
  const values = rows.map((row) => row.cells[column] ?? '');
  const isNumeric = values.every((value) => value.trim() === '' || toNumber(value) !== null);
  const sign = direction === 'ascending' ? 1 : -1;

  return [...rows].sort((a, b) => {
    const left = a.cells[column] ?? '';
    const right = b.cells[column] ?? '';
    const isLeftEmpty = left.trim() === '';
    const isRightEmpty = right.trim() === '';
    if (isLeftEmpty || isRightEmpty) return Number(isLeftEmpty) - Number(isRightEmpty);

    const order = isNumeric
      ? (toNumber(left) ?? 0) - (toNumber(right) ?? 0)
      : left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
    return order * sign;
  });
}
