import { useCallback, useEffect, useRef, useState } from "react";
import { EditorErrorBoundary } from "../features/editor/EditorErrorBoundary";
import { LocalNoteEditor } from "../features/editor/LocalNoteEditor";
import { useDocumentPersistence } from "../features/editor/useDocumentPersistence";
import { useMarkdownExport } from "../features/export/useMarkdownExport";
import { useNotesBackup } from "../features/export/useNotesBackup";
import { usePageManagement } from "../features/pages/usePageManagement";
import { QuickSearch } from "../features/search/QuickSearch";
import { SettingsDialog } from "../features/settings/SettingsDialog";
import { useSpellcheck } from "../features/settings/useSpellcheck";
import { Sidebar } from "../features/sidebar/Sidebar";
import {
  COLLAPSED_SIDEBAR_WIDTH,
  useSidebarState,
} from "../features/sidebar/useSidebarState";
import { useAccentColor } from "../features/theme/useAccentColor";
import { useTheme } from "../features/theme/useTheme";
import { useTrash } from "../features/trash/useTrash";
import { TrashDialog } from "../features/trash/TrashDialog";

export function AppShell() {
  const pageManagement = usePageManagement();
  const theme = useTheme();
  const accent = useAccentColor();
  const spellcheck = useSpellcheck();
  const trash = useTrash({
    onRestored: (activePages) => {
      pageManagement.setPagesList(activePages);
    },
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const documents = useDocumentPersistence();
  const backup = useNotesBackup(documents.flush);
  const markdownExport = useMarkdownExport(
    pageManagement.activePageId,
    documents.flush,
  );
  const {
    document: loadedDocument,
    error: documentError,
    loading: documentLoading,
    loadPage,
    pageId: documentPageId,
  } = documents;
  const sidebarState = useSidebarState();
  const transitionRef = useRef(Promise.resolve());
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeTrash = useCallback(() => setTrashOpen(false), []);
  const openTrash = useCallback(() => setTrashOpen(true), []);

  const serializeTransition = useCallback(<T,>(operation: () => Promise<T>) => {
    const result = transitionRef.current.then(operation, operation);
    transitionRef.current = result.then(() => undefined, () => undefined);
    return result;
  }, []);

  useEffect(() => {
    if (
      !pageManagement.loading &&
      pageManagement.activePageId &&
      documentPageId === null &&
      !documentLoading
    ) {
      void loadPage(pageManagement.activePageId, false);
    }
  }, [
    documentLoading,
    loadPage,
    documentPageId,
    pageManagement.activePageId,
    pageManagement.loading,
  ]);

  const selectPage = (id: string) =>
    serializeTransition(async () => {
      if (!(await documents.flush())) return false;
      if (!(await pageManagement.selectPage(id))) return false;
      await documents.loadPage(id, false);
      return true;
    });

  const createPage = (parentId: string | null = null) =>
    serializeTransition(async () => {
      if (!(await documents.flush())) return null;
      const created = await pageManagement.createPage(parentId);
      if (created) await documents.loadPage(created.id, false);
      return created;
    });

  const deletePage = (id: string) =>
    serializeTransition(async () => {
      if (pageManagement.activePageId === id && !(await documents.flush())) {
        return false;
      }
      const result = await pageManagement.deletePage(id);
      if (!result.success) return false;
      void trash.refreshTrash();
      if (pageManagement.activePageId === id) {
        if (result.nextActivePageId) {
          await documents.loadPage(result.nextActivePageId, false);
        } else {
          documents.clearDocument();
        }
      }
      return true;
    });

  const editorReady =
    pageManagement.activePage &&
    loadedDocument?.pageId === pageManagement.activePage.id;

  const [isFocusMode, setIsFocusMode] = useState(false);
  const toggleFocusMode = useCallback(() => setIsFocusMode((prev) => !prev), []);

  useEffect(() => {
    const handleNewPageShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditing =
        target instanceof HTMLElement &&
        (target.matches("input, textarea, select") || target.isContentEditable);
      if (event.ctrlKey && event.key.toLowerCase() === "n" && !isEditing) {
        event.preventDefault();
        void createPage();
      } else if (event.ctrlKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setSearchOpen(true);
      } else if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFocusMode();
      } else if (event.ctrlKey && event.key === "\\") {
        event.preventDefault();
        sidebarState.toggleCollapse();
      }
    };
    window.addEventListener("keydown", handleNewPageShortcut);
    return () => window.removeEventListener("keydown", handleNewPageShortcut);
  });

  const sidebarWidthValue = isFocusMode
    ? "0px"
    : sidebarState.isCollapsed
    ? `${COLLAPSED_SIDEBAR_WIDTH}px`
    : `${sidebarState.width}px`;

  return (
    <div className="app-frame">
      <div
        className={`app-shell${sidebarState.isResizing ? " app-shell--resizing" : ""}${isFocusMode ? " app-shell--focus-mode" : ""}`}
        style={{ "--sidebar-width": sidebarWidthValue } as React.CSSProperties}
      >
        {!isFocusMode && (
          <Sidebar
            {...pageManagement}
            selectPage={selectPage}
            createPage={createPage}
            deletePage={deletePage}
            onOpenSearch={() => setSearchOpen(true)}
            settingsTriggerRef={settingsTriggerRef}
            onOpenSettings={openSettings}
            onOpenTrash={openTrash}
            trashCount={trash.trashCount}
            isCollapsed={sidebarState.isCollapsed}
            onToggleCollapse={sidebarState.toggleCollapse}
            onResizerPointerDown={sidebarState.handleResizerPointerDown}
            onResizerDoubleClick={sidebarState.handleResizerDoubleClick}
          />
        )}
        <QuickSearch
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSelect={selectPage}
        />
        {pageManagement.loading || documentLoading || (pageManagement.activePage && !editorReady && !documentError) ? (
        <main className="empty-document" aria-label="Loading pages">
          <p>Loading note…</p>
        </main>
      ) : editorReady && loadedDocument ? (
        <EditorErrorBoundary
          key={loadedDocument.editorKey}
          onError={documents.markInitializationError}
        >
          <LocalNoteEditor
            pageId={loadedDocument.pageId}
            title={pageManagement.activePage!.title}
            onRename={(title) => pageManagement.renamePage(pageManagement.activePage!.id, title)}
            initialBlocks={loadedDocument.blocks}
            saveStatus={documents.status}
            saveError={documents.error}
            onChange={documents.documentChanged}
            onRetrySave={() => void documents.retrySave()}
            exportStatus={markdownExport.status}
            exportError={markdownExport.error}
            onExport={(serialize) => void markdownExport.exportPage(serialize)}
            spellcheck={spellcheck.preference}
            isFavorite={pageManagement.activePage!.isFavorite}
            onSetFavorite={(isFavorite) =>
              void pageManagement.setFavorite(pageManagement.activePage!.id, isFavorite)
            }
            onCreateChild={() => void createPage(pageManagement.activePage!.id)}
            isFocusMode={isFocusMode}
            onToggleFocusMode={toggleFocusMode}
          />
        </EditorErrorBoundary>
      ) : pageManagement.activePage && documentError ? (
        <main className="empty-document" aria-label="Document unavailable">
          <div>
            <h1>Note unavailable</h1>
            <p>{documentError}</p>
            <button
              type="button"
              onClick={() => void documents.loadPage(pageManagement.activePage!.id, false)}
            >
              Retry loading
            </button>
          </div>
        </main>
      ) : (
        <main className="empty-document" aria-label="No page selected">
          <div>
            <h1>No pages yet</h1>
            <p>Create a page to start organizing your notes.</p>
            <button type="button" onClick={() => void createPage()}>
              Create your first page
            </button>
          </div>
        </main>
        )}
      </div>
      <SettingsDialog
        open={settingsOpen}
        triggerRef={settingsTriggerRef}
        theme={theme.preference}
        themeError={theme.error}
        accentColor={accent.accentColor}
        accentColorError={accent.error}
        spellcheck={spellcheck.preference}
        spellcheckError={spellcheck.error}
        backupStatus={backup.status}
        backupProgress={backup.progress}
        backupDestination={backup.destinationPath}
        backupExportedCount={backup.exportedCount}
        backupError={backup.error}
        onThemeChange={(preference) => void theme.setTheme(preference)}
        onAccentColorChange={(hex) => void accent.setAccentColor(hex)}
        onSpellcheckChange={(preference) => void spellcheck.setSpellcheck(preference)}
        onStartBackup={() => void backup.startBackup()}
        onOpenBackupFolder={() => void backup.openFolder()}
        onResetBackup={backup.reset}
        onClose={closeSettings}
      />
      <TrashDialog
        open={trashOpen}
        trashPages={trash.trashPages}
        loading={trash.loading}
        onClose={closeTrash}
        onRestore={trash.restorePage}
        onDeletePermanently={trash.deletePermanently}
        onEmptyTrash={trash.emptyTrash}
      />
    </div>
  );
}
