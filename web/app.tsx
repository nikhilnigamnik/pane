import { Code, Eye } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { COPY } from '@/config/copy';
import { OPEN_FILE_PARAM } from '@/config/routes';
import { SHORTCUTS } from '@/config/shortcuts';
import { ICON_SIZE_SMALL, ICON_STROKE_WIDTH } from '@/config/ui';
import type { WorkspaceMeta } from '@/types/api';
import type { CursorPosition } from '@/types/editor';
import type { SidebarView } from '@/types/ui';

import { CodeEditor } from './components/code-editor';
import { EmptyState } from './components/empty-state';
import { FilePreview } from './components/file-preview';
import { QuickOpen } from './components/quick-open';
import { Sidebar } from './components/sidebar';
import { StatusBar } from './components/status-bar';
import { TabBar } from './components/tab-bar';
import { Button } from './components/ui/button';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { Note } from './components/ui/note';
import { useEditorTabs } from './hooks/use-editor-tabs';
import { useGlobalShortcuts } from './hooks/use-global-shortcuts';
import { fetchMeta } from './lib/api';
import { getModel } from './lib/models';
import { previewKind } from './lib/preview';
import { shortcutLabel } from './lib/shortcuts';

const PREVIEW_SHORTCUT = shortcutLabel(SHORTCUTS.TOGGLE_PREVIEW);

export function App() {
  const editorTabs = useEditorTabs();
  const { tabs, activePath, activeTab, notice, pendingCloseTab, openFile, saveActiveTab } = editorTabs;
  const [meta, setMeta] = useState<WorkspaceMeta | null>(null);
  const [cursor, setCursor] = useState<CursorPosition | null>(null);
  const [sidebarView, setSidebarView] = useState<SidebarView>('files');
  const [searchFocusToken, setSearchFocusToken] = useState(0);
  const [isQuickOpenVisible, setIsQuickOpenVisible] = useState(false);

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

  const showSearch = useCallback(() => {
    setIsQuickOpenVisible(false);
    setSidebarView('search');
    setSearchFocusToken((current) => current + 1);
  }, []);

  useGlobalShortcuts({
    onSave: () => void saveActiveTab(),
    onQuickOpen: () => setIsQuickOpenVisible((current) => !current),
    onSearch: showSearch,
    onTogglePreview: editorTabs.toggleActivePreview,
  });

  const hasUnsavedChanges = tabs.some((tab) => tab.isDirty);
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const languageId = activePath ? (getModel(activePath)?.getLanguageId() ?? null) : null;
  const hasBanner = activeTab?.hasConflict === true || notice !== null;
  // Markdown and SVG are text that can also be shown rendered. A picture is only ever shown.
  const canTogglePreview = activeTab?.kind === 'text' && previewKind(activeTab.path) !== null;
  const isPreviewing = activeTab?.kind === 'image' || (canTogglePreview && activeTab.isPreviewing);
  const PreviewIcon = isPreviewing ? Code : Eye;
  const previewLabel = isPreviewing ? COPY.SHOW_SOURCE : COPY.SHOW_PREVIEW;

  return (
    <div className="flex h-full bg-theme-product-editor text-theme-text">
      <Sidebar
        meta={meta}
        activePath={activePath}
        view={sidebarView}
        searchFocusToken={searchFocusToken}
        onViewChange={setSidebarView}
        onQuickOpen={() => setIsQuickOpenVisible(true)}
        onOpenFile={(path, selection) => void openFile(path, selection)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <TabBar
          tabs={tabs}
          activePath={activePath}
          onSelect={editorTabs.selectTab}
          onClose={editorTabs.requestCloseTab}
          actions={
            canTogglePreview && (
              <Button
                variant="tertiary"
                size="tiny"
                title={COPY.WITH_SHORTCUT(previewLabel, PREVIEW_SHORTCUT)}
                onClick={editorTabs.toggleActivePreview}
              >
                <PreviewIcon size={ICON_SIZE_SMALL} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
                {previewLabel}
              </Button>
            )
          }
        />

        {hasBanner && (
          <div className="flex flex-col gap-2 border-b border-theme-border-02 p-2">
            {activeTab?.hasConflict && (
              <Note
                variant="warning"
                action={
                  <>
                    <Button size="tiny" onClick={() => void editorTabs.reloadActiveTab()}>
                      {COPY.CONFLICT_RELOAD}
                    </Button>
                    <Button
                      size="tiny"
                      variant="primary"
                      onClick={() => void editorTabs.overwriteActiveTab()}
                    >
                      {COPY.CONFLICT_OVERWRITE}
                    </Button>
                  </>
                }
              >
                {COPY.CONFLICT_MESSAGE}
              </Note>
            )}
            {notice && (
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
            )}
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          <CodeEditor
            activePath={activePath}
            isHidden={isPreviewing}
            revealRequest={editorTabs.revealRequest}
            onContentChange={editorTabs.syncDirtyState}
            onCursorChange={setCursor}
          />
          {!activeTab && <EmptyState />}
          {activeTab && isPreviewing && (
            <FilePreview key={activeTab.path} tab={activeTab} onOpenFile={openFile} />
          )}
        </div>

        <StatusBar
          tab={activeTab}
          languageId={languageId}
          // The cursor sits in source text, which a preview hides.
          cursor={isPreviewing ? null : cursor}
          isSaving={editorTabs.isSaving}
        />
      </main>

      <QuickOpen
        isOpen={isQuickOpenVisible}
        openPaths={tabs.map((tab) => tab.path)}
        onClose={() => setIsQuickOpenVisible(false)}
        onOpenFile={(path) => void openFile(path)}
      />

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
