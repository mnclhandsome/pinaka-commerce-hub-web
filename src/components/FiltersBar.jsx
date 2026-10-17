import FilterDropdown from "./FilterDropdown";
import "../styles/list-filter-toolbar.css";

export default function FiltersBar({
    searchValue = "",
    onSearchChange,
    searchPlaceholder = "Search...",
    filters = [],
    onClear,
    showClear = true,
    clearLabel = "Reset",
    searchDisabled = false,
    searchAutoFocus = false,
    searchAriaLabel = "Search",
    className = "",
    trailingAction = null,
}) {
    return (
        <div className={`filters-bar ${className}`.trim()}>

    {onSearchChange && (
        <div className="filter-search">
            <i className="bi bi-search" />

            <input
                type="text"
                aria-label={searchAriaLabel}
                disabled={searchDisabled}
                autoFocus={searchAutoFocus}
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) =>
                    onSearchChange(e.target.value)
                }
            />
        </div>
    )}

    <div className="filter-options">
        {filters.map((filter) => (
            <div
                className="filter-select-wrapper"
                key={filter.key}
            >
                <FilterDropdown
                    aria-label={filter.label}
                    disabled={filter.disabled}
                    value={filter.value ?? ""}
                    onChange={(e) =>
                        filter.onChange(e.target.value)
                    }
                >
                    {filter.options.map((option) => (
                        <option
                            key={
                                typeof option === "object"
                                    ? option.value
                                    : option
                            }
                            value={
                                typeof option === "object"
                                    ? option.value
                                    : option
                            }
                        >
                            {typeof option === "object"
                                ? option.label
                                : option}
                        </option>
                    ))}
                </FilterDropdown>

                <i className="bi bi-chevron-down filter-select-arrow" />
            </div>
        ))}

        {showClear && onClear && (
            <button
                type="button"
                className="filter-reset-btn"
                onClick={onClear}
            >
                <i className="bi bi-arrow-counterclockwise" />
                {clearLabel}
            </button>
        )}
        {trailingAction}
    </div>
</div>
    );
}
