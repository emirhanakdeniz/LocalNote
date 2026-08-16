import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { Icon } from "../../components/Icon";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import type { Page } from "../pages/types";

type PageTreeProps = {
  pages: Page[];
  activePageId: string | null;
  onSelect: (id: string) => Promise<boolean>;
  onCreate: (parentId: string | null) => Promise<Page | null>;
  onRename: (id: string, title: string) => Promise<boolean>;
  onMove: (
    id: string,
    parentId: string | null,
    position: number,
  ) => Promise<boolean>;
  onSetFavorite: (id: string, isFavorite: boolean) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
};

type PageTreeItemProps = PageTreeProps & {
  page: Page;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string, forceOpen?: boolean) => void;
  onRequestDelete: (page: Page) => void;
};

function PageTreeItem({
  page,
  pages,
  activePageId,
  depth,
  expanded,
  onToggle,
  onSelect,
  onCreate,
  onRename,
  onMove,
  onSetFavorite,
  onDelete,
  onRequestDelete,
}: PageTreeItemProps) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [moving, setMoving] = useState(false);
  const [moveParentId, setMoveParentId] = useState(page.parentId ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAbove, setMenuAbove] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const children = pages.filter((candidate) => candidate.parentId === page.id);
  const siblings = pages.filter(
    (candidate) => candidate.parentId === page.parentId,
  );
  const siblingIndex = siblings.findIndex((candidate) => candidate.id === page.id);
  const isExpanded = expanded.has(page.id);

  useEffect(() => setTitle(page.title), [page.title]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsidePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    });
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [menuOpen]);

  const closeMenu = (restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) requestAnimationFrame(() => menuButtonRef.current?.focus());
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    );
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      items[(current + offset + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items.at(-1)?.focus();
    }
  };

  const commitRename = async () => {
    if (await onRename(page.id, title)) setRenaming(false);
  };

  const handleRenameKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitRename();
    } else if (event.key === "Escape") {
      setTitle(page.title);
      setRenaming(false);
    }
  };

  const commitMove = async () => {
    const parentId = moveParentId || null;
    const finalPosition = pages.filter(
      (candidate) => candidate.parentId === parentId && candidate.id !== page.id,
    ).length;
    if (await onMove(page.id, parentId, finalPosition)) setMoving(false);
  };

  return (
    <li className="page-tree__node">
      <div
        className="page-tree__row"
        style={{ "--tree-depth": depth } as CSSProperties}
      >
        {children.length ? (
          <button
            type="button"
            className={`page-tree__disclosure${isExpanded ? "" : " page-tree__disclosure--collapsed"}`}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${page.title}`}
            aria-expanded={isExpanded}
            onClick={() => onToggle(page.id)}
          >
            <Icon name="chevron" />
          </button>
        ) : (
          <span className="page-tree__spacer" />
        )}

        <Icon name="document" className="page-tree__page-icon" />

        {renaming ? (
          <input
            className="page-tree__rename"
            aria-label={`Rename ${page.title}`}
            value={title}
            maxLength={200}
            autoFocus
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={handleRenameKey}
            onBlur={() => void commitRename()}
          />
        ) : (
          <button
            type="button"
            className="page-tree__item"
            aria-current={activePageId === page.id ? "page" : undefined}
            onClick={() => void onSelect(page.id)}
            onKeyDown={(event) => {
              if (event.key === "Delete") {
                event.preventDefault();
                onRequestDelete(page);
              }
            }}
          >
            <span className="page-tree__label">{page.title}</span>
          </button>
        )}

        {!renaming && (
          <div className="page-tree__actions">
            {page.isFavorite && <Icon name="star" className="page-tree__favorite" />}
            <button
              ref={menuButtonRef}
              type="button"
              className="page-tree__menu-button"
              title="Page actions"
              aria-label={`Actions for ${page.title}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={(event) => {
                event.stopPropagation();
                const trigger = event.currentTarget.getBoundingClientRect();
                setMenuOpen((open) => {
                  if (!open) {
                    setMenuAbove(window.innerHeight - trigger.bottom < 280);
                  }
                  return !open;
                });
              }}
            >
              <Icon name="ellipsis" />
            </button>
            {menuOpen && (
              <div
                ref={menuRef}
                className={`page-menu${menuAbove ? " page-menu--above" : ""}`}
                role="menu"
                aria-label={`Actions for ${page.title}`}
                onKeyDown={handleMenuKeyDown}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeMenu();
                    void onSetFavorite(page.id, !page.isFavorite);
                  }}
                >
                  <Icon name="star" />
                  {page.isFavorite ? "Remove from favorites" : "Add to favorites"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeMenu();
                    setRenaming(true);
                  }}
                >
                  <Icon name="pencil" /> Rename
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    closeMenu();
                    const created = await onCreate(page.id);
                    if (created) onToggle(page.id, true);
                  }}
                >
                  <Icon name="folder-plus" /> New child page
                </button>
                <div className="page-menu__separator" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  disabled={siblingIndex <= 0}
                  onClick={() => {
                    closeMenu();
                    void onMove(page.id, page.parentId, siblingIndex - 1);
                  }}
                >
                  <Icon name="arrow-up" /> Move up
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={siblingIndex === siblings.length - 1}
                  onClick={() => {
                    closeMenu();
                    void onMove(page.id, page.parentId, siblingIndex + 1);
                  }}
                >
                  <Icon name="arrow-down" /> Move down
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeMenu();
                    setMoving(true);
                  }}
                >
                  <Icon name="move" /> Move to…
                </button>
                <div className="page-menu__separator" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  className="page-menu__danger"
                  onClick={() => {
                    closeMenu();
                    onRequestDelete(page);
                  }}
                >
                  <Icon name="trash" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {moving && (
        <div className="page-tree__inline-panel" style={{ "--tree-depth": depth } as CSSProperties}>
          <label>
            Parent
            <select
              aria-label={`New parent for ${page.title}`}
              value={moveParentId}
              onChange={(event) => setMoveParentId(event.target.value)}
            >
              <option value="">Top level</option>
              {pages
                .filter((candidate) => candidate.id !== page.id)
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title}
                  </option>
                ))}
            </select>
          </label>
          <button type="button" onClick={() => void commitMove()}>
            Move
          </button>
          <button type="button" onClick={() => setMoving(false)}>
            Cancel
          </button>
        </div>
      )}

      {children.length > 0 && isExpanded && (
        <ul className="page-tree__children">
          {children.map((child) => (
            <PageTreeItem
              key={child.id}
              {...{
                page: child,
                pages,
                activePageId,
                depth: depth + 1,
                expanded,
                onToggle,
                onSelect,
                onCreate,
                onRename,
                onMove,
                onSetFavorite,
                onDelete,
                onRequestDelete,
              }}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function PageTree(props: PageTreeProps) {
  const { activePageId, pages, onDelete } = props;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingDeletePage, setPendingDeletePage] = useState<Page | null>(null);

  const roots = useMemo(
    () => pages.filter((page) => page.parentId === null),
    [pages],
  );

  useEffect(() => {
    if (!activePageId) return;

    setExpanded((current) => {
      const next = new Set(current);
      let parentId = pages.find((page) => page.id === activePageId)?.parentId;
      let changed = false;

      while (parentId) {
        if (!next.has(parentId)) {
          next.add(parentId);
          changed = true;
        }
        parentId = pages.find((page) => page.id === parentId)?.parentId;
      }

      return changed ? next : current;
    });
  }, [activePageId, pages]);

  const toggle = (id: string, forceOpen = false) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (forceOpen || !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  if (!pages.length) {
    return <p className="page-tree__empty">No pages yet</p>;
  }

  return (
    <>
      <ul className="page-tree">
        {roots.map((page) => (
          <PageTreeItem
            key={page.id}
            {...props}
            page={page}
            depth={0}
            expanded={expanded}
            onToggle={toggle}
            onRequestDelete={(p) => setPendingDeletePage(p)}
          />
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(pendingDeletePage)}
        title="Move to Trash"
        message={`Move "${pendingDeletePage?.title || "Untitled"}" to Trash? Direct children will move up one level.`}
        confirmLabel="Move to Trash"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (pendingDeletePage) {
            const pageToDelete = pendingDeletePage;
            setPendingDeletePage(null);
            await onDelete(pageToDelete.id);
          }
        }}
        onCancel={() => setPendingDeletePage(null)}
      />
    </>
  );
}
