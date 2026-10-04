import * as RadixContextMenu from '@radix-ui/react-context-menu';
import type { ReactNode } from 'react';

import { cn } from '@/web/lib/cn';

interface ContextMenuProps {
  // The area that opens the menu on right-click.
  children: ReactNode;
  // The items. Leave it empty to keep the browser's own menu for that click.
  content: ReactNode;
  onOpenChange?: (isOpen: boolean) => void;
}

interface ContextMenuItemProps {
  children: ReactNode;
  // A key hint shown at the right edge, such as "F2".
  shortcut?: string;
  isDestructive?: boolean;
  onSelect: () => void;
}

export function ContextMenu({ children, content, onOpenChange }: ContextMenuProps) {
  return (
    <RadixContextMenu.Root onOpenChange={onOpenChange}>
      <RadixContextMenu.Trigger asChild>{children}</RadixContextMenu.Trigger>
      <RadixContextMenu.Portal>
        <RadixContextMenu.Content
          // Without this the menu can sit flush against the edge of the window.
          collisionPadding={8}
          className="z-50 min-w-52 rounded-md border border-theme-border-02 bg-theme-card-02 p-1 shadow-flyout outline-none"
        >
          {content}
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  );
}

export function ContextMenuItem({ children, shortcut, isDestructive, onSelect }: ContextMenuItemProps) {
  return (
    <RadixContextMenu.Item
      onSelect={onSelect}
      className={cn(
        'flex h-7 cursor-pointer items-center justify-between gap-6 rounded-xs px-2 text-product-lg outline-none select-none',
        'data-highlighted:bg-theme-fg-10',
        isDestructive ? 'text-theme-error' : 'text-theme-text',
      )}
    >
      <span>{children}</span>
      {shortcut && <span className="text-product-base text-theme-text-tertiary">{shortcut}</span>}
    </RadixContextMenu.Item>
  );
}

export function ContextMenuSeparator() {
  return <RadixContextMenu.Separator className="mx-1 my-1 h-px bg-theme-border-02" />;
}
