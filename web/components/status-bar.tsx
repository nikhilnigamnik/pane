import { COPY } from '@/config/copy';
import type { CursorPosition, EditorTab } from '@/types/editor';
import { cn } from '@/web/lib/cn';

interface StatusBarProps {
  tab: EditorTab | null;
  languageId: string | null;
  cursor: CursorPosition | null;
  isSaving: boolean;
}

function saveStatusLabel(tab: EditorTab, isSaving: boolean): string {
  if (isSaving) return COPY.STATUS_SAVING;
  return tab.isDirty ? COPY.STATUS_UNSAVED : COPY.STATUS_SAVED;
}

export function StatusBar({ tab, languageId, cursor, isSaving }: StatusBarProps) {
  return (
    <footer className="flex h-8 shrink-0 items-center justify-between gap-4 border-t border-theme-border-02 bg-theme-product-chrome px-3 text-product-base text-theme-text-sec">
      <span className="truncate font-mono">{tab?.path}</span>
      {/* A picture cannot be edited, so it has no save state, cursor or language to report. */}
      {tab?.kind === 'text' && (
        <div className="flex shrink-0 items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className={cn('size-1.5 rounded-full', tab.isDirty ? 'bg-theme-accent' : 'bg-theme-success')}
              aria-hidden
            />
            {saveStatusLabel(tab, isSaving)}
          </span>
          {cursor && (
            <span className="font-mono tabular-nums">
              {COPY.CURSOR_POSITION(cursor.line, cursor.column)}
            </span>
          )}
          {languageId && <span>{languageId}</span>}
        </div>
      )}
    </footer>
  );
}
