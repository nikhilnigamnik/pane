import { ChevronRight, File, Folder, FolderOpen } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';

import { COPY } from '@/config/copy';
import { ICON_SIZE, ICON_STROKE_WIDTH } from '@/config/ui';
import type { TreeEntry } from '@/types/api';
import type { FileTreeState } from '@/web/hooks/use-file-tree';
import { cn } from '@/web/lib/cn';
import { ROOT_PATH } from '@/web/lib/path';
import { treeKeyAction, visibleRows } from '@/web/lib/tree-rows';

interface FileTreeProps {
  tree: FileTreeState;
  activePath: string | null;
  onOpenFile: (path: string) => void;
}

interface TreeLevelProps extends FileTreeProps {
  entries: TreeEntry[];
  // The single row that the Tab key lands on. The arrow keys move between rows from there.
  tabStopPath: string | null;
}

interface TreeNodeProps extends Omit<TreeLevelProps, 'entries'> {
  entry: TreeEntry;
}

const ROW_CLASSES =
  'flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-xs px-1.5 text-left text-product-lg text-theme-text outline-none transition-colors hover:bg-theme-fg-05 focus-visible:shadow-focus-ring';

const ICON_PROPS = {
  size: ICON_SIZE,
  strokeWidth: ICON_STROKE_WIDTH,
  className: 'shrink-0 text-theme-text-sec',
  'aria-hidden': true,
} as const;

function rowPath(target: EventTarget): string | undefined {
  return target instanceof HTMLElement ? target.dataset.path : undefined;
}

function TreeNode({ entry, tree, activePath, tabStopPath, onOpenFile }: TreeNodeProps) {
  const tabIndex = entry.path === tabStopPath ? 0 : -1;

  if (entry.kind === 'file') {
    const isActive = entry.path === activePath;
    return (
      <li role="treeitem" aria-selected={isActive}>
        <button
          type="button"
          title={entry.path}
          data-path={entry.path}
          tabIndex={tabIndex}
          onClick={() => onOpenFile(entry.path)}
          className={cn(ROW_CLASSES, isActive && 'bg-theme-fg-10 hover:bg-theme-fg-10')}
        >
          <span className="size-4 shrink-0" aria-hidden />
          <File {...ICON_PROPS} />
          <span className="truncate">{entry.name}</span>
        </button>
      </li>
    );
  }

  const isExpanded = tree.expandedPaths.has(entry.path);
  const children = tree.childrenByPath[entry.path];
  const FolderIcon = isExpanded ? FolderOpen : Folder;

  return (
    <li role="treeitem" aria-expanded={isExpanded} aria-selected={false}>
      <button
        type="button"
        title={entry.path}
        data-path={entry.path}
        tabIndex={tabIndex}
        onClick={() => tree.toggleDirectory(entry.path)}
        className={ROW_CLASSES}
      >
        <ChevronRight
          {...ICON_PROPS}
          className={cn(ICON_PROPS.className, 'transition-transform', isExpanded && 'rotate-90')}
        />
        <FolderIcon {...ICON_PROPS} />
        <span className="truncate">{entry.name}</span>
      </button>
      {isExpanded && children && (
        <div className="ml-3.5 border-l border-theme-border-02 pl-1">
          <TreeLevel
            entries={children}
            tree={tree}
            activePath={activePath}
            tabStopPath={tabStopPath}
            onOpenFile={onOpenFile}
          />
        </div>
      )}
    </li>
  );
}

function TreeLevel({ entries, tree, activePath, tabStopPath, onOpenFile }: TreeLevelProps) {
  if (entries.length === 0) {
    return <p className="px-1.5 py-1 text-product-base text-theme-text-tertiary">{COPY.EMPTY_FOLDER}</p>;
  }

  return (
    <ul role="group">
      {entries.map((entry) => (
        <TreeNode
          key={entry.path}
          entry={entry}
          tree={tree}
          activePath={activePath}
          tabStopPath={tabStopPath}
          onOpenFile={onOpenFile}
        />
      ))}
    </ul>
  );
}

export function FileTree({ tree, activePath, onOpenFile }: FileTreeProps) {
  const treeRef = useRef<HTMLDivElement>(null);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const rows = useMemo(
    () => visibleRows(tree.childrenByPath, tree.expandedPaths),
    [tree.childrenByPath, tree.expandedPaths],
  );
  const rootEntries = tree.childrenByPath[ROOT_PATH];

  if (tree.error && !rootEntries) {
    return <p className="px-1.5 py-1 text-product-lg text-theme-error">{tree.error}</p>;
  }
  if (!rootEntries) {
    return <p className="px-1.5 py-1 text-product-base text-theme-text-tertiary">{COPY.LOADING}</p>;
  }

  // Tab enters the tree at the row used last, else at the open file, else at the top. A row
  // that is no longer on screen (its folder closed) cannot hold that place.
  const isOnScreen = (path: string | null) => rows.some((row) => row.entry.path === path);
  const tabStopPath =
    [focusedPath, activePath].find(isOnScreen) ?? rows[0]?.entry.path ?? null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const path = rowPath(event.target);
    if (path === undefined) return;

    const action = treeKeyAction(rows, tree.expandedPaths, path, event.key);
    if (!action) return;
    // Arrow keys would otherwise scroll the list as well as move through it.
    event.preventDefault();

    if (action.kind === 'toggle') {
      tree.toggleDirectory(action.path);
      return;
    }
    treeRef.current
      ?.querySelector<HTMLElement>(`[data-path="${CSS.escape(action.path)}"]`)
      ?.focus();
  }

  function handleFocus(event: FocusEvent<HTMLDivElement>) {
    const path = rowPath(event.target);
    if (path !== undefined) setFocusedPath(path);
  }

  return (
    <div
      ref={treeRef}
      role="tree"
      aria-label={COPY.FILE_TREE_LABEL}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
    >
      <TreeLevel
        entries={rootEntries}
        tree={tree}
        activePath={activePath}
        tabStopPath={tabStopPath}
        onOpenFile={onOpenFile}
      />
    </div>
  );
}
