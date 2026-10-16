export default function ListActions({
    onView,
    onEdit,
    onDelete,
    onActivate,

    viewLabel = "View",
    editLabel = "Edit",
    deleteLabel = "Deactivate",
    activateLabel = "Activate",

    deleteDisabled = false,
    activateDisabled = false,
    viewDisabled = false,
    editDisabled = false,
    editButtonClassName = "",
    deleteButtonClassName = "",
    deleteIconClassName = "bi bi-trash3",
}) {
    return (
        <div className="list-actions">
            {onView && (
                <button
                    type="button"
                    className="list-action-btn"
                    disabled={viewDisabled}
                    onClick={(event) => onView(event)}
                    title={viewLabel}
                    aria-label={viewLabel}
                >
                    <i className="bi bi-eye View-btn list-action-view-icon" aria-hidden="true" />
                </button>
            )}

            {onEdit && (
                <button
                    type="button"
                    className={`list-action-btn ${editButtonClassName}`.trim()}
                    disabled={editDisabled}
                    onClick={(event) => onEdit(event)}
                    title={editLabel}
                    aria-label={editLabel}
                >
                    
                    <i className="bi bi-pencil list-action-edit-icon" aria-hidden="true" />
                  
                </button>
            )}

            {onActivate && (
                <button
                    type="button"
                    className="list-action-btn text-success"
                    disabled={activateDisabled}
                    onClick={(event) => onActivate(event)}
                    title={activateLabel}
                    aria-label={activateLabel}
                >
                    <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
                </button>
            )}

            {onDelete && (
                <button
                    type="button"
                    className={`list-action-btn text-danger ${deleteButtonClassName}`.trim()}
                    disabled={deleteDisabled}
                    onClick={(event) => onDelete(event)}
                    title={deleteLabel}
                    aria-label={deleteLabel}
                >
                    <i className={`${deleteIconClassName} list-action-delete-icon`} aria-hidden="true" />
                </button>
            )}
        </div>
    );
}
