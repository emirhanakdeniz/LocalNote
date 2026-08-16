import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import type { PartialBlock } from "@blocknote/core";
import { Icon } from "../../components/Icon";
import { Tooltip } from "../../components/Tooltip";
import { DocumentStats } from "./DocumentStats";
import type { SaveStatus } from "./types";
import type { ExportStatus, MarkdownSerializer } from "../export/useMarkdownExport";

type EditorHeaderProps = {
  title: string;
  saveStatus: SaveStatus;
  saveError: string | null;
  onRetrySave: () => void;
  exportStatus: ExportStatus;
  exportError: string | null;
  onExport: (serialize: MarkdownSerializer) => void;
  serializeMarkdownFn: () => MarkdownSerializer;
  isFavorite: boolean;
  onSetFavorite: (isFavorite: boolean) => void;
  onCreateChild: () => void;
  blocks: PartialBlock[];
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
  isTocVisible?: boolean;
  onToggleToc?: () => void;
};

const statusConfig: Record<
  SaveStatus,
  { label: string; dotClass: string }
> = {
  saved: { label: "Saved", dotClass: "status-dot--saved" },
  saving: { label: "Saving…", dotClass: "status-dot--saving" },
  unsaved: { label: "Unsaved changes", dotClass: "status-dot--unsaved" },
  error: { label: "Save failed", dotClass: "status-dot--error" },
};

export function EditorHeader({
  title,
  saveStatus,
  saveError,
  onRetrySave,
  exportStatus,
  exportError,
  onExport,
  serializeMarkdownFn,
  isFavorite,
  onSetFavorite,
  onCreateChild,
  blocks,
  isFocusMode = false,
  onToggleFocusMode,
  isTocVisible = true,
  onToggleToc,
}: EditorHeaderProps) {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !moreMenuRef.current?.contains(target) &&
        !moreTriggerRef.current?.contains(target)
      ) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutside);
    requestAnimationFrame(() => {
      moreMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    });
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [moreMenuOpen]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      moreMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setMoreMenuOpen(false);
      requestAnimationFrame(() => moreTriggerRef.current?.focus());
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      items[(current + offset + items.length) % items.length]?.focus();
    }
  };

  const currentStatus = statusConfig[saveStatus];

  return (
    <header className="editor-header" aria-label="Note header">
      {/* Breadcrumb row */}
      <div className="editor-breadcrumb">
        <Icon name="document" className="editor-breadcrumb__icon" />
        <span className="editor-breadcrumb__segment">Notes</span>
        <span className="editor-breadcrumb__divider">/</span>
        <span className="editor-breadcrumb__current">{title || "Untitled"}</span>
      </div>

      {/* Title & Actions Row */}
      <div className="editor-title-row">
        <h1 className="editor-title">{title}</h1>

        <div className="editor-actions">
          {/* Quick Action: Favorite */}
          <Tooltip content={isFavorite ? "Remove from favorites" : "Add to favorites"}>
            <button
              type="button"
              className={`editor-action-btn ${isFavorite ? "editor-action-btn--favorite-active" : ""}`}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              onClick={() => onSetFavorite(!isFavorite)}
            >
              <Icon name="star" />
            </button>
          </Tooltip>

          {/* Quick Action: Table of Contents Toggle */}
          {onToggleToc && (
            <Tooltip content={isTocVisible ? "Hide table of contents" : "Show table of contents"}>
              <button
                type="button"
                className={`editor-action-btn ${isTocVisible ? "editor-action-btn--active" : ""}`}
                aria-label={isTocVisible ? "Hide table of contents" : "Show table of contents"}
                onClick={onToggleToc}
              >
                <Icon name="list" />
              </button>
            </Tooltip>
          )}

          {/* Quick Action: Focus Mode */}
          {onToggleFocusMode && (
            <Tooltip content={isFocusMode ? "Exit focus mode (Ctrl+Shift+F)" : "Focus mode (Ctrl+Shift+F)"}>
              <button
                type="button"
                className={`editor-action-btn ${isFocusMode ? "editor-action-btn--active" : ""}`}
                aria-label={isFocusMode ? "Exit focus mode" : "Focus mode"}
                onClick={onToggleFocusMode}
              >
                <Icon name="focus" />
              </button>
            </Tooltip>
          )}

          {/* More Actions Menu */}
          <div className="editor-more-menu-wrapper">
            <Tooltip content="More actions">
              <button
                ref={moreTriggerRef}
                type="button"
                className="editor-action-btn"
                aria-label="Page actions"
                aria-haspopup="menu"
                aria-expanded={moreMenuOpen}
                onClick={() => setMoreMenuOpen((curr) => !curr)}
              >
                <Icon name="ellipsis" />
              </button>
            </Tooltip>

            {moreMenuOpen && (
              <div
                ref={moreMenuRef}
                className="document__page-menu"
                role="menu"
                aria-label="Page actions"
                onKeyDown={handleMenuKeyDown}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onSetFavorite(!isFavorite);
                  }}
                >
                  <Icon name="star" />
                  <span>{isFavorite ? "Remove from favorites" : "Add to favorites"}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onCreateChild();
                  }}
                >
                  <Icon name="folder-plus" />
                  <span>New child page</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={exportStatus === "exporting"}
                  onClick={() => {
                    setMoreMenuOpen(false);
                    onExport(serializeMarkdownFn());
                  }}
                >
                  <Icon name="download" />
                  <span>{exportStatus === "exporting" ? "Exporting…" : "Export Markdown"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metadata Row: Save Status, Last edited time, Document stats */}
      <div className="editor-metadata-row">
        <div className={`editor-status-pill editor-status-pill--${saveStatus}`}>
          <span className={`status-dot ${currentStatus.dotClass}`} aria-hidden="true" />
          <span role="status">{currentStatus.label}</span>
          {saveStatus === "error" && (
            <button type="button" className="editor-status-retry" onClick={onRetrySave}>
              Retry
            </button>
          )}
        </div>

        <span className="editor-metadata-divider">·</span>

        <DocumentStats blocks={blocks} />
      </div>

      {/* Error / feedback messages */}
      {saveError && <p className="document__save-error" role="alert">{saveError}</p>}
      {exportStatus === "success" && (
        <p className="document__export-feedback" aria-live="polite">
          Markdown exported.
        </p>
      )}
      {exportError && (
        <p className="document__export-error" role="alert">
          {exportError}
        </p>
      )}
    </header>
  );
}
