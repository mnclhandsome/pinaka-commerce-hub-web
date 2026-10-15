import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, pendingStoreRead } from "../api/http";
import { normalizeCatalog } from "../api/products";
import FilterDropdown from "../components/FilterDropdown";
import Pagination from "../components/Pagination";
import DeleteConfirmationDialog from "../components/DeleteConfirmationDialog";
import "../styles/coupons.css";
import "../styles/discounts.css";

const TYPES = [
  { id: "all", label: "All discounts", icon: "bi-grid" },
  { id: "auto", label: "Auto Discount", icon: "bi-lightning-charge" },
  { id: "mix_match", label: "Mix 'n Match", icon: "bi-intersect" },
  { id: "multipack", label: "Multipack", icon: "bi-boxes" },
];

const emptyForm = (type = "auto") => ({
  type,
  code: "",
  discount_type: type === "mix_match" ? "percent" : type === "multipack" ? "price" : "percent",
  amount: "",
  product: "",
  discounted_products: "",
  auto_apply: false,
  qty: "",
  usage_limit: "",
  minimum_amount: "",
  maximum_amount: "",
  min_qty: "",
  max_qty: "",
  date_starts: "",
  date_expires: "",
});

const typeOptions = {
  auto: [
    ["percent", "Percentage discount"],
    ["fixed_cart", "Fixed cart discount"],
  ],
  mix_match: [
    ["percent", "Percentage discount"],
    ["fixed_item", "Fixed item discount"],
  ],
  multipack: [
    ["percent", "Percentage discount"],
    ["price", "Fixed discount"],
  ],
};

const typeLabel = (value) => TYPES.find((type) => type.id === value)?.label || "Discount";
const discountStatus = (discount) => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (discount.date_starts && discount.date_starts > today) return "Scheduled";
  if (discount.date_expires && discount.date_expires < today) return "Expired";
  return "Active";
};
const amountLabel = (discount) => {
  if (discount.discount_type === "percent") return `${discount.amount}%`;
  return `$${Number(discount.amount || 0).toFixed(2)}`;
};
const inputDate = value => {
  const text = String(value ?? "").slice(0, 10);
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : text;
};
const formatSystemDate = (value) => {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
};

