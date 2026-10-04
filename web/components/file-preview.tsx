import type { EditorTab } from '@/types/editor';
import { previewKind, tableDelimiter } from '@/web/lib/preview';

import { ImagePreview, SvgPreview } from './image-preview';
import { JsonPreview } from './json-preview';
import { MarkdownPreview } from './markdown-preview';
import { TablePreview } from './table-preview';

interface FilePreviewProps {
  tab: EditorTab;
  onOpenFile: (path: string) => void;
}

// What covers the editor when a tab is showing a rendered view instead of source text.
export function FilePreview({ tab, onOpenFile }: FilePreviewProps) {
  if (tab.kind === 'image') return <ImagePreview path={tab.path} revision={tab.revision} />;

  switch (previewKind(tab.path)) {
    case 'svg':
      return <SvgPreview path={tab.path} />;
    case 'json':
      return <JsonPreview path={tab.path} />;
    case 'table':
      return <TablePreview path={tab.path} delimiter={tableDelimiter(tab.path) ?? ''} />;
    default:
      return <MarkdownPreview path={tab.path} onOpenFile={onOpenFile} />;
  }
}
