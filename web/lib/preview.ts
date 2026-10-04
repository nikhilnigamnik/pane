import { IMAGE_MIME_TYPES, MARKDOWN_EXTENSIONS, SVG_EXTENSION } from '@/config/preview';

import { fileExtension } from './path';

export type PreviewKind = 'markdown' | 'svg';

// Pictures open in a tab that only shows them. SVG is the exception: it is text, so it opens
// in the editor and offers a preview.
export function isImagePath(path: string): boolean {
  const extension = fileExtension(path);
  return extension !== SVG_EXTENSION && Object.hasOwn(IMAGE_MIME_TYPES, extension);
}

export function previewKind(path: string): PreviewKind | null {
  const extension = fileExtension(path);
  if (extension === SVG_EXTENSION) return 'svg';
  return MARKDOWN_EXTENSIONS.includes(extension) ? 'markdown' : null;
}
