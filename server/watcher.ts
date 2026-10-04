import { watch } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import path from 'node:path';

import { IGNORED_ENTRY_NAMES, MAX_WATCH_BATCH_PATHS, WATCH_DEBOUNCE_MS } from '@/config/server';
import type { WorkspaceChange } from '@/types/api';

import type { Workspace } from './workspace';

type ChangeListener = (change: WorkspaceChange) => void;

export interface WorkspaceWatcher {
  subscribe: (listener: ChangeListener) => () => void;
}

// Reports which paths changed, never their contents. Readers still fetch files through the
// guarded routes. The disk is only watched while someone is subscribed.
export function createWatcher(workspace: Workspace): WorkspaceWatcher {
  const listeners = new Set<ChangeListener>();
  const pendingPaths = new Set<string>();
  let hasOverflowed = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let fsWatcher: FSWatcher | null = null;

  function flush(): void {
    flushTimer = null;
    const change: WorkspaceChange = {
      paths: hasOverflowed ? [] : [...pendingPaths],
      hasOverflowed,
    };
    pendingPaths.clear();
    hasOverflowed = false;
    for (const listener of listeners) listener(change);
  }

  function record(filename: string | null): void {
    if (filename === null) {
      // Some platforms leave the name out, so the only safe answer is "re-check everything".
      hasOverflowed = true;
    } else {
      // macOS reports a change to the opened folder itself under that folder's own name. It
      // is passed on like any other path: the browser only uses paths to decide what to
      // re-check, so the worst outcome is one extra refresh of the top level.
      const segments = filename.split(path.sep);
      if (segments.some((segment) => IGNORED_ENTRY_NAMES.includes(segment))) return;
      if (pendingPaths.size >= MAX_WATCH_BATCH_PATHS) hasOverflowed = true;
      else pendingPaths.add(segments.join('/'));
    }
    // The timer is not restarted by later events, so a steady stream of writes cannot hold
    // a batch back forever.
    flushTimer ??= setTimeout(flush, WATCH_DEBOUNCE_MS);
  }

  function stop(): void {
    fsWatcher?.close();
    fsWatcher = null;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    pendingPaths.clear();
    hasOverflowed = false;
  }

  function start(): void {
    try {
      fsWatcher = watch(workspace.root, { recursive: true }, (_eventType, filename) => {
        record(filename);
      });
      // For example the opened folder was deleted. The UI keeps working without live updates.
      fsWatcher.on('error', stop);
    } catch {
      // Recursive watching is not available on every platform; manual refresh still works.
      fsWatcher = null;
    }
  }

  return {
    subscribe(listener) {
      if (listeners.size === 0) start();
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
  };
}
