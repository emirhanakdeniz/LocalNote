import { useId, useRef } from "react";
import { Icon } from "./Icon";
import { Dialog } from "./Dialog";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const descriptionId = useId();

  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      role="alertdialog"
      className="confirm-dialog"
      backdropClassName="confirm-dialog-backdrop"
      descriptionId={descriptionId}
      initialFocusRef={cancelBtnRef}
    >
        <div className="confirm-dialog__header">
          <div
            className={`confirm-dialog__icon-wrap confirm-dialog__icon-wrap--${variant}`}
          >
            <Icon
              name={variant === "danger" ? "alert-triangle" : "info"}
              className="confirm-dialog__icon"
            />
          </div>
          <div className="confirm-dialog__text-content">
            <h3 className="confirm-dialog__title">
              {title}
            </h3>
            <p id={descriptionId} className="confirm-dialog__message">
              {message}
            </p>
          </div>
        </div>

        <div className="confirm-dialog__actions">
          <button
            ref={cancelBtnRef}
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-dialog__btn confirm-dialog__btn--confirm confirm-dialog__btn--${variant}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
    </Dialog>
  );
}
