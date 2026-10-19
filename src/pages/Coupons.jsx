import FilterDropdown from "../components/FilterDropdown";
import { useEffect, useMemo, useRef, useState } from "react";
import Pagination from "../components/Pagination";
import BentoDetailModal from "../components/BentoDetailModal";
import DeleteConfirmationDialog from "../components/DeleteConfirmationDialog";
import { api, pendingStoreRead } from "../api/http";
import { normalizeCatalog } from "../api/products";
import { catalogProductId } from "./discountForm";
import { getStoreCoupons, invalidateStoreCoupons } from "../api/storeCoupons";
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
    required_product_ids: "",
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
    const rawStatus = String(raw.status || "Active").toLowerCase();
    const status = expired ? "Expired" : usedUp ? "Used" : (rawStatus === "active" || rawStatus === "enabled" ? "Active" : rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1));
    const typeMap = {
        percent: "Percentage discount",
        fixed_cart: "Fixed cart discount",
        fixed_product: "Fixed product discount",
    };
    const discountType = raw.discount_type || raw.discountType || "fixed_cart";
    const amountValue = raw.amount ?? raw.discount_amount ?? raw.discountAmount ?? "";
    const numericAmount = amountValue === "" ? NaN : Number(amountValue);
    const displayAmount = Number.isFinite(numericAmount)
        ? numericAmount.toFixed(2)
        : amountValue;
    return {
        ...raw,
        id: raw.id ?? raw.couponId ?? raw.coupon_id ?? raw.woocommerceId ?? raw.woocommerce_id ?? raw.code,
        code: raw.code || raw.coupon_code || "",
        type: typeMap[discountType] || raw.type || discountType,
        amount: amountValue === "" ? "—" : `${displayAmount}${discountType === "percent" ? "%" : ""}`,
        description: raw.description || "",
        productIds: listValues(raw.product_ids || raw.productIds).map(String),
        issuedOrderIds: listValues(raw.issuedOrderIds || raw.issued_order_ids),
        usedOrderIds: listValues(raw.usedOrderIds || raw.used_order_ids),
        usedCount: usageCount,
        usageLimit: usageLimit || "∞",
        expiryDate: expiryDate ? String(expiryDate).slice(0, 10) : "",
        status,
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
        required_product_ids: csv(coupon.required_product_ids || coupon.requiredProductIds),
        individual_use: coupon.individual_use ?? coupon.individualUse ?? false,
        free_shipping: coupon.free_shipping ?? coupon.freeShipping ?? false,
        exclude_sale_items: coupon.exclude_sale_items ?? coupon.excludeSaleItems ?? false,
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

    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [attempt, setAttempt] = useState(0);
    const ownerId = merchantId || store?.merchantId || store?.merchant_id || store?.merchant?.id;
    const [catalogProducts, setCatalogProducts] = useState([]);
    const [catalogError, setCatalogError] = useState("");
    const [editorMode, setEditorMode] = useState("");
    useEffect(() => {
        let active = true;
        if (!storeId || !editorMode) return undefined;
        setCatalogError("");
        pendingStoreRead(`store-products:${storeId}`, () => api.get(`/stores/${encodeURIComponent(storeId)}/catalog`))
            .then(result => { if (active) setCatalogProducts(normalizeCatalog(result).products || []); })
            .catch(error => { if (active) setCatalogError(error.message || "Unable to load store products."); });
        return () => { active = false; };
    }, [storeId, editorMode]);
    useEffect(() => {
        let active = true;
        setCoupons([]);
        if (!storeId || !ownerId) return;
        setLoading(true);
        setLoadError("");
        getStoreCoupons(ownerId, storeId, { refresh: true }).then(rows => { if (active) setCoupons(rows.map(normalizeCoupon)); })
          .catch(error => { if (active) setLoadError(error.message || "Unable to load coupons."); })
          .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [ownerId, storeId, attempt]);
    const [couponForm, setCouponForm] = useState(emptyCoupon);
    const [formError, setFormError] = useState("");
    const [savingCoupon, setSavingCoupon] = useState(false);
    const couponSaveLock = useRef(false);
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

    const handleSaveCoupon = async (event) => {
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
        if (couponSaveLock.current) return;
        if (editorMode === "edit" && !couponForm.id) { setFormError("Coupon ID is missing."); return; }
        if (!ownerId) { setFormError("Merchant ID is missing for this store."); return; }
        couponSaveLock.current = true;
        setSavingCoupon(true);
        setFormError("");
        try {
            const csv = value => String(value || "").split(",").map(item => item.trim()).filter(Boolean);
            const ids = value => csv(value).map(item => {
                const id = Number(item);
                if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Product and category IDs must be positive integers.");
                return id;
            });
            const limit = value => {
                if (value === "" || value == null) return null;
                const n = Number(value);
                if (!Number.isSafeInteger(n) || n < 0) throw new Error("Usage limits must be non-negative integers.");
                return n;
            };
            const payload = {
                merchantId: ownerId, storeId, code: couponForm.code.trim(),
                amount: String(couponForm.amount), discountType: couponForm.discount_type,
                description: couponForm.description || "", individualUse: Boolean(couponForm.individual_use),
                productIds: ids(couponForm.product_ids), requiredProductIds: ids(couponForm.required_product_ids),
                excludedProductIds: ids(couponForm.excluded_product_ids),
                usageLimit: limit(couponForm.usage_limit), usageLimitPerUser: limit(couponForm.usage_limit_per_user),
                limitUsageToXItems: limit(couponForm.limit_usage_to_x_items),
                freeShipping: Boolean(couponForm.free_shipping), productCategories: ids(couponForm.product_categories),
                excludedProductCategories: ids(couponForm.excluded_product_categories), excludeSaleItems: Boolean(couponForm.exclude_sale_items),
                minimumAmount: couponForm.minimum_amount || "0.00", maximumAmount: couponForm.maximum_amount || "0.00",
                emailRestrictions: csv(couponForm.email_restrictions), dateExpires: couponForm.date_expires || null,
            };
            const response = editorMode === "edit"
                ? await api.put(`/coupons/${encodeURIComponent(couponForm.id)}`, payload)
                : await api.post("/coupons", payload);
            if (response?.success === false) throw new Error(response.message || "Unable to create coupon.");
            invalidateStoreCoupons(ownerId, storeId);
            setEditorMode("");
            setSyncMessage(editorMode === "edit" ? "Coupon updated successfully." : "Coupon created successfully.");
            setAttempt(value => value + 1);
        } catch (error) { setFormError(error.message || "Unable to create coupon."); }
        finally { couponSaveLock.current = false; setSavingCoupon(false); }
    };

    const handleDeleteCoupon = async () => {
        if (!deleteTarget?.id || !storeId || couponSaveLock.current) return;
        couponSaveLock.current = true;
        setSavingCoupon(true);
        setDeleteError("");
        try {
            const response = await api.delete(`/coupons/${encodeURIComponent(deleteTarget.id)}`);
            if (response?.success === false) throw new Error(response.message || "Unable to delete coupon.");
            invalidateStoreCoupons(ownerId, storeId);
            setDeleteTarget(null);
            setSelectedCoupon(null);
            setSyncMessage("Coupon deleted successfully.");
            setAttempt(value => value + 1);
        } catch (error) { setDeleteError(error.message || "Unable to delete coupon."); }
        finally { couponSaveLock.current = false; setSavingCoupon(false); }
    };

    if (editorMode) {
        return (
            <CouponEditor
                mode={editorMode}
                form={couponForm}
                setForm={setCouponForm}
                error={formError}
                busy={savingCoupon}
                products={catalogProducts}
                catalogError={catalogError}
                onSubmit={handleSaveCoupon}
                onClose={() => { if (!couponSaveLock.current) setEditorMode(""); }}
            />
        );
    }

    // =========================================================
    // RENDER
    // =========================================================

    return (
        <div className="coupons-page">
            {loading && <p role="status">Loading coupons…</p>}
            {loadError && <p role="alert">{loadError} <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button></p>}

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="coupons-header">

                <div className="coupons-title-area">
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
                        Reset
                    </button>

            </div>

            {/* =================================================
                MAIN CARD
            ================================================= */}
            <div className="coupons-card">

                {/* =================================================
                    TABLE HEADER
                ================================================= */}

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

                            {paginatedCoupons.length ? paginatedCoupons.map(
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
                            ) : (
                                <tr>
                                    <td className="coupons-table-empty" colSpan="9">
                                        <div className="products-table-empty-state">
                                
                                            <strong>
                                                {loading
                                                    ? "Loading coupons..."
                                                    : loadError
                                                        ? "Coupons could not be loaded."
                                                        : "No coupons found"}
                                            </strong>
                                            {!loading && !loadError && <span>Try changing your search or filters.</span>}
                                            
                                        </div>
                                    </td>
                                </tr>
                            )}

                        </tbody>

                    </table>

                </div>

                {/* =================================================
                    PAGINATION
                ================================================= */}

                {!loading && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        itemLabel="Coupons"
                        showWhenEmpty
                        onPageSizeChange={(size) => {
                            setPageSize(size);
                            setCurrentPage(1);
                        }}
                    />
                )}

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

            <BentoDetailModal
                open={Boolean(selectedCoupon)}
                onClose={() => setSelectedCoupon(null)}
                headerIcon="bi-ticket-perforated"
                title="Coupon Details"
                code={selectedCoupon?.code ? `Code: ${selectedCoupon.code}` : ""}
                hero={
                    selectedCoupon
                        ? {
                              icon: "bi-ticket-detailed",
                              title: selectedCoupon.code || "Coupon",
                              subtitle: selectedCoupon.type || "Store Discount",
                              status: selectedCoupon.status || "Active",
                              metricLabel: "DISCOUNT VALUE",
                              metricValue: selectedCoupon.amount
                                  ? (String(selectedCoupon.type || "").toLowerCase().includes("percent")
                                        ? `${selectedCoupon.amount}%`
                                        : `$${selectedCoupon.amount}`)
                                  : "—",
                          }
                        : null
                }
                layout="bento-3"
                sections={
                    selectedCoupon
                        ? [
                              {
                                  title: "DISCOUNT SPECS",
                                  fields: [
                                      {
                                          label: "COUPON CODE",
                                          value: selectedCoupon.code,
                                          mono: true,
                                      },
                                      {
                                          label: "DISCOUNT TYPE",
                                          value: selectedCoupon.type || "Percentage discount",
                                      },
                                      {
                                          label: "STATUS",
                                          value: selectedCoupon.status || "Active",
                                          render: (val) => (
                                              <span
                                                  className={`bento-status-pill ${
                                                      String(val).toLowerCase() === "active"
                                                          ? "active"
                                                          : "inactive"
                                                  }`}
                                              >
                                                  {val || "Active"}
                                              </span>
                                          ),
                                      },
                                  ],
                              },
                              {
                                  title: "USAGE CONSTRAINTS",
                                  fields: [
                                      {
                                          label: "USAGE REDEEMED",
                                          value: `${selectedCoupon.usedCount || 0} / ${
                                              selectedCoupon.usageLimit || "Unlimited"
                                          }`,
                                      },
                                      {
                                          label: "EXPIRATION DATE",
                                          value: selectedCoupon.expiryDate,
                                          emptyText: "No Expiration",
                                      },
                                      {
                                          label: "DESCRIPTION",
                                          value: selectedCoupon.description,
                                          emptyText: "No description provided",
                                      },
                                  ],
                              },
                              {
                                  title: "LINKED REFERENCES",
                                  fields: [
                                      {
                                          label: "PRODUCT IDS",
                                          value: selectedCoupon.productIds,
                                          render: (val) => {
                                              if (!val || !val.length)
                                                  return (
                                                      <span className="bento-field-value empty-state">
                                                          No products linked
                                                      </span>
                                                  );
                                              return (
                                                  <div className="bento-chips-wrap">
                                                      {val.map((p, i) => (
                                                          <span key={i} className="bento-chip">
                                                              {p}
                                                          </span>
                                                      ))}
                                                  </div>
                                              );
                                          },
                                      },
                                      {
                                          label: "USED ORDER IDS",
                                          value: selectedCoupon.usedOrderIds,
                                          render: (val) => {
                                              if (!val || !val.length)
                                                  return (
                                                      <span className="bento-field-value empty-state">
                                                          No orders used
                                                      </span>
                                                  );
                                              return (
                                                  <div className="bento-chips-wrap">
                                                      {val.map((o, i) => (
                                                          <span key={i} className="bento-chip">
                                                              {o}
                                                          </span>
                                                      ))}
                                                  </div>
                                              );
                                          },
                                      },
                                  ],
                              },
                          ]
                        : []
                }
            />

            <DeleteConfirmationDialog
                isOpen={Boolean(deleteTarget)}
                title="Delete coupon?"
                message={deleteTarget ? `Delete “${deleteTarget.code}” from this store and sync the change to WooCommerce?` : "This coupon will be removed from this store and synced to WooCommerce."}
                busy={savingCoupon}
                error={deleteError}
                onCancel={() => { if (!couponSaveLock.current) setDeleteTarget(null); }}
                onConfirm={handleDeleteCoupon}
            />

        </div>
    );
}

