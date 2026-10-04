import * as RadixScrollArea from '@radix-ui/react-scroll-area';
import type { ComponentProps } from 'react';

import { cn } from '@/web/lib/cn';

// Other props, a ref included, reach the outer element, so a ScrollArea can be the trigger of a
// Radix context menu.
type ScrollAreaProps = ComponentProps<typeof RadixScrollArea.Root> & {
  // Also scrolls sideways, for content wider than the area such as a table.
  isHorizontal?: boolean;
};

const SCROLLBAR_CLASSES = 'flex touch-none p-0.5 select-none';
const THUMB_CLASSES =
  'relative flex-1 rounded-full bg-theme-fg-20 transition-colors hover:bg-theme-text-tertiary';

// A scroll container with a slim overlay scrollbar that only shows while hovering or
// scrolling, instead of the browser's own bar.
export function ScrollArea({ children, className, isHorizontal = false, ...props }: ScrollAreaProps) {
  return (
    <RadixScrollArea.Root {...props} className={cn('overflow-hidden', className)}>
      {/* Radix wraps the content in a table-display div, which lets long names widen the
          area instead of truncating. Making that wrapper a block restores truncation. */}
      <RadixScrollArea.Viewport className="size-full [&>div]:block!">
        {children}
      </RadixScrollArea.Viewport>
      <RadixScrollArea.Scrollbar orientation="vertical" className={cn(SCROLLBAR_CLASSES, 'w-2.5')}>
        <RadixScrollArea.Thumb className={THUMB_CLASSES} />
      </RadixScrollArea.Scrollbar>
      {isHorizontal && (
        <RadixScrollArea.Scrollbar orientation="horizontal" className={cn(SCROLLBAR_CLASSES, 'h-2.5 flex-col')}>
          <RadixScrollArea.Thumb className={THUMB_CLASSES} />
        </RadixScrollArea.Scrollbar>
      )}
    </RadixScrollArea.Root>
  );
}
