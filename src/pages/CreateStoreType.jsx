import FilterDropdown from "../components/FilterDropdown";
import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import Pagination from "../components/Pagination";

import { storeTypesApi } from "../api/storeTypes";

function getStoreTypesForScreen() {
  return storeTypesApi.getAll();
}

function toRow(item) {

  const created = item.createdAt ? new Date(item.createdAt) : null;

  const updated = item.updatedAt ? new Date(item.updatedAt) : null;

  // Safely normalize status regardless of casing, booleans, or whitespace

  const rawStatus = String(item.status ?? "").trim().toUpperCase();

  const isInactive =

    rawStatus === "INACTIVE" ||

    item.status === false ||

    item.isActive === false ||

    item.is_active === false ||

    rawStatus === "FALSE" ||

    rawStatus === "0";

  return {

    id: item.id,

    code: item.storeTypeCode ?? item.code ?? "",

    name: item.name ?? "",

    description: item.description?.trim() || "-",

    status: isInactive ? "Inactive" : "Active",

    createdAt: item.createdAt,

    updatedAt: item.updatedAt,

    createdDate: created

      ? created.toLocaleDateString("en-US", {

        month: "short",

        day: "2-digit",

        year: "numeric",

      })

      : "—",

    createdTime: created

      ? created.toLocaleTimeString("en-US", {

        hour: "2-digit",

        minute: "2-digit",

        hour12: true,

      })

      : "",

    updatedDate: updated

      ? updated.toLocaleDateString("en-US", {

        month: "short",

        day: "2-digit",

        year: "numeric",

      })

      : "—",

    updatedTime: updated

      ? updated.toLocaleTimeString("en-US", {

        hour: "2-digit",

        minute: "2-digit",

        hour12: true,

      })

      : "",

  };

}

const emptyForm = {
  code: "",
  name: "",
  description: "",
  category: "",
  status: "Select Status",
};

export default function CreateStoreType() {

  const navigate = useNavigate();

  const [storeTypes, setStoreTypes] = useState([]);

  const [form, setForm] = useState(emptyForm);

  const [nextStoreTypeCode, setNextStoreTypeCode] = useState("");

  const [originalForm, setOriginalForm] = useState(emptyForm);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("");

  const [sortBy, setSortBy] = useState("newest");

  const [editingId, setEditingId] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [errors, setErrors] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  async function loadStoreTypes() {

    const response = await storeTypesApi.getAll();

    const data = response?.data ?? response;

    const list = Array.isArray(data?.storeTypes)

      ? data.storeTypes

      : Array.isArray(data)

        ? data

        : [];

    const sorted = [...list].sort(

      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),

    );

    setStoreTypes(sorted.map(toRow));

    if (response?.nextStoreTypeCode) {

      setNextStoreTypeCode(response.nextStoreTypeCode);

    }

    if (response?.nextStoreTypeCode && editingId === null) {

      setForm((current) => ({ ...current, code: response.nextStoreTypeCode }));

      setOriginalForm((current) => ({

        ...current,

        code: response.nextStoreTypeCode,

      }));

    }

  }

  useEffect(() => {

    let cancelled = false;

    setLoading(true);

    getStoreTypesForScreen()

      .then((response) => {

        if (cancelled) return;

        const data = response?.data ?? response;

        const list = Array.isArray(data?.storeTypes)

          ? data.storeTypes

          : Array.isArray(data)

            ? data

            : [];

        const sorted = [...list].sort(

          (a, b) => new Date(b.createdAt) - new Date(a.createdAt),

        );

        setStoreTypes(sorted.map(toRow));

        if (response?.nextStoreTypeCode) {

          setNextStoreTypeCode(response.nextStoreTypeCode);

          setForm((current) => ({

            ...current,

            code: response.nextStoreTypeCode,

          }));

          setOriginalForm((current) => ({

            ...current,

            code: response.nextStoreTypeCode,

          }));

        }

      })

      .catch((err) => {

        if (!cancelled) setError(err.message);

      })

      .finally(() => {

        if (!cancelled) setLoading(false);

      });

    return () => {

      cancelled = true;

    };

  }, []);

  const filteredStoreTypes = useMemo(() => {

    const searchValue = search.trim().toLowerCase();

    const filtered = storeTypes.filter((item) => {

      const matchesSearch = `${item.code} ${item.name} ${item.description}`

        .toLowerCase()

        .includes(searchValue);

      const matchesStatus =

        !statusFilter ||

        item.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;

    });

    return filtered.sort((a, b) => {

      switch (sortBy) {

        case "oldest":

          return new Date(a.createdAt) - new Date(b.createdAt);

        case "updated":

          return (

            new Date(b.updatedAt || b.createdAt) -

            new Date(a.updatedAt || a.createdAt)

          );

        case "name-asc":

          return a.name.localeCompare(b.name);

        case "name-desc":

          return b.name.localeCompare(a.name);

        case "newest":

        default:

          return new Date(b.createdAt) - new Date(a.createdAt);

      }

    });

  }, [storeTypes, search, statusFilter, sortBy]);

  const totalPages = Math.ceil(
    filteredStoreTypes.length / pageSize
);