function CouponProductPicker({ label, products, value, onChange }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const root = useRef(null);
    const ids = String(value || "").split(",").map(item => item.trim()).filter(Boolean);
    const productName = product => String(product?.name || "Unnamed product");
    const selected = products.filter(product => ids.includes(catalogProductId(product)));
    useEffect(() => {
        const dismiss = event => { if (!root.current?.contains(event.target)) { setOpen(false); setQuery(""); } };
        document.addEventListener("pointerdown", dismiss);
        return () => document.removeEventListener("pointerdown", dismiss);
    }, []);
    return <div className="discount-product-picker" ref={root}>
        <div className="discount-product-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input aria-label={label} role="combobox" aria-expanded={open} autoComplete="off"
                placeholder={selected.length ? selected.map(productName).join(", ") : "Search store products..."}
                value={open ? query : selected.map(productName).join(", ")}
                onFocus={() => { setOpen(true); setQuery(""); }}
                onChange={event => { setQuery(event.target.value); setOpen(true); }}
                onKeyDown={event => { if (event.key === "Escape") { setOpen(false); setQuery(""); } }} />
        </div>
        {open && <div className="discount-product-menu" role="listbox">
            {products.filter(product => productName(product).toLowerCase().includes(query.toLowerCase()) && catalogProductId(product)).map(product => {
                const id = catalogProductId(product);
                const chosen = ids.includes(id);
                return <button type="button" key={id} role="option" aria-selected={chosen} onClick={() => {
                    onChange((chosen ? ids.filter(item => item !== id) : [...ids, id]).join(","));
                }}><span>{productName(product)}</span>{chosen && <i className="bi bi-check2" aria-hidden="true" />}</button>;
            })}
            {!products.some(product => productName(product).toLowerCase().includes(query.toLowerCase()) && catalogProductId(product)) && <p>No store products found.</p>}
        </div>}
    </div>;
}

