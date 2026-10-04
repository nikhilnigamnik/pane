import { describe, expect, it } from 'vitest';

import { formatJsonPrimitive, jsonChildren, jsonKind, parseJson } from './json-tree';

describe('parseJson', () => {
  it('parses valid JSON, a byte order mark included', () => {
    expect(parseJson('﻿{"a":[1,2]}')).toEqual({ isValid: true, value: { a: [1, 2] } });
  });

  it('reports why invalid JSON failed', () => {
    const result = parseJson('{"a": 1,}');
    expect(result.isValid).toBe(false);
    if (!result.isValid) expect(result.error.length).toBeGreaterThan(0);
  });
});

describe('json helpers', () => {
  it('names the kind of each value', () => {
    expect([{}, [], 'x', 1, true, null].map(jsonKind)).toEqual([
      'object',
      'array',
      'string',
      'number',
      'boolean',
      'null',
    ]);
  });

  it('lists children with keys or indexes', () => {
    expect(jsonChildren({ b: 1, a: 2 })).toEqual([
      ['b', 1],
      ['a', 2],
    ]);
    expect(jsonChildren(['x', 'y'])).toEqual([
      ['0', 'x'],
      ['1', 'y'],
    ]);
    expect(jsonChildren('text')).toEqual([]);
  });

  it('writes primitives as they appear in JSON', () => {
    expect(formatJsonPrimitive('say "hi"')).toBe('"say \\"hi\\""');
    expect(formatJsonPrimitive(null)).toBe('null');
    expect(formatJsonPrimitive(1.5)).toBe('1.5');
  });
});
