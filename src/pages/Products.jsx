import { pendingStoreRead } from "../api/http";
import FilterDropdown from "../components/FilterDropdown";
import { useEffect, useMemo, useState } from "react";
import Pagination from "../components/Pagination";
import BentoDetailModal from "../components/BentoDetailModal";
import {
    productsApi,
    normalizeCatalog,
} from "../api/products";
import "../styles/products.css";

export default function Products({
    embedded = false,
    merchantId,
    storeId,
    store,
}) {
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("");
    const [type, setType] = useState("");
    const [stockStatus, setStockStatus] = useState("");

    // =========================================================
    // PAGINATION
    // =========================================================

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // =========================================================
    // PRODUCT API STATES
    // =========================================================

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);

    // =========================================================
    // PRODUCT SYNC STATES
    // =========================================================

    const [syncing, setSyncing] = useState("");
    const [syncMessage, setSyncMessage] = useState("");
    const [syncError, setSyncError] = useState("");

    // =========================================================
    // VIEW PRODUCT MODAL
    // =========================================================

    const [selectedProduct, setSelectedProduct] = useState(null);

    // =========================================================
    // LOAD PRODUCTS FROM API
    // =========================================================

    const loadProducts = async ({
        showMessage = false,
    } = {}) => {
        if (!storeId) {
            setProducts([]);
            setSyncError("Store ID is required to load products.");
            return;
        }

        try {
            setLoading(true);

            if (showMessage) {
                setSyncing("latest");
                setSyncMessage("");
                setSyncError("");
            }

            const response =
                await pendingStoreRead(`store-products:${storeId}`, () => productsApi.getCatalog(storeId));

            const catalog =
                normalizeCatalog(response);

            setProducts(catalog.products || []);

            if (showMessage) {
                setSyncMessage(
                    "Latest product updates completed successfully."
                );
            }
        } catch (error) {
            console.error(
                "Failed to load products:",
                error
            );

            setProducts([]);

            setSyncError(
                error?.message ||
                "Failed to load products."
            );
        } finally {
            setLoading(false);

            if (showMessage) {
                setSyncing("");
            }
        }
    };

    // =========================================================
    // INITIAL PRODUCT LOAD
    // =========================================================

    useEffect(() => {
        loadProducts();
    }, [storeId]);

    // =========================================================
    // CATEGORIES
    // =========================================================

    const categories = useMemo(() => {
        return [
            ...new Set(
                products
                    .map(
                        (product) =>
                            product.category
                    )
                    .filter(Boolean)
            ),
        ];
    }, [products]);

    // =========================================================
    // TYPES
    // =========================================================

    const types = useMemo(() => {
        return [
            ...new Set(
                products
                    .map(
                        (product) =>
                            product.type
                    )
                    .filter(Boolean)
            ),
        ];
    }, [products]);

    // =========================================================
    // FILTER PRODUCTS
    // =========================================================

    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
            const text = `
                ${product.name || ""}
                ${product.sku || ""}
                ${product.category || ""}
                ${product.brand || ""}
            `.toLowerCase();

            const matchesSearch =
                !search ||
                text.includes(
                    search.toLowerCase()
                );

            const matchesCategory =
                !category ||
                product.category === category;

            const matchesType =
                !type ||
                product.type === type;

            const matchesStock =
                !stockStatus ||
                product.stockStatus ===
                    stockStatus;

            return (
                matchesSearch &&
                matchesCategory &&
                matchesType &&
                matchesStock
            );
        });
    }, [
        products,
        search,
        category,
        type,
        stockStatus,
    ]);

    // =========================================================
    // PAGINATION CALCULATIONS
    // =========================================================

    const totalItems =
        filteredProducts.length;

    const totalPages =
        Math.ceil(
            totalItems / pageSize
        );

    const paginatedProducts = useMemo(() => {
        const startIndex =
            (currentPage - 1) *
            pageSize;

        const endIndex =
            startIndex + pageSize;

        return filteredProducts.slice(
            startIndex,
            endIndex
        );
    }, [
        filteredProducts,
        currentPage,
        pageSize,
    ]);

    // =========================================================
    // RESET PAGE WHEN FILTERS CHANGE
    // =========================================================

    useEffect(() => {
        setCurrentPage(1);
    }, [
        search,
        category,
        type,
        stockStatus,
    ]);

    // =========================================================
    // KEEP CURRENT PAGE VALID
    // =========================================================

    useEffect(() => {
        if (
            totalPages > 0 &&
            currentPage > totalPages
        ) {
            setCurrentPage(totalPages);
        }
    }, [
        currentPage,
        totalPages,
    ]);

    // =========================================================
    // CLEAR FILTERS
    // =========================================================

    const clearFilters = () => {
        setSearch("");
        setCategory("");
        setType("");
        setStockStatus("");
        setCurrentPage(1);
    };

    // =========================================================
    // LATEST PRODUCT UPDATES
    // =========================================================

    const handleLatestProductUpdates =
        async () => {
            if (syncing) return;

            await loadProducts({
                showMessage: true,
            });
        };

    // =========================================================
    // PRODUCT DETAILS FIELDS
    // =========================================================

    const productDetailsFields = [
        {
            key: "name",
            label: "Product Name",
            fullWidth: true,
        },
        {
            key: "sku",
            label: "SKU",
        },
        {
            key: "type",
            label: "Product Type",
        },
        {
            key: "category",
            label: "Category",
        },
        {
            key: "brand",
            label: "Brand",
        },
        {
            key: "price",
            label: "Price",
        },
        {
            key: "quantity",
            label: "Quantity",
            format: (value) =>
                value === undefined ||
                value === null ||
                value === ""
                    ? "—"
                    : `${value} units`,
        },
        {
            key: "stockStatus",
            label: "Stock Status",
            render: (value) => {
                const status = String(
                    value || ""
                ).toLowerCase();

                let className =
                    "detail-status";

                if (
                    status === "in stock"
                ) {
                    className += " active";
                } else if (
                    status ===
                    "out of stock"
                ) {
                    className +=
                        " inactive";
                } else if (
                    status ===
                    "low stock"
                ) {
                    className +=
                        " pending";
                }

                return (
                    <span
                        className={className}
                    >
                        {value || "—"}
                    </span>
                );
            },
        },
        {
            key: "tags",
            label: "Tags",
            fullWidth: true,
            render: (value) => {
                if (
                    !Array.isArray(value) ||
                    value.length === 0
                ) {
                    return "—";
                }

                return (
                    <div className="view-details-list">
                        {value.map(
                            (tag) => (
                                <span
                                    key={tag}
                                    className="view-details-list-item"
                                >
                                    {tag}
                                </span>
                            )
                        )}
                    </div>
                );
            },
        },
        {
            key: "taxStatus",
            label: "Tax Status",
        },
        {
            key: "taxClass",
            label: "Tax Class",
        },
        {
            key: "updatedAt",
            label: "Last Updated",
        },
    ];

    // =========================================================
    // RENDER
    // =========================================================

    return (
        <div className="products-page">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="products-header">

                <div>
                    <div className="products-title-row">

                        <div>
                            <h1>Products</h1>

                            <p>
                                View products available for this
                                store.
                            </p>
                        </div>

                    </div>
                </div>

                <div className="products-header-actions">

                    {/* LATEST PRODUCT UPDATES */}

                    <button
                        type="button"
                        className="product-sync-btn product-sync-update"
                        onClick={
                            handleLatestProductUpdates
                        }
                        disabled={Boolean(syncing)}
                    >
                        {syncing === "latest" ? (
                            <>
                                <span className="sync-spinner" />
                                Updating...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-arrow-repeat" />
                                Latest Updates
                            </>
                        )}
                    </button>

                </div>
            </div>

            {/* =================================================
                API / SYNC MESSAGE
            ================================================= */}

            {(syncMessage ||
                syncError) && (
                <div
                    className={
                        syncError
                            ? "products-sync-message error"
                            : "products-sync-message success"
                    }
                >

                    <i
                        className={
                            syncError
                                ? "bi bi-exclamation-circle"
                                : "bi bi-check-circle"
                        }
                    />

                    <span>
                        {syncError ||
                            syncMessage}
                    </span>

                    <button
                        type="button"
                        onClick={() => {
                            setSyncMessage("");
                            setSyncError("");
                        }}
                        aria-label="Close"
                    >
                        <i className="bi bi-x" />
                    </button>

                </div>
            )}

            {/* =================================================
                SUMMARY
            ================================================= */}

            <div className="products-summary">

                {/* TOTAL PRODUCTS */}

                <div className="product-summary-card">

                    <div className="summary-card-icon purple">
                        <i className="bi bi-box-seam" />
                    </div>

                    <div>
                        <span>
                            Total Products
                        </span>

                        <strong>
                            {products.length}
                        </strong>
                    </div>

                </div>

                {/* IN STOCK */}

                <div className="product-summary-card">

                    <div className="summary-card-icon green">
                        <i className="bi bi-check-circle" />
                    </div>

                    <div>
                        <span>
                            In Stock
                        </span>

                        <strong>
                            {
                                products.filter(
                                    (product) =>
                                        product.stockStatus ===
                                        "In stock"
                                ).length
                            }
                        </strong>
                    </div>

                </div>

                {/* LOW STOCK */}

                <div className="product-summary-card">

                    <div className="summary-card-icon orange">
                        <i className="bi bi-exclamation-circle" />
                    </div>

                    <div>
                        <span>
                            Low Stock
                        </span>

                        <strong>
                            {
                                products.filter(
                                    (product) =>
                                        product.stockStatus ===
                                        "Low stock"
                                ).length
                            }
                        </strong>
                    </div>

                </div>

                {/* OUT OF STOCK */}

                <div className="product-summary-card">

                    <div className="summary-card-icon red">
                        <i className="bi bi-x-circle" />
                    </div>

                    <div>
                        <span>
                            Out of Stock
                        </span>

                        <strong>
                            {
                                products.filter(
                                    (product) =>
                                        product.stockStatus ===
                                        "Out of stock"
                                ).length
                            }
                        </strong>
                    </div>

                </div>

            </div>

            {/* =================================================
                PRODUCTS CARD
            ================================================= */}

            {/* =================================================
                TOOLBAR
            ================================================= */}

            <div className="products-toolbar">

                    {/* SEARCH */}

                    <div className="products-search">

                        <i className="bi bi-search" />

                        <input
                            type="text"
                            placeholder="Search products, SKU, category..."
                            value={search}
                            onChange={(e) =>
                                setSearch(
                                    e.target.value
                                )
                            }
                        />

                    </div>

                    {/* CATEGORY */}

                    <FilterDropdown
                        value={category}
                        onChange={(e) =>
                            setCategory(
                                e.target.value
                            )
                        }
                    >
                        <option value="">
                            All Categories
                        </option>

                        {categories.map(
                            (item) => (
                                <option
                                    key={item}
                                    value={item}
                                >
                                    {item}
                                </option>
                            )
                        )}
                    </FilterDropdown>

                    {/* TYPE */}

                    <FilterDropdown
                        value={type}
                        onChange={(e) =>
                            setType(
                                e.target.value
                            )
                        }
                    >
                        <option value="">
                            All Types
                        </option>

                        {types.map(
                            (item) => (
                                <option
                                    key={item}
                                    value={item}
                                >
                                    {item}
                                </option>
                            )
                        )}
                    </FilterDropdown>

                    {/* STOCK */}

                    <FilterDropdown
                        value={stockStatus}
                        onChange={(e) =>
                            setStockStatus(
                                e.target.value
                            )
                        }
                    >
                        <option value="">
                            All Stock
                        </option>

                        <option value="In stock">
                            In Stock
                        </option>

                        <option value="Low stock">
                            Low Stock
                        </option>

                        <option value="Out of stock">
                            Out of Stock
                        </option>
                    </FilterDropdown>

                    {/* CLEAR */}

                    <button
                        type="button"
                        className="products-clear-btn"
                        onClick={
                            clearFilters
                        }
                    >
                        <i className="bi bi-arrow-counterclockwise" />
                        Reset
                    </button>

            </div>

            <div className="products-card">

                {/* =================================================
                    LOADING
                ================================================= */}

                {loading && (
                    <div className="products-loading">
                        <span className="sync-spinner" />
                        Loading products...
                    </div>
                )}

                {/* =================================================
                    TABLE
                ================================================= */}

                {!loading && (
                    <div className="products-table-wrapper">

                        <table className="products-table">

                            <thead>

                                <tr>

                                    <th>Product</th>
                                    <th>SKU</th>
                                    <th>Stock</th>
                                    <th>Price</th>
                                    <th>Category</th>
                                    <th>Tags</th>
                                    <th>Brand</th>
                                    <th>Updated</th>
                                    <th>Status</th>

                                </tr>

                            </thead>

                            <tbody>

                                {paginatedProducts.length ? paginatedProducts.map(
                                    (product) => (
                                        <ProductRow
                                            key={
                                                product.id
                                            }
                                            product={
                                                product
                                            }
                                            onClick={() =>
                                                setSelectedProduct(
                                                    product
                                                )
                                            }
                                        />
                                    )
                                ) : (
                                    <tr>
                                        <td className="products-table-empty-cell" colSpan="9">
                                            <div className="products-table-empty-state">
                                            
                                                <strong>No products found</strong>
                                                <span>
                                                    {products.length === 0
                                                        ? "No products are available for this store."
                                                        : "Try changing your search or filters."}
                                                </span>
                                               
                                            </div>
                                        </td>
                                    </tr>
                                )}

                            </tbody>

                        </table>

                    </div>
                )}

                {/* =================================================
                    PAGINATION
                ================================================= */}

                {!loading && (
                        <div className="products-pagination">
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalItems={totalItems}
                                pageSize={pageSize}
                                itemLabel="products"
                                showWhenEmpty
                                onPageChange={setCurrentPage}
                                onPageSizeChange={(size) => {
                                    setPageSize(size);
                                    setCurrentPage(1);
                                }}
                                
                            />
                        </div>
                    )}

                {/* =================================================
                    FOOTER
                ================================================= */}

                {!loading &&
                    filteredProducts.length >
                        0 && (
                        <div className="products-footer">

                            <span className="products-source">

                                <i className="bi bi-arrow-repeat" />

                                Synced from WooCommerce

                            </span>

                        </div>
                    )}

            </div>

            {/* =================================================
                UNIFIED MODERN PRODUCT MODAL
            ================================================= */}

            <BentoDetailModal
                open={Boolean(selectedProduct)}
                onClose={() => setSelectedProduct(null)}
                headerIcon="bi-box-seam"
                title="Product Details"
                code={
                    selectedProduct?.sku
                        ? `SKU: ${selectedProduct.sku}`
                        : selectedProduct?.id
                        ? `ID: ${selectedProduct.id}`
                        : ""
                }
                size="compact"
                hero={
                    selectedProduct
                        ? {
                              icon: "bi-box-seam",
                              image: selectedProduct.image,
                              title: selectedProduct.name || "Product",
                              status: selectedProduct.stockStatus || "In Stock",
                              metricLabel: "PRICE",
                              metricValue:
                                  selectedProduct.price !== undefined &&
                                  selectedProduct.price !== null &&
                                  selectedProduct.price !== ""
                                      ? String(selectedProduct.price).startsWith("$")
                                          ? selectedProduct.price
                                          : `$${Number(selectedProduct.price).toFixed(2)}`
                                      : "$0.00",
                          }
                        : null
                }
                fields={
                    selectedProduct
                        ? [
                              {
                                  label: "CATEGORY",
                                  value: selectedProduct.category || "Uncategorized",
                              },
                              {
                                  label: "BRAND",
                                  value: selectedProduct.brand || "—",
                              },
                              {
                                  label: "PRODUCT TYPE",
                                  value: selectedProduct.type || "Simple Product",
                              },
                              {
                                  label: "QUANTITY / UNITS",
                                  value:
                                      selectedProduct.quantity !== undefined &&
                                      selectedProduct.quantity !== null &&
                                      selectedProduct.quantity !== ""
                                          ? `${selectedProduct.quantity} units`
                                          : "—",
                              },
                              {
                                  label: "TAGS",
                                  value: selectedProduct.tags,
                                  fullWidth: true,
                                  render: (tags) => {
                                      if (Array.isArray(tags) && tags.length > 0) {
                                          return (
                                              <div className="bento-chips-wrap">
                                                  {tags.map((tag) => (
                                                      <span key={tag} className="bento-chip">
                                                          {tag}
                                                      </span>
                                                  ))}
                                              </div>
                                          );
                                      }
                                      if (typeof tags === "string" && tags.trim()) {
                                          return <span className="bento-field-value">{tags}</span>;
                                      }
                                      return (
                                          <span className="bento-field-value empty-state">
                                              No tags assigned
                                          </span>
                                      );
                                  },
                              },
                          ]
                        : []
                }
            />

        </div>
    );
}


