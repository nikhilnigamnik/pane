import { z } from 'zod';

import { MAX_PATH_LENGTH, MAX_SEARCH_QUERY_LENGTH } from '@/config/server';

const relativePath = z.string().max(MAX_PATH_LENGTH);

export const treeQuerySchema = z.object({
  path: relativePath.default(''),
});

export const fileQuerySchema = z.object({
  path: relativePath.min(1),
});

export const searchQuerySchema = z.object({
  // A search runs line by line, so a query cannot span lines.
  query: z.string().min(1).max(MAX_SEARCH_QUERY_LENGTH).regex(/^[^\r\n]+$/),
  isCaseSensitive: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export const saveBodySchema = z.object({
  path: relativePath.min(1),
  content: z.string(),
  expectedMtimeMs: z.number().nullable(),
});
