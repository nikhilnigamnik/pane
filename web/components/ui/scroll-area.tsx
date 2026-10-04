import * as RadixScrollArea from '@radix-ui/react-scroll-area';
import type { ReactNode } from 'react';

import { cn } from '@/web/lib/cn';

interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
}

// A scroll container with a slim overlay scrollbar that only shows while hovering or
// scrolling, instead of the browser's own bar.
export function ScrollArea({ children, className }: ScrollAreaProps) {
  return (
    <RadixScrollArea.Root className={cn('overflow-hidden', className)}>
      {/* Radix wraps the content in a table-display div, which lets long names widen the
          area instead of truncating. Making that wrapper a block restores truncation. */}
      <RadixScrollArea.Viewport className="size-full [&>div]:block!">
        {children}
      </RadixScrollArea.Viewport>
      <RadixScrollArea.Scrollbar
        orientation="vertical"
        className="flex w-2.5 touch-none p-0.5 select-none"
      >
        <RadixScrollArea.Thumb className="relative flex-1 rounded-full bg-theme-fg-20 transition-colors hover:bg-theme-text-tertiary" />
      </RadixScrollArea.Scrollbar>
    </RadixScrollArea.Root>
  );
}
