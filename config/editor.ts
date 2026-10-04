import type { editor } from 'monaco-editor';

// Cursor's code font stack. Berkeley Mono is a paid font, so it only applies when installed.
export const EDITOR_FONT_FAMILY =
  '"Berkeley Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

export const EDITOR_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  fontFamily: EDITOR_FONT_FAMILY,
  fontSize: 13,
  lineHeight: 20,
  fontLigatures: false,
  tabSize: 2,
  minimap: { enabled: false },
  stickyScroll: { enabled: false },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  renderLineHighlight: 'line',
  guides: { indentation: true, bracketPairs: false },
  padding: { top: 12, bottom: 12 },
  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
  overviewRulerBorder: false,
  fixedOverflowWidgets: true,
};

// Monaco's rainbow brackets use their own palette, which is not part of the design system. The setting is
// read per model, so it is applied when a model is created rather than in EDITOR_OPTIONS.
export const BRACKET_COLORIZATION: editor.BracketPairColorizationOptions = {
  enabled: false,
  independentColorPoolPerBracketType: false,
};

export const EDITOR_THEME_NAME = 'cursor-dark';
export const MARKDOWN_LANGUAGE_ID = 'markdown';

// Monaco's own pickers, opened by the go-to-line and go-to-symbol shortcuts.
export const EDITOR_ACTIONS = {
  GO_TO_LINE: 'editor.action.gotoLine',
  GO_TO_SYMBOL: 'editor.action.quickOutline',
} as const;
// The built-in theme that supplies every color the Cursor theme does not set.
export const EDITOR_BASE_THEME: editor.BuiltinTheme = 'vs-dark';

export interface EditorSyntaxRule {
  token: string;
  variable: string;
  fontStyle?: string;
}

// cursor.com publishes no syntax colors, so the roles are mapped onto its named palette:
// keywords orange (the brand hue), strings green, constants blue, functions and types
// lavender, comments in secondary text.
export const EDITOR_SYNTAX_RULES: EditorSyntaxRule[] = [
  { token: '', variable: '--cursor-fg' },
  { token: 'comment', variable: '--cursor-text-sec' },
  { token: 'keyword', variable: '--cursor-orange' },
  { token: 'keyword.json', variable: '--cursor-blue' },
  { token: 'string', variable: '--cursor-success' },
  { token: 'string.key.json', variable: '--cursor-blue' },
  // The base theme colors JSON values on its own, which would override the plain "string" rule.
  { token: 'string.value.json', variable: '--cursor-success' },
  { token: 'regexp', variable: '--cursor-success' },
  { token: 'number', variable: '--cursor-blue' },
  { token: 'constant', variable: '--cursor-blue' },
  { token: 'type', variable: '--cursor-lavender' },
  { token: 'function', variable: '--cursor-lavender' },
  { token: 'predefined', variable: '--cursor-lavender' },
  { token: 'annotation', variable: '--cursor-lavender' },
  { token: 'namespace', variable: '--cursor-lavender' },
  { token: 'variable', variable: '--cursor-fg' },
  { token: 'variable.predefined', variable: '--cursor-blue' },
  { token: 'variable.parameter', variable: '--cursor-amber' },
  { token: 'tag', variable: '--cursor-success' },
  { token: 'metatag', variable: '--cursor-text-sec' },
  { token: 'attribute.name', variable: '--cursor-lavender' },
  { token: 'attribute.value', variable: '--cursor-success' },
  { token: 'attribute.value.number', variable: '--cursor-blue' },
  { token: 'attribute.value.unit', variable: '--cursor-blue' },
  { token: 'key', variable: '--cursor-blue' },
  { token: 'delimiter', variable: '--cursor-fg' },
  { token: 'emphasis', variable: '--cursor-fg', fontStyle: 'italic' },
  { token: 'strong', variable: '--cursor-fg', fontStyle: 'bold' },
];

const TRANSPARENT = '#00000000';

export const EDITOR_BACKGROUND_VARIABLE = '--cursor-product-editor';

