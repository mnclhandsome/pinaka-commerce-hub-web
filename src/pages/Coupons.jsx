import FilterDropdown from "../components/FilterDropdown";
import { useEffect, useMemo, useState } from "react";
import Pagination from "../components/Pagination";
import ViewDetailsModal from "../components/ViewDetailsModal";
import DeleteConfirmationDialog from "../components/DeleteConfirmationDialog";
import { couponsSeed } from "../data/data";
import "../styles/coupons.css";

const emptyCoupon = {
    code: "",
    discount_type: "",
    amount: "",
    description: "",
    date_expires: "",
    individual_use: false,
    exclude_sale_items: false,
    free_shipping: false,
    product_ids: "",
    excluded_product_ids: "",
    product_categories: "",
    excluded_product_categories: "",
    email_restrictions: "",
    issue_enabled: false,
    coupon_generate_type: "",
    issue_usage_limit: "",
    minimum_amount: "",
    maximum_amount: "",
    usage_limit: "",
    usage_limit_per_user: "",
    limit_usage_to_x_items: "",
};

const listValues = (value) => Array.isArray(value) ? value : [];

function normalizeCoupon(raw = {}) {
    const usageCount = Number(raw.usage_count ?? raw.usedCount ?? raw.used_count ?? 0);
    const usageLimit = raw.usage_limit ?? raw.usageLimit ?? "";
    const expiryDate = raw.date_expires || raw.expiryDate || raw.expiry_date || "";
    const expired = expiryDate && new Date(expiryDate) < new Date();
    const usedUp = Number(usageLimit) > 0 && usageCount >= Number(usageLimit);
    const typeMap = {
        percent: "Percentage discount",
        fixed_cart: "Fixed cart discount",
        fixed_product: "Fixed product discount",
    };
    const discountType = raw.discount_type || raw.discountType || "fixed_cart";
    const amountValue = raw.amount ?? raw.discount_amount ?? raw.discountAmount ?? "";
    return {
        ...raw,
        id: raw.id ?? raw.couponId ?? raw.coupon_id ?? raw.woocommerceId ?? raw.woocommerce_id ?? raw.code,
        code: raw.code || raw.coupon_code || "",
        type: typeMap[discountType] || raw.type || discountType,
        amount: amountValue === "" ? "—" : `${amountValue}${discountType === "percent" ? "%" : ""}`,
        description: raw.description || "",
        productIds: listValues(raw.product_ids || raw.productIds).map(String),
        issuedOrderIds: listValues(raw.issuedOrderIds || raw.issued_order_ids),
        usedOrderIds: listValues(raw.usedOrderIds || raw.used_order_ids),
        usedCount: usageCount,
        usageLimit: usageLimit || "∞",
        expiryDate: expiryDate ? String(expiryDate).slice(0, 10) : "",
        status: expired ? "Expired" : usedUp ? "Used" : raw.status || "Active",
    };
}

function couponToForm(coupon = {}) {
    const csv = (value) => Array.isArray(value) ? value.join(", ") : (value || "");
    return {
        ...emptyCoupon,
        ...coupon,
        code: coupon.code || "",
        discount_type: coupon.discount_type || coupon.discountType || "fixed_cart",
        amount: String(coupon.amount ?? "").replace(/[$,%]/g, "").trim(),
        date_expires: coupon.date_expires ? String(coupon.date_expires).slice(0, 10) : coupon.expiryDate || "",
        product_ids: csv(coupon.product_ids || coupon.productIds),
        excluded_product_ids: csv(coupon.excluded_product_ids || coupon.excludedProductIds),
        product_categories: csv(coupon.product_categories || coupon.productCategories),
        excluded_product_categories: csv(coupon.excluded_product_categories || coupon.excludedProductCategories),
        email_restrictions: csv(coupon.email_restrictions || coupon.emailRestrictions),
        minimum_amount: String(coupon.minimum_amount ?? coupon.minimumAmount ?? ""),
        maximum_amount: String(coupon.maximum_amount ?? coupon.maximumAmount ?? ""),
        usage_limit: String(coupon.usage_limit ?? coupon.usageLimit ?? ""),
        usage_limit_per_user: String(coupon.usage_limit_per_user ?? coupon.usageLimitPerUser ?? ""),
        limit_usage_to_x_items: String(coupon.limit_usage_to_x_items ?? coupon.limitUsageToXItems ?? ""),
    };
}

