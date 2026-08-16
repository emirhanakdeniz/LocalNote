import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import type { Page } from "../pages/types";

type TrashDialogProps = {
  open: boolean;
  trashPages: Page[];
  loading: boolean;
  onClose: () => void;
  onRestore: (id: string) => Promise<boolean>;
  onDeletePermanently: (id: string) => Promise<boolean>;
  onEmptyTrash: () => Promise<boolean>;
};

function formatDeletionDate(isoString?: string | null): string {
  if (!isoString) {
    return "";
  }
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function TrashDialog({
  open,
  trashPages,
  loading,
  onClose,
  onRestore,
  onDeletePermanently,
  onEmptyTrash,
}: TrashDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingPermanentDelete, setPendingPermanentDelete] = useState<Page | null>(null);
  const [confirmEmptyOpen, setConfirmEmptyOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setPendingPermanentDelete(null);
      setConfirmEmptyOpen(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (pendingPermanentDelete) {
          setPendingPermanentDelete(null);
        } else if (confirmEmptyOpen) {
          setConfirmEmptyOpen(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const timeout = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timeout);
    };
  }, [open, onClose, pendingPermanentDelete, confirmEmptyOpen]);

  const filteredPages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return trashPages;
    }
    return trashPages.filter((p) => p.title.toLowerCase().includes(query));
  }, [trashPages, searchQuery]);

  if (!open) {
    return null;
  }

  return (
    <>
      <div
        className="trash-dialog-backdrop"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className="trash-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trash-dialog-title"
        >
          <div className="trash-dialog__header">
            <div className="trash-dialog__title-wrap">
              <Icon name="trash" className="trash-dialog__header-icon" />
              <h2 id="trash-dialog-title" className="trash-dialog__title">
                Trash
              </h2>
              {trashPages.length > 0 && (
                <span className="trash-dialog__count-badge">
                  {trashPages.length}
                </span>
              )}
            </div>

            <div className="trash-dialog__header-actions">
              {trashPages.length > 0 && (
                <button
                  type="button"
                  className="trash-dialog__empty-btn"
                  onClick={() => setConfirmEmptyOpen(true)}
                  title="Empty entire trash"
                >
                  Empty Trash
                </button>
              )}
              <button
                type="button"
                className="trash-dialog__close-btn"
                onClick={onClose}
                aria-label="Close trash dialog"
              >
                <Icon name="x" />
              </button>
            </div>
          </div>

          {trashPages.length > 0 && (
            <div className="trash-dialog__search-wrap">
              <Icon name="search" className="trash-dialog__search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                className="trash-dialog__search-input"
                placeholder="Filter trashed notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="trash-dialog__search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search filter"
                >
                  <Icon name="x" />
                </button>
              )}
            </div>
          )}

          <div className="trash-dialog__content">
            {loading && trashPages.length === 0 ? (
              <div className="trash-dialog__state">Loading trash...</div>
            ) : trashPages.length === 0 ? (
              <div className="trash-dialog__empty-state">
                <div className="trash-dialog__empty-icon-wrap">
                  <Icon name="trash" className="trash-dialog__empty-icon" />
                </div>
                <p className="trash-dialog__empty-title">Trash is empty</p>
                <p className="trash-dialog__empty-desc">
                  Notes moved to trash will appear here.
                </p>
              </div>
            ) : filteredPages.length === 0 ? (
              <div className="trash-dialog__empty-state">
                <p className="trash-dialog__empty-title">No matching notes</p>
                <p className="trash-dialog__empty-desc">
                  No notes found matching "{searchQuery}".
                </p>
              </div>
            ) : (
              <ul className="trash-dialog__list" role="list">
                {filteredPages.map((page) => (
                  <li key={page.id} className="trash-dialog__item">
                    <div className="trash-dialog__item-info">
                      <Icon
                        name="document"
                        className="trash-dialog__item-icon"
                      />
                      <span className="trash-dialog__item-title">
                        {page.title.trim() || "Untitled"}
                      </span>
                      {page.deletedAt && (
                        <span className="trash-dialog__item-date">
                          {formatDeletionDate(page.deletedAt)}
                        </span>
                      )}
                    </div>

                    <div className="trash-dialog__item-actions">
                      <button
                        type="button"
                        className="trash-dialog__action-btn trash-dialog__action-btn--restore"
                        onClick={() => void onRestore(page.id)}
                        title="Restore note"
                        aria-label={`Restore ${page.title}`}
                      >
                        <Icon name="rotate-ccw" />
                        <span>Restore</span>
                      </button>
                      <button
                        type="button"
                        className="trash-dialog__action-btn trash-dialog__action-btn--delete"
                        onClick={() => setPendingPermanentDelete(page)}
                        title="Delete permanently"
                        aria-label={`Permanently delete ${page.title}`}
                      >
                        <Icon name="trash" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingPermanentDelete)}
        title="Permanently Delete Note"
        message={`Are you sure you want to permanently delete "${pendingPermanentDelete?.title || "Untitled"}"? This action cannot be undone.`}
        confirmLabel="Delete Permanently"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (pendingPermanentDelete) {
            const pageToDelete = pendingPermanentDelete;
            setPendingPermanentDelete(null);
            await onDeletePermanently(pageToDelete.id);
          }
        }}
        onCancel={() => setPendingPermanentDelete(null)}
      />

      <ConfirmDialog
        open={confirmEmptyOpen}
        title="Empty Trash"
        message={`Are you sure you want to permanently delete all ${trashPages.length} notes in Trash? This action cannot be undone.`}
        confirmLabel="Empty Trash"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={async () => {
          setConfirmEmptyOpen(false);
          await onEmptyTrash();
        }}
        onCancel={() => setConfirmEmptyOpen(false)}
      />
    </>
  );
}
