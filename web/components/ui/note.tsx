import { CircleAlert, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { ICON_SIZE, ICON_STROKE_WIDTH } from '@/config/ui';
import { cn } from '@/web/lib/cn';

type NoteVariant = 'warning' | 'error';

interface NoteProps {
  variant: NoteVariant;
  children: ReactNode;
  action?: ReactNode;
}

const VARIANT_CLASSES: Record<NoteVariant, string> = {
  warning: 'border-theme-accent/25 bg-theme-accent/10',
  error: 'border-theme-error/25 bg-theme-error/10',
};

// Only the icon carries the status color; the message stays in the text color so it reads
// clearly on the tinted background.
const VARIANT_ICON_CLASSES: Record<NoteVariant, string> = {
  warning: 'text-theme-accent',
  error: 'text-theme-error',
};

const VARIANT_ICON = {
  warning: TriangleAlert,
  error: CircleAlert,
} as const;

export function Note({ variant, children, action }: NoteProps) {
  const Icon = VARIANT_ICON[variant];

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-center gap-3 rounded-md border py-1.5 pl-3 pr-1.5 text-product-lg text-theme-text',
        VARIANT_CLASSES[variant],
      )}
    >
      <Icon
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE_WIDTH}
        className={cn('shrink-0', VARIANT_ICON_CLASSES[variant])}
        aria-hidden
      />
      <span className="min-w-0 flex-1">{children}</span>
      {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
    </div>
  );
}
