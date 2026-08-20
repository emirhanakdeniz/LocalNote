import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";

const FOCUSABLE_SELECTOR = [
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type DialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  backdropClassName?: string;
  descriptionId?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  role?: "dialog" | "alertdialog";
  closeOnBackdrop?: boolean;
};

export function Dialog({
  open,
  title,
  children,
  onClose,
  className = "dialog",
  backdropClassName = "dialog-backdrop",
  descriptionId,
  initialFocusRef,
  restoreFocusRef,
  role = "dialog",
  closeOnBackdrop = true,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const restoreFocusTarget = restoreFocusRef?.current;
    const frame = requestAnimationFrame(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (initialFocusRef?.current ?? firstFocusable ?? dialogRef.current)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      );
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown, true);
      requestAnimationFrame(() =>
        (restoreFocusTarget ?? previousFocusRef.current)?.focus(),
      );
    };
  }, [initialFocusRef, onClose, open, restoreFocusRef]);

  if (!open) return null;

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) onClose();
  };

  return (
    <div className={backdropClassName} role="presentation" onMouseDown={handleBackdrop}>
      <div
        ref={dialogRef}
        className={className}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <span id={titleId} className="sr-only">{title}</span>
        {children}
      </div>
    </div>
  );
}
