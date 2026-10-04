import { File } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { COPY } from '@/config/copy';
import { ICON_SIZE, ICON_STROKE_WIDTH, QUICK_OPEN_MAX_RESULTS } from '@/config/ui';
import type { FileIndex } from '@/types/api';
import { fetchFiles } from '@/web/lib/api';
import { rankPaths } from '@/web/lib/fuzzy';
import type { FuzzyMatch } from '@/web/lib/fuzzy';
import { fileName, parentPath } from '@/web/lib/path';

import { HighlightedText } from './ui/highlighted-text';
import { Picker } from './ui/picker';

interface QuickOpenProps {
  isOpen: boolean;
  // Listed first while nothing has been typed, so recent work is one key press away.
  openPaths: string[];
  onClose: () => void;
  onOpenFile: (path: string) => void;
}

interface FileIndexState {
  index: FileIndex | null;
  error: string | null;
}

function FileRow({ match }: { match: FuzzyMatch }) {
  const name = fileName(match.path);
  const folder = parentPath(match.path);
  const nameStart = match.path.length - name.length;

  return (
    <>
      <File
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE_WIDTH}
        className="shrink-0 text-theme-text-sec"
        aria-hidden
      />
      <span className="shrink-0 text-theme-text">
        <HighlightedText
          text={name}
          positions={match.positions
            .filter((position) => position >= nameStart)
            .map((position) => position - nameStart)}
        />
      </span>
      <span className="truncate text-theme-text-tertiary">
        <HighlightedText
          text={folder}
          positions={match.positions.filter((position) => position < folder.length)}
        />
      </span>
    </>
  );
}

export function QuickOpen({ isOpen, openPaths, onClose, onOpenFile }: QuickOpenProps) {
  const [files, setFiles] = useState<FileIndexState>({ index: null, error: null });

  // The list is fetched each time the picker opens, so it includes files made since.
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    async function loadFiles() {
      const result = await fetchFiles();
      if (isCancelled) return;
      setFiles(result.success ? { index: result.data, error: null } : { index: null, error: result.error.message });
    }

    void loadFiles();
    return () => {
      isCancelled = true;
      setFiles({ index: null, error: null });
    };
  }, [isOpen]);

  const candidates = useMemo(() => {
    if (!files.index) return [];
    const open = new Set(openPaths);
    return [...openPaths, ...files.index.paths.filter((path) => !open.has(path))];
  }, [files.index, openPaths]);

  const filterItems = useCallback(
    (query: string) => rankPaths(candidates, query, QUICK_OPEN_MAX_RESULTS),
    [candidates],
  );

  return (
    <Picker
      isOpen={isOpen}
      label={COPY.QUICK_OPEN}
      listLabel={COPY.QUICK_OPEN_RESULTS_LABEL}
      placeholder={COPY.QUICK_OPEN_PLACEHOLDER}
      filterItems={filterItems}
      itemKey={(match) => match.path}
      itemTitle={(match) => match.path}
      renderItem={(match) => <FileRow match={match} />}
      emptyMessage={COPY.QUICK_OPEN_EMPTY}
      isLoading={!files.index && !files.error}
      loadingMessage={COPY.LOADING}
      error={files.error}
      footer={files.index?.isTruncated ? COPY.QUICK_OPEN_TRUNCATED : undefined}
      onChoose={(match) => onOpenFile(match.path)}
      onClose={onClose}
    />
  );
}
