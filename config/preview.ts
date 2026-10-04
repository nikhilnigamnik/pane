// Files with these extensions can be shown as pictures. The server only hands out raw bytes
// for these, and always with the content type listed here.
export const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

// SVG is text, so it opens in the editor with a preview instead of as a picture-only tab.
export const SVG_EXTENSION = '.svg';
export const SVG_MIME_TYPE = 'image/svg+xml';
export const MARKDOWN_EXTENSIONS = ['.md', '.markdown'];
export const JSON_EXTENSIONS = ['.json'];
// Data files shown as a table, with the character that separates their cells.
export const TABLE_DELIMITERS: Record<string, string> = {
  '.csv': ',',
  '.tsv': '\t',
};

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