function DiscountProductPicker({ products, value, onChange, multiple = false, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef(null);
  const ids = String(value || "").split(",").filter(Boolean);
  const productId = product => String(product.wordpressId || product.id);
  const selected = products.filter(product => ids.includes(productId(product)));
  useEffect(() => {
    const dismiss = event => { if (!root.current?.contains(event.target)) { setOpen(false); setQuery(""); } };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  return <div className="discount-product-picker" ref={root}>
    <div className="discount-product-search">
      <i className="bi bi-search" aria-hidden="true" />
      <input aria-label={multiple ? "Search discounted products" : "Search products"} role="combobox" aria-expanded={open} autoComplete="off" disabled={disabled}
        placeholder={selected.length ? selected.map(product => product.name).join(", ") : "Search products..."}
        value={open ? query : selected.map(product => product.name).join(", ")}
        onFocus={() => { setOpen(true); setQuery(""); }} onChange={event => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={event => { if (event.key === "Escape") { setOpen(false); setQuery(""); } }} />
    </div>
    {open && !disabled && <div className="discount-product-menu">
      {products.filter(product => product.name.toLowerCase().includes(query.toLowerCase())).map(product => {
        const id = productId(product);
        return <button type="button" key={id} aria-pressed={ids.includes(id)} onClick={() => {
          onChange(multiple ? (ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]).join(",") : id);
          if (!multiple) { setOpen(false); setQuery(""); }
        }}><span>{product.name}</span>{ids.includes(id) && <i className="bi bi-check2" aria-hidden="true" />}</button>;
      })}
      {!products.some(product => product.name.toLowerCase().includes(query.toLowerCase())) && <p>No products found.</p>}
    </div>}
  </div>;
}
export default function Discounts({ embedded = false }) {
  const { storeId } = useParams();
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [pagination, setPagination] = useState({});
  const catalogCache = useRef({});
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [formTab, setFormTab] = useState("details");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const deleteLock = useRef(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    setDiscounts([]);
    const path = `/stores/${storeId}/discounts?page=${currentPage}&per_page=${pageSize}`;
    pendingStoreRead(`discounts:${path}`, () => api.get(path, { headers: { Accept: "application/json" } }))
      .then(async response => {
        if (!active) return;
        if (response?.success === false || response?.status === "error") throw new Error(response.message || "Unable to load discounts.");
        const data = response?.data ?? response;
        if (!catalogCache.current[storeId]) {
          catalogCache.current[storeId] = pendingStoreRead(`store-products:${storeId}`, () => api.get(`/stores/${encodeURIComponent(storeId)}/catalog`))
            .then(result => normalizeCatalog(result).products)
            .catch(error => { delete catalogCache.current[storeId]; throw error; });
        }
        const catalog = await catalogCache.current[storeId];
        if (!active) return;
        setCatalogProducts(catalog);
        const productNames = new Map();
        catalog.forEach(product => {
          [product.id, product.product_id, product.wordpressId, product.wordpress_id, product.payload?.id].filter(id => id != null).forEach(id => productNames.set(String(id), product.name));
        });
        const names = value => {
          const values = Array.isArray(value) ? value : String(value ?? "").split(",").map(item => item.trim()).filter(Boolean);
          return values.map(item => {
            if (item && typeof item === "object") return item.name || item.title || productNames.get(String(item.product_id ?? item.id)) || "Product unavailable";
            return productNames.get(String(item)) || (/^\d+$/.test(String(item)) ? "Product unavailable" : String(item));
          }).join(", ");
        };
        const rows = Array.isArray(data) ? data : ["auto", "mix_match", "multipack"].flatMap(type => (Array.isArray(data?.[type]) ? data[type] : []).map(item => ({ ...item, type })));
        setDiscounts(rows.map(item => ({
          ...item,
          id: item.id ?? item.discount_id,
          type: item.type || "auto",
          code: item.code || item.name || "—",
          amount: item.coupon_amount ?? "0",
          product: item.type === "mix_match" ? names(item.product_label || item.product_id) : names(item.product_label ?? item.product ?? item.product_name ?? item.products ?? item.product_ids ?? item.product_id),
          discounted_products: names(item.discounted_products ?? item.discount_products ?? item.discount_product_ids),
          date_starts: inputDate(item.date_starts ?? item.start_date),
          date_expires: inputDate(item.date_expires ?? item.expiry_date),
        })));
        setPagination(response?.pagination || {});
      })
      .catch(error => { if (active) setLoadError(error.message || "Unable to load discounts."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId, currentPage, pageSize, retry]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return discounts.filter((item) => {
      const matchesType = !typeFilter || item.type === typeFilter;
      const matchesStatus = !statusFilter || discountStatus(item) === statusFilter;
      const matchesSearch = !query || [item.code, item.product, item.discounted_products, typeLabel(item.type), item.discount_type]
        .join(" ").toLowerCase().includes(query);
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [discounts, search, typeFilter, statusFilter]);
  const totalPages = Math.max(1, Number(pagination.total_pages ?? pagination.totalPages) || (pagination.has_more ? currentPage + 1 : currentPage));
  const visibleDiscounts = filtered;

  const openCreate = () => {
    setForm({ ...emptyForm("auto"), type: "" });
    setFormTab("details");
    setFormError("");
    setMode("create");
  };

  const changeProgramType = (type) => {
    setForm((current) => ({
      ...emptyForm(type),
      code: current.code,
      amount: current.amount,
      product: current.product,
      date_starts: current.date_starts,
      date_expires: current.date_expires,
      usage_limit: current.usage_limit,
    }));
    setFormError("");
  };

  const openEdit = (discount) => {
    setForm({ ...emptyForm(discount.type), ...discount, product: String(discount.product_id ?? ""), discounted_products: (discount.discount_product_ids || []).map(String).join(","), auto_apply: [true, 1, "1", "yes", "true"].includes(discount.pinaka_discount_auto_apply) });
    setFormTab("details");
    setFormError("");
    setMode("edit");
  };

  const closeEditor = () => {
    if (saveLock.current) return;
    setMode("");
    setFormError("");
  };

  const saveDiscount = async (event) => {
    event.preventDefault();
    if (saveLock.current) return;
    setFormError("");
    const amount = Number(form.amount);
    if (!form.code.trim() || !form.discount_type || form.amount === "") {
      setFormError("Discount name, discount type, and amount are required.");
      setFormTab("details");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0 || (form.discount_type === "percent" && amount > 100)) {
      setFormError(form.discount_type === "percent" ? "Enter an amount greater than 0 and no more than 100%." : "Enter a valid discount amount greater than 0.");
      setFormTab("details");
      return;
    }
    if (!form.product.trim()) {
      setFormError(form.type === "mix_match" ? "Choose a main trigger product." : "Enter a product name.");
      setFormTab("rules");
      return;
    }
    if (form.type === "mix_match" && !form.discounted_products.trim()) {
      setFormError("Enter at least one discounted product.");
      setFormTab("rules");
      return;
    }
    if (form.type === "multipack" && (!Number(form.qty) || Number(form.qty) < 1)) {
      setFormError("Pack quantity must be at least 1.");
      setFormTab("rules");
      return;
    }

    {
      const productId = Number(form.product);
      const discountedIds = form.discounted_products.split(",").map(value => Number(value.trim())).filter(Boolean);
      if (!Number.isInteger(productId) || productId <= 0 || (form.type === "mix_match" && !discountedIds.length)) {
        setFormError("Select valid store products.");
        setFormTab("rules");
        return;
      }
      if (form.date_starts && form.date_expires && form.date_starts > form.date_expires) {
        setFormError("Expiry date must be on or after the start date.");
        setFormTab("limits");
        return;
      }
      const payload = {
        type: form.type,
        code: form.code.trim(),
        discount_type: form.discount_type,
        amount,
        product_id: productId,
        pinaka_discount_auto_apply: Boolean(form.auto_apply),
        ...(form.type === "mix_match" ? { discount_product_ids: discountedIds } : {}),
      };
      for (const key of ["qty", "usage_limit", "minimum_amount", "maximum_amount", "min_qty", "max_qty"]) {
        if (form[key] !== "") payload[key] = Number(form[key]);
      }
      if (form.date_starts) payload.date_starts = form.date_starts;
      if (form.date_expires) payload.date_expires = form.date_expires;
      saveLock.current = true;
      setSaving(true);
      try {
        const basePath = `/stores/${encodeURIComponent(storeId)}/discounts`;
        const response = mode === "edit"
          ? await api.put(`${basePath}/${encodeURIComponent(form.type)}/${encodeURIComponent(form.id)}`, payload)
          : await api.post(basePath, payload);
        if (response?.success === false || ["error", "failed"].includes(response?.status)) throw new Error(response.message || "Unable to save discount.");
        setNotice(response?.message || (mode === "edit" ? "Discount updated successfully." : "Discount created successfully."));
        setMode("");
        setCurrentPage(1);
        setRetry(value => value + 1);
      } catch (error) {
        setFormError(error.message || "Unable to save discount.");
      } finally {
        saveLock.current = false;
        setSaving(false);
      }
      return;
    }
  };

  const deleteDiscount = async () => {
    if (!deleteTarget || deleteLock.current) return;
    deleteLock.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await api.delete(`/stores/${encodeURIComponent(storeId)}/discounts/${encodeURIComponent(deleteTarget.type)}/${encodeURIComponent(deleteTarget.id)}`);
      if (response?.success === false || ["error", "failed"].includes(response?.status)) throw new Error(response.message || "Unable to delete discount.");
      setNotice(response?.message || "Discount deleted successfully.");
      setDeleteTarget(null);
      if (discounts.length === 1 && currentPage > 1) setCurrentPage(page => page - 1);
      else setRetry(value => value + 1);
    } catch (error) {
      setDeleteError(error.message || "Unable to delete discount.");
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  };
  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  if (mode) {
    return (
      <div className={`coupons-page discounts-page ${embedded ? "discounts-embedded" : ""}`}>
        <div className="coupons-header coupon-editor-heading">
          <div className="discount-editor-title">
            <button type="button" className="discount-back" onClick={closeEditor}>
              <i className="bi bi-arrow-left" /> Discounts
            </button>
            <h1>{mode === "edit" ? "Edit discount" : "Create discount"}</h1>
            <p>{typeLabel(form.type)} settings</p>
          </div>
        </div>
        <form className="discount-editor-layout" onSubmit={saveDiscount}>
          <nav className="discount-editor-tabs" aria-label="Discount settings">
            {[
              ["details", "bi-tag", "Discount details"],
              ["rules", "bi-basket", "Products & rules"],
              ["limits", "bi-calendar3", "Schedule & limits"],
            ].map(([id, icon, label]) => (
              <button key={id} type="button" className={formTab === id ? "active" : ""} onClick={() => setFormTab(id)} disabled={mode === "create" && !form.type}>
                <i className={`bi ${icon}`} />{label}
              </button>
            ))}
          </nav>
          <div className="discount-editor-main">
            <div className="discount-editor-body">
              {formTab === "details" && <>
                <h2>Discount details</h2>
                <div className="coupon-editor-grid">
                  {mode === "create" ? <label className="coupon-form-field"><span className="discount-field-label">Select discount <span className="discount-required" title="Required" aria-label="Required">*</span></span>
                    <select value={form.type} onChange={(event) => changeProgramType(event.target.value)} required>
                      <option value="" disabled>Select a discount</option>
                      {TYPES.filter((type) => type.id !== "all").map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                    </select>
                  </label> : <div className="coupon-form-field"><span>Select discount</span><div className="discount-program-readonly">{typeLabel(form.type)}</div></div>}
                  {form.type ? <>
                  <label className="coupon-form-field"><span className="discount-field-label">Discount name <span className="discount-required" title="Required" aria-label="Required">*</span></span>
                    <input autoFocus value={form.code} onChange={(event) => updateForm("code", event.target.value)} placeholder="e.g. Weekend special" required />
                  </label>
                  <label className="coupon-form-field"><span className="discount-field-label">Discount type <span className="discount-required" title="Required" aria-label="Required">*</span></span>
                    <select value={form.discount_type} onChange={(event) => updateForm("discount_type", event.target.value)} required>
                      {typeOptions[form.type].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="coupon-form-field"><span className="discount-field-label">Amount {form.discount_type === "percent" ? "(%)" : ""} <span className="discount-required" title="Required" aria-label="Required">*</span></span>
                    <input type="number" min="0.01" max={form.discount_type === "percent" ? 100 : undefined} step="0.01" value={form.amount} onChange={(event) => updateForm("amount", event.target.value)} placeholder="0.00" required />
                    <small>{form.discount_type === "percent" ? "Enter a percentage from 0 to 100." : "Enter the fixed discount amount."}</small>
                  </label>
                  {form.type === "auto" && <label className="coupon-form-toggle discount-auto-toggle">
                    <input type="checkbox" checked={Boolean(form.auto_apply)} onChange={(event) => updateForm("auto_apply", event.target.checked)} />
                    <span>Apply automatically when conditions match</span>
                  </label>}
                  </> : <p className="discount-select-hint">Choose a discount type to enable its settings.</p>}
                </div>
              </>}
              {formTab === "rules" && <>
                <h2>Products & rules</h2>
                <div className="coupon-editor-grid">
                  <div className="coupon-form-field"><span className="discount-field-label">{form.type === "mix_match" ? "Main product (trigger)" : "Product"} <span className="discount-required">*</span></span>
                    <DiscountProductPicker products={catalogProducts} value={form.product} onChange={value => updateForm("product", value)} disabled={saving} />
                    <small>Select a product from the store catalog.</small>
                  </div>
                  {form.type === "mix_match" && <div className="coupon-form-field discount-full-width"><span className="discount-field-label">Discounted products <span className="discount-required">*</span></span>
                    <DiscountProductPicker products={catalogProducts} value={form.discounted_products} onChange={value => updateForm("discounted_products", value)} multiple disabled={saving} />
                    <small>These products receive the discount when the trigger product is present.</small>
                  </div>}                  {form.type === "multipack" && <label className="coupon-form-field"><span className="discount-field-label">Pack quantity <span className="discount-required" title="Required" aria-label="Required">*</span></span>
                    <input type="number" min="1" step="1" value={form.qty} onChange={(event) => updateForm("qty", event.target.value)} placeholder="e.g. 3" required />
                  </label>}
                  {form.type === "auto" && <>
                    <label className="coupon-form-field">Minimum spend
                      <input type="number" min="0" step="0.01" value={form.minimum_amount} onChange={(event) => updateForm("minimum_amount", event.target.value)} placeholder="No minimum" />
                    </label>
                    <label className="coupon-form-field">Maximum spend
                      <input type="number" min="0" step="0.01" value={form.maximum_amount} onChange={(event) => updateForm("maximum_amount", event.target.value)} placeholder="No maximum" />
                    </label>
                  </>}
                </div>
              </>}
              {formTab === "limits" && <>
                <h2>Schedule & limits</h2>
                <div className="coupon-editor-grid">
                  <label className="coupon-form-field">Start date
                    <input type="date" value={form.date_starts} onChange={(event) => updateForm("date_starts", event.target.value)} />
                  </label>
                  <label className="coupon-form-field">Expiry date
                    <input type="date" value={form.date_expires} onChange={(event) => updateForm("date_expires", event.target.value)} />
                  </label>
                  <label className="coupon-form-field">Usage limit
                    <input type="number" min="0" step="1" value={form.usage_limit} onChange={(event) => updateForm("usage_limit", event.target.value)} placeholder="Unlimited" />
                    <small>{form.type === "multipack" ? "Maximum number of orders allowed for this pack." : "Maximum total uses for this discount."}</small>
                  </label>
                  {form.type === "auto" && <>
                    <label className="coupon-form-field">Minimum quantity
                      <input type="number" min="0" step="1" value={form.min_qty} onChange={(event) => updateForm("min_qty", event.target.value)} placeholder="No minimum" />
                    </label>
                    <label className="coupon-form-field">Maximum quantity
                      <input type="number" min="0" step="1" value={form.max_qty} onChange={(event) => updateForm("max_qty", event.target.value)} placeholder="No maximum" />
                    </label>
                  </>}
                </div>
              </>}
              {formError && <p className="coupon-form-error" role="alert">{formError}</p>}
            </div>
            <div className="coupon-editor-actions">
              <button type="button" className="coupon-form-cancel" onClick={closeEditor}>Cancel</button>
              <button type="submit" className="coupon-form-save" disabled={saving || (mode === "create" && !form.type)}><i className="bi bi-check2" />{saving ? "Saving…" : mode === "edit" ? "Save changes" : "Create discount"}</button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={`coupons-page discounts-page ${embedded ? "discounts-embedded" : ""}`}>
      <div className="coupons-header">
        <div className="coupons-title-area">
          <div className="coupons-title-icon"><i className="bi bi-percent" /></div>
          <div><h1>Discounts</h1><p>Create and manage automatic, mix 'n match, and multipack discounts for this store.</p></div>
        </div>
        <div className="coupons-header-actions">
          <button type="button" className="coupon-create-btn" onClick={openCreate}><i className="bi bi-plus-lg" />Create discount</button>
        </div>
      </div>

      {notice && <div className="discount-notice" role="status"><i className="bi bi-info-circle" />{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><i className="bi bi-x" /></button></div>}

      <div className="coupons-summary discounts-summary">
        {[
          { label: "All Discounts", count: discounts.length, icon: "bi-percent", tone: "purple" },
          { label: "Auto Discount", count: discounts.filter((item) => item.type === "auto").length, icon: "bi-lightning-charge", tone: "green" },
          { label: "Mix 'n Match", count: discounts.filter((item) => item.type === "mix_match").length, icon: "bi-intersect", tone: "orange" },
          { label: "Multipack", count: discounts.filter((item) => item.type === "multipack").length, icon: "bi-boxes", tone: "red" },
        ].map((card) => <div className="coupon-summary-card" key={card.label}>
          <div className={`coupon-summary-icon ${card.tone}`}><i className={`bi ${card.icon}`} /></div>
          <div><span>{card.label}</span><strong>{card.count}</strong></div>
        </div>)}
      </div>

      <div className="coupons-card discounts-card">
        <div className="coupons-toolbar">
          <label className="coupons-search"><i className="bi bi-search" /><input value={search} onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }} placeholder="Search discount name or product..." /></label>
          <FilterDropdown aria-label="Discount type" value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setCurrentPage(1); }}>
            <option value="">All Types</option>
            {TYPES.filter((type) => type.id !== "all").map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
          </FilterDropdown>
          <FilterDropdown aria-label="Discount status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }}>
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Expired">Expired</option>
          </FilterDropdown>
          {(search || typeFilter || statusFilter) && <button type="button" className="coupons-clear-btn" onClick={() => { setSearch(""); setTypeFilter(""); setStatusFilter(""); setCurrentPage(1); }}><i className="bi bi-arrow-counterclockwise" />Clear</button>}
        </div>
        <div className="coupons-table-heading"><div>Discounts<span>{filtered.length}</span></div></div>
        {loading ? <p role="status">Loading discounts…</p> : loadError ? <p role="alert">{loadError} <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></p> : visibleDiscounts.length ? <div className="coupons-table-wrapper">
          <table className="coupons-table discounts-table">
            <thead><tr><th>Name</th><th>Discount type</th><th>Amount</th><th>Product / rules</th><th>Usage / limit</th><th>Start date</th><th>Expiry date</th><th>Actions</th></tr></thead>
            <tbody>{visibleDiscounts.map((discount) => <tr key={discount.id}>
              <td><div className="discount-name-cell"><strong>{discount.code}</strong><small>{typeLabel(discount.type)}</small></div></td>
              <td><span className="discount-type-pill">{discount.type || "—"}</span></td>
              <td><strong className="discount-amount">{amountLabel(discount)}</strong></td>
              <td><span className="discount-product-cell">{`${discount.product}${discount.type === "multipack" ? ` · ${discount.qty} items` : ""}`}</span></td>
              <td>{discount.usage_limit || "∞"}</td>
              <td>{formatSystemDate(discount.date_starts)}</td>
              <td>{formatSystemDate(discount.date_expires)}</td>

              <td className="coupon-row-actions"><button type="button" aria-label={`Edit ${discount.code}`} onClick={() => openEdit(discount)}><i className="bi bi-pencil" /></button><button type="button" aria-label={`Delete ${discount.code}`} onClick={() => { setDeleteError(""); setDeleteTarget(discount); }}><i className="bi bi-trash3" /></button></td>
            </tr>)}</tbody>
          </table>
        </div> : <div className="discounts-empty"><div className="coupons-empty-icon"><i className="bi bi-percent" /></div><h3>{search || typeFilter || statusFilter ? "No discounts found" : "No discounts yet"}</h3><p>{search || typeFilter || statusFilter ? "Try changing your search or filters." : "Create a discount to see it listed here."}</p>{!(search || typeFilter || statusFilter) && <button type="button" className="coupon-create-btn" onClick={openCreate}><i className="bi bi-plus-lg" />Create discount</button>}</div>}
        {!loading && !loadError && (discounts.length > 0 || currentPage > 1) && <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={Number(pagination.total ?? pagination.total_items) || ((totalPages - 1) * pageSize + discounts.length)} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} />}
      </div>

      <DeleteConfirmationDialog isOpen={Boolean(deleteTarget)} title="Delete discount?" message={deleteTarget ? `Delete “${deleteTarget.code}”?` : ""} busy={deleting} busyLabel="Deleting…" error={deleteError} onCancel={() => { if (deleteLock.current) return; setDeleteTarget(null); setDeleteError(""); }} onConfirm={deleteDiscount} />
    </div>
  );
}
