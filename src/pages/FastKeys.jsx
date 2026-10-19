import { normalizeCatalog } from "../api/products";
import { useParams } from "react-router-dom";
import { api, pendingStoreRead } from "../api/http";

import { useEffect, useMemo, useRef, useState } from "react";
import FilterDropdown from "../components/FilterDropdown";
import Pagination from "../components/Pagination";
import DeleteConfirmationDialog from "../components/DeleteConfirmationDialog";
import ListActions from "../components/ListActions";


const emptyForm = {
  title: "",
  employeeId: "",
  index: "1",
  products: "",
  image: "",
};

function formatTimestamp(value) {
  if (!value || value === "—") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return <span className="fast-key-timestamp"><strong>{date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong><small>{date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}</small></span>;
}
export default function FastKeys() {
  const { storeId } = useParams();
  const [items, setItems] = useState([]);
  const [failedImages, setFailedImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    setItems([]);
    if (!storeId) { setLoading(false); setLoadError("Store ID is required."); return; }
    const path = `/fastkeys/get-by-store-id/${encodeURIComponent(storeId)}`;
    pendingStoreRead(`fastkeys:${storeId}`, () => api.get(path))
      .then(response => {
        if (!active) return;
        const data = response?.data || response;
        if (data?.status === "error" || data?.success === false) throw new Error(data.message || "Unable to load fast keys.");
        if (!Array.isArray(data?.fastkeys)) throw new Error("Fast Keys API did not return a fastkeys array.");
        setItems(data.fastkeys.map(item => ({
          id: item.fastkey_id,
          title: item.fastkey_title || "—",
          image: item.fastkey_image || "",
          products: (Array.isArray(item.products) ? item.products : []).map(product => product.name || String(product.product_id || "")).filter(Boolean),
          productIds: (Array.isArray(item.products) ? item.products : []).map(product => String(product.product_id || product.id || "")).filter(Boolean),
          employeeId: item.email || "—",
          userId: item.user_id || "",
          updatedAt: item.updated_at || item.updatedAt || "",
          date: item.created_at || item.createdAt || "—",
          time: "",
          status: item.status || "—",
          index: Number(item.fastkey_index) || 0,
        })).sort((a, b) => a.index - b.index));
      }).catch(error => { if (active) setLoadError(error.message || "Unable to load fast keys."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId, attempt]);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [productSearch, setProductSearch] = useState("");
  useEffect(() => {
    if (!formOpen || !storeId) return;
    let active = true;
    setProductsLoading(true);
    setProductsError("");
    setCatalogProducts([]);
    pendingStoreRead(`store-products:${storeId}`, () => api.get(`/stores/${encodeURIComponent(storeId)}/catalog`))
      .then(response => { if (active) setCatalogProducts(normalizeCatalog(response).products); })
      .catch(error => { if (active) setProductsError(error.message || "Unable to load store products."); })
      .finally(() => { if (active) setProductsLoading(false); });
    return () => { active = false; };
  }, [formOpen, storeId]);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const deleteLock = useRef(false);

  const [form, setForm] = useState(emptyForm);
  const [imagePreview, setImagePreview] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const createdFastkeyId = useRef(null);
  const saveLock = useRef(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // Filter fast keys
  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesTab =
        tab === "all" || item.status === "Published";

      const searchText = `
        ${item.title}
        ${item.employeeId}
        ${item.products.join(" ")}
      `.toLowerCase();

      const matchesSearch = searchText.includes(
        search.toLowerCase()
      );
      const matchesStatus = !statusFilter || String(item.status || "").toLowerCase() === statusFilter.toLowerCase();

      return matchesTab && matchesSearch && matchesStatus;
    });
  }, [items, search, tab, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const pageItems = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, tab, statusFilter]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const publishedCount = items.filter(
    (item) => item.status === "Published"
  ).length;

  // Open Add / Edit popup
  const openForm = (item = null) => {
    setEditing(item);
    setProductSearch("");
    createdFastkeyId.current = null;
    setSaveError("");
    setFieldErrors({});
    setImageFile(null);

    if (item) {
      setForm({
        title: item.title,
        employeeId: item.employeeId,
        products: (item.productIds || []).join("\n"),
        index: String(item.index || 1),
        image: item.image || "",
      });

      setImagePreview(item.image || "");
    } else {
      setForm({ ...emptyForm });
      setImagePreview("");
    }

    setFormOpen(true);
  };

  // Close Add / Edit popup
  const closeForm = () => {
    if (saving) return;
    setEditing(null);
    setForm({ ...emptyForm });
    setImagePreview("");
    setFormOpen(false);
  };

  // Handle text input changes
  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  };

  // Handle local image upload
  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setSaveError("Choose a JPG, PNG, or WebP image up to 5 MB.");
      return;
    }

    setSaveError("");
    setImageFile(file);
    const imageUrl = URL.createObjectURL(file);

    setImagePreview(imageUrl);

    setForm((current) => ({
      ...current,
      image: imageUrl,
    }));
  };

  // Remove uploaded image
  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");

    setForm((current) => ({
      ...current,
      image: "",
    }));
  };

  // Save Add / Edit
  const save = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!form.title.trim()) errors.title = "Fast Key Name is required.";
    if (!Number.isInteger(Number(form.index)) || Number(form.index) < 1) errors.index = "Position must be a whole number greater than 0.";
    setFieldErrors(errors);
    if (Object.keys(errors).length || saveLock.current) return;
    saveLock.current = true;
    setSuccessMessage("");
    setSaving(true);
    setSaveError("");
    try {
      const body = new FormData();
      body.append("fastkey_title", form.title.trim());
      body.append("fastkey_index", String(form.index || "1"));
      if (imageFile) body.append("fastkey_image", imageFile);
      if (editing) body.append("fastkey_id", editing.id);
      const response = editing ? await api.post("/fastkeys/update-fastkey", body) : createdFastkeyId.current ? { fastkey_id: createdFastkeyId.current } : await api.post("/fastkeys/create", body);
      if (response?.status === "error" || response?.success === false) throw new Error(response.message || "Unable to create Fast Key.");
      const fastkeyId = response?.fastkey_id || response?.data?.fastkey_id || editing?.id;
      if (!fastkeyId) throw new Error("Fast Key was created but its ID was not returned. Refresh the list before retrying.");
      createdFastkeyId.current = fastkeyId;
      const ids = [...new Set(form.products.split(/[\n,]+/).map(value => value.trim()).filter(Boolean))];
      if (ids.length) {
        const result = await api.post(editing ? "/fastkeys/update-fastkey-products" : "/fastkeys/add-products", { fastkey_id: fastkeyId, products: ids.map((id, index) => ({ product_id: id, sl_number: index + 1 })) });
        if (result?.status === "error" || result?.success === false || result?.failed_products?.length) throw new Error(result.message || "Fast Key created, but some products could not be assigned. Retry to update the same Fast Key.");
      }
      if (editing && !ids.length) {
        for (const productId of editing.productIds || []) {
          const result = await api.post("/fastkeys/delete-product", { fastkey_id: fastkeyId, product_id: productId });
          if (result?.status === "error" || result?.success === false) throw new Error(result.message || "Unable to remove product.");
        }
      }
      createdFastkeyId.current = null;
      setSuccessMessage(editing ? "Fast Key updated successfully." : "Fast Key created successfully.");
      setFormOpen(false);
      setForm({ ...emptyForm });
      setImageFile(null);
      setImagePreview("");
      setAttempt(value => value + 1);
    } catch (error) {
      setSaveError(error.message || "Unable to create Fast Key.");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  // Open delete confirmation
  const remove = (item) => {
    setDeleteError("");
    setDeleteTarget(item);
  };

  // Cancel delete
  const cancelDelete = () => {
    if (deleteLock.current) return;
    setDeleteTarget(null);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!deleteTarget || deleteLock.current) return;
    deleteLock.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await api.get(`/fastkeys/delete-fastkey/${encodeURIComponent(deleteTarget.id)}`);
      if (response?.status === "error" || response?.success === false) throw new Error(response.message || "Unable to delete Fast Key.");
      setDeleteTarget(null);
      setSuccessMessage("Fast Key deleted successfully.");
      setAttempt(value => value + 1);
    } catch (error) {
      setDeleteError(error.message || "Unable to delete Fast Key.");
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  };

  // Check whether image is a real image URL
  const isImageUrl = (value) => {
    return (
      typeof value === "string" &&
      (
        value.startsWith("blob:") ||
        value.startsWith("data:image/") ||
        value.startsWith("http://") ||
        value.startsWith("https://")
      )
    );
  };

  return (
    <div className="fast-keys-panel" aria-busy={loading}>
      {successMessage && <p role="status" className="store-message info">{successMessage}</p>}
      {loading && <p role="status">Loading fast keys…</p>}
      {loadError && <p role="alert">{loadError} <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button></p>}

      {/* ================= HEADER ================= */}

      <div className="fast-keys-heading">
        <div>
          <h2>Fast Keys</h2>

          <p>
            Manage fast keys for this store.
            Fast keys allow quick access to products in POS.
          </p>
        </div>
      <button type="button" className="store-config-btn" onClick={() => openForm()}><i className="bi bi-plus-lg" aria-hidden="true" /> Add New Fast Key</button>
      </div>

      {/* ================= TOOLBAR ================= */}

      <div className="fast-key-toolbar">
        <input
          type="text"
          placeholder="Search fast keys..."
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />

        <FilterDropdown
          aria-label="Filter fast keys by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">All Statuses</option>
          {[...new Set(items.map((item) => String(item.status || "")).filter((status) => status && status !== "—"))].map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </FilterDropdown>

        <button
          type="button"
          className="store-edit-btn"
          onClick={() => { setSearch(""); setStatusFilter(""); }}
        >
          <i className="bi bi-arrow-counterclockwise" />
          Reset
        </button>
      </div>

      {/* ================= TABLE ================= */}

      <div className="fast-key-table-wrap">
        <table className="fast-key-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Title</th>
              <th>Products</th>
              <th>Created By</th>
              <th>Created At</th>
              <th>Updated At</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {pageItems.length ? pageItems.map((item) => (
              <tr key={item.id}>

                {/* Image */}
                <td>
                  <div className="fast-key-image">
                    {isImageUrl(item.image) && !failedImages[item.id] && !/no-image/i.test(item.image) ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        onError={() => setFailedImages(current => ({ ...current, [item.id]: true }))}
                      />
                    ) : (
                      <span className="fast-key-no-image"><i className="bi bi-image" /><small>No image</small></span>
                    )}
                  </div>
                </td>

                {/* Title */}
                <td>
                  <strong>{item.title}</strong>
                </td>



                <td><div className="fast-key-products"><small>{item.products.length} products</small>{item.products.slice(0,3).map((name,index) => <span key={index}>{name}</span>)}{item.products.length > 3 && <b>+{item.products.length - 3} more</b>}</div></td>
                <td><span className="fast-key-employee" title={item.employeeId}>{item.employeeId}</span></td>
                <td>{formatTimestamp(item.date)}</td><td>{formatTimestamp(item.updatedAt)}</td>
                <td><ListActions onEdit={() => openForm(item)} onDelete={() => remove(item)} editLabel={`Edit ${item.title}`} deleteLabel={`Delete ${item.title}`} deleteIconClassName="bi bi-trash" /></td>
              </tr>
            )) : (
              <tr>
                <td className="fast-key-table-empty-cell" colSpan="7">
                  {loading
                    ? "Loading fast keys..."
                    : loadError
                      ? "Fast keys could not be loaded."
                      : "No fast keys found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!loading && !loadError && <div className="fast-key-footer"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} pageSize={itemsPerPage} onPageSizeChange={(pageSize) => { setItemsPerPage(pageSize); setCurrentPage(1); }} totalItems={filtered.length} itemLabel="fast keys" showWhenEmpty /></div>}
      <DeleteConfirmationDialog isOpen={Boolean(deleteTarget)} title="Delete Fast Key?" message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.title}"?` : ""} confirmLabel="Delete" busyLabel="Deleting…" cancelLabel="Cancel" busy={deleting} error={deleteError} onCancel={cancelDelete} onConfirm={confirmDelete} iconClassName="bi bi-trash3" />
      {formOpen && <div className="fast-key-modal-backdrop"><form className="fast-key-modal" onSubmit={save}>
        <div className="fast-key-modal-header"><h2>{editing ? "Edit Fast Key" : "Add New Fast Key"}</h2><button type="button" className="fast-key-close" disabled={saving} onClick={closeForm} aria-label="Close"><i className="bi bi-x-lg" aria-hidden="true" /></button></div>
        <div className="fast-key-modal-body"><div className="fast-key-form-grid">
          <label className={`fast-key-field${fieldErrors.title ? " has-error" : ""}`}><span>Fast Key Name *</span><input name="title" value={form.title} onChange={handleChange} required aria-invalid={Boolean(fieldErrors.title)} disabled={saving} />{fieldErrors.title && <small className="fast-key-field-error" role="alert">{fieldErrors.title}</small>}</label>
          <label className={`fast-key-field${fieldErrors.index ? " has-error" : ""}`}><span>Position *</span><input type="number" name="index" min="1" step="1" value={form.index || "1"} onChange={handleChange} required aria-invalid={Boolean(fieldErrors.index)} disabled={saving} />{fieldErrors.index && <small className="fast-key-field-error" role="alert">{fieldErrors.index}</small>}</label>
          <div className="fast-key-field fast-key-product-picker">
            <span>Products</span>
            <input type="search" placeholder="Search store products…" value={productSearch} onChange={event => setProductSearch(event.target.value)} disabled={saving || productsLoading} />
            {productsLoading && <p role="status">Loading products…</p>}
            {productsError && <p role="alert">{productsError}</p>}
            <div className="fast-key-product-options">
              {catalogProducts.filter(product => String(product.name || "").toLowerCase().includes(productSearch.toLowerCase())).map(product => {
                const id = String(product.id || product.product_id || product.productId || "");
                if (!id) return null;
                const selected = form.products.split(/\n/).filter(Boolean);
                return <label key={id} className="fast-key-product-option"><input type="checkbox" style={{width:16,height:16}} disabled={saving} checked={selected.includes(id)} onChange={event => setForm(current => { const ids = current.products.split(/\n/).filter(Boolean); return {...current, products:(event.target.checked ? [...new Set([...ids,id])] : ids.filter(value => value !== id)).join("\n")}; })} /><span>{product.name || id}</span></label>;
              })}
              {!productsLoading && !productsError && !catalogProducts.length && <p>No products found for this store.</p>}
            </div>
          </div>
          <label className="fast-key-field"><span>Image (JPG, PNG, WebP; max 5 MB)</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} disabled={saving} /></label>
          {imagePreview && <div className="fast-key-image-preview"><img src={imagePreview} alt="Fast key preview" />{!editing && <button type="button" disabled={saving} onClick={removeImage}>Remove</button>}</div>}
        </div>{saveError && <p role="alert" style={{color:"#b42318"}}>{saveError}</p>}</div>
        <div className="fast-key-modal-footer"><button type="button" className="store-edit-btn" disabled={saving} onClick={closeForm}>Cancel</button><button type="submit" className="store-config-btn" disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Save Fast Key"}</button></div>
      </form></div>}
    </div>
  );
}
