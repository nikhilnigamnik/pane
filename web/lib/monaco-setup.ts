import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import CssWorker from 'monaco-editor/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker';

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

  // tsconfig.json and friends are JSON with comments.
  monaco.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: true,
    trailingCommas: 'ignore',
  });
}
