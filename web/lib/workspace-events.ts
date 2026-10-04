import { API_ROUTES, CHANGE_EVENT_NAME } from '@/config/routes';
import type { WorkspaceChange } from '@/types/api';

type ChangeListener = (change: WorkspaceChange) => void;

const EVERYTHING_CHANGED: WorkspaceChange = { paths: [], hasOverflowed: true };

// One connection is shared by every subscriber and only stays open while there is one.
const listeners = new Set<ChangeListener>();
let source: EventSource | null = null;

function notify(change: WorkspaceChange): void {
  for (const listener of listeners) listener(change);
}

function connect(): EventSource {
  const eventSource = new EventSource(API_ROUTES.EVENTS);
  let hasConnectedBefore = false;

  eventSource.addEventListener('open', () => {
    // The browser reconnects by itself after the server restarts. Changes made in between
    // were never reported, so everything on screen is re-checked.
    if (hasConnectedBefore) notify(EVERYTHING_CHANGED);
    hasConnectedBefore = true;
  });

  eventSource.addEventListener(CHANGE_EVENT_NAME, (event: MessageEvent<string>) => {
    try {
      notify(JSON.parse(event.data) as WorkspaceChange);
    } catch {
      // A malformed event is dropped; later ones still arrive.
    }
  });

  return eventSource;
}

export function subscribeToWorkspaceChanges(listener: ChangeListener): () => void {
  listeners.add(listener);
  source ??= connect();

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    source?.close();
    source = null;
  };
}
