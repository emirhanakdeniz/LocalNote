import { useEffect, useRef, type ReactNode, type KeyboardEvent } from "react";

export type ContextMenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  onClick: () => void;
};

type ContextMenuProps = {
  isOpen: boolean;
  items: ContextMenuItem[];
  ariaLabel: string;
  anchorRef?: React.RefObject<HTMLElement | null>;
  position?: { x: number; y: number } | null;
  align?: "left" | "right";
  onClose: (restoreFocus?: boolean) => void;
  className?: string;
};

export function ContextMenu({
  isOpen,
  items,
  ariaLabel,
  anchorRef,
  position,
  align = "right",
  onClose,
  className = "",
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !anchorRef?.current?.contains(target)
      ) {
        onClose(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    });

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, anchorRef, onClose]);

  if (!isOpen) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const focusable = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    );
    const current = focusable.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === "Escape") {
      event.preventDefault();
      onClose(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      focusable[(current + offset + focusable.length) % focusable.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      focusable[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      focusable.at(-1)?.focus();
    }
  };

  const style: React.CSSProperties | undefined = position
    ? {
        position: "fixed",
        top: `${position.y}px`,
        left: align === "left" ? `${position.x}px` : undefined,
        right: align === "right" ? `${window.innerWidth - position.x}px` : undefined,
      }
    : undefined;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={ariaLabel}
      className={`context-menu ${position ? "context-menu--fixed" : ""} ${className}`.trim()}
      style={style}
      onKeyDown={handleKeyDown}
    >
      {items.map((item) => (
        <div key={item.id}>
          {item.separatorBefore && <div className="context-menu__separator" role="separator" />}
          <button
            type="button"
            role="menuitem"
            className={`context-menu__item ${item.danger ? "context-menu__item--danger" : ""}`}
            disabled={item.disabled}
            onClick={() => {
              onClose(false);
              item.onClick();
            }}
          >
            <div className="context-menu__item-left">
              {item.icon && <span className="context-menu__icon">{item.icon}</span>}
              <span className="context-menu__label">{item.label}</span>
            </div>
            {item.shortcut && (
              <span className="context-menu__shortcut" aria-hidden="true">
                {item.shortcut}
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
