import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

// Lets long-lived callbacks read the newest value without being recreated on every render.
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
