import { Code, Columns2, Eye } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { COPY } from '@/config/copy';
import { EDITOR_ACTIONS } from '@/config/editor';
import { OPEN_FILE_PARAM } from '@/config/routes';
import { SHORTCUTS } from '@/config/shortcuts';
import { ICON_SIZE_SMALL, ICON_STROKE_WIDTH } from '@/config/ui';
import type { WorkspaceMeta } from '@/types/api';
import type { ActionRequest, CursorPosition, EditorTab } from '@/types/editor';
import type { PaneId, SidebarView } from '@/types/ui';

import { CommandPalette } from './components/command-palette';
import { EditorPane } from './components/editor-pane';
import { EmptyState } from './components/empty-state';
import { FileActionDialogs } from './components/file-action-dialogs';
import { QuickOpen } from './components/quick-open';
import { SidePaneHeader } from './components/side-pane-header';
import { Sidebar } from './components/sidebar';
import { StatusBar } from './components/status-bar';
import { TabBar } from './components/tab-bar';
import { Button } from './components/ui/button';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { Note } from './components/ui/note';
import { useEditorTabs } from './hooks/use-editor-tabs';
import { useFileActions } from './hooks/use-file-actions';
import { useFileTree } from './hooks/use-file-tree';
import { useGlobalShortcuts } from './hooks/use-global-shortcuts';
import { useSideView } from './hooks/use-side-view';
import { fetchMeta } from './lib/api';
import { buildCommands } from './lib/command-list';
import type { CommandActions } from './lib/command-list';
import { getModel } from './lib/models';
import { previewKind } from './lib/preview';
import { shortcutLabel } from './lib/shortcuts';

const PREVIEW_SHORTCUT = shortcutLabel(SHORTCUTS.TOGGLE_PREVIEW);
const SIDE_SHORTCUT = shortcutLabel(SHORTCUTS.OPEN_TO_SIDE);

interface PaneActionRequest extends ActionRequest {
  pane: PaneId;
}

// Markdown and SVG are text that can also be shown rendered. A picture is only ever shown.
function canPreview(tab: EditorTab | null): tab is EditorTab {
  return tab?.kind === 'text' && previewKind(tab.path) !== null;
}

