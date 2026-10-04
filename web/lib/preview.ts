import {
  IMAGE_MIME_TYPES,
  JSON_EXTENSIONS,
  MARKDOWN_EXTENSIONS,
  SVG_EXTENSION,
  TABLE_DELIMITERS,
} from '@/config/preview';

import { fileExtension } from './path';

export type PreviewKind = 'markdown' | 'svg' | 'table' | 'json';

// Pictures open in a tab that only shows them. SVG is the exception: it is text, so it opens
// in the editor and offers a preview.
export function isImagePath(path: string): boolean {
  const extension = fileExtension(path);
  return extension !== SVG_EXTENSION && Object.hasOwn(IMAGE_MIME_TYPES, extension);
}

export function previewKind(path: string): PreviewKind | null {
  const extension = fileExtension(path);
  if (extension === SVG_EXTENSION) return 'svg';
  if (MARKDOWN_EXTENSIONS.includes(extension)) return 'markdown';
  if (JSON_EXTENSIONS.includes(extension)) return 'json';
  return Object.hasOwn(TABLE_DELIMITERS, extension) ? 'table' : null;
}

// The cell separator of a CSV or TSV file.
export function tableDelimiter(path: string): string | null {
  return TABLE_DELIMITERS[fileExtension(path)] ?? null;
}
