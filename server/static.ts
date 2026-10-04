import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { Handler } from 'hono';

import { FALLBACK_MIME_TYPE, MIME_TYPES, STATIC_INDEX_FILE } from '@/config/server';

import { isInside } from './paths';

const HASHED_ASSET_PREFIX = '/assets/';
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const NO_CACHE = 'no-cache';

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function decodePathname(url: string): string | null {
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }
}

export function createStaticHandler(staticDir: string): Handler {
  const indexPath = path.join(staticDir, STATIC_INDEX_FILE);

  return async (c) => {
    const pathname = decodePathname(c.req.url);
    const requested = pathname ? path.join(staticDir, pathname) : indexPath;
    const isServable = isInside(staticDir, requested) && (await isFile(requested));
    // Anything that is not a real asset gets the app shell, which handles its own state.
    const filePath = isServable ? requested : indexPath;

    const body = await fs.readFile(filePath);
    const mimeType = MIME_TYPES[path.extname(filePath).toLowerCase()] ?? FALLBACK_MIME_TYPE;
    const isHashedAsset = isServable && pathname?.startsWith(HASHED_ASSET_PREFIX) === true;

    return c.body(new Uint8Array(body), 200, {
      'Content-Type': mimeType,
      'Cache-Control': isHashedAsset ? IMMUTABLE_CACHE : NO_CACHE,
    });
  };
}
