import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { COPY } from '@/config/copy';
import { ICON_SIZE_SMALL, ICON_STROKE_WIDTH } from '@/config/ui';
import type { EditorTab } from '@/types/editor';
import { cn } from '@/web/lib/cn';

import { Button } from './ui/button';

interface TabBarProps {
  tabs: EditorTab[];
  activePath: string | null;
  // Controls for the tab on screen. They stay at the right edge while the tabs scroll.
  actions?: ReactNode;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export function TabBar({ tabs, activePath, actions, onSelect, onClose }: TabBarProps) {
  return (
    <div className="flex h-10 shrink-0 border-b border-theme-border-02 bg-theme-product-chrome">
      <div
        role="tablist"
        aria-label={COPY.OPEN_TABS_LABEL}
        className="flex min-w-0 flex-1 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const isActive = tab.path === activePath;

          return (
            <div
              key={tab.path}
              className={cn(
                'relative flex shrink-0 items-center border-r border-theme-border-02 transition-colors',
                isActive
                  ? 'bg-theme-product-editor text-theme-text'
                  : 'text-theme-text-sec hover:text-theme-text',
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                title={tab.path}
                onClick={() => onSelect(tab.path)}
                className="flex h-full cursor-pointer items-center gap-2 pl-3 pr-1.5 text-product-lg outline-none focus-visible:shadow-focus-ring"
              >
                <span className="max-w-48 truncate">{tab.name}</span>
                {tab.isDirty && (
                  <span
                    role="img"
                    aria-label={COPY.UNSAVED_BADGE}
                    title={COPY.UNSAVED_BADGE}
                    className="size-1.5 shrink-0 rounded-full bg-theme-fg"
                  />
                )}
              </button>
              <Button
                variant="tertiary"
                size="tiny"
                isSquare
                aria-label={COPY.CLOSE_TAB(tab.name)}
                title={COPY.CLOSE_TAB(tab.name)}
                onClick={() => onClose(tab.path)}
                className="mr-1.5"
              >
                <X size={ICON_SIZE_SMALL} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
              </Button>
              {isActive && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-theme-fg" aria-hidden />}
            </div>
          );
        })}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-1 border-l border-theme-border-02 px-2">
          {actions}
        </div>
      )}
    </div>
  );
}
