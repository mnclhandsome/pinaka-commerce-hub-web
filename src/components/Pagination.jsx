
export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = "items",
  showWhenEmpty = false,
}) {
  if (!totalItems && !showWhenEmpty) {return null;}

  const safeTotalPages = Math.max(1, totalPages || 1);
  const safeCurrentPage = Math.min(
    Math.max(1, currentPage),
    safeTotalPages
  );

  const startItem = totalItems
    ? (safeCurrentPage - 1) * pageSize + 1
    : 0;

  const endItem = Math.min(
    safeCurrentPage * pageSize,
    totalItems
  );

  const getPageNumbers = () => {
    const pages = [];
    const start = Math.max(
      1,
      Math.min(safeCurrentPage, safeTotalPages - 1)
    );

    for (
      let i = start;
      i <= Math.min(start + 1, safeTotalPages);
      i++
    ) {
      pages.push(i);
    }

    return pages;
  };

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        Showing <strong>{startItem}</strong> to{" "}
        <strong>{endItem}</strong> of{" "}
        <strong>{totalItems}</strong> {itemLabel}
      </div>

      <div className="pagination-controls">
        <div className="pagination-page-size">
          <span>Rows per page:</span>

          <div className="pagination-select-wrapper">
            <select
              value={pageSize}
              onChange={(e) =>
                onPageSizeChange(Number(e.target.value))
              }
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>

            <i className="bi bi-chevron-down pagination-select-arrow" />
          </div>
        </div>

        <button
          type="button"
          className="pagination-arrow"
          disabled={!totalItems || safeCurrentPage <= 1}
          onClick={() => onPageChange(safeCurrentPage - 1)}
          aria-label="Previous page"
        >
          <i className="bi bi-chevron-left" />
        </button>

        <div className="pagination-pages">
          {getPageNumbers().map((page) => (
            <button
              key={page}
              type="button"
              className={
                page === safeCurrentPage
                  ? "pagination-page active"
                  : "pagination-page"
              }
              disabled={!totalItems}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="pagination-arrow"
          disabled={
            !totalItems || safeCurrentPage >= safeTotalPages
          }
          onClick={() => onPageChange(safeCurrentPage + 1)}
          aria-label="Next page"
        >
          <i className="bi bi-chevron-right" />
        </button>
      </div>
    </div>
  );
}
