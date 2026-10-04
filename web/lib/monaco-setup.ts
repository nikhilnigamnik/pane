import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import CssWorker from 'monaco-editor/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker';

import { MARKDOWN_LANGUAGE_ID } from '@/config/editor';

import { markdownHeadings } from './markdown-headings';

const WORKER_BY_LABEL: Record<string, new () => Worker> = {
  json: JsonWorker,
  css: CssWorker,
  scss: CssWorker,
  less: CssWorker,
  html: HtmlWorker,
  handlebars: HtmlWorker,
  razor: HtmlWorker,
  typescript: TsWorker,
  javascript: TsWorker,
};

let isReady = false;

// Turns the headings of a Markdown file into an outline for "go to symbol". Each heading holds
// the ones below it until the next heading of the same or a higher level.
function markdownSymbols(model: monaco.editor.ITextModel): monaco.languages.DocumentSymbol[] {
  const headings = markdownHeadings(model.getValue());
  const roots: monaco.languages.DocumentSymbol[] = [];
  const open: { level: number; symbol: monaco.languages.DocumentSymbol }[] = [];
  const lastLine = model.getLineCount();

  headings.forEach((heading, index) => {
    const next = headings.slice(index + 1).find((later) => later.level <= heading.level);
    const endLine = next ? next.line - 1 : lastLine;
    const symbol: monaco.languages.DocumentSymbol = {
      name: heading.text,
      detail: '',
      kind: monaco.languages.SymbolKind.String,
      tags: [],
      range: new monaco.Range(heading.line, 1, endLine, model.getLineMaxColumn(endLine)),
      selectionRange: new monaco.Range(heading.line, 1, heading.line, model.getLineMaxColumn(heading.line)),
      children: [],
    };

    while ((open.at(-1)?.level ?? 0) >= heading.level) open.pop();
    const parent = open.at(-1)?.symbol;
    if (parent) parent.children?.push(symbol);
    else roots.push(symbol);
    open.push({ level: heading.level, symbol });
  });

  return roots;
}

export function setupMonaco(): void {
  if (isReady) return;
  isReady = true;

  self.MonacoEnvironment = {
    getWorker: (_workerId, label) => new (WORKER_BY_LABEL[label] ?? EditorWorker)(),
  };

  // Files open one at a time with no project around them, so imports can never resolve.
  // Only syntax errors are meaningful; type errors would be noise.
  const diagnostics = { noSemanticValidation: true, noSyntaxValidation: false };
  monaco.typescript.typescriptDefaults.setDiagnosticsOptions(diagnostics);
  monaco.typescript.javascriptDefaults.setDiagnosticsOptions(diagnostics);

  monaco.languages.registerDocumentSymbolProvider(MARKDOWN_LANGUAGE_ID, {
    provideDocumentSymbols: markdownSymbols,
  });

  // tsconfig.json and friends are JSON with comments.
  monaco.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: true,
    trailingCommas: 'ignore',
  });
}
