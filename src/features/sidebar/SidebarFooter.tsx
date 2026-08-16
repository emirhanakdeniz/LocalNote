import type { RefObject } from "react";
import { Icon } from "../../components/Icon";

type SidebarFooterProps = {
  settingsTriggerRef: RefObject<HTMLButtonElement | null>;
  onOpenSettings: () => void;
  onOpenTrash?: () => void;
  trashCount?: number;
  pageCount?: number;
  isCollapsed?: boolean;
};

export function SidebarFooter({
  settingsTriggerRef,
  onOpenSettings,
  onOpenTrash,
  trashCount = 0,
  pageCount,
  isCollapsed = false,
}: SidebarFooterProps) {
  if (isCollapsed) {
    return (
      <footer className="sidebar-footer sidebar-footer--collapsed">
        {onOpenTrash && (
          <button
            type="button"
            className="sidebar-icon-btn sidebar-icon-btn--trash"
            aria-label="Open trash"
            title={`Trash${trashCount > 0 ? ` (${trashCount})` : ""}`}
            onClick={onOpenTrash}
          >
            <Icon name="trash" />
            {trashCount > 0 && (
              <span className="sidebar-footer__collapsed-badge" />
            )}
          </button>
        )}
        <button
          ref={settingsTriggerRef}
          type="button"
          className="sidebar-icon-btn"
          aria-label="Open settings"
          title="Settings"
          onClick={onOpenSettings}
        >
          <Icon name="settings" />
        </button>
      </footer>
    );
  }

  return (
    <footer className="sidebar-footer">
      {onOpenTrash && (
        <div className="sidebar-footer__row sidebar-footer__row--trash">
          <button
            type="button"
            className="sidebar-footer__btn"
            aria-label="Open trash"
            title="Trash"
            onClick={onOpenTrash}
          >
            <Icon name="trash" className="sidebar-footer__icon" />
            <span>Trash</span>
            {trashCount > 0 && (
              <span className="sidebar-footer__badge">{trashCount}</span>
            )}
          </button>
        </div>
      )}

      <div className="sidebar-footer__row">
        <button
          ref={settingsTriggerRef}
          type="button"
          className="sidebar-footer__btn"
          aria-label="Open settings"
          title="Settings"
          onClick={onOpenSettings}
        >
          <Icon name="settings" className="sidebar-footer__icon" />
          <span>Settings</span>
        </button>

        {pageCount !== undefined && pageCount > 0 && (
          <span
            className="sidebar-footer__stats"
            title={`${pageCount} notes stored locally`}
          >
            {pageCount} {pageCount === 1 ? "note" : "notes"}
          </span>
        )}
      </div>
    </footer>
  );
}
