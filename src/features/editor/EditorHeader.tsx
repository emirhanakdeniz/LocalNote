import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import type { PartialBlock } from "@blocknote/core";
import { Icon } from "../../components/Icon";
import { Tooltip } from "../../components/Tooltip";
import { DocumentStats } from "./DocumentStats";
import type { SaveStatus } from "./types";
import type { ExportStatus, MarkdownSerializer } from "../export/useMarkdownExport";
import type { EditorBreadcrumb } from "./LocalNoteEditor";

type EditorHeaderProps = {
  title: string;
  breadcrumbs: EditorBreadcrumb[];
  onRename?: (title: string) => Promise<boolean>;
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
  saved: { label: "Saved on this device", dotClass: "status-dot--saved" },
  saving: { label: "Saving locally…", dotClass: "status-dot--saving" },
  unsaved: { label: "Unsaved changes", dotClass: "status-dot--unsaved" },
  error: { label: "Save failed", dotClass: "status-dot--error" },
};

export function EditorHeader({
  title,
  breadcrumbs,
  onRename,
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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitleInput(title);
  }, [title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    const handleGlobalF2 = (event: globalThis.KeyboardEvent) => {
      if (event.key === "F2") {
        const target = event.target instanceof Element ? event.target : null;
        const isInSidebarTree = Boolean(target?.closest(".page-tree"));
        const isInModal = Boolean(
          target?.closest(".settings, .trash-dialog, .dialog-backdrop, [role='dialog']"),
        );
        if (!isInSidebarTree && !isInModal) {
          event.preventDefault();
          setIsEditingTitle(true);
        }
      }
    };
    window.addEventListener("keydown", handleGlobalF2);
    return () => window.removeEventListener("keydown", handleGlobalF2);
  }, []);

  const commitTitleRename = async () => {
    const trimmed = titleInput.trim();
    if (!trimmed) {
      setTitleInput(title);
      setIsEditingTitle(false);
      return;
    }
    if (trimmed !== title && onRename) {
      await onRename(trimmed);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitTitleRename();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setTitleInput(title);
      setIsEditingTitle(false);
    }
  };

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
        {breadcrumbs.map((crumb, index) => (
          <span className="editor-breadcrumb__part" key={crumb.id}>
            {index > 0 && <span className="editor-breadcrumb__divider">/</span>}
            <span className={index === breadcrumbs.length - 1 ? "editor-breadcrumb__current" : "editor-breadcrumb__segment"}>
              {crumb.title || "Untitled"}
            </span>
          </span>
        ))}
      </div>

      {/* Title & Actions Row */}
      <div className="editor-title-row">
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            className="editor-title-input"
            value={titleInput}
            maxLength={200}
            aria-label="Edit note title"
            placeholder="Untitled"
            onChange={(event) => setTitleInput(event.target.value)}
            onKeyDown={handleTitleKeyDown}
            onBlur={() => void commitTitleRename()}
          />
        ) : (
          <h1
            className="editor-title editor-title--clickable"
            onClick={() => setIsEditingTitle(true)}
            title="Click or press F2 to rename"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " " || event.key === "F2") {
                event.preventDefault();
                setIsEditingTitle(true);
              }
            }}
          >
            {title || "Untitled"}
          </h1>
        )}

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
                    setIsEditingTitle(true);
                  }}
                >
                  <Icon name="pencil" />
                  <span>Rename</span>
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
      <div className="editor-metadata-row" aria-label="Local document status">
        <div className={`editor-status-pill editor-status-pill--${saveStatus}`}>
          <span className={`status-dot ${currentStatus.dotClass}`} aria-hidden="true" />
          <span role="status" aria-live="polite">{currentStatus.label}</span>
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
