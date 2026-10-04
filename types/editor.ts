// Pictures get a tab that only shows them; everything else is text in the editor.
export type TabKind = 'text' | 'image';

export interface EditorTab {
  path: string;
  name: string;
  kind: TabKind;
  mtimeMs: number;
  isDirty: boolean;
  hasConflict: boolean;
  // Markdown and SVG tabs can show the rendered result in place of the source.
  isPreviewing: boolean;
  // Counts changes on disk to an image tab, so the picture is fetched again.
  revision: number;
}

export interface CursorPosition {
  line: number;
  column: number;
}

// A stretch of text on one line. Line and column count from 1.
export interface TextSelection {
  line: number;
  column: number;
  length: number;
}

// Asks the editor to show and select some text. The id tells two requests for the same
// place apart, so clicking the same search result twice works both times.
// Asks one editor to run one of Monaco's actions, such as opening the go-to-line picker. The
// id lets the same action be asked for twice in a row.
export interface ActionRequest {
  id: number;
  actionId: string;
}

export interface RevealRequest extends TextSelection {
  id: number;
  path: string;
}