// Monaco color id -> Cursor token (or a literal hex when no token applies).
export const EDITOR_COLORS: Record<string, string> = {
  'editor.background': EDITOR_BACKGROUND_VARIABLE,
  'editor.foreground': '--cursor-fg',
  'editorGutter.background': EDITOR_BACKGROUND_VARIABLE,
  'editorLineNumber.foreground': '--cursor-text-tertiary',
  'editorLineNumber.activeForeground': '--cursor-fg',
  'editorCursor.foreground': '--cursor-fg',
  'editor.lineHighlightBackground': '--cursor-fg-05',
  'editor.lineHighlightBorder': TRANSPARENT,
  'editor.selectionBackground': '--cursor-fg-15',
  'editor.inactiveSelectionBackground': '--cursor-fg-10',
  'editor.selectionHighlightBackground': '--cursor-fg-10',
  'editor.wordHighlightBackground': '--cursor-fg-08',
  'editor.wordHighlightStrongBackground': '--cursor-fg-10',
  'editor.findMatchBackground': '--cursor-accent-bg-strong',
  'editor.findMatchHighlightBackground': '--cursor-accent-bg',
  // The lines of a symbol while it is picked in "go to symbol".
  'editor.rangeHighlightBackground': '--cursor-fg-05',
  'editorOverviewRuler.rangeHighlightForeground': '--cursor-fg-20',
  'editorWhitespace.foreground': '--cursor-fg-20',
  'editorIndentGuide.background1': '--cursor-fg-08',
  'editorIndentGuide.activeBackground1': '--cursor-fg-20',
  'editorBracketMatch.background': '--cursor-fg-08',
  'editorBracketMatch.border': '--cursor-border-02-5',
  'editorOverviewRuler.border': TRANSPARENT,
  'editorError.foreground': '--cursor-error',
  'editorWarning.foreground': '--cursor-accent',
  'editorInfo.foreground': '--cursor-blue',
  'editorLink.activeForeground': '--cursor-accent',
  'editorWidget.background': '--cursor-card-02',
  'editorWidget.foreground': '--cursor-fg',
  'editorWidget.border': '--cursor-border-02',
  'editorHoverWidget.background': '--cursor-card-02',
  'editorHoverWidget.border': '--cursor-border-02',
  'editorSuggestWidget.background': '--cursor-card-02',
  'editorSuggestWidget.border': '--cursor-border-02',
  'editorSuggestWidget.foreground': '--cursor-fg',
  'editorSuggestWidget.selectedBackground': '--cursor-fg-08',
  'editorSuggestWidget.highlightForeground': '--cursor-accent',
  'input.background': EDITOR_BACKGROUND_VARIABLE,
  'input.foreground': '--cursor-fg',
  'input.border': '--cursor-border-02',
  'inputOption.activeBorder': '--cursor-border-03',
  focusBorder: '--cursor-border-03',
  'list.hoverBackground': '--cursor-fg-05',
  'list.activeSelectionBackground': '--cursor-fg-10',
  'list.activeSelectionForeground': '--cursor-fg',
  'list.focusBackground': '--cursor-fg-08',
  // The go-to-line and go-to-symbol pickers.
  'quickInput.background': '--cursor-card-02',
  'quickInput.foreground': '--cursor-fg',
  'quickInputList.focusBackground': '--cursor-fg-10',
  'quickInputList.focusForeground': '--cursor-fg',
  'quickInputList.focusIconForeground': '--cursor-fg',
  'list.highlightForeground': '--cursor-accent',
  'list.focusHighlightForeground': '--cursor-accent',
  'pickerGroup.foreground': '--cursor-text-sec',
  'pickerGroup.border': '--cursor-border-02',
  descriptionForeground: '--cursor-text-sec',
  'menu.background': '--cursor-card-02',
  'menu.foreground': '--cursor-fg',
  'menu.selectionBackground': '--cursor-fg-08',
  'menu.selectionForeground': '--cursor-fg',
  'menu.border': '--cursor-border-02',
  'scrollbar.shadow': TRANSPARENT,
  'scrollbarSlider.background': '--cursor-fg-10',
  'scrollbarSlider.hoverBackground': '--cursor-fg-15',
  'scrollbarSlider.activeBackground': '--cursor-fg-20',
};

export const CSS_VARIABLE_PREFIX = '--';

// Files Monaco cannot identify from the extension alone.
export const ENV_FILE_PATTERN = /^\.env(\..+)?$/;
export const ENV_FILE_LANGUAGE = 'ini';
export const LANGUAGE_BY_FILENAME: Record<string, string> = {
  '.dev.vars': 'ini',
  '.npmrc': 'ini',
  '.editorconfig': 'ini',
};
