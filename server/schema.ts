import { z } from 'zod';

import {
  MAX_PATH_LENGTH,
  MAX_SEARCH_FILTER_LENGTH,
  MAX_SEARCH_QUERY_LENGTH,
} from '@/config/server';

const relativePath = z.string().max(MAX_PATH_LENGTH);

// Query strings carry flags as the words "true" and "false".
const queryFlag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const pathFilter = z.string().max(MAX_SEARCH_FILTER_LENGTH).default('');

export const treeQuerySchema = z.object({
  path: relativePath.default(''),
});

export const fileQuerySchema = z.object({
  path: relativePath.min(1),
});

export const searchQuerySchema = z.object({
  // A search runs line by line, so a query cannot span lines.
  query: z.string().min(1).max(MAX_SEARCH_QUERY_LENGTH).regex(/^[^\r\n]+$/),
  isCaseSensitive: queryFlag,
  isWholeWord: queryFlag,
  isRegex: queryFlag,
  include: pathFilter,
  exclude: pathFilter,
});

const entryKind = z.enum(['file', 'directory']);

export const createEntryBodySchema = z.object({
  path: relativePath.min(1),
  kind: entryKind,
});

export const renameEntryBodySchema = z.object({
  fromPath: relativePath.min(1),
  toPath: relativePath.min(1),
});

export const deleteEntryBodySchema = z.object({
  path: relativePath.min(1),
});

export const saveBodySchema = z.object({
  path: relativePath.min(1),
  content: z.string(),
  expectedMtimeMs: z.number().nullable(),
});
