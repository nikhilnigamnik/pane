import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, RefObject } from 'react';

import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_KEYBOARD_STEP,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
  SIDEBAR_WIDTH_VARIABLE,
} from '@/config/ui';

interface ResizeHandleProps {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onLostPointerCapture: () => void;
  onDoubleClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

interface SidebarWidthState {
  sidebarRef: RefObject<HTMLElement | null>;
  width: number;
  isResizing: boolean;
  handleProps: ResizeHandleProps;
}

function clampWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

function readStoredWidth(): number {
  try {
    const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
    return Number.isFinite(stored) && stored > 0 ? clampWidth(stored) : SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

function widthAfterKey(key: string, width: number): number | null {
  if (key === 'ArrowLeft') return width - SIDEBAR_KEYBOARD_STEP;
  if (key === 'ArrowRight') return width + SIDEBAR_KEYBOARD_STEP;
  if (key === 'Home') return SIDEBAR_MIN_WIDTH;
  if (key === 'End') return SIDEBAR_MAX_WIDTH;
  if (key === 'Enter') return SIDEBAR_DEFAULT_WIDTH;
  return null;
}

export function useSidebarWidth(): SidebarWidthState {
  const sidebarRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(readStoredWidth);
  const [isResizing, setIsResizing] = useState(false);
  const draftWidth = useRef(width);

  // The width lives in a CSS variable on the sidebar, so a drag can move the edge without
  // re-rendering the file tree on every pointer move.
  const applyWidth = useCallback((next: number) => {
    draftWidth.current = next;
    sidebarRef.current?.style.setProperty(SIDEBAR_WIDTH_VARIABLE, `${next}px`);
  }, []);

  useLayoutEffect(() => {
    applyWidth(width);
  }, [applyWidth, width]);

  const commitWidth = useCallback(
    (next: number) => {
      const clamped = clampWidth(next);
      applyWidth(clamped);
      setWidth(clamped);
      try {
        window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clamped));
      } catch {
        // Storage can be blocked (private windows); the width then lasts for this visit only.
      }
    },
    [applyWidth],
  );

  const handleProps: ResizeHandleProps = {
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      // Stops the drag from selecting text. Capturing keeps the moves coming to the handle
      // even while the pointer is over the editor.
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsResizing(true);
    },
    onPointerMove: (event) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      applyWidth(clampWidth(event.clientX - left));
    },
    // Fires when the button is released and also when the drag is interrupted.
    onLostPointerCapture: () => {
      setIsResizing(false);
      commitWidth(draftWidth.current);
    },
    onDoubleClick: () => commitWidth(SIDEBAR_DEFAULT_WIDTH),
    onKeyDown: (event) => {
      const next = widthAfterKey(event.key, width);
      if (next === null) return;
      event.preventDefault();
      commitWidth(next);
    },
  };

  return { sidebarRef, width, isResizing, handleProps };
}
