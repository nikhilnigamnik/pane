import { useCallback, useSyncExternalStore } from 'react';

import { getModel } from '@/web/lib/models';

// The current text of an open file, including edits that are not saved yet. It follows the
// editor as the user types and as the file changes on disk.
export function useModelText(path: string): string {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const listener = getModel(path)?.onDidChangeContent(onChange);
      return () => listener?.dispose();
    },
    [path],
  );

  return useSyncExternalStore(subscribe, () => getModel(path)?.getValue() ?? '');
}
