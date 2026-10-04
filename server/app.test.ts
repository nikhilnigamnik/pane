import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { API_ROUTES, CHANGE_EVENT_NAME } from '@/config/routes';
import { MAX_SEARCH_QUERY_LENGTH } from '@/config/server';

import { createApp } from './app';
import { createWorkspace } from './workspace';

const LOCAL_HOST = '127.0.0.1:7878';
const LOCAL_ORIGIN = `http://${LOCAL_HOST}`;

let root: string;
let app: Hono;

function get(route: string, headers: Record<string, string> = {}) {
  return app.request(route, { headers: { host: LOCAL_HOST, ...headers } });
}

function put(body: unknown, headers: Record<string, string> = {}) {
  return app.request(API_ROUTES.FILE, {
    method: 'PUT',
    headers: { host: LOCAL_HOST, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'pane-app-test-'));
  await fs.writeFile(path.join(root, 'notes.txt'), 'one\n');
  app = createApp({ workspace: await createWorkspace(root), staticDir: null });
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('file API', () => {
  it('reads then saves a file over HTTP', async () => {
    const readResponse = await get(`${API_ROUTES.FILE}?path=notes.txt`);
    expect(readResponse.status).toBe(200);
    const read = await readResponse.json();
    expect(read.data.content).toBe('one\n');

    const saveResponse = await put(
      { path: 'notes.txt', content: 'two\n', expectedMtimeMs: read.data.mtimeMs },
      { origin: LOCAL_ORIGIN },
    );
    expect(saveResponse.status).toBe(200);
    expect(await fs.readFile(path.join(root, 'notes.txt'), 'utf8')).toBe('two\n');
  });

  it('maps errors to status codes', async () => {
    expect((await get(`${API_ROUTES.FILE}?path=missing.txt`)).status).toBe(404);
    expect((await get(`${API_ROUTES.FILE}?path=../etc/passwd`)).status).toBe(403);
    expect((await get(API_ROUTES.FILE)).status).toBe(400);
    await fs.writeFile(path.join(root, 'latin1.txt'), Buffer.from([0x63, 0x61, 0x66, 0xe9]));
    expect((await get(`${API_ROUTES.FILE}?path=latin1.txt`)).status).toBe(415);
    expect((await put({ path: 'notes.txt' })).status).toBe(400);
    expect((await put({ path: 'notes.txt', content: 'x', expectedMtimeMs: 1 })).status).toBe(409);
  });
});

describe('files API', () => {
  it('lists the files that quick open can jump to', async () => {
    await fs.mkdir(path.join(root, 'src'));
    await fs.writeFile(path.join(root, 'src', 'main.ts'), 'export {};\n');

    const response = await get(API_ROUTES.FILES);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual({ paths: ['notes.txt', 'src/main.ts'], isTruncated: false });
  });
});

describe('search API', () => {
  it('finds text and reports where it is', async () => {
    const response = await get(`${API_ROUTES.SEARCH}?query=ONE`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.matchCount).toBe(1);
    expect(body.data.files).toEqual([
      {
        path: 'notes.txt',
        matches: [
          {
            line: 1,
            column: 1,
            length: 3,
            preview: 'one',
            previewOffset: 0,
            isClippedAtStart: false,
          },
        ],
      },
    ]);
  });

  it('honors the match case option', async () => {
    const response = await get(`${API_ROUTES.SEARCH}?query=ONE&isCaseSensitive=true`);
    expect((await response.json()).data.matchCount).toBe(0);
  });

  it('rejects a missing, multi-line or oversized query', async () => {
    const longQuery = 'a'.repeat(MAX_SEARCH_QUERY_LENGTH + 1);

    expect((await get(API_ROUTES.SEARCH)).status).toBe(400);
    expect((await get(`${API_ROUTES.SEARCH}?query=`)).status).toBe(400);
    expect((await get(`${API_ROUTES.SEARCH}?query=one%0Atwo`)).status).toBe(400);
    expect((await get(`${API_ROUTES.SEARCH}?query=${longQuery}`)).status).toBe(400);
    expect((await get(`${API_ROUTES.SEARCH}?query=one&isCaseSensitive=maybe`)).status).toBe(400);
  });

  it('does not search files reached through a symlink out of the workspace', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'pane-app-outside-'));
    try {
      await fs.writeFile(path.join(outside, 'private.txt'), 'top secret one\n');
      await fs.symlink(path.join(outside, 'private.txt'), path.join(root, 'linked.txt'));
      await fs.symlink(outside, path.join(root, 'linked-folder'));

      const body = await (await get(`${API_ROUTES.SEARCH}?query=secret`)).json();
      expect(body.data).toEqual({ files: [], matchCount: 0, isTruncated: false });
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});

describe('raw API', () => {
  // A complete one-pixel GIF.
  const gifBytes = Buffer.from('R0lGODlhAQABAAAAACwAAAAAAQABAAA=', 'base64');

  it('serves an image with headers that stop it running as a page', async () => {
    await fs.writeFile(path.join(root, 'pixel.gif'), gifBytes);

    const response = await get(`${API_ROUTES.RAW}?path=pixel.gif`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/gif');
    expect(response.headers.get('content-security-policy')).toContain('sandbox');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(gifBytes);
  });

  it('refuses anything that is not an image inside the workspace', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'pane-app-outside-'));
    try {
      await fs.writeFile(path.join(outside, 'photo.gif'), gifBytes);
      await fs.symlink(path.join(outside, 'photo.gif'), path.join(root, 'link.gif'));
      const escapePath = encodeURIComponent(`../${path.basename(outside)}/photo.gif`);

      expect((await get(`${API_ROUTES.RAW}?path=notes.txt`)).status).toBe(415);
      expect((await get(`${API_ROUTES.RAW}?path=missing.gif`)).status).toBe(404);
      expect((await get(API_ROUTES.RAW)).status).toBe(400);
      expect((await get(`${API_ROUTES.RAW}?path=${escapePath}`)).status).toBe(403);
      expect((await get(`${API_ROUTES.RAW}?path=link.gif`)).status).toBe(403);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});

describe('events API', () => {
  it('streams the paths of files that change on disk', async () => {
    const response = await get(API_ROUTES.EVENTS);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    if (!response.body) throw new Error('Expected a streaming body');

    // A new watcher takes a moment to report, so the file is rewritten until it does.
    const writes = setInterval(() => {
      void fs.writeFile(path.join(root, 'notes.txt'), 'changed\n');
    }, 50);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let received = '';
    try {
      while (!received.includes('notes.txt')) {
        const { done, value } = await reader.read();
        if (done) break;
        received += decoder.decode(value, { stream: true });
      }
    } finally {
      clearInterval(writes);
      // Cancelling is what a closed browser tab looks like; it also stops the disk watcher.
      await reader.cancel();
    }

    expect(received).toContain(`event: ${CHANGE_EVENT_NAME}`);
    expect(received).toMatch(/"paths":\[[^\]]*"notes\.txt"/);
  });
});

describe('request guards', () => {
  it('rejects requests addressed to a non-loopback host', async () => {
    const response = await get(API_ROUTES.META, { host: 'evil.example:7878' });
    expect(response.status).toBe(403);
  });

  it('rejects requests with no host header', async () => {
    const response = await app.request(API_ROUTES.META);
    expect(response.status).toBe(403);
  });

  it('rejects API calls coming from another website', async () => {
    const save = { path: 'notes.txt', content: 'hacked\n', expectedMtimeMs: null };

    expect((await put(save, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await put(save, { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect((await get(API_ROUTES.META, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await get(API_ROUTES.EVENTS, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await get(API_ROUTES.FILES, { origin: 'https://evil.example' })).status).toBe(403);
    expect(
      (await get(`${API_ROUTES.SEARCH}?query=one`, { 'sec-fetch-site': 'cross-site' })).status,
    ).toBe(403);
    expect(
      (await get(`${API_ROUTES.RAW}?path=notes.txt`, { 'sec-fetch-site': 'cross-site' })).status,
    ).toBe(403);
    expect(await fs.readFile(path.join(root, 'notes.txt'), 'utf8')).toBe('one\n');
  });

  it('rejects writes that are not JSON', async () => {
    const response = await put(
      { path: 'notes.txt', content: 'x', expectedMtimeMs: null },
      { 'content-type': 'text/plain' },
    );
    expect(response.status).toBe(400);
    expect(await fs.readFile(path.join(root, 'notes.txt'), 'utf8')).toBe('one\n');
  });

  it('allows the Vite dev origin on localhost', async () => {
    const response = await get(API_ROUTES.META, { origin: 'http://localhost:5173' });
    expect(response.status).toBe(200);
  });
});