// =========================================================
// PRODUCT ROW
// =========================================================

function ProductRow({
    product,
    onClick,
}) {
    const normalizedStockStatus =
        String(
            product.stockStatus || ""
        ).toLowerCase().replace(/[\s_-]+/g, "");

    const stockClass =
        normalizedStockStatus ===
        "instock"
            ? "in-stock"
            : normalizedStockStatus ===
              "lowstock"
            ? "low-stock"
            : normalizedStockStatus ===
              "outofstock"
            ? "out-stock"
            : "out-stock";

    return (
        <tr
            className="product-row-clickable"
            onClick={onClick}
            title="Click to view product details"
        >

            {/* =================================================
                PRODUCT
            ================================================= */}

            <td>

                <div className="product-info">
                    <div>

                        <strong>
                            {product.name ||
                                "—"}
                        </strong>

                        {product.type && (
                            <small>
                                {
                                    product.type
                                }
                            </small>
                        )}

                    </div>

                </div>

            </td>

            {/* =================================================
                SKU
            ================================================= */}

            <td>

                <span className="product-sku">
                    {product.sku ||
                        "—"}
                </span>

            </td>

            {/* =================================================
                STOCK
            ================================================= */}

            <td>

                <div className="stock-info">

                    <span
                        className={`stock-dot ${stockClass}`}
                    />

                    <div>

                        <strong
                            className={
                                stockClass
                            }
                        >
                            {product.stockStatus ||
                                "—"}
                        </strong>

                        {product.quantity !==
                            undefined &&
                            product.quantity !==
                                null && (
                                <small>
                                    {
                                        product.quantity
                                    }{" "}
                                    units
                                </small>
                            )}

                    </div>

                </div>

            </td>

            {/* =================================================
                PRICE
            ================================================= */}

            <td>

                <strong className="product-price">
                    {product.price !==
                        undefined &&
                    product.price !==
                        null &&
                    product.price !==
                        ""
                        ? product.price
                        : "$0.00"}
                </strong>

            </td>

            {/* =================================================
                CATEGORY
            ================================================= */}

            <td>

                <span className="category-chip">
                    {product.category ||
                        "Uncategorized"}
                </span>

            </td>

            {/* =================================================
                TAGS
            ================================================= */}

            <td>

                <div className="product-tags">

                    {product.tags &&
                    product.tags.length >
                        0 ? (
                        product.tags.map(
                            (tag) => (
                                <span
                                    className="product-tag"
                                    key={tag}
                                >
                                    {tag}
                                </span>
                            )
                        )
                    ) : (
                        <span className="no-tags">
                            —
                        </span>
                    )}

                </div>

            </td>

            {/* =================================================
                BRAND
            ================================================= */}

            <td>

                <span className="product-brand">
                    {product.brand ||
                        "—"}
                </span>

            </td>

            {/* =================================================
                UPDATED
            ================================================= */}

            <td>

                <span className="product-date">
                    {product.updatedAt ||
                        "Recently"}
                </span>

            </td>

            {/* =================================================
                STATUS
            ================================================= */}

            <td>

                <span className="product-status">

                    <i className="bi bi-check-circle-fill" />

                    Published

                </span>

            </td>

        </tr>
    );
}
