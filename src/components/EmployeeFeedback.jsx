export function EmployeeToast({ message, onClose }) {
  if (!message) return null;
  return <div className="plan-toast" role="status"><span>{message}</span><button type="button" aria-label="Dismiss message" onClick={onClose}>×</button></div>;
}
export function EmployeeDeleteDialog({
  title,
  description,
  busy,
  onCancel,
  onConfirm,
  cancelLabel = "No, Keep It",
  confirmLabel = "Yes, Delete",
  busyLabel = "Deleting...",
}) {
  return <div className="delete-plan-overlay" onClick={busy ? undefined : onCancel}>
    <div className="delete-plan-modal" role="dialog" aria-modal="true" aria-label={title} onClick={event => event.stopPropagation()}>
      <div className="delete-plan-icon"><i className="bi bi-trash3" /></div>
      <h2>{title}</h2><p>{description}</p>
      <div className="delete-plan-actions">
        <button type="button" className="delete-plan-keep-button" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className="delete-plan-confirm-button" disabled={busy} onClick={onConfirm}>{busy ? busyLabel : confirmLabel}</button>
      </div>
    </div>
  </div>;
}
