import * as monaco from 'monaco-editor';
import { useEffect, useRef } from 'react';

import { EDITOR_OPTIONS } from '@/config/editor';
import type { ActionRequest, CursorPosition, RevealRequest } from '@/types/editor';
import { useLatest } from '@/web/hooks/use-latest';
import { cn } from '@/web/lib/cn';
import { applyEditorTheme } from '@/web/lib/editor-theme';
import { getModel, modelPath } from '@/web/lib/models';

interface CodeEditorProps {
  activePath: string | null;
  // True while a preview covers the editor. A hidden editor must not take key presses.
  isHidden: boolean;
  revealRequest: RevealRequest | null;
  actionRequest: ActionRequest | null;
  onContentChange: (path: string) => void;
  onCursorChange: (position: CursorPosition | null) => void;
  onFocus: () => void;
}

function toCursor(position: monaco.Position | null): CursorPosition | null {
  return position ? { line: position.lineNumber, column: position.column } : null;
}

export function CodeEditor({
  activePath,
  isHidden,
  revealRequest,
  actionRequest,
  onContentChange,
  onCursorChange,
  onFocus,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const viewStates = useRef(new Map<string, monaco.editor.ICodeEditorViewState>());
  const shownPath = useRef<string | null>(null);
  const appliedRevealId = useRef(0);
  const appliedActionId = useRef(0);
  const handlers = useLatest({ onContentChange, onCursorChange, onFocus });

  // One editor instance for the whole app; tabs swap its model instead of recreating it.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const editor = monaco.editor.create(container, { ...EDITOR_OPTIONS, model: null });
    editorRef.current = editor;

    const contentListener = editor.onDidChangeModelContent(() => {
      const model = editor.getModel();
      if (!model) return;
      const path = modelPath(model);
      // Monaco tells editors about an undo before it puts back the version id that marks the
      // text as saved, so the dirty check waits until the undo has finished.
      queueMicrotask(() => handlers.current.onContentChange(path));
    });
    const cursorListener = editor.onDidChangeCursorPosition((event) => {
      handlers.current.onCursorChange(toCursor(event.position));
    });
    const focusListener = editor.onDidFocusEditorWidget(() => handlers.current.onFocus());

    return () => {
      contentListener.dispose();
      cursorListener.dispose();
      focusListener.dispose();
      editor.dispose();
      editorRef.current = null;
      shownPath.current = null;
    };
  }, [handlers]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Remember scroll and cursor of the tab being left. A closed tab's model is already gone,
    // in which case there is nothing to save and its old entry is dropped.
    const previousPath = shownPath.current;
    if (previousPath && previousPath !== activePath) {
      const viewState = getModel(previousPath) ? editor.saveViewState() : null;
      if (viewState) viewStates.current.set(previousPath, viewState);
      else viewStates.current.delete(previousPath);
    }

    const model = activePath ? getModel(activePath) : null;
    editor.setModel(model);
    shownPath.current = model ? activePath : null;

    if (activePath && model) {
      const viewState = viewStates.current.get(activePath);
      if (viewState) editor.restoreViewState(viewState);
      editor.focus();
    }
    handlers.current.onCursorChange(model ? toCursor(editor.getPosition()) : null);
  }, [activePath, handlers]);

  // Runs after the model swap above, so a file opened from a search result is on screen
  // before its match is selected.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !revealRequest || revealRequest.id === appliedRevealId.current) return;
    if (revealRequest.path !== activePath || !editor.getModel()) return;

    // Each request is applied once. Coming back to this tab later must not move the cursor.
    appliedRevealId.current = revealRequest.id;
    const { line, column, length } = revealRequest;
    const range = new monaco.Range(line, column, line, column + length);
    editor.setSelection(range);
    editor.revealRangeInCenterIfOutsideViewport(range);
    editor.focus();
  }, [activePath, revealRequest]);

  // Leaving a preview hands the keyboard back to the editor.
  useEffect(() => {
    const editor = editorRef.current;
    if (!isHidden && editor?.getModel()) editor.focus();
  }, [isHidden]);

  // Waits until the editor is showing text: an action asked for from a preview runs once the
  // source is back on screen. It comes after the effect above, because a picker closes when
  // the editor takes focus after it opens.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !actionRequest || actionRequest.id === appliedActionId.current) return;
    if (isHidden || !editor.getModel()) return;

    appliedActionId.current = actionRequest.id;
    editor.focus();
    void editor.getAction(actionRequest.actionId)?.run();
  }, [actionRequest, isHidden, activePath]);

  useEffect(() => {
    applyEditorTheme();
  }, []);

  // An invisible element cannot hold focus, so typing never reaches text behind a preview.
  return <div ref={containerRef} className={cn('absolute inset-0', isHidden && 'invisible')} />;
}
