import { FilePlus, FileSearch, FolderPlus, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';
import type { MouseEvent } from 'react';

import { COPY } from '@/config/copy';
import { SHORTCUTS } from '@/config/shortcuts';
import { APP_NAME } from '@/config/site';
import {
  ICON_SIZE_SMALL,
  ICON_STROKE_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from '@/config/ui';
import type { TreeEntry, WorkspaceMeta } from '@/types/api';
import type { TextSelection } from '@/types/editor';
import type { SidebarView } from '@/types/ui';
import type { FileActionsState } from '@/web/hooks/use-file-actions';
import type { FileTreeState } from '@/web/hooks/use-file-tree';
import { useProjectSearch } from '@/web/hooks/use-project-search';
import { useSidebarWidth } from '@/web/hooks/use-sidebar-width';
import { cn } from '@/web/lib/cn';
import { shortcutLabel } from '@/web/lib/shortcuts';
import { findEntry } from '@/web/lib/tree-rows';

import { FileTree } from './file-tree';
import { FileTreeMenu } from './file-tree-menu';
import { SearchPanel } from './search-panel';
import { Button } from './ui/button';
import { ContextMenu } from './ui/context-menu';
import { ScrollArea } from './ui/scroll-area';

interface SidebarProps {
  meta: WorkspaceMeta | null;
  tree: FileTreeState;
  fileActions: FileActionsState;
  activePath: string | null;
  view: SidebarView;
  // Changes every time search is asked for, which puts the cursor back in its box.
  searchFocusToken: number;
  onViewChange: (view: SidebarView) => void;
  onQuickOpen: () => void;
  onOpenFile: (path: string, selection?: TextSelection) => void;
  onOpenToSide: (path: string) => void;
}

interface HeaderButtonProps {
  label: string;
  icon: typeof Search;
  isPressed?: boolean;
  onClick: () => void;
}

const QUICK_OPEN_TITLE = COPY.WITH_SHORTCUT(COPY.QUICK_OPEN, shortcutLabel(SHORTCUTS.QUICK_OPEN));
const SEARCH_TITLE = COPY.WITH_SHORTCUT(COPY.SEARCH, shortcutLabel(SHORTCUTS.SEARCH));

function HeaderButton({ label, icon: Icon, isPressed, onClick }: HeaderButtonProps) {
  return (
    <Button
      variant="tertiary"
      size="tiny"
      isSquare
      isPressed={isPressed}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon size={ICON_SIZE_SMALL} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
    </Button>
  );
}

function rowPathAt(event: MouseEvent): string | null {
  const row = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-path]') : null;
  return row?.dataset.path ?? null;
}

export function Sidebar({
  meta,
  tree,
  fileActions,
  activePath,
  view,
  searchFocusToken,
  onViewChange,
  onQuickOpen,
  onOpenFile,
  onOpenToSide,
}: SidebarProps) {
  // Lives here, not in the search view, so the last search survives switching views.
  const search = useProjectSearch();
  const { sidebarRef, width, isResizing, handleProps } = useSidebarWidth();
  const [menuEntry, setMenuEntry] = useState<TreeEntry | null>(null);
  const isSearching = view === 'search';

  return (
    <aside
      ref={sidebarRef}
      className="relative flex w-(--sidebar-width) max-w-2/3 shrink-0 flex-col border-r border-theme-border-02 bg-theme-product-chrome"
    >
      <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-theme-border-02 pl-3 pr-2">
        <span className="truncate text-product-lg font-medium text-theme-text" title={meta?.rootPath}>
          {meta?.name ?? APP_NAME}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          {!isSearching && (
            <>
              <HeaderButton
                label={COPY.NEW_FILE}
                icon={FilePlus}
                onClick={() => fileActions.requestCreate('file')}
              />
              <HeaderButton
                label={COPY.NEW_FOLDER}
                icon={FolderPlus}
                onClick={() => fileActions.requestCreate('directory')}
              />
            </>
          )}
          <Button
            variant="tertiary"
            size="tiny"
            isSquare
            aria-label={COPY.QUICK_OPEN}
            title={QUICK_OPEN_TITLE}
            onClick={onQuickOpen}
          >
            <FileSearch size={ICON_SIZE_SMALL} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
          </Button>
          <Button
            variant="tertiary"
            size="tiny"
            isSquare
            isPressed={isSearching}
            aria-label={COPY.SEARCH}
            title={SEARCH_TITLE}
            onClick={() => onViewChange(isSearching ? 'files' : 'search')}
          >
            <Search size={ICON_SIZE_SMALL} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
          </Button>
          {!isSearching && (
            <HeaderButton label={COPY.REFRESH_TREE} icon={RefreshCw} onClick={() => void tree.refresh()} />
          )}
        </div>
      </header>

      {isSearching ? (
        <SearchPanel search={search} focusToken={searchFocusToken} onOpenFile={onOpenFile} />
      ) : (
        <ContextMenu
          content={
            <FileTreeMenu
              entry={menuEntry}
              onCreate={fileActions.requestCreate}
              onRename={fileActions.requestRename}
              onDelete={fileActions.requestDelete}
              onOpenToSide={onOpenToSide}
            />
          }
        >
          {/* The whole area takes right-clicks, so the space below the rows offers "new file". */}
          <ScrollArea
            className="min-h-0 flex-1"
            onContextMenu={(event) => {
              const path = rowPathAt(event);
              setMenuEntry(path === null ? null : findEntry(tree.childrenByPath, path));
            }}
          >
            <nav className="p-1.5">
              <FileTree
                tree={tree}
                activePath={activePath}
                onOpenFile={onOpenFile}
                onRenameEntry={fileActions.requestRename}
                onDeleteEntry={fileActions.requestDelete}
              />
            </nav>
          </ScrollArea>
        </ContextMenu>
      )}

      <footer className="flex h-8 shrink-0 items-center border-t border-theme-border-02 px-3">
        <span className="text-product-base text-theme-text-sec">{APP_NAME}</span>
      </footer>

      {/* Sits across the sidebar's right border, so it can be grabbed from either side. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={COPY.RESIZE_SIDEBAR}
        aria-valuenow={width}
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={SIDEBAR_MAX_WIDTH}
        tabIndex={0}
        title={COPY.RESIZE_SIDEBAR}
        {...handleProps}
        className={cn(
          'absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none outline-none',
          'after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:transition-colors',
          'hover:after:bg-theme-fg-10 focus-visible:after:bg-theme-fg',
          isResizing && 'after:bg-theme-fg-10',
        )}
      />
    </aside>
  );
}
