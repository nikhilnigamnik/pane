import { Hono } from 'hono';
import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { streamSSE } from 'hono/streaming';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { API_PREFIX, API_ROUTES, CHANGE_EVENT_NAME } from '@/config/routes';
import { LOOPBACK_HOSTNAMES, MAX_SAVE_BODY_BYTES } from '@/config/server';
import type { ApiErrorCode, Result, WorkspaceMeta } from '@/types/api';

import { fail, ok } from './result';
import { fileQuerySchema, saveBodySchema, searchQuerySchema, treeQuerySchema } from './schema';
import { searchWorkspace } from './search';
import { createStaticHandler } from './static';
import { createWatcher } from './watcher';
import { listDirectory, listFiles, readFile, readImage, writeFile } from './workspace';
import type { Workspace } from './workspace';

export interface AppOptions {
  workspace: Workspace;
  // null when the UI is served elsewhere (the Vite dev server).
  staticDir: string | null;
}

const STATUS_BY_ERROR: Record<ApiErrorCode, ContentfulStatusCode> = {
  invalid_request: 400,
  forbidden: 403,
  outside_workspace: 403,
  not_found: 404,
  not_a_file: 400,
  not_a_directory: 400,
  too_large: 413,
  binary: 415,
  not_an_image: 415,
  unsupported_encoding: 415,
  conflict: 409,
  io_error: 500,
};

const JSON_CONTENT_TYPE = 'application/json';

// A workspace file is untrusted content served from this server's own address. An SVG opened
// as a page could otherwise run scripts with access to the file API, so raw responses are
// sandboxed, never sniffed into another type and never embeddable by other sites.
const RAW_RESPONSE_HEADERS = {
  'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'",
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cache-Control': 'no-store',
};

function respond<T>(c: Context, result: Result<T>) {
  return c.json(result, result.success ? 200 : STATUS_BY_ERROR[result.error.code]);
}

function isLoopbackHost(host: string | undefined): boolean {
  if (!host) return false;
  try {
    return LOOPBACK_HOSTNAMES.includes(new URL(`http://${host}`).hostname);
  } catch {
    return false;
  }
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    return LOOPBACK_HOSTNAMES.includes(new URL(origin).hostname);
  } catch {
    return false;
  }
}

// A website can point its own domain at 127.0.0.1 (DNS rebinding) to reach this server from
// the user's browser. It cannot fake the Host header, so only loopback hostnames are served.
const requireLoopbackHost: MiddlewareHandler = async (c, next) => {
  if (!isLoopbackHost(c.req.header('host'))) return respond(c, fail('forbidden'));
  await next();
};

// Stops other websites from calling the file API through the user's browser.
const rejectCrossSiteCalls: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header('origin');
  const isForeignOrigin = origin !== undefined && !isLoopbackOrigin(origin);
  const isCrossSite = c.req.header('sec-fetch-site') === 'cross-site';
  if (isForeignOrigin || isCrossSite) return respond(c, fail('forbidden'));
  await next();
};

export function createApp({ workspace, staticDir }: AppOptions): Hono {
  const app = new Hono();
  const watcher = createWatcher(workspace);

  app.use('*', requireLoopbackHost);
  app.use(`${API_PREFIX}/*`, rejectCrossSiteCalls);

  app.get(API_ROUTES.META, (c) => {
    const meta: WorkspaceMeta = { name: workspace.name, rootPath: workspace.root };
    return respond(c, ok(meta));
  });

  app.get(API_ROUTES.TREE, async (c) => {
    const query = treeQuerySchema.safeParse(c.req.query());
    if (!query.success) return respond(c, fail('invalid_request'));
    return respond(c, await listDirectory(workspace, query.data.path));
  });

  app.get(API_ROUTES.FILE, async (c) => {
    const query = fileQuerySchema.safeParse(c.req.query());
    if (!query.success) return respond(c, fail('invalid_request'));
    return respond(c, await readFile(workspace, query.data.path));
  });

  app.get(API_ROUTES.FILES, async (c) => respond(c, await listFiles(workspace)));

  app.get(API_ROUTES.SEARCH, async (c) => {
    const query = searchQuerySchema.safeParse(c.req.query());
    if (!query.success) return respond(c, fail('invalid_request'));
    // The signal fires when the browser drops the request, which it does on every keystroke.
    const options = { ...query.data, signal: c.req.raw.signal };
    return respond(c, await searchWorkspace(workspace, options));
  });

  app.get(API_ROUTES.RAW, async (c) => {
    const query = fileQuerySchema.safeParse(c.req.query());
    if (!query.success) return respond(c, fail('invalid_request'));

    const image = await readImage(workspace, query.data.path);
    if (!image.success) return respond(c, image);
    return c.body(new Uint8Array(image.data.bytes), 200, {
      'Content-Type': image.data.mimeType,
      ...RAW_RESPONSE_HEADERS,
    });
  });

  app.put(
    API_ROUTES.FILE,
    bodyLimit({
      maxSize: MAX_SAVE_BODY_BYTES,
      onError: (c) => respond(c, fail('too_large')),
    }),
    async (c) => {
      // Requiring JSON forces browsers to preflight cross-origin writes, which are never allowed.
      if (!c.req.header('content-type')?.startsWith(JSON_CONTENT_TYPE)) {
        return respond(c, fail('invalid_request'));
      }

      let payload: unknown;
      try {
        payload = await c.req.json();
      } catch {
        return respond(c, fail('invalid_request'));
      }

      const body = saveBodySchema.safeParse(payload);
      if (!body.success) return respond(c, fail('invalid_request'));
      return respond(c, await writeFile(workspace, body.data));
    },
  );

  app.get(API_ROUTES.EVENTS, (c) =>
    streamSSE(c, async (stream) => {
      const unsubscribe = watcher.subscribe((change) => {
        void stream.writeSSE({ event: CHANGE_EVENT_NAME, data: JSON.stringify(change) });
      });

      // Returning would end the response, so this waits until the browser disconnects.
      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          unsubscribe();
          resolve();
        });
      });
    }),
  );

  app.all(`${API_PREFIX}/*`, (c) => respond(c, fail('not_found')));

  if (staticDir) app.get('*', createStaticHandler(staticDir));

  return app;
}
