import { Icon } from "../../components/Icon";
import type { Page } from "../pages/types";
import { PageTree } from "./PageTree";
import { SidebarPageList } from "./SidebarPageList";
import { SidebarSection } from "./SidebarSection";
import { NewNoteButton } from "./NewNoteButton";
import { SearchBox } from "./SearchBox";
import { SidebarFooter } from "./SidebarFooter";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

type SidebarProps = {
  pages: Page[];
  favoritePages: Page[];
  activePageId: string | null;
  error: string | null;
  clearError: () => void;
  createPage: (parentId?: string | null) => Promise<Page | null>;
  selectPage: (id: string) => Promise<boolean>;
  onOpenSearch: () => void;
  renamePage: (id: string, title: string) => Promise<boolean>;
  movePage: (
    id: string,
    parentId: string | null,
    position: number,
  ) => Promise<boolean>;
  setFavorite: (id: string, isFavorite: boolean) => Promise<boolean>;
  deletePage: (id: string) => Promise<boolean>;
  settingsTriggerRef: RefObject<HTMLButtonElement | null>;
  onOpenSettings: () => void;
  onOpenTrash?: () => void;
  trashCount?: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onResizerPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizerDoubleClick?: () => void;
};

export function Sidebar({
  pages,
  favoritePages,
  activePageId,
  error,
  clearError,
  createPage,
  selectPage,
  onOpenSearch,
  renamePage,
  movePage,
  setFavorite,
  deletePage,
  settingsTriggerRef,
  onOpenSettings,
  onOpenTrash,
  trashCount = 0,
  isCollapsed,
  onToggleCollapse,
  onResizerPointerDown,
  onResizerDoubleClick,
}: SidebarProps) {
  if (isCollapsed) {
    return (
      <aside className="sidebar sidebar--collapsed" aria-label="Workspace navigation">
        <div className="sidebar__scroll-area sidebar__scroll-area--collapsed">
          <button
            type="button"
            className="sidebar__icon-button"
            aria-label="Expand sidebar"
            title="Expand sidebar (Ctrl+\)"
            onClick={onToggleCollapse}
          >
            <Icon name="sidebar" />
          </button>

          <button
            type="button"
            className="sidebar__icon-button"
            aria-label="New page"
            title="New page (Ctrl+N)"
            onClick={() => void createPage()}
          >
            <Icon name="plus" />
          </button>

          <button
            type="button"
            className="sidebar__icon-button"
            aria-label="Search notes"
            title="Search notes (Ctrl+P)"
            onClick={onOpenSearch}
          >
            <Icon name="search" />
          </button>
        </div>

        <SidebarFooter
          settingsTriggerRef={settingsTriggerRef}
          onOpenSettings={onOpenSettings}
          onOpenTrash={onOpenTrash}
          trashCount={trashCount}
          isCollapsed={true}
        />

        <div
          className="sidebar__resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Sidebar resize handle"
          title="Double click to reset or drag to resize"
          onPointerDown={onResizerPointerDown}
          onDoubleClick={onResizerDoubleClick}
        />
      </aside>
    );
  }

  return (
    <aside className="sidebar" aria-label="Workspace navigation">
      <div className="sidebar__scroll-area">
        {/* Top header row: New Note Button + Collapse Toggle */}
        <div className="sidebar__header-row">
          <NewNoteButton onClick={() => void createPage()} />
          <button
            type="button"
            className="sidebar__collapse-button"
            aria-label="Collapse sidebar"
            title="Collapse sidebar (Ctrl+\)"
            onClick={onToggleCollapse}
          >
            <Icon name="sidebar" />
          </button>
        </div>

        {/* Compact Search Box */}
        <div className="sidebar__search-row">
          <SearchBox onClick={onOpenSearch} />
        </div>

        {/* Favorites Section */}
        <SidebarSection title="Favorites">
          <SidebarPageList
            pages={favoritePages}
            activePageId={activePageId}
            emptyMessage="No favorites yet"
            onSelect={selectPage}
          />
        </SidebarSection>

        {/* Pages Tree Section */}
        <SidebarSection title="Pages">
          <PageTree
            pages={pages}
            activePageId={activePageId}
            onSelect={selectPage}
            onCreate={(parentId) => createPage(parentId)}
            onRename={renamePage}
            onMove={movePage}
            onSetFavorite={setFavorite}
            onDelete={deletePage}
          />
        </SidebarSection>

        {error && (
          <div className="sidebar__error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={clearError}>Dismiss</button>
          </div>
        )}
      </div>

      <SidebarFooter
        settingsTriggerRef={settingsTriggerRef}
        onOpenSettings={onOpenSettings}
        onOpenTrash={onOpenTrash}
        trashCount={trashCount}
        pageCount={pages.length}
      />

      <div
        className="sidebar__resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Sidebar resize handle"
        title="Double click to reset or drag to resize"
        onPointerDown={onResizerPointerDown}
        onDoubleClick={onResizerDoubleClick}
      />
    </aside>
  );
}
