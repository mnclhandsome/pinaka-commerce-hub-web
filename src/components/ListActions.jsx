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
}) {
    return (
        <div className="list-actions">
            {onView && (
                <button
                    type="button"
                    className="list-action-btn"
                    onClick={(event) => onView(event)}
                    title={viewLabel}
                    aria-label={viewLabel}
                >
                    <i className="bi bi-eye View-btn" />
                </button>
            )}

            {onEdit && (
                <button
                    type="button"
                    className="list-action-btn"
                    onClick={(event) => onEdit(event)}
                    title={editLabel}
                    aria-label={editLabel}
                >
                    
                    <i className="bi bi-pencil text-primary" />
                  
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
                    <i className="bi bi-arrow-counterclockwise" />
                </button>
            )}

            {onDelete && (
                <button
                    type="button"
                    className="list-action-btn text-danger"
                    disabled={deleteDisabled}
                    onClick={(event) => onDelete(event)}
                    title={deleteLabel}
                    aria-label={deleteLabel}
                >
                    <i className="bi bi-trash" />
                </button>
            )}
        </div>
    );
}