export function App() {
  const editorTabs = useEditorTabs();
  const { tabs, activePath, activeTab, notice, pendingCloseTab, openFile } = editorTabs;
  const tree = useFileTree();
  const side = useSideView(editorTabs);
  const { sideView, sideTab } = side;
  const fileActions = useFileActions({
    tree,
    editorTabs,
    onRenamed: side.followRename,
    onDeleted: side.followDelete,
  });

  const [meta, setMeta] = useState<WorkspaceMeta | null>(null);
  const [cursors, setCursors] = useState<Record<PaneId, CursorPosition | null>>({ main: null, side: null });
  const [focusedPaneState, setFocusedPane] = useState<PaneId>('main');
  const [actionRequest, setActionRequest] = useState<PaneActionRequest | null>(null);
  const [sidebarView, setSidebarView] = useState<SidebarView>('files');
  const [searchFocusToken, setSearchFocusToken] = useState(0);
  const [isQuickOpenVisible, setIsQuickOpenVisible] = useState(false);
  const [isCommandPaletteVisible, setIsCommandPaletteVisible] = useState(false);
  const actionCount = useRef(0);

  useEffect(() => {
    let isCancelled = false;

    async function loadMeta() {
      const result = await fetchMeta();
      if (isCancelled || !result.success) return;
      setMeta(result.data);
      document.title = COPY.PAGE_TITLE(result.data.name);
    }

    void loadMeta();
    return () => {
      isCancelled = true;
    };
  }, []);

  // `pane some-file.ts` passes the file in the URL; open it once, then tidy the address bar.
  useEffect(() => {
    const url = new URL(window.location.href);
    const initialFile = url.searchParams.get(OPEN_FILE_PARAM);
    if (!initialFile) return;

    url.searchParams.delete(OPEN_FILE_PARAM);
    window.history.replaceState(null, '', url);
    void openFile(initialFile);
  }, [openFile]);

  const hasUnsavedChanges = tabs.some((tab) => tab.isDirty);
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const isMainPreviewing = activeTab?.kind === 'image' || (canPreview(activeTab) && activeTab.isPreviewing);
  const isSidePreviewing = sideTab?.kind === 'image' || (canPreview(sideTab) && sideView?.isPreviewing === true);
  // Shortcuts act on the view used last, and on the tabs once the side view closes.
  const focusedPane: PaneId = focusedPaneState === 'side' && sideTab ? 'side' : 'main';
  const focusedTab = focusedPane === 'side' ? sideTab : activeTab;
  const isFocusedPreviewing = focusedPane === 'side' ? isSidePreviewing : isMainPreviewing;

  function setPanePreviewing(pane: PaneId, isPreviewing: boolean) {
    if (pane === 'side') side.setSidePreviewing(isPreviewing);
    else if (activePath) editorTabs.setPreviewing(activePath, isPreviewing);
  }

  // Monaco's pickers need the source on screen, so a preview steps aside first.
  function runEditorAction(actionId: string) {
    if (focusedTab?.kind !== 'text') return;
    setPanePreviewing(focusedPane, false);
    actionCount.current += 1;
    setActionRequest({ id: actionCount.current, actionId, pane: focusedPane });
  }

  async function openActiveToSide() {
    if (!activeTab) return;
    // Markdown and SVG open rendered, next to their source. Other files open a second editor.
    if (await side.openToSide(activeTab.path, canPreview(activeTab))) setFocusedPane('side');
  }

  async function openPathToSide(path: string) {
    if (await side.openToSide(path, false)) setFocusedPane('side');
  }

  const showSearch = useCallback(() => {
    setIsQuickOpenVisible(false);
    setIsCommandPaletteVisible(false);
    setSidebarView('search');
    setSearchFocusToken((current) => current + 1);
  }, []);

  function closeSideView() {
    side.closeSide();
    setFocusedPane('main');
  }

  // Everything the shortcuts and the command palette can do, in one place.
  const actions: CommandActions = {
    quickOpen: () => {
      setIsCommandPaletteVisible(false);
      setIsQuickOpenVisible(true);
    },
    search: showSearch,
    showFiles: () => setSidebarView('files'),
    save: () => {
      if (focusedTab) void editorTabs.saveTab(focusedTab.path);
    },
    togglePreview: () => {
      if (canPreview(focusedTab)) setPanePreviewing(focusedPane, !isFocusedPreviewing);
    },
    goToLine: () => runEditorAction(EDITOR_ACTIONS.GO_TO_LINE),
    goToSymbol: () => runEditorAction(EDITOR_ACTIONS.GO_TO_SYMBOL),
    openToSide: () => void openActiveToSide(),
    closeSideView,
    newFile: () => fileActions.requestCreate('file'),
    newFolder: () => fileActions.requestCreate('directory'),
    renameFile: () => {
      if (focusedTab) fileActions.requestRename({ name: focusedTab.name, path: focusedTab.path, kind: 'file' });
    },
    deleteFile: () => {
      if (focusedTab) fileActions.requestDelete({ name: focusedTab.name, path: focusedTab.path, kind: 'file' });
    },
    closeTab: () => {
      if (focusedTab) editorTabs.requestCloseTab(focusedTab.path);
    },
    refreshFiles: () => {
      setSidebarView('files');
      void tree.refresh();
    },
    reloadFromDisk: () => {
      if (focusedTab) void editorTabs.reloadTab(focusedTab.path);
    },
  };

  const commands = buildCommands({
    hasTextFile: focusedTab?.kind === 'text',
    hasFile: focusedTab !== null,
    canPreview: canPreview(focusedTab),
    hasSideView: sideTab !== null,
    hasConflict: focusedTab?.hasConflict === true,
    actions,
  });

  useGlobalShortcuts({
    onSave: actions.save,
    onQuickOpen: () => {
      setIsCommandPaletteVisible(false);
      setIsQuickOpenVisible((current) => !current);
    },
    onCommandPalette: () => {
      setIsQuickOpenVisible(false);
      setIsCommandPaletteVisible((current) => !current);
    },
    onSearch: actions.search,
    onTogglePreview: actions.togglePreview,
    onGoToLine: actions.goToLine,
    onGoToSymbol: actions.goToSymbol,
    onOpenToSide: actions.openToSide,
  });

  const setMainCursor = useCallback(
    (position: CursorPosition | null) => setCursors((current) => ({ ...current, main: position })),
    [],
  );
  const setSideCursor = useCallback(
    (position: CursorPosition | null) => setCursors((current) => ({ ...current, side: position })),
    [],
  );
  const focusMain = useCallback(() => setFocusedPane('main'), []);
  const focusSide = useCallback(() => setFocusedPane('side'), []);
  const reloadTab = useCallback((path: string) => void editorTabs.reloadTab(path), [editorTabs]);
  const overwriteTab = useCallback((path: string) => void editorTabs.overwriteTab(path), [editorTabs]);

  const languageId = focusedTab ? (getModel(focusedTab.path)?.getLanguageId() ?? null) : null;
  const PreviewIcon = isMainPreviewing ? Code : Eye;
  const previewLabel = isMainPreviewing ? COPY.SHOW_SOURCE : COPY.SHOW_PREVIEW;
  const sideLabel = canPreview(activeTab) ? COPY.OPEN_PREVIEW_TO_SIDE : COPY.OPEN_TO_SIDE;

  return (
    <div className="flex h-full bg-theme-product-editor text-theme-text">
      <Sidebar
        meta={meta}
        tree={tree}
        fileActions={fileActions}
        activePath={activePath}
        view={sidebarView}
        searchFocusToken={searchFocusToken}
        onViewChange={setSidebarView}
        onQuickOpen={() => setIsQuickOpenVisible(true)}
        onOpenFile={(path, selection) => void openFile(path, selection)}
        onOpenToSide={(path) => void openPathToSide(path)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <TabBar
              tabs={tabs}
              activePath={activePath}
              onSelect={(path) => {
                editorTabs.selectTab(path);
                setFocusedPane('main');
              }}
              onClose={editorTabs.requestCloseTab}
              actions={
                activeTab && (
                  <>
                    {canPreview(activeTab) && (
                      <Button
                        variant="tertiary"
                        size="tiny"
                        title={COPY.WITH_SHORTCUT(previewLabel, PREVIEW_SHORTCUT)}
                        onClick={() => setPanePreviewing('main', !isMainPreviewing)}
                      >
                        <PreviewIcon size={ICON_SIZE_SMALL} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
                        {previewLabel}
                      </Button>
                    )}
                    <Button
                      variant="tertiary"
                      size="tiny"
                      isSquare
                      aria-label={sideLabel}
                      title={COPY.WITH_SHORTCUT(sideLabel, SIDE_SHORTCUT)}
                      onClick={() => void openActiveToSide()}
                    >
                      <Columns2 size={ICON_SIZE_SMALL} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
                    </Button>
                  </>
                )
              }
            />
            <EditorPane
              tab={activeTab}
              isPreviewing={isMainPreviewing}
              revealRequest={editorTabs.revealRequest}
              actionRequest={actionRequest?.pane === 'main' ? actionRequest : null}
              notice={
                notice && (
                  <Note
                    variant="error"
                    action={
                      <Button size="tiny" variant="tertiary" onClick={editorTabs.dismissNotice}>
                        {COPY.DISMISS}
                      </Button>
                    }
                  >
                    {notice}
                  </Note>
                )
              }
              emptyState={<EmptyState />}
              onFocus={focusMain}
              onContentChange={editorTabs.syncDirtyState}
              onCursorChange={setMainCursor}
              onOpenFile={openFile}
              onReload={reloadTab}
              onOverwrite={overwriteTab}
            />
          </div>

          {sideTab && (
            <div className="flex w-1/2 min-w-0 flex-col border-l border-theme-border-02">
              <SidePaneHeader
                tab={sideTab}
                isPreviewing={isSidePreviewing}
                canTogglePreview={canPreview(sideTab)}
                onTogglePreview={() => setPanePreviewing('side', !isSidePreviewing)}
                onClose={closeSideView}
              />
              <EditorPane
                tab={sideTab}
                isPreviewing={isSidePreviewing}
                revealRequest={null}
                actionRequest={actionRequest?.pane === 'side' ? actionRequest : null}
                onFocus={focusSide}
                onContentChange={editorTabs.syncDirtyState}
                onCursorChange={setSideCursor}
                onOpenFile={openFile}
                onReload={reloadTab}
                onOverwrite={overwriteTab}
              />
            </div>
          )}
        </div>

        <StatusBar
          tab={focusedTab}
          languageId={languageId}
          // The cursor sits in source text, which a preview hides.
          cursor={isFocusedPreviewing ? null : cursors[focusedPane]}
          isSaving={editorTabs.isSaving}
        />
      </main>

      <QuickOpen
        isOpen={isQuickOpenVisible}
        openPaths={tabs.map((tab) => tab.path)}
        onClose={() => setIsQuickOpenVisible(false)}
        onOpenFile={(path) => {
          setFocusedPane('main');
          void openFile(path);
        }}
      />

      <CommandPalette
        isOpen={isCommandPaletteVisible}
        commands={commands}
        onClose={() => setIsCommandPaletteVisible(false)}
      />

      <FileActionDialogs actions={fileActions} workspaceName={meta?.name ?? ''} />

      <ConfirmDialog
        isOpen={pendingCloseTab !== null}
        title={COPY.DISCARD_TITLE}
        description={COPY.DISCARD_DESCRIPTION(pendingCloseTab?.name ?? '')}
        confirmLabel={COPY.DISCARD_CONFIRM}
        cancelLabel={COPY.CANCEL}
        onConfirm={editorTabs.confirmPendingClose}
        onCancel={editorTabs.cancelPendingClose}
      />
    </div>
  );
}