const paginatedStoreTypes = filteredStoreTypes.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
);

  useEffect(() => {

    setCurrentPage(1);

  }, [search, statusFilter]);

 useEffect(() => {
    const lastValidPage = Math.max(1, totalPages);

    if (currentPage > lastValidPage) {
        setCurrentPage(lastValidPage);
    }
}, [totalPages, currentPage]);

  const hasChanges =
    form.name.trim() !== (originalForm.name || "").trim() ||

    form.description.trim() !== (originalForm.description || "").trim() ||

    form.status !== originalForm.status;

  const canSubmitStoreType =
  !!form.name.trim() &&
  (form.status === "Active" || form.status === "Inactive");

  function updateField(event) {

    const { name, value } = event.target;

    setForm((current) => ({

      ...current,

      [name]: value,

    }));

    setErrors((current) => ({

      ...current,

      [name]: "",

    }));

  }

  function resetForm() {

    setForm({ ...emptyForm, code: nextStoreTypeCode });

    setOriginalForm({ ...emptyForm, code: nextStoreTypeCode });

    setEditingId(null);

    setErrors({});

  }

  function resetFilters() {

    setSearch("");

    setStatusFilter("");

    setSortBy("newest");

  }

  

  function validateForm() {

    const nextErrors = {};

    const name = form.name.trim();

    if (!name) {

      nextErrors.name = "Display name is required.";

    } else if (

      storeTypes.some(

        (item) =>

          item.name.toLowerCase() === name.toLowerCase() &&

          item.id !== editingId,

      )

    ) {

      nextErrors.name = "This display name already exists.";

    }

    if (
  form.status !== "Active" &&
  form.status !== "Inactive"
) {
  nextErrors.status = "Please select a status.";
}

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;

  }

  async function submitForm(event) {

    event.preventDefault();

    if (!validateForm()) {

      return;

    }

    const values = {
      name: form.name.trim(),

      description: form.description.trim(),

      status: form.status.toLowerCase() === "inactive" ? "INACTIVE" : "ACTIVE",

    };

    setSaving(true);

    setError("");

    setMessage("");

    try {

      if (editingId !== null) {

        await storeTypesApi.update(editingId, values);

      } else {

        await storeTypesApi.create(values);

      }

      setMessage(

        editingId !== null

          ? "Store type updated successfully."

          : "Store type created successfully.",

      );

      resetForm();

      try {

        await loadStoreTypes();

      } catch (refreshError) {

        setError(

          `Saved, but the list could not refresh: ${refreshError.message}`,

        );

      }

    } catch (err) {

      setError(err.message);

    } finally {

      setSaving(false);

    }

  }

  function editStoreType(item) {

    setEditingId(item.id);

    setErrors({});

    const nextForm = {

      code: item.code,

      name: item.name,

      description: item.description === "-" ? "" : item.description,

      status: item.status,

    };

    setForm(nextForm);

    setOriginalForm(nextForm);

    window.scrollTo({ top: 0, behavior: "smooth" });

  }

  async function confirmDelete() {

    if (!deleteTarget) return;

    setSaving(true);

    setError("");

    try {

      const rawResponse = await storeTypesApi.delete(deleteTarget.id);

      const data = rawResponse?.data ?? rawResponse;

      if (data?.success === false) {

        throw new Error(data.message || "Failed to deactivate store type.");

      }

      setMessage(data?.message || "Store type deactivated successfully.");

      if (String(editingId) === String(deleteTarget.id)) {

        resetForm();

      }

      setDeleteTarget(null);

      // Re-fetch the updated list from the API

      await loadStoreTypes();

    } catch (err) {

      setError(err.message || "An error occurred while deactivating.");

      setDeleteTarget(null);

    } finally {

      setSaving(false);

    }

  }

  return (
    <section className="store-types-page">
      <div className="store-types-page-heading">
        <div>
          <h1>Store Types</h1>
          <p>Manage store types and their basic information.</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="store-type-error">

          {error}
        </p>

      )}

      <form

        className="store-type-form-card"

        onSubmit={submitForm}

        autoComplete="off"
      >
        <div className="store-type-card-heading">
          <div className="store-type-heading-icon">
            <i className="bi bi-shop" />
          </div>

          <div>
            <h2>{editingId ? "Edit Store Type" : "Add Store Type"}</h2>
            <p>Enter the store type details.</p>
          </div>
        </div>

        <div className="store-type-form-grid">

