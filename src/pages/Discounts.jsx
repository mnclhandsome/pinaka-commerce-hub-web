import { useMemo, useState } from "react";
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

const discountsSeed = [
  { id: "auto-1", type: "auto", code: "Weekend Saver", discount_type: "percent", amount: "10", product: "Pake Taxo", auto_apply: true, usage_limit: "100", date_starts: "2026-01-01", date_expires: "2026-12-31" },
  { id: "mix-1", type: "mix_match", code: "Movie Night", discount_type: "percent", amount: "20", product: "Popcorn", discounted_products: "Soda, Chocolate", usage_limit: "120", date_starts: "2026-11-01", date_expires: "2026-11-15" },
  { id: "pack-1", type: "multipack", code: "Family Rice Pack", discount_type: "price", amount: "5", product: "Basmati Rice", qty: "6", usage_limit: "40", date_starts: "2026-08-01", date_expires: "2026-10-01" },
];

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
const formatSystemDate = (value) => {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
};

export default function Discounts({ embedded = false }) {
  const [discounts, setDiscounts] = useState(discountsSeed);
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
  const totalPages = Math.ceil(filtered.length / pageSize);
  const visibleDiscounts = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
    setForm({ ...emptyForm(discount.type), ...discount });
    setFormTab("details");
    setFormError("");
    setMode("edit");
  };

  const closeEditor = () => {
    setMode("");
    setFormError("");
  };

  const saveDiscount = (event) => {
    event.preventDefault();
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

    const saved = {
      ...form,
      id: form.id || `${form.type}-${Date.now()}`,
      amount: String(amount),
      code: form.code.trim(),
      product: form.product.trim(),
      discounted_products: form.discounted_products.trim(),
      created_at: form.created_at || new Date().toISOString(),
    };
    setDiscounts((current) => mode === "edit"
      ? current.map((item) => item.id === saved.id ? saved : item)
      : [saved, ...current]);
    setNotice(`${typeLabel(saved.type)} ${mode === "edit" ? "updated" : "created"}. This change is saved in this screen only until the discount API is connected.`);
    setMode("");
    setCurrentPage(1);
  };

  const deleteDiscount = () => {
    if (!deleteTarget) return;
    setDiscounts((current) => current.filter((item) => item.id !== deleteTarget.id));
    setNotice(`${deleteTarget.code} was deleted from this screen.`);
    setDeleteTarget(null);
    setDeleteError("");
  };

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  if (mode) {
    return (
      <div className={`coupons-page discounts-page ${embedded ? "discounts-embedded" : ""}`}>
        <div className="coupons-header coupon-editor-heading">
          <div className="discount-editor-title">
            <h1>{mode === "edit" ? "Edit discount" : "Create discount"}</h1>
            <p>{typeLabel(form.type)} settings</p>
          </div>
          <button type="button" className="coupon-form-cancel coupon-editor-back store-config-back-button" onClick={closeEditor}><i className="bi bi-arrow-left" /> Back to Discounts</button>
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
                  <label className="coupon-form-field"><span className="discount-field-label">{form.type === "mix_match" ? "Main product (trigger)" : "Product"} <span className="discount-required" title="Required" aria-label="Required">*</span></span>
                    <input value={form.product} onChange={(event) => updateForm("product", event.target.value)} placeholder="Enter product name" required />
                    <small>Product catalog selection will be connected with the API.</small>
                  </label>
                  {form.type === "mix_match" && <label className="coupon-form-field discount-full-width"><span className="discount-field-label">Discounted products <span className="discount-required" title="Required" aria-label="Required">*</span></span>
                    <textarea rows="3" value={form.discounted_products} onChange={(event) => updateForm("discounted_products", event.target.value)} placeholder="Enter product names separated by commas" required />
                    <small>These products receive the discount when the trigger product is present.</small>
                  </label>}
                  {form.type === "multipack" && <label className="coupon-form-field"><span className="discount-field-label">Pack quantity <span className="discount-required" title="Required" aria-label="Required">*</span></span>
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
              <button type="submit" className="coupon-form-save" disabled={mode === "create" && !form.type}><i className="bi bi-check2" />{mode === "edit" ? "Save changes" : "Create discount"}</button>
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
        <div className="coupons-table-wrapper">
          <table className="coupons-table discounts-table">
            <thead><tr><th>Name</th><th>Discount type</th><th>Amount</th><th>Product / rules</th><th>Usage / limit</th><th>Start date</th><th>Expiry date</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{visibleDiscounts.length ? visibleDiscounts.map((discount) => <tr key={discount.id}>
              <td><div className="discount-name-cell"><strong>{discount.code}</strong><small>{typeLabel(discount.type)}</small></div></td>
              <td><span className="discount-type-pill">{typeOptions[discount.type].find(([value]) => value === discount.discount_type)?.[1] || discount.discount_type}</span></td>
              <td><strong className="discount-amount">{amountLabel(discount)}</strong></td>
              <td><span className="discount-product-cell">{discount.type === "mix_match" ? `${discount.product} → ${discount.discounted_products}` : `${discount.product}${discount.type === "multipack" ? ` · ${discount.qty} items` : ""}`}</span></td>
              <td>{discount.usage_limit || "∞"}</td>
              <td>{formatSystemDate(discount.date_starts)}</td>
              <td>{formatSystemDate(discount.date_expires)}</td>
              <td><span className={`discount-status ${discountStatus(discount).toLowerCase()}`}>{discountStatus(discount)}</span></td>
              <td className="coupon-row-actions"><button type="button" aria-label={`Edit ${discount.code}`} onClick={() => openEdit(discount)}><i className="bi bi-pencil" /></button><button type="button" aria-label={`Delete ${discount.code}`} onClick={() => { setDeleteError(""); setDeleteTarget(discount); }}><i className="bi bi-trash3" /></button></td>
            </tr>) : <tr><td className="discount-table-empty" colSpan="9"><div className="products-table-empty-state"><div className="products-empty-icon"><i className="bi bi-percent" /></div><strong>{search || typeFilter || statusFilter ? "No discounts found" : "No discounts yet"}</strong><span>{search || typeFilter || statusFilter ? "Try changing your search or filters." : "Create a discount to see it listed here."}</span>{search || typeFilter || statusFilter ? <button type="button" onClick={() => { setSearch(""); setTypeFilter(""); setStatusFilter(""); setCurrentPage(1); }}>Clear Filters</button> : <button type="button" onClick={openCreate}><i className="bi bi-plus-lg" /> Create discount</button>}</div></td></tr>}</tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} showWhenEmpty />
      </div>

      <DeleteConfirmationDialog isOpen={Boolean(deleteTarget)} title="Delete discount?" message={deleteTarget ? `Delete “${deleteTarget.code}” from this screen?` : ""} error={deleteError} onCancel={() => { setDeleteTarget(null); setDeleteError(""); }} onConfirm={deleteDiscount} />
    </div>
  );
}
