import FilterDropdown from "../components/FilterDropdown";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Pagination from "../components/Pagination";
import "../styles/features.css";
import { listFeatures, createFeature as createFeatureApi, updateFeature as updateFeatureApi, deleteFeature as deleteFeatureApi } from "../api/features";

const initialFeatures = [];

const emptyForm = {
  code: "",
  name: "",
  description: "",
  category: "",
  status: "Select Status",
};

const defaultCategories = [
  "Inventory",
  "Payments",
  "Operations",
  "Cash Management",
  "Refund",
  "Promotions",
  "Peripheral",
  "Billing",
  "Store Management",
  "Reports",
  "Administration",
  "Integration",
  "KOT Management",
  "Kitchen Management",
  "Financial",
  "Marketing",
  "Hardware",
];

function FeatureDescriptionCell({ description = "" }) {
  return (
    <td className="feature-description">
      <div className="feature-description-content">
        <span className="feature-description-clamp">
          {description || "—"}
        </span>
      </div>
    </td>
  );
}

export default function Features() {
  const navigate = useNavigate();
  const [features, setFeatures] = useState(initialFeatures);
  const [apiError, setApiError] = useState("");
  useEffect(() => { listFeatures().then(setFeatures).catch((e) => setApiError(e.message || "Unable to load features.")); }, []);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [sortBy, setSortBy] = useState("newest");
  const [formErrors, setFormErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const isEditing = editingId !== null;
  const editingFeature = features.find((item) => item.id === editingId);

  const categoryOptions = useMemo(() => {
    const set = new Set(defaultCategories);
    features.forEach((f) => {
      if (f.category && f.category.trim()) {
        set.add(f.category.trim());
      }
    });
    if (form.category && form.category.trim()) {
      set.add(form.category.trim());
    }
    return Array.from(set);
  }, [features, form.category]);

  const requiredFieldsComplete =
    form.name.trim() !== "" &&
    form.category.trim() !== "";

  const hasEditChanges =
    !isEditing ||
    !editingFeature ||
    form.name.trim() !== String(editingFeature.name || "").trim() ||
    form.description.trim() !== String(editingFeature.description || "").trim() ||
    form.category !== String(editingFeature.category || "") ||
    form.status !== String(editingFeature.status || "Active");

  const canSubmitFeature =
    requiredFieldsComplete &&
    (!isEditing || hasEditChanges);

  const updateField = (event) => {
    const field = event.target.dataset.field || event.target.name;
    const { value } = event.target;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateFeature = () => {
    const errors = {};
    const name = form.name.trim();

    if (!name) errors.name = "Feature Name is required.";
    if (!form.category) errors.category = "Category is required.";

    if (name && features.some(
      (item) =>
        String(item.id) !== String(editingId) &&
        item.name.trim().toLowerCase() === name.toLowerCase()
    )) {
      errors.name = "Feature Name already exists. Enter a unique name.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const clearForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormErrors({});
  };

    const editFeature = (feature) => {
    setEditingId(feature.id);
    setForm({
      code: feature.feature_code || "",
      name: feature.name || "",
      description: feature.description || "",
      category: feature.feature_type || feature.category || "",
      status: feature.status || "Active",
    });
    setFormErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveFeature = async () => {
    if (!validateFeature()) return;
    try {
      const payload = {
        ...form,
        category: form.category,
      };
      const created = await createFeatureApi(payload);
      if (created && created.id) {
        setFeatures((prev) => [created, ...prev.filter((f) => f.id !== created.id)]);
      }
      const latestFeatures = await listFeatures();
      if (Array.isArray(latestFeatures)) {
        setFeatures(latestFeatures);
      }
      setCurrentPage(1);
      clearForm();
      setApiError("");
    } catch (e) {
      setApiError(e.message || "Unable to create feature.");
    }
  };

  const updateFeature = async () => {
    if (!validateFeature()) return;
    try {
      const payload = {
        ...form,
        category: form.category,
      };
      const updated = await updateFeatureApi(editingId, payload);
      setFeatures((prev) =>
        prev.map((item) =>
          String(item.id) === String(editingId)
            ? {
                ...item,
                ...payload,
                ...(updated || {}),
                category: form.category,
                feature_type: form.category,
              }
            : item
        )
      );
      const latestFeatures = await listFeatures();
      if (Array.isArray(latestFeatures)) {
        setFeatures(latestFeatures);
      }
      setCurrentPage(1);
      clearForm();
      setApiError("");
    } catch (e) {
      setApiError(e.message || "Unable to update feature.");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("All Statuses");
    setSortBy("newest");
  };

  const deleteFeature = async (featureId) => {
    try {
      await deleteFeatureApi(featureId);
      setFeatures((prev) => prev.filter((item) => String(item.id) !== String(featureId)));
      const latestFeatures = await listFeatures();
      if (Array.isArray(latestFeatures)) {
        setFeatures(latestFeatures);
      }
      setApiError("");
    } catch (e) {
      setApiError(e.message || "Unable to delete feature.");
      throw e;
    }
  };

  const confirmDeleteFeature = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFeature(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // Keep modal open on error
    }
  };

  const filteredFeatures = useMemo(() => {
    const q = search.trim().toLowerCase();

    const getCreatedTime = (item) => {
      const value = item.created_at;
      const time = value ? new Date(value).getTime() : 0;
      return Number.isNaN(time) ? 0 : time;
    };

    const getUpdatedTime = (item) => {
      const value = item.updated_at;
      const time = value ? new Date(value).getTime() : 0;
      return Number.isNaN(time) ? 0 : time;
    };

    const result = features.filter((item) => {
      const matchesSearch =
        String(item.name || "").toLowerCase().includes(q) ||
        String(item.code || "").toLowerCase().includes(q) ||
        String(item.category || "").toLowerCase().includes(q) ||
        String(item.description || "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "All Statuses" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    return result.sort((a, b) => {
      if (sortBy === "oldest") return getCreatedTime(a) - getCreatedTime(b);
      if (sortBy === "updated") return getUpdatedTime(b) - getUpdatedTime(a);
      if (sortBy === "name-asc") return String(a.name || "").localeCompare(String(b.name || ""));
      if (sortBy === "name-desc") return String(b.name || "").localeCompare(String(a.name || ""));
      return getCreatedTime(b) - getCreatedTime(a);
    });
  }, [features, search, statusFilter, sortBy]);

  const totalEntries = filteredFeatures.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / itemsPerPage));

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, sortBy]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const startIndex = totalEntries === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalEntries);
  const paginatedFeatures = filteredFeatures.slice(startIndex, endIndex);


  const formatFeatureDate = (value) => {
    if (!value) return { date: "—", time: "" };

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return { date: String(value), time: "" };
    }

    return {
      date: parsedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      time: parsedDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    };
  };

  return (
    <div className="features-page">
      <header className="features-page-heading">
        <h1>Features</h1>
        <p>Manage features available in PCH.</p>
      </header>

      {apiError && <p role="alert">{apiError}</p>}

      <section className="feature-details-card">
        <div className="feature-section-heading">
          <div className="feature-title-icon">
            <i className="bi bi-grid-1x2" />
          </div>
          <div>
            <h2>{isEditing ? "Edit Feature" : "Add Feature"}</h2>
            <p>Enter the feature details.</p>
          </div>
        </div>

        <div className="feature-form-grid">
          <div className="feature-field ">
            <label>Feature Code<span>*</span></label>
            <input
              data-field="code"
              value={form.code}
              readOnly
              disabled
              autoComplete="off"
              placeholder="Auto Generated"
              className={formErrors.code ? "feature-input-error" : "feature-placeholder"}
            />
            
            {formErrors.code ? (
              <small className="feature-error-text">{formErrors.code}</small>
            ) : (
              <small></small>
            )}
          </div>

          <div className="feature-field">
            <label>Feature Name<span>*</span></label>
            <input
              data-field="name"
              value={form.name}
              onChange={updateField}
              autoComplete="off"
              placeholder="Enter a unique feature name, e.g. Inventory Management"
              className={formErrors.name ? "feature-input-error" : ""}
            />
            {formErrors.name ? (
              <small className="feature-error-text">{formErrors.name}</small>
            ) : (
              <small> </small>
            )}
          </div>

          <div className="feature-field feature-description-field">
            <label>Description</label>
            <textarea
              data-field="description"
              value={form.description}
              onChange={updateField}
              onInput={(event) => {
                event.currentTarget.style.height = "44px";
                event.currentTarget.style.height = `${Math.max(44, event.currentTarget.scrollHeight)}px`;
              }}
              autoComplete="off"
              placeholder="Describe the feature and its purpose."
              maxLength={500}
            />
            <div className="feature-description-meta">
            </div>
          </div>

          <div className="feature-field">
            <label>Feature Category<span>*</span></label>
            <div className="select-shell">
              <select
                name="category"
                data-field="category"
                value={form.category}
                onChange={updateField}
                autoComplete="off"
                className={formErrors.category ? "feature-input-error" : ""}
              >
                <option value="">Select category</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            {formErrors.category ? (
              <small className="feature-error-text">{formErrors.category}</small>
            ) : (
              <small></small>
            )}
          </div>

          <div className="feature-field feature-form-status-field">
  <label>Status</label>

  <div className="select-shell">
    <select
      name="status"
      value={form.status}
      onChange={updateField}
      autoComplete="off"
      className={`feature-form-status-select ${
        form.status === "Active"
          ? "active"
          : form.status === "Inactive"
          ? "inactive"
          : ""
      }`}
    >
      <option value="Select Status">Select Status</option>
      <option value="Active">Active</option>
      <option value="Inactive">Inactive</option>
    </select>
  </div>

  <small></small>
</div>
        </div>

        <div className="feature-form-footer">
<div className="feature-footer-actions">
            <button className="feature-action secondary" type="button" onClick={clearForm}>
              {isEditing ? "Cancel" : "Cancel"}
            </button>
            <button
              className="feature-action primary"
              type="button"
              onClick={isEditing ? updateFeature : saveFeature}
              disabled={!canSubmitFeature}
            >
              {isEditing ? "Update Feature" : "Add Feature"}
            </button>
          </div>
        </div>
      </section>

      <section className="features-list-card">
        <div className="features-list-toolbar">
          <h2>Features</h2>
          <div className="features-filters pch-master-toolbar pch-master-control">
            <div className="feature-search pch-master-search pch-master-control">
              <i className="bi bi-search" />
              <input
                type="text"
                placeholder="Search features..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="feature-filter-control">
              <FilterDropdown preserveToolbarLayout
                className="features-filter-select features-status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All Statuses">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </FilterDropdown>
              <i className="bi bi-chevron-down feature-filter-chevron" />
            </div>

            <div className="feature-filter-control feature-sort-control">
              <FilterDropdown preserveToolbarLayout
                className="features-filter-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort features"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="updated">Recently Updated</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
              </FilterDropdown>
              <i className="bi bi-chevron-down feature-filter-chevron" />
            </div>

            <button className="reset-filter pch-master-reset pch-master-control" type="button" onClick={resetFilters}>
              <i className="bi bi-arrow-counterclockwise" />
            
            </button>
          </div>
        </div>

        <div className="features-table-wrap">
          <table className="features-table">
            <colgroup>
              <col className="col-code" />
              <col className="col-name" />
              <col className="col-category" />
              <col className="col-description" />
              <col className="col-status" />
              <col className="col-created" />
              <col className="col-updated" />
              <col className="col-actions" />
            </colgroup>

            <thead>
              <tr>
                <th>Feature Code</th>
                <th>Feature Name</th>
                <th>Feature Category</th>
                <th>Description</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Updated At</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>

            <tbody>
              {paginatedFeatures.map((item) => (
                <tr
                  key={item.id}
                  className="feature-clickable-row"
                  onClick={() =>
                    navigate(`/features/${item.id}/overview`, {
                      state: { feature: item },
                    })
                  }
                  role="link"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/features/${item.id}/overview`, {
                        state: { feature: item },
                      });
                    }
                  }}
                  aria-label={`Open ${item.name} feature overview`}
                >
                  <td className="feature-code-cell">
                    {item.code || "—"}
                  </td>
                  <td className="feature-name-cell">
                    <span className="feature-name feature-name-button">
                      {item.name}
                    </span>
                  </td>

                  <td>{item.feature_type || item.category || "—"}</td>

                  <FeatureDescriptionCell description={item.description} />
                  
                  
                  <td>
                    <span className={`feature-status ${item.status.toLowerCase()}`}>
                      <b />{item.status}
                    </span>
                  </td>
                  <td className="feature-created">
                    {(() => {
                      const created = formatFeatureDate(item.created_at);
                      return (
                        <div className="feature-date-stack">
                          <strong>{created.date}</strong>
                          {created.time && <span className="feature-time">{created.time}</span>}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="feature-updated">
                    {(() => {
                      const updated = formatFeatureDate(item.updated_at);
                      return (
                        <div className="feature-date-stack">
                          <strong>{updated.date}</strong>
                          {updated.time && <span className="feature-time">{updated.time}</span>}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="actions-col">
                    <div className="feature-row-actions">
                      <button
                        type="button"
                        className="edit-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          editFeature(item);
                        }}
                        aria-label={`Edit ${item.name}`}
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        type="button"
                        className="delete-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(item);
                        }}
                        aria-label={`Delete ${item.name}`}
                        title={`Delete ${item.name}`}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="feature-pagination-row">
  <Pagination
    currentPage={currentPage}
    totalPages={totalPages}
    totalItems={totalEntries}
    pageSize={itemsPerPage}
    onPageChange={setCurrentPage}
    itemLabel="features"
  />
</div>
      </section>

      {deleteTarget && (
        <div
          className="features-delete-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-feature-title"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="features-delete-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="features-delete-icon">
              <i className="bi bi-trash" />
            </div>

            <h2 id="delete-feature-title">Delete Feature?</h2>

            <p>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
            </p>

            <p className="features-delete-final-warning">
              This action cannot be undone.
            </p>

            <div className="features-delete-actions">
              <button
                type="button"
                className="features-delete-keep-button"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="features-delete-confirm-button"
                onClick={confirmDeleteFeature}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
