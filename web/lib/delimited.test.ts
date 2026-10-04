import { describe, expect, it } from 'vitest';

import { parseDelimited, sortRows } from './delimited';
import type { TableRow } from './delimited';

describe('parseDelimited', () => {
  it('splits rows and cells', () => {
    expect(parseDelimited('a,b\n1,2\n', ',')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('handles Windows line endings, a missing final line break and blank lines', () => {
    expect(parseDelimited('a,b\r\n\r\n1,2', ',')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps delimiters, line breaks and doubled quotes inside quoted cells', () => {
    expect(parseDelimited('name,note\n"Smith, J","said ""hi""\nthen left"\n', ',')).toEqual([
      ['name', 'note'],
      ['Smith, J', 'said "hi"\nthen left'],
    ]);
  });

  it('keeps empty cells and reads tabs', () => {
    expect(parseDelimited('a,,c\n', ',')).toEqual([['a', '', 'c']]);
    expect(parseDelimited('a\tb,c\n', '\t')).toEqual([['a', 'b,c']]);
  });

  it('drops a byte order mark', () => {
    expect(parseDelimited('﻿id\n1\n', ',')).toEqual([['id'], ['1']]);
  });
});

describe('sortRows', () => {
  function rows(values: string[]): TableRow[] {
    return values.map((value, index) => ({ lineNumber: index + 1, cells: [value] }));
  }
  const order = (sorted: TableRow[]) => sorted.map((row) => row.cells[0]);

  it('sorts numbers as numbers', () => {
    expect(order(sortRows(rows(['10', '9', '-1.5', '100']), 0, 'ascending'))).toEqual(['-1.5', '9', '10', '100']);
    expect(order(sortRows(rows(['10', '9', '100']), 0, 'descending'))).toEqual(['100', '10', '9']);
  });

  it('sorts text naturally and ignores case', () => {
    expect(order(sortRows(rows(['item 10', 'Item 2', 'apple']), 0, 'ascending'))).toEqual(['apple', 'Item 2', 'item 10']);
  });

  it('puts empty cells last in both directions', () => {
    expect(order(sortRows(rows(['2', '', '1']), 0, 'ascending'))).toEqual(['1', '2', '']);
    expect(order(sortRows(rows(['2', '', '1']), 0, 'descending'))).toEqual(['2', '1', '']);
  });

  it('keeps the original line numbers and leaves the input alone', () => {
    const input = rows(['b', 'a']);
    const sorted = sortRows(input, 0, 'ascending');
    expect(sorted.map((row) => row.lineNumber)).toEqual([2, 1]);
    expect(order(input)).toEqual(['b', 'a']);
  });
});
