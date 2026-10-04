export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type JsonKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export type JsonParseResult = { isValid: true; value: JsonValue } | { isValid: false; error: string };

const BYTE_ORDER_MARK = '﻿';

export function parseJson(text: string): JsonParseResult {
  const source = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
  try {
    return { isValid: true, value: JSON.parse(source) as JsonValue };
  } catch (error) {
    return { isValid: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function jsonKind(value: JsonValue): JsonKind {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') return 'string';
  return typeof value === 'number' ? 'number' : 'boolean';
}

// The keys and values inside an object or array, in order. Array keys are the indexes.
export function jsonChildren(value: JsonValue): [string, JsonValue][] {
  if (Array.isArray(value)) return value.map((item, index) => [String(index), item]);
  if (value !== null && typeof value === 'object') return Object.entries(value);
  return [];
}

// How a value is written in the tree: strings keep their quotes, as in the source.
export function formatJsonPrimitive(value: JsonValue): string {
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}
