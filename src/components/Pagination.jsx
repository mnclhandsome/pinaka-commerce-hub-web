import FilterDropdown from "./FilterDropdown";

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = "items",
  showWhenEmpty = false,
  pageSizeOptions = [5, 10, 25, 50, 100],
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
            <FilterDropdown
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) =>
                onPageSizeChange(Number(e.target.value))
              }
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </FilterDropdown>
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
