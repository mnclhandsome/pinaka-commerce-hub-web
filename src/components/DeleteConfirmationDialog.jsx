import { useEffect, useId, useRef } from "react";
import "../styles/delete-confirmation-dialog.css";

export default function DeleteConfirmationDialog({
  isOpen,
  title,
  message,
  cancelLabel = "Cancel",
  confirmLabel = "Delete",
  busyLabel = "Deleting...",
  busy = false,
  error = "",
  iconClassName = "bi bi-trash3",
  onCancel,
  onConfirm,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      className="delete-confirmation-dialog"
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          onCancel();
        }
      }}
    >
      <div className="delete-confirmation-content">
        <div className="delete-confirmation-icon" aria-hidden="true">
          <i className={iconClassName} />
        </div>

        <h2 id={titleId}>{title}</h2>
        <p className="delete-confirmation-message">{message}</p>

        {error && (
          <p className="delete-confirmation-error" role="alert">
            {error}
          </p>
        )}

        <div className="delete-confirmation-actions">
          <button
            type="button"
            className="delete-confirmation-cancel"
            autoFocus
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className="delete-confirmation-confirm"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
