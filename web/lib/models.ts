import * as monaco from 'monaco-editor';

import {
  BRACKET_COLORIZATION,
  ENV_FILE_LANGUAGE,
  ENV_FILE_PATTERN,
  LANGUAGE_BY_FILENAME,
} from '@/config/editor';

import { fileName } from './path';

// One Monaco model per open file, keyed by its workspace-relative path. A model keeps the
// text, undo history and language, so switching tabs loses nothing.
function toUri(path: string): monaco.Uri {
  return monaco.Uri.file(`/${path}`);
}

function languageOverride(path: string): string | undefined {
  const name = fileName(path);
  if (ENV_FILE_PATTERN.test(name)) return ENV_FILE_LANGUAGE;
  return LANGUAGE_BY_FILENAME[name];
}

export function getModel(path: string): monaco.editor.ITextModel | null {
  return monaco.editor.getModel(toUri(path));
}

export function createModel(path: string, content: string): monaco.editor.ITextModel {
  const existing = getModel(path);
  if (existing) return existing;

  // With no explicit language Monaco picks one from the file extension.
  const model = monaco.editor.createModel(content, languageOverride(path), toUri(path));
  model.updateOptions({ bracketColorizationOptions: BRACKET_COLORIZATION });
  return model;
}

export function disposeModel(path: string): void {
  getModel(path)?.dispose();
}

export function modelPath(model: monaco.editor.ITextModel): string {
  return model.uri.path.slice(1);
}

// Keeps the file's own line endings and byte order mark instead of normalizing them on save.
export function readModelValue(model: monaco.editor.ITextModel): string {
  return model.getValue(monaco.editor.EndOfLinePreference.TextDefined, true);
}

// setValue sends the cursor and scroll position back to the top, so they are put back for any
// editor that is showing the model.
export function replaceModelValue(model: monaco.editor.ITextModel, content: string): void {
  const editors = monaco.editor.getEditors().filter((editor) => editor.getModel() === model);
  const viewStates = editors.map((editor) => editor.saveViewState());
  model.setValue(content);
  editors.forEach((editor, index) => {
    const viewState = viewStates[index];
    if (viewState) editor.restoreViewState(viewState);
  });
}

// Gives an open file's text a new path, unsaved edits included. Monaco keys models by path, so
// a renamed file needs a new model; its undo history does not come along.
export function moveModel(fromPath: string, toPath: string): monaco.editor.ITextModel | null {
  const source = getModel(fromPath);
  if (!source) return null;

  // Something still open under the new name (a tab for a file that was deleted on disk) gives
  // way to the file being moved there.
  disposeModel(toPath);
  const target = createModel(toPath, readModelValue(source));
  source.dispose();
  return target;
}