<div className="store-type-field">
  <label>Store Type Code</label>

  <input
    name="code"
    value=""
    placeholder="Auto Generated"
    readOnly
    disabled
    aria-readonly="true"
  />

</div>




          <div className="store-type-field">
            <label>

              Store Type Name <span className="required">*</span>
            </label>
            <input

              name="name"

              value={form.name}

              onChange={updateField}

              placeholder="Enter display name, e.g. Grocery"

              maxLength={80}

              className={errors.name ? "store-type-input-error" : ""}

            />

            {errors.name ? (
              <small className="field-error">{errors.name}</small>

            ) : (
              <small></small>

            )}
          </div>

          
<div className="store-type-field">
  <label>
    Status <span className="required">*</span>
  </label>

  <div className="select-shell">
    <select
      name="status"
      value={form.status}
      onChange={updateField}
      className={
        form.status === "Active"
          ? "active"
          : form.status === "Inactive"
          ? "inactive"
          : ""
      }
    >
      <option value="Select Status">
        Select Status
      </option>
      <option value="Active">Active</option>
      <option value="Inactive">Inactive</option>
    </select>

    <i className="bi bi-chevron-down" />
  </div>

  {errors.status && (
    <small className="field-error">{errors.status}</small>
  )}
</div>
        </div>

        <div className="store-type-form-grid">
          <div className="store-type-field store-type-description-field">
            <label>Description</label>

            <textarea

              name="description"

              value={form.description}

              onChange={updateField}

              onInput={(e) => {

                e.currentTarget.style.height = "44px";

                e.currentTarget.style.height = `${Math.max(

                  44,

                  e.currentTarget.scrollHeight,

                )}px`;

              }}

              placeholder="Briefly describe this store type"

              maxLength={500}

            />

            <div className="store-type-description-meta">
            </div>
          </div>
        </div>

        <div className="store-type-actions">
          <button

            type="button"

            className="store-type-cancel-button"

            onClick={resetForm}

            disabled={saving}
          >

            Cancel
          </button>

          <button

            type="submit"

            className="store-type-submit-button"

            disabled={

              saving ||

              !canSubmitStoreType ||

              (editingId !== null && !hasChanges)

            }
          >

            {saving

              ? "Saving..."

              : editingId

                ? "Update Store Type"

                : "Create Store Type"}
          </button>
        </div>
      </form>

      <section className="store-types-list-card">
        <div className="store-types-list-header">
          <h2>Store Types</h2>

          <div className="store-types-filters pch-master-toolbar pch-master-control">
            <label className="store-type-search pch-master-search pch-master-control">
              <i className="bi bi-search" />
              <input

                value={search}

                onChange={(event) => setSearch(event.target.value)}

                placeholder="Search store types..."

                autoComplete="off"

              />
            </label>

            <div className="store-filter-select pch-master-filter pch-master-control">
              <FilterDropdown preserveToolbarLayout

                value={statusFilter}

                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </FilterDropdown>
              <i className="bi bi-chevron-down" />
            </div>

            <div className="store-filter-select pch-master-filter pch-master-control">
              <FilterDropdown preserveToolbarLayout

                value={sortBy}

                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="updated">Recently Updated</option>
                <option value="name-asc">Name (A–Z)</option>
                <option value="name-desc">Name (Z–A)</option>
              </FilterDropdown>
              <i className="bi bi-chevron-down" />
            </div>

            <button

              type="button"

              className="store-type-reset-button pch-master-reset pch-master-control"

              onClick={resetFilters}
            >
              <i className="bi bi-arrow-counterclockwise" />
            </button>
          </div>
        </div>

        <div className="store-types-table-wrap">
          <div className="store-types-table">
            <div className="store-types-row store-types-row-head">
              <div>Store Type Code</div>
              <div>Store Type Name</div>
              <div>Description</div>
              <div>Status</div>
              <div>Created At</div>
              <div>Updated At</div>
              <div>Actions</div>
            </div>

            {paginatedStoreTypes.map((item) => (
              <div

                className="store-types-row store-types-row-clickable"

                key={item.id}

                onClick={() =>

                  navigate(`/store-types/${item.id}`, {

                    state: { storeType: item },

                  })

                }
              >
                <div className="store-type-code-cell">
                  <strong>{item.code}</strong>
                </div>

                <button

                  type="button"

                  className="store-type-name-cell store-type-name-clickable"

                  onClick={(e) => {

                    e.stopPropagation();

                    navigate(`/store-types/${item.id}`, {

                      state: { storeType: item },

                    });

                  }}
                >
                  <strong>{item.name}</strong>
                </button>
  
              <div className="store-type-description-cell">
                     <span className="store-type-description-text">
                       {item.description || "—"}
                     </span>
                 </div>

                <div>
                  <span

                    className={`store-type-status ${item.status === "Inactive" ? "inactive" : "active"

                      }`}
                  >
                    <i className="bi bi-circle-fill" />

                    {item.status}
                  </span>
                </div>

                <div

                  className="store-type-date-cell"

                  title={`${item.createdDate}, ${item.createdTime}`}
                >
                  <strong>{item.createdDate}</strong>
                  <span>{item.createdTime}</span>
                </div>

                <div

                  className="store-type-date-cell"

                  title={`${item.updatedDate}, ${item.updatedTime}`}
                >
                  <strong>{item.updatedDate}</strong>
                  <span>{item.updatedTime}</span>
                </div>

                <div className="store-type-table-actions">
                  <button

                    type="button"

                    onClick={(e) => {

                      e.stopPropagation();

                      editStoreType(item);

                    }}
                  >
                    <i className="bi bi-pencil" />
                  </button>

                  <button

                    type="button"

                    className="store-type-delete-icon"

                    onClick={(e) => {

                      e.stopPropagation();

                      setDeleteTarget(item);

                    }}
                  >
                    <i className="bi bi-trash3" />
                  </button>
                </div>
              </div>

            ))}

            {loading && (
              <div className="store-types-row">Loading store types...</div>

            )}

            {!loading && filteredStoreTypes.length === 0 && (
              <div className="store-types-row">No store types found.</div>

            )}
          </div>
        </div>

       <Pagination
    currentPage={currentPage}
    totalPages={totalPages}
    totalItems={filteredStoreTypes.length}
    pageSize={pageSize}
    onPageChange={setCurrentPage}
    onPageSizeChange={(newPageSize) => {
        setPageSize(newPageSize);
        setCurrentPage(1);
    }}
    itemLabel="entries"
