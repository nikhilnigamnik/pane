import { Code, Eye, X } from 'lucide-react';

import { COPY } from '@/config/copy';
import { ICON_SIZE_SMALL, ICON_STROKE_WIDTH } from '@/config/ui';
import type { EditorTab } from '@/types/editor';

import { Button } from './ui/button';

interface SidePaneHeaderProps {
  tab: EditorTab;
  isPreviewing: boolean;
  canTogglePreview: boolean;
  onTogglePreview: () => void;
  onClose: () => void;
}

// Takes the place of a tab bar above the side view. It lines up with the tab bar on the left.
export function SidePaneHeader({
  tab,
  isPreviewing,
  canTogglePreview,
  onTogglePreview,
  onClose,
}: SidePaneHeaderProps) {
  const PreviewIcon = isPreviewing ? Code : Eye;
  const previewLabel = isPreviewing ? COPY.SHOW_SOURCE : COPY.SHOW_PREVIEW;

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-theme-border-02 bg-theme-product-chrome pl-3 pr-2">
      <span className="truncate text-product-lg text-theme-text" title={tab.path}>
        {tab.name}
      </span>
      {tab.isDirty && (
        <span
          role="img"
          aria-label={COPY.UNSAVED_BADGE}
          title={COPY.UNSAVED_BADGE}
          className="size-1.5 shrink-0 rounded-full bg-theme-fg"
        />
      )}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {canTogglePreview && (
          <Button variant="tertiary" size="tiny" title={previewLabel} onClick={onTogglePreview}>
            <PreviewIcon size={ICON_SIZE_SMALL} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
            {previewLabel}
          </Button>
        )}
        <Button
          variant="tertiary"
          size="tiny"
          isSquare
          aria-label={COPY.CLOSE_SIDE_VIEW}
          title={COPY.CLOSE_SIDE_VIEW}
          onClick={onClose}
        >
          <X size={ICON_SIZE_SMALL} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
        </Button>
      </div>
    </div>
  );
}