export default function Coupons({
    embedded = false,
    merchantId,
    storeId,
    store,
}) {
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    // =========================================================
    // PAGINATION
    // =========================================================

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // =========================================================
    // VIEW DETAILS
    // =========================================================

    const [selectedCoupon, setSelectedCoupon] = useState(null);

    const [coupons] = useState(() => (couponsSeed || []).map(normalizeCoupon));
    const [editorMode, setEditorMode] = useState("");
    const [couponForm, setCouponForm] = useState(emptyCoupon);
    const [formError, setFormError] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteError, setDeleteError] = useState("");

    // =========================================================
    // COUPON SYNC STATES
    // =========================================================

    const [syncMessage, setSyncMessage] = useState("");
    const [syncError, setSyncError] = useState("");

    // =========================================================
    // COUPONS
    // =========================================================

    // =========================================================
    // COUPON TYPES
    // =========================================================

    const couponTypes = useMemo(() => {
        return [
            ...new Set(
                coupons
                    .map((coupon) => coupon.type)
                    .filter(Boolean)
            ),
        ];
    }, [coupons]);

    // =========================================================
    // FILTER COUPONS
    // =========================================================

    const filteredCoupons = useMemo(() => {
        return coupons.filter((coupon) => {
            const searchText = `
                ${coupon.code || ""}
                ${coupon.issuedOrderIds?.join(" ") || ""}
                ${coupon.usedOrderIds?.join(" ") || ""}
                ${coupon.type || ""}
                ${coupon.description || ""}
                ${coupon.productIds?.join(" ") || ""}
            `.toLowerCase();

            const matchesSearch =
                !search ||
                searchText.includes(
                    search.toLowerCase()
                );

            const matchesType =
                !typeFilter ||
                coupon.type === typeFilter;

            const matchesStatus =
                !statusFilter ||
                coupon.status === statusFilter;

            return (
                matchesSearch &&
                matchesType &&
                matchesStatus
            );
        });
    }, [
        coupons,
        search,
        typeFilter,
        statusFilter,
    ]);

    // =========================================================
    // PAGINATION
    // =========================================================

    const totalItems = filteredCoupons.length;

    const totalPages = Math.ceil(
        totalItems / pageSize
    );

    const paginatedCoupons = useMemo(() => {
        const startIndex =
            (currentPage - 1) * pageSize;

        const endIndex =
            startIndex + pageSize;

        return filteredCoupons.slice(
            startIndex,
            endIndex
        );
    }, [
        filteredCoupons,
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
        typeFilter,
        statusFilter,
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
        setTypeFilter("");
        setStatusFilter("");
        setCurrentPage(1);
    };

    // =========================================================
    // SUMMARY
    // =========================================================

    const activeCount = coupons.filter(
        (coupon) => coupon.status === "Active"
    ).length;

    const expiredCount = coupons.filter(
        (coupon) => coupon.status === "Expired"
    ).length;

    const usedCount = coupons.filter(
        (coupon) =>
            Number(coupon.usedCount || 0) > 0
    ).length;

    // =========================================================
    // LATEST COUPON UPDATES
    // =========================================================

    const handleLatestCouponUpdates = () => {
        setSyncMessage("");
        setSyncError("");
        setSyncMessage("WooCommerce sync will be connected after the coupon API is implemented.");
    };

    const openCreate = () => {
        setCouponForm(emptyCoupon);
        setFormError("");
        setEditorMode("create");
    };

    const openEdit = (coupon) => {
        setCouponForm(couponToForm(coupon));
        setFormError("");
        setSelectedCoupon(null);
        setEditorMode("edit");
    };

    const handleSaveCoupon = (event) => {
        event.preventDefault();
        if (!storeId) {
            setFormError("Select a store before creating or editing a coupon.");
            return;
        }
        if (!couponForm.code.trim() || !couponForm.discount_type || couponForm.amount === "") {
            setFormError("Coupon name, discount type, and amount are required.");
            return;
        }
        if (!Number.isFinite(Number(couponForm.amount)) || Number(couponForm.amount) < 0) {
            setFormError("Enter a valid discount amount.");
            return;
        }
        setFormError("Saving will be enabled after the coupon API is implemented.");
    };

    const handleDeleteCoupon = () => {
        if (!deleteTarget || !storeId) return;
        setDeleteError("Deleting will be enabled after the coupon API is implemented.");
    };

    if (editorMode) {
        return (
            <CouponEditor
                mode={editorMode}
                form={couponForm}
                setForm={setCouponForm}
                error={formError}
                busy={false}
                onSubmit={handleSaveCoupon}
                onClose={() => setEditorMode("")}
            />
        );
    }

    // =========================================================
    // RENDER
    // =========================================================

    return (
        <div className="coupons-page">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="coupons-header">

                <div className="coupons-title-area">

                    <div className="coupons-title-icon">
                        <i className="bi bi-ticket-perforated" />
                    </div>

                    <div>
                        <h1>Coupons</h1>

                        <p>
                            View coupons available for this
                            store.
                        </p>
                    </div>

                </div>

                <div className="coupons-header-actions">

                    <button
                        type="button"
                        className="coupon-create-btn"
                        onClick={openCreate}
                        disabled={!storeId}
                    >
                        <i className="bi bi-plus-lg" />
                        Create Coupon
                    </button>

                    {/* LATEST UPDATES */}

                    <button
                        type="button"
                        className="coupon-sync-btn coupon-sync-update"
                        onClick={handleLatestCouponUpdates}
                        disabled={!storeId}
                    >
                        <i className="bi bi-arrow-repeat" />
                        Latest Updates
                    </button>

                </div>

            </div>

            {/* =================================================
                SYNC MESSAGE
            ================================================= */}

            {(syncMessage || syncError) && (
                <div
                    className={
                        syncError
                            ? "coupons-sync-message error"
                            : "coupons-sync-message success"
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
                        {syncError || syncMessage}
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

            {!storeId && (
                <div className="coupons-sync-message error" role="alert">
                    <i className="bi bi-exclamation-circle" />
                    <span>Select a store to manage its coupons.</span>
                </div>
            )}

            {/* =================================================
                SUMMARY
            ================================================= */}

            <div className="coupons-summary">

                {/* TOTAL */}

                <div className="coupon-summary-card">

                    <div className="coupon-summary-icon purple">
                        <i className="bi bi-ticket-perforated" />
                    </div>

                    <div>
                        <span>Total Coupons</span>

                        <strong>
                            {coupons.length}
                        </strong>
                    </div>

                </div>

                {/* ACTIVE */}

                <div className="coupon-summary-card">

                    <div className="coupon-summary-icon green">
                        <i className="bi bi-check-circle" />
                    </div>

                    <div>
                        <span>Active</span>

                        <strong>
                            {activeCount}
                        </strong>
                    </div>

                </div>

                {/* USED */}

                <div className="coupon-summary-card">

                    <div className="coupon-summary-icon orange">
                        <i className="bi bi-clock-history" />
                    </div>

                    <div>
                        <span>Used</span>

                        <strong>
                            {usedCount}
                        </strong>
                    </div>

                </div>

                {/* EXPIRED */}

                <div className="coupon-summary-card">

                    <div className="coupon-summary-icon red">
                        <i className="bi bi-calendar-x" />
                    </div>

                    <div>
                        <span>Expired</span>

                        <strong>
                            {expiredCount}
                        </strong>
                    </div>

                </div>

            </div>

            {/* =================================================
                TOOLBAR
            ================================================= */}

            <div className="coupons-toolbar">

                    {/* SEARCH */}

                    <div className="coupons-search">

                        <i className="bi bi-search" />

                        <input
                            type="text"
                            placeholder="Search coupon code, order ID..."
                            value={search}
                            onChange={(e) =>
                                setSearch(e.target.value)
                            }
                        />

                    </div>

                    {/* TYPE */}

                    <FilterDropdown
                        value={typeFilter}
                        onChange={(e) =>
                            setTypeFilter(e.target.value)
                        }
                    >
                        <option value="">
                            All Types
                        </option>

                        {couponTypes.map((type) => (
                            <option
                                key={type}
                                value={type}
                            >
                                {type}
                            </option>
                        ))}

                    </FilterDropdown>

                    {/* STATUS */}

                    <FilterDropdown
                        value={statusFilter}
                        onChange={(e) =>
                            setStatusFilter(e.target.value)
                        }
                    >
                        <option value="">
                            All Status
                        </option>

                        <option value="Active">
                            Active
                        </option>

                        <option value="Expired">
                            Expired
                        </option>

                        <option value="Used">
                            Used
                        </option>

                    </FilterDropdown>

                    {/* CLEAR */}

                    <button
                        type="button"
                        className="coupons-clear-btn"
                        onClick={clearFilters}
                    >
                        <i className="bi bi-arrow-counterclockwise" />
                        Clear
                    </button>

            </div>

            {/* =================================================
                MAIN CARD
            ================================================= */}
            <div className="coupons-card">

                {/* =================================================
                    TABLE HEADER
                ================================================= */}

                <div className="coupons-table-heading">

                    <div>
                        Coupons

                        <span>
                            {filteredCoupons.length}
                        </span>
                    </div>

                </div>

                {/* =================================================
                    TABLE
                ================================================= */}

                <div className="coupons-table-wrapper">

                    <table className="coupons-table">

                        <thead>

                            <tr>

                                <th>Code</th>
                                <th>Issued Order ID</th>
                                <th>Used Order ID</th>
                                <th>Coupon Type</th>
                                <th>Coupon Amount</th>
                                <th>Usage / Limit</th>
                                <th>Expiry Date</th>
                                <th>Barcode</th>
                                <th>Actions</th>

                            </tr>

                        </thead>

                        <tbody>

                            {paginatedCoupons.map(
                                (coupon) => (
                                    <CouponRow
                                        key={coupon.id}
                                        coupon={coupon}
                                        onView={() =>
                                            setSelectedCoupon(coupon)
                                        }
                                        onEdit={() => openEdit(coupon)}
                                        onDelete={() => { setDeleteError(""); setDeleteTarget(coupon); }}
                                    />
                                )
                            )}

                        </tbody>

                    </table>

                </div>

                {/* =================================================
                    EMPTY
                ================================================= */}

                {filteredCoupons.length === 0 && (
                    <div className="coupons-empty">

                        <div className="coupons-empty-icon">
                            <i className="bi bi-ticket-perforated" />
                        </div>

                        <h3>
                            No coupons found
                        </h3>

                        <p>
                            Try changing your search or
                            filters.
                        </p>

                        <button
                            type="button"
                            onClick={clearFilters}
                        >
                            Clear Filters
                        </button>

                    </div>
                )}

                {/* =================================================
                    PAGINATION
                ================================================= */}

                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        itemLabel="coupons"
                        showWhenEmpty
                        onPageSizeChange={(size) => {
                            setPageSize(size);
                            setCurrentPage(1);
                        }}
                    />

                {/* =================================================
                    FOOTER
                ================================================= */}

                {filteredCoupons.length > 0 && (
                    <div className="coupons-footer">

                        <span className="coupons-source">

                            <i className="bi bi-arrow-repeat" />

                            Synced from WooCommerce

                        </span>

                    </div>
                )}

            </div>

            {/* =================================================
                VIEW COUPON DETAILS
            ================================================= */}

            <ViewDetailsModal
                open={Boolean(selectedCoupon)}
                title="Coupon Details"
                subtitle={
                    selectedCoupon?.code
                        ? `Coupon Code: ${selectedCoupon.code}`
                        : ""
                }
                data={selectedCoupon}
                fields={[
                    {
                        label: "Coupon Code",
                        key: "code",
                        fullWidth: true,
                    },
                    {
                        label: "Coupon Type",
                        key: "type",
                    },
                    {
                        label: "Coupon Amount",
                        key: "amount",
                    },
                    {
                        label: "Status",
                        key: "status",
                        render: (value) => {
                            const status = value || "—";

                            const statusClass =
                                status === "Active"
                                    ? "active"
                                    : status === "Expired"
                                        ? "inactive"
                                        : "pending";

                            return (
                                <span
                                    className={`detail-status ${statusClass}`}
                                >
                                    {status}
                                </span>
                            );
                        },
                    },
                    {
                        label: "Usage",
                        value: (coupon) =>
                            `${coupon?.usedCount || 0} / ${
                                coupon?.usageLimit || "∞"
                            }`,
                    },
                    {
                        label: "Expiry Date",
                        key: "expiryDate",
                    },
                    {
                        label: "Description",
                        key: "description",
                        fullWidth: true,
                    },
                    {
                        label: "Issued Order IDs",
                        key: "issuedOrderIds",
                        fullWidth: true,
                        render: (values) =>
                            values?.length ? (
                                <div className="view-details-list">
                                    {values.map((orderId) => (
                                        <div
                                            key={orderId}
                                            className="view-details-list-item"
                                        >
                                            <strong>{orderId}</strong>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <span>—</span>
                            ),
                    },
                    {
                        label: "Used Order IDs",
                        key: "usedOrderIds",
                        fullWidth: true,
                        render: (values) =>
                            values?.length ? (
                                <div className="view-details-list">
                                    {values.map((orderId) => (
                                        <div
                                            key={orderId}
                                            className="view-details-list-item"
                                        >
                                            <strong>{orderId}</strong>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <span>—</span>
                            ),
                    },
                    {
                        label: "Product IDs",
                        key: "productIds",
                        fullWidth: true,
                        render: (values) =>
                            values?.length ? (
                                <div className="view-details-list">
                                    {values.map((productId) => (
                                        <div
                                            key={productId}
                                            className="view-details-list-item"
                                        >
                                            <strong>{productId}</strong>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <span>—</span>
                            ),
                    },
                ]}
                onClose={() => setSelectedCoupon(null)}
            />

            <DeleteConfirmationDialog
                isOpen={Boolean(deleteTarget)}
                title="Delete coupon?"
                message={deleteTarget ? `Delete “${deleteTarget.code}” from this store and sync the change to WooCommerce?` : "This coupon will be removed from this store and synced to WooCommerce."}
                busy={false}
                error={deleteError}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={handleDeleteCoupon}
            />

        </div>
    );
}

function CouponEditor({ mode, form, setForm, error, busy, onSubmit, onClose }) {
    const [activeTab, setActiveTab] = useState("general");
    const editorTabs = [
        ["general", "General", "bi-ticket-perforated"],
        ["restrictions", "Usage restriction", "bi-slash-circle"],
        ["limits", "Usage limits", "bi-arrows-collapse"],
        ["issuing", "Issuing Coupon", "bi-wrench-adjustable"],
    ];
    const change = (event) => {
        const { name, value, type, checked } = event.target;
        setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    };
    const field = (label, name, options = {}) => (
        <label className="coupon-form-field" key={name}>
            <span>{label}{options.required ? " *" : ""}</span>
            {options.textarea ? (
                <textarea name={name} value={form[name] || ""} onChange={change} rows={3} />
            ) : options.select ? (
                <FilterDropdown name={name} value={form[name] || ""} onChange={change} required={options.required}>
                    {options.select.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </FilterDropdown>
            ) : (
                <input name={name} type={options.type || "text"} value={form[name] ?? ""} onChange={change} required={options.required} min={options.min} step={options.step} />
            )}
            {options.help && <small>{options.help}</small>}
        </label>
    );
    const toggle = (label, name) => (
        <label className="coupon-form-toggle" key={name}>
            <input type="checkbox" name={name} checked={Boolean(form[name])} onChange={change} />
            <span>{label}</span>
        </label>
    );

    return (
        <div className="coupons-page coupon-editor-page">
            <header className="coupons-header coupon-editor-heading">
                <div className="coupons-title-area">
                    <div className="coupons-title-icon"><i className="bi bi-ticket-perforated" /></div>
                    <div>
                        <h1 id="coupon-editor-title">{mode === "edit" ? "Edit Coupon" : "Create Coupon"}</h1>
                        <p>Set coupon details and optional restrictions.</p>
                    </div>
                </div>
                    <button type="button" className="coupon-form-cancel" onClick={onClose}>Back to coupons</button>
                </header>
                <section className="coupon-editor-layout">
                    <nav className="coupon-editor-tabs" role="tablist" aria-label="Coupon settings">
                        {editorTabs.map(([id, label, icon]) => (
                            <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>
                                <i className={`bi ${icon}`} /><span>{label}</span>
                            </button>
                        ))}
                    </nav>
                    <form className="coupon-editor-form" onSubmit={onSubmit}>
                        <div className="coupon-editor-body">
                            {activeTab === "general" && <>
                                <h2>General</h2>
                                <div className="coupon-editor-grid">
                                    {field("Coupon name", "code", { required: true, help: "This is the coupon code customers enter at checkout." })}
                                    {field("Discount type", "discount_type", { required: true, select: [["", "Select discount type"], ["fixed_cart", "Fixed cart discount"], ["percent", "Percentage discount"], ["fixed_product", "Fixed product discount"]] })}
                                    {field("Amount", "amount", { required: true, type: "number", min: "0", step: "0.01" })}
                                    {field("Expiry date", "date_expires", { type: "date" })}
                                    {field("Description", "description", { textarea: true })}
                                </div>
                            </>}
                            {activeTab === "restrictions" && <>
                                <h2>Usage restriction</h2>
                                <div className="coupon-editor-grid">
                                    {field("Minimum spend", "minimum_amount", { type: "number", min: "0", step: "0.01" })}
                                    {field("Maximum spend", "maximum_amount", { type: "number", min: "0", step: "0.01" })}
                                    {field("Product IDs", "product_ids", { help: "Comma-separated WooCommerce product IDs." })}
                                    {field("Excluded product IDs", "excluded_product_ids", { help: "Comma-separated WooCommerce product IDs." })}
                                    {field("Product category IDs", "product_categories", { help: "Comma-separated category IDs." })}
                                    {field("Excluded category IDs", "excluded_product_categories", { help: "Comma-separated category IDs." })}
                                    {field("Allowed emails", "email_restrictions", { help: "Comma-separated email addresses." })}
                                </div>
                                <div className="coupon-editor-toggles">
                                    {toggle("Individual use only", "individual_use")}
                                    {toggle("Exclude sale items", "exclude_sale_items")}
                                    {toggle("Allow free shipping", "free_shipping")}
                                </div>
                            </>}
                            {activeTab === "limits" && <>
                                <h2>Usage limits</h2>
                                <div className="coupon-editor-grid">
                                    {field("Coupon usage limit", "usage_limit", { type: "number", min: "0", step: "1", help: "Leave blank for unlimited usage." })}
                                    {field("Usage limit per user", "usage_limit_per_user", { type: "number", min: "0", step: "1" })}
                                    {field("Limit usage to X items", "limit_usage_to_x_items", { type: "number", min: "0", step: "1" })}
                                </div>
                            </>}
                            {activeTab === "issuing" && <>
                                <h2>Issuing Coupon</h2>
                                <div className="coupon-editor-toggles coupon-issue-enable">
                                    {toggle("Enable coupon issuing", "issue_enabled")}
                                </div>
                                {form.issue_enabled && <div className="coupon-editor-grid coupon-issue-fields">
                                    {field("Coupon generate type", "coupon_generate_type", { select: [["", "Select type"], ["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["yearly", "Yearly"]] })}
                                    {field("Coupon usage limit", "issue_usage_limit", { type: "number", min: "0", step: "1" })}
                                </div>}
                                <p className="coupon-editor-note">Issuing settings are optional and can be configured later.</p>
                            </>}
                        </div>
                        {error && <p className="coupon-form-error" role="alert">{error}</p>}
                    <footer className="coupon-editor-actions">
                        <button type="button" className="coupon-form-cancel" onClick={onClose} disabled={busy}>Cancel</button>
                        <button type="submit" className="coupon-form-save" disabled={busy}>{busy ? "Saving…" : mode === "edit" ? "Save Changes" : "Create Coupon"}</button>
                    </footer>
                    </form>
                </section>
        </div>
    );
}

// =========================================================
// COUPON ROW
// =========================================================

function CouponRow({ coupon, onView, onEdit, onDelete }) {

    const statusClass =
        coupon.status === "Active"
            ? "active"
            : coupon.status === "Expired"
                ? "expired"
                : "used";

    return (
        <tr
            className="coupon-row-clickable"
            onClick={onView}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
                if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {
                    event.preventDefault();
                    onView?.();
                }
            }}
        >

            {/* =================================================
                CODE
            ================================================= */}

            <td>

                <div className="coupon-code-cell">

                    <div>

                        <strong>
                            {coupon.code}
                        </strong>

                        <span
                            className={`coupon-status ${statusClass}`}
                        >
                            <i className="bi bi-circle-fill" />
                            {coupon.status}
                        </span>

                    </div>

                </div>

            </td>

            {/* =================================================
                ISSUED ORDER ID
            ================================================= */}

            <td>

                <OrderList
                    values={coupon.issuedOrderIds}
                />

            </td>

            {/* =================================================
                USED ORDER ID
            ================================================= */}

            <td>

                <OrderList
                    values={coupon.usedOrderIds}
                />

            </td>

            {/* =================================================
                COUPON TYPE
            ================================================= */}

            <td>

                <span className="coupon-type">
                    {coupon.type}
                </span>

            </td>

            {/* =================================================
                COUPON AMOUNT
            ================================================= */}

            <td>

                <strong className="coupon-amount">
                    {coupon.amount}
                </strong>

            </td>

            {/* =================================================
                USAGE / LIMIT
            ================================================= */}

            <td>

                <div className="coupon-usage">

                    <strong>
                        {coupon.usedCount || 0}
                    </strong>

                    <span>/</span>

                    <span>
                        {coupon.usageLimit || "∞"}
                    </span>

                </div>

            </td>

            {/* =================================================
                EXPIRY DATE
            ================================================= */}

            <td>

                <span className="coupon-expiry">
                    {coupon.expiryDate || "—"}
                </span>

            </td>

            {/* =================================================
                BARCODE
            ================================================= */}

            <td>

                <Barcode
                    value={coupon.code}
                />

            </td>

            <td className="coupon-row-actions" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                <button type="button" aria-label={`Edit ${coupon.code}`} title="Edit coupon" onClick={onEdit}><i className="bi bi-pencil" /></button>
                <button type="button" aria-label={`Delete ${coupon.code}`} title="Delete coupon" onClick={onDelete}><i className="bi bi-trash3" /></button>
            </td>

        </tr>
    );
}

// =========================================================
// ORDER LIST
// =========================================================

function OrderList({ values }) {

    if (!values || values.length === 0) {
        return (
            <span className="empty-value">
                —
            </span>
        );
    }

    const visible = values.slice(0, 2);

    return (
        <div className="coupon-order-list">

            {visible.map((order) => (
                <span key={order}>
                    {order}
                </span>
            ))}

            {values.length > 2 && (
                <small>
                    +{values.length - 2} more
                </small>
            )}

        </div>
    );
}

// =========================================================
// BARCODE
// =========================================================

function Barcode({ value }) {

    return (
        <div className="coupon-barcode-cell">

            <div className="barcode">

                {Array.from(
                    { length: 24 },
                    (_, index) => (
                        <span
                            key={index}
                            style={{
                                width:
                                    index % 4 === 0
                                        ? "3px"
                                        : index % 2 === 0
                                            ? "2px"
                                            : "1px",
                            }}
                        />
                    )
                )}

            </div>

            <small>
                {value}
            </small>

            <button
                type="button"
                className="barcode-download"
                onClick={() => {
                    alert(
                        `Barcode download will be connected to the backend for ${value}.`
                    );
                }}
            >
                <i className="bi bi-download" />
                Download
            </button>

        </div>
    );
}