/>
      </section>

      {deleteTarget && (
        <div

          className="delete-storetype-overlay"

          onClick={() => setDeleteTarget(null)}
        >
          <div

            className="delete-storetype-modal"

            onClick={(event) => event.stopPropagation()}
          >
            <div className="delete-storetype-icon">
              <i className="bi bi-exclamation-triangle" />
            </div>

            <h2>Deactivate Store Type?</h2>

            <p>

              Are you sure you want to deactivate{" "}
              <strong>{deleteTarget.name}</strong>?
            </p>

            {deleteTarget.assignedStores > 0 && (
              <div className="delete-impact-warning">
                <i className="bi bi-exclamation-circle-fill" />

                This store type is assigned to{" "}
                <strong>{deleteTarget.assignedStores}</strong>{" "}

                {deleteTarget.assignedStores === 1 ? "store" : "stores"}.

                Deactivating it may affect their configuration.
              </div>

            )}

            <p className="delete-final-warning">

              The record will remain visible and can be activated again later.
            </p>

            <div className="delete-storetype-actions">
              <button

                type="button"

                className="delete-keep-button"

                onClick={() => setDeleteTarget(null)}
              >

                No, Keep It
              </button>

              <button

                type="button"

                className="delete-confirm-button"

                onClick={confirmDelete}

                disabled={saving}
              >

                Yes, Deactivate
              </button>
            </div>
          </div>
        </div>

      )}

      {message && (
        <div className="store-type-toast">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")}>

            ×
          </button>
        </div>

      )}
    </section>

  );
}
