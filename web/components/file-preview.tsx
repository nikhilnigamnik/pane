import type { EditorTab } from '@/types/editor';
import { previewKind } from '@/web/lib/preview';

import { ImagePreview, SvgPreview } from './image-preview';
import { MarkdownPreview } from './markdown-preview';

interface FilePreviewProps {
  tab: EditorTab;
  onOpenFile: (path: string) => void;
}

// What covers the editor when a tab is showing a rendered view instead of source text.
export function FilePreview({ tab, onOpenFile }: FilePreviewProps) {
  if (tab.kind === 'image') return <ImagePreview path={tab.path} revision={tab.revision} />;
  if (previewKind(tab.path) === 'svg') return <SvgPreview path={tab.path} />;
  return <MarkdownPreview path={tab.path} onOpenFile={onOpenFile} />;
}
