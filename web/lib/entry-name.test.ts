import { describe, expect, it } from 'vitest';

import { COPY } from '@/config/copy';

import { entryNameError, nameSelectionEnd, normalizeEntryName } from './entry-name';

describe('entryNameError', () => {
  it('accepts ordinary names, including hidden files and spaces inside', () => {
    expect(entryNameError('index.ts')).toBeNull();
    expect(entryNameError('.env.local')).toBeNull();
    expect(entryNameError('my notes.md')).toBeNull();
    expect(entryNameError('..notes')).toBeNull();
  });

  it('rejects empty names and path separators', () => {
    expect(entryNameError('   ')).toBe(COPY.NAME_EMPTY);
    expect(entryNameError('src/index.ts')).toBe(COPY.NAME_HAS_SEPARATOR);
    expect(entryNameError('src\\index.ts')).toBe(COPY.NAME_HAS_SEPARATOR);
  });

  it('rejects the names that point elsewhere or that the app hides', () => {
    expect(entryNameError('.')).toBe(COPY.NAME_RESERVED);
    expect(entryNameError(' .. ')).toBe(COPY.NAME_RESERVED);
    expect(entryNameError('.git')).toBe(COPY.NAME_RESERVED);
  });
});

describe('normalizeEntryName', () => {
  it('trims spaces at the ends only', () => {
    expect(normalizeEntryName('  a b.ts ')).toBe('a b.ts');
  });
});

describe('nameSelectionEnd', () => {
  it('stops before the extension of a file', () => {
    expect(nameSelectionEnd('index.test.ts', false)).toBe(10);
    expect(nameSelectionEnd('Makefile', false)).toBe(8);
    expect(nameSelectionEnd('.env', false)).toBe(4);
    expect(nameSelectionEnd('v1.2', true)).toBe(4);
  });
});
