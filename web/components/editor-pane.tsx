import type { ReactNode } from 'react';

import { COPY } from '@/config/copy';
import type { ActionRequest, CursorPosition, EditorTab, RevealRequest } from '@/types/editor';

import { CodeEditor } from './code-editor';
import { FilePreview } from './file-preview';
import { Button } from './ui/button';
import { Note } from './ui/note';

interface EditorPaneProps {
  tab: EditorTab | null;
  isPreviewing: boolean;
  revealRequest: RevealRequest | null;
  actionRequest: ActionRequest | null;
  // Shown under the conflict banner, such as an error from the last action.
  notice?: ReactNode;
  // Shown when no file is open.
  emptyState?: ReactNode;
  onFocus: () => void;
  onContentChange: (path: string) => void;
  onCursorChange: (position: CursorPosition | null) => void;
  onOpenFile: (path: string) => void;
  onReload: (path: string) => void;
  onOverwrite: (path: string) => void;
}

// One view of a file: the editor, a preview over it, and the banners above them. The main
// area and the side view each have one.
export function EditorPane({
  tab,
  isPreviewing,
  revealRequest,
  actionRequest,
  notice,
  emptyState,
  onFocus,
  onContentChange,
  onCursorChange,
  onOpenFile,
  onReload,
  onOverwrite,
}: EditorPaneProps) {
  const hasConflict = tab?.hasConflict === true;

  return (
    // Capturing focus and clicks marks this pane as the one that shortcuts act on, also when
    // the click lands on a preview that cannot take focus.
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      onFocusCapture={onFocus}
      onPointerDownCapture={onFocus}
    >
      {(hasConflict || notice) && (
        <div className="flex flex-col gap-2 border-b border-theme-border-02 p-2">
          {tab && hasConflict && (
            <Note
              variant="warning"
              action={
                <>
                  <Button size="tiny" onClick={() => onReload(tab.path)}>
                    {COPY.CONFLICT_RELOAD}
                  </Button>
                  <Button size="tiny" variant="primary" onClick={() => onOverwrite(tab.path)}>
                    {COPY.CONFLICT_OVERWRITE}
                  </Button>
                </>
              }
            >
              {COPY.CONFLICT_MESSAGE}
            </Note>
          )}
          {notice}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <CodeEditor
          activePath={tab?.path ?? null}
          isHidden={isPreviewing}
          revealRequest={revealRequest}
          actionRequest={actionRequest}
          onContentChange={onContentChange}
          onCursorChange={onCursorChange}
          onFocus={onFocus}
        />
        {!tab && emptyState}
        {tab && isPreviewing && <FilePreview key={tab.path} tab={tab} onOpenFile={onOpenFile} />}
      </div>
    </div>
  );
}