function CouponEditor({ mode, form, setForm, error, busy, products = [], catalogError = "", onSubmit, onClose }) {
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
                    <div>
                        <h1 id="coupon-editor-title">{mode === "edit" ? "Edit Coupon" : "Create Coupon"}</h1>
                        <p>Set coupon details and optional restrictions.</p>
                    </div>
                </div>
                <button type="button" className="coupon-form-cancel coupon-editor-back store-config-back-button" onClick={onClose}><i className="bi bi-arrow-left" /> Back to Coupons</button>
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
                                    {products.length ? (
                                        <label className="coupon-form-field" key="product_ids">
                                            <span>Products</span>
                                            <CouponProductPicker label="Products" products={products} value={form.product_ids} onChange={value => setForm(current => ({ ...current, product_ids: value }))} />
                                            <small>{catalogError || "Choose products stored for this store."}</small>
                                        </label>
                                    ) : field("Product IDs", "product_ids", { help: catalogError || "Comma-separated product IDs from this store." })}
                                    {products.length ? (
                                        <label className="coupon-form-field" key="required_product_ids">
                                            <span>Required products</span>
                                            <CouponProductPicker label="Required products" products={products} value={form.required_product_ids} onChange={value => setForm(current => ({ ...current, required_product_ids: value }))} />
                                            <small>Optional. The cart must include these store products.</small>
                                        </label>
                                    ) : field("Required product IDs", "required_product_ids", { help: "Comma-separated product IDs from this store." })}
                                    {products.length ? (
                                        <label className="coupon-form-field" key="excluded_product_ids">
                                            <span>Excluded products</span>
                                            <CouponProductPicker label="Excluded products" products={products} value={form.excluded_product_ids} onChange={value => setForm(current => ({ ...current, excluded_product_ids: value }))} />
                                            <small>Optional. These store products cannot use the coupon.</small>
                                        </label>
                                    ) : field("Excluded product IDs", "excluded_product_ids", { help: "Comma-separated product IDs from this store." })}
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
