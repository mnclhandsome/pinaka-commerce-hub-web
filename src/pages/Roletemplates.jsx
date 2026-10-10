import FilterDropdown from "../components/FilterDropdown";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Pagination from "../components/Pagination";
import {
  roleTemplatesApi,
  readRoleTemplatesList,
} from "../api/roleTemplatesApi";

const initialForm = {
  roleCode: "",
  name: "",
  description: "",
  status: "",
};
 
function displayDate(value) {
  if (!value) return null;
 
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return {
    date: date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

// Updated to generate RLC_001 format
function generateRoleTemplateCode(templates) {
  const existingNumbers = templates
    .map((template) => {
      const match = String(template.roleCode || "").match(/(\d+)$/);
      return match ? Number(match[1]) : 0;
    })
    .filter((n) => n > 0);

  const nextNumber =
    existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

  // Changed prefix to RLC_ and padding to 3 digits
  return `RLC_${String(nextNumber).padStart(3, "0")}`;
}

export default function RoleTemplates() {
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(initialForm);
 
  const [editingId, setEditingId] = useState(null);
  const [originalForm, setOriginalForm] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("NEWEST");
 
  // Client-side pagination over the real API-backed list.
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
 
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // `roleCode` is generated automatically; we keep the state only
  // for possible future display of server‑side validation errors.
  const [roleCodeError, setRoleCodeError] = useState("");

  const [deletePopup, setDeletePopup] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  /** --------------------------------------------------------------
   *  Load all role templates from the backend
   * -------------------------------------------------------------- */
  async function loadTemplates() {
    setLoading(true);
    setError("");
 
    try {
      const response = await roleTemplatesApi.getAll();
      const items = readRoleTemplatesList(response);
      const validItems = items.filter((item) => item?.id != null);
      setTemplates(validItems);

      // When we are not editing, generate the next code for the blank form
      if (editingId === null) {
        setForm((cur) => ({
          ...cur,
          roleCode: generateRoleTemplateCode(validItems),
        }));
      }
    } catch (err) {
      setError(err?.message || "Unable to load role templates.");
    } finally {
      setLoading(false);
    }
  }
 
  useEffect(() => {
    loadTemplates();
  }, []);

  /** --------------------------------------------------------------
   *  Filtering / sorting logic (client‑side)
   * -------------------------------------------------------------- */
  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
 
    const filtered = templates.filter((template) => {
      const searchable = [
        template.roleCode,
        template.name,
        template.description,
        template.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);
      const matchesStatus =
        statusFilter === "ALL" ||
        String(template.status).toUpperCase() === statusFilter;
 
      return matchesSearch && matchesStatus;
    });
 
    const getDateValue = (template) => {
      const v =
        template.createdAt || template.created_at || template.createdDate;
      const ts = v ? new Date(v).getTime() : 0;
      return Number.isNaN(ts) ? 0 : ts;
    };
 
    return [...filtered].sort((a, b) => {
      if (sortBy === "NEWEST") return getDateValue(b) - getDateValue(a);
      if (sortBy === "OLDEST") return getDateValue(a) - getDateValue(b);

      const nameA = String(a.name || "").trim();
      const nameB = String(b.name || "").trim();

      if (sortBy === "A_Z")
        return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      if (sortBy === "Z_A")
        return nameB.localeCompare(nameA, undefined, { sensitivity: "base" });

      return 0;
    });
  }, [templates, search, statusFilter, sortBy]);
 
  const totalEntries = filteredTemplates.length;

const totalPages = Math.max(
  1,
  Math.ceil(totalEntries / pageSize)
);

const paginatedTemplates = useMemo(() => {
  const start = (currentPage - 1) * pageSize;
  return filteredTemplates.slice(start, start + pageSize);
}, [filteredTemplates, currentPage, pageSize]);

  /** --------------------------------------------------------------
   *  Keep pagination in sync when filters change
   * -------------------------------------------------------------- */
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, sortBy]);

  /** --------------------------------------------------------------
   *  Adjust page when a delete makes the current page invalid
   * -------------------------------------------------------------- */
  useEffect(() => {
  if (currentPage > totalPages) {
    setCurrentPage(totalPages);
  }
}, [currentPage, totalPages]);

  /** --------------------------------------------------------------
   *  Form handling helpers
   * -------------------------------------------------------------- */
  function handleChange(event) {
    const { name, value } = event.target;
    setForm((cur) => ({ ...cur, [name]: value }));
  }
 
  function resetForm() {
    setForm({
      ...initialForm,
      roleCode: generateRoleTemplateCode(templates), // Keep the role code populated
    });
    setEditingId(null);
    setOriginalForm(null);
    setError("");
  }
  /** --------------------------------------------------------------
   *  Save (create / update) a role template
   * -------------------------------------------------------------- */
  async function saveTemplate() {
    const values = {
      name: form.name.trim(),
      description: form.description.trim(),
      status: form.status,
    };
 
    if (!values.name) {
      setError("Role Template Name is required.");
      return;
    }

    if (!values.status) {
  setError("Please select a status.");
  return;
}

       // 2. NEW: Check for duplicate name
    const isDuplicate = templates.some(
      (t) =>
        String(t.name || "").trim().toLowerCase() === values.name.toLowerCase() &&
        t.id !== editingId
    );
 
    if (isDuplicate) {
      setError("A Role Template with this name already exists.");
      return;
    }
 
    setSaving(true);
    setError("");
 
    try {
      const isCreating = editingId === null;

      if (editingId !== null) {
        // Updating – keep the existing generated roleCode
        await roleTemplatesApi.update(editingId, {
          roleCode: originalForm?.roleCode || "",
          name: values.name,
          description: values.description,
          status: values.status,
        });
      } else {
        // Creating – **do NOT** send roleCode; backend generates it
        await roleTemplatesApi.create(values);
      }

      if (isCreating) setCurrentPage(1);
      
      // ✅ FIX: Reset the form FIRST (clears name/description, sets editingId to null)
      resetForm();
      
      // ✅ FIX: Load templates SECOND (fetches fresh list and generates the correct NEXT roleCode)
      await loadTemplates();

    } catch (err) {
      setError(err?.message || "Unable to save role template.");
    } finally {
      setSaving(false);
    }
  }

  /** --------------------------------------------------------------
   *  Populate form for editing an existing template
   * -------------------------------------------------------------- */
  function editTemplate(template) {
    const nextForm = {
      roleCode: template.roleCode || "",
      name: template.name || "",
      description: template.description || "",
      status: template.status || "ACTIVE",
    };
 
    setEditingId(template.id);
    setForm(nextForm);
    setOriginalForm(nextForm);
    setError("");
    setRoleCodeError("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** --------------------------------------------------------------
   *  Delete (soft‑deactivate) helpers
   * -------------------------------------------------------------- */
  function openDeletePopup(template) {
    setTemplateToDelete(template);
    setDeletePopup(true);
    setDeleteError("");
  }
 
  function closeDeletePopup() {
    if (saving) return;
    setDeletePopup(false);
    setTemplateToDelete(null);
  }
 
  async function confirmDeleteTemplate() {
    if (!templateToDelete) return;
 
    const targetId =
      templateToDelete.id ??
      templateToDelete._id ??
      templateToDelete.roleTemplateId;
 
    if (!targetId) {
      setDeleteError("Role Template ID is missing. Cannot deactivate.");
      return;
    }
 
    setSaving(true);
    setDeleteError("");
 
    try {
      await roleTemplatesApi.update(targetId, {
        roleCode: templateToDelete.roleCode || "",
        name: templateToDelete.name || "",
        description: templateToDelete.description || "",
        status: "INACTIVE",
      });

      await loadTemplates();

      if (editingId !== null && String(editingId) === String(targetId))
        resetForm();

      setDeletePopup(false);
      setTemplateToDelete(null);
      setDeleteError("");
    } catch (err) {
      console.error("Role Template deactivate failed:", err);
 
      const errorMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.response?.data?.errors?.[0]?.message ||
        err?.message ||
        "Unable to deactivate role template.";
 
      setDeleteError(errorMsg);
    } finally {
      setSaving(false);
    }
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setSortBy("NEWEST");
  }
 
    // NEW: Check if the current name being typed already exists
  const isDuplicateName = templates.some((t) => {
    if (!t.name || !form.name) return false;
    return (
      t.name.trim().toLowerCase() === form.name.trim().toLowerCase() &&
      t.id !== editingId
    );
  });
 
  const isFormValid =
  form.roleCode.length >= 3 &&
  form.roleCode.length <= 30 &&
  /^[A-Z0-9_]+$/.test(form.roleCode) &&
  form.name.trim().length > 0 &&
  Boolean(form.status) &&
  !isDuplicateName;
 
  const hasFormChanges =
    editingId !== null &&
    originalForm !== null &&
    (form.roleCode !== originalForm.roleCode ||
      form.name !== originalForm.name ||
      form.description !== originalForm.description ||
      form.status !== originalForm.status);
  const canSubmit = isFormValid && (editingId === null || hasFormChanges);
 
  return (
    <>
      <section className="role-templates-page">
        <div className="role-templates-page-heading">
          <div>
            <h1>Role Template</h1>
            <p>Manage reusable role templates and their permissions.</p>
          </div>
        </div>
 
        <div className="role-details-card">
          <div className="role-card-heading">
            <div className="role-heading-icon">
              <i className="bi bi-grid-1x2" />
            </div>
 
            <div>
              <h2>
                {editingId !== null
                  ? "Edit Role Template"
                  : "Add Role Template"}
              </h2>
              <p>
                Provide the basic details and configuration for this role
                template.
              </p>
            </div>
          </div>
 
          {error && (
            <p className="role-error-message" role="alert">
              {error}
            </p>
          )}
 
          <div className="role-form-grid role-create-fields-grid">
            {/* ------------------ ROLE CODE (disabled) ------------------ */}
          

<label className="role-field role-code-field">
  <span>
    Role Template Code <b>*</b>
  </span>

  <div className="role-input-wrap role-placeholder">
    <input
      type="text"
      name="roleCode"
      value=""
      readOnly
      disabled
      placeholder="Auto Generated"
      maxLength={30}
      autoComplete="off"
      aria-invalid={Boolean(roleCodeError)}
      className={roleCodeError ? "role-input-invalid" : "role-placeholder"}
    />
  </div>

 
</label>





            {/* ------------------ NAME ------------------ */}
                       {/* ------------------ NAME ------------------ */}
<label className="role-field role-name-field">
<span>

                Role Template Name <b>*</b>
</span>
<div className="role-input-wrap">
<input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Enter role template name"
                  maxLength={100}
                  autoComplete="off"
                  aria-invalid={isDuplicateName}
                  className={isDuplicateName ? "role-input-invalid" : ""}
                />
</div>
              {/* NEW: Show duplicate name warning */}
<small
                className={isDuplicateName ? "role-field-error" : ""}
                style={{ color: isDuplicateName ? "#dc2626" : "inherit" }}
>
                {isDuplicateName ? "This role template name already exists." : ""}
</small>
</label>
 

            {/* ------------------ STATUS ------------------ */}
<label className="role-field role-status-field">
  <span>
    Status <b>*</b>
  </span>

  <div
    className={`role-select-wrap ${
      form.status === "INACTIVE"
        ? "role-status-select-inactive"
        : form.status === "ACTIVE"
        ? "role-status-select-active"
        : ""
    }`}
  >
    <select
      name="status"
      value={form.status}
      onChange={handleChange}
      className={
        form.status === "INACTIVE"
          ? "status-inactive"
          : form.status === "ACTIVE"
          ? "status-active"
          : ""
      }
      required
      aria-label="Select status"
    >
      <option value="">Select Status</option>
      <option value="ACTIVE">Active</option>
      <option value="INACTIVE">Inactive</option>
    </select>

    <i className="bi bi-chevron-down" />
  </div>

</label>

            {/* ------------------ DESCRIPTION ------------------ */}
            <label className="role-field role-description-field">
              <span>Description</span>
 
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                onInput={(e) => {
                  e.currentTarget.style.height = "44px";
                  e.currentTarget.style.height = `${Math.max(44, e.currentTarget.scrollHeight)}px`;
                }}
                autoComplete="off"
                placeholder="Describe the role template’s purpose."
                maxLength={500}
              />
              <div className="role-description-meta">
                <small> </small>
                <span>{form.description.length}/500</span>
              </div>
            </label>
          </div>
 
          <div className="role-form-actions">
            <button
              type="button"
              className="role-template-cancel-button"
              onClick={resetForm}
              disabled={saving}
            >
              Cancel
            </button>
 
            <button
              type="button"
              className="role-template-submit-button"
              onClick={saveTemplate}
              disabled={saving || !canSubmit}
            >
              {saving
                ? "Saving..."
                : editingId !== null
                  ? "Update Role Template"
                  : "Add Role Template"}
            </button>
          </div>
        </div>

        {/* ------------------ LIST & FILTERS ------------------ */}
        <div className="role-list-card">
          <div className="role-list-header">
            <div>
              <h2>Role Templates</h2>
            </div>
 
            <div className="role-filters pch-master-toolbar pch-master-control">
              <div className="role-search pch-master-search pch-master-control">
                <i className="bi bi-search" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search role templates..."
                />
              </div>
 
              <FilterDropdown preserveToolbarLayout
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </FilterDropdown>
 
              <FilterDropdown preserveToolbarLayout
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort role templates"
              >
                <option value="NEWEST">Newest to Oldest</option>
                <option value="OLDEST">Oldest to Newest</option>
                <option value="A_Z">A to Z</option>
                <option value="Z_A">Z to A</option>
              </FilterDropdown>
 
              <button
                type="button"
                className="role-reset-icon-btn pch-master-reset pch-master-control"
                title="Reset filters"
                aria-label="Reset filters"
                onClick={resetFilters}
              >
                <i className="bi bi-arrow-counterclockwise" />
              </button>
            </div>
          </div>
 
          <div className="role-table-wrap">
            <table className="role-table">
              <colgroup>
                <col className="role-code-col role-equal-col" />
                <col className="role-name-col role-equal-col" />
                <col className="role-description-col role-equal-col" />
                <col className="role-status-col role-equal-col" />
                <col className="role-created-col role-equal-col" />
                <col className="role-updated-col role-equal-col" />
                <col className="role-actions-col role-equal-col" />
              </colgroup>
 
              <thead>
                <tr>
                  <th className="role-code-col role-equal-col">Role Code</th>
                  <th className="role-name-col role-equal-col">
                    Role Template Name
                  </th>
                  <th className="role-description-col role-equal-col">
                    Description
                  </th>
                  <th className="role-status-col role-equal-col">Status</th>
                  <th className="role-created-col role-equal-col">
                    Created At
                  </th>
                  <th className="role-updated-col role-equal-col">
                    Updated At
                  </th>
                  <th className="role-actions-col role-equal-col">Actions</th>
                </tr>
              </thead>
 
              <tbody>
                {paginatedTemplates.map((template) => (
                  <tr
                    key={template.id}
                    className="role-template-clickable-row"
                    onClick={() =>
                      navigate(`/role-templates/${template.id}`, {
                        state: { roleTemplate: template },
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/role-templates/${template.id}`, {
                          state: { roleTemplate: template },
                        });
                      }
                    }}
                    tabIndex={0}
                  >
                    <td className="role-code-cell role-equal-col">
                      <div className="role-key-cell">
                        <strong>{template.roleCode || "—"}</strong>
                      </div>
                    </td>
 
                    <td className="role-name-cell role-equal-col">
                      <strong>{template.name || "—"}</strong>
                    </td>
 
                    <td className="role-description-cell role-equal-col">
                      <span className="role-description-text">
                        {template.description || "—"}
                      </span>
                    </td>
 
                    <td className="role-status-cell role-equal-col">
                      <span
                        className={`role-status ${String(template.status || "").toLowerCase()}`}
                      >
                        <i />
                        {String(template.status).toUpperCase() === "ACTIVE"
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>
 
                    <td className="role-created-cell role-equal-col">
                      {(() => {
                        const f = displayDate(
                          template.createdAt ||
                            template.created_at ||
                            template.createdDate,
                        );
                        return f ? (
                          <>
                            <span className="role-date-value">{f.date}</span>
                            <span className="role-time-value">{f.time}</span>
                          </>
                        ) : (
                          "—"
                        );
                      })()}
                    </td>
 
                    <td className="role-updated-cell role-equal-col">
                      {(() => {
                        const f = displayDate(
                          template.updatedAt ||
                            template.updated_at ||
                            template.updatedDate,
                        );
                        return f ? (
                          <>
                            <span className="role-date-value">{f.date}</span>
                            <span className="role-time-value">{f.time}</span>
                          </>
                        ) : (
                          "—"
                        );
                      })()}
                    </td>
 
                    <td className="role-actions role-equal-col">
                      <button
                        type="button"
                        className="role-edit-action"
                        onClick={(e) => {
                          e.stopPropagation();
                          editTemplate(template);
                        }}
                        disabled={saving}
                        aria-label={`Edit ${template.name || template.roleCode}`}
                        title="Edit role template"
                      >
                        <i className="bi bi-pencil" />
                      </button>

                      <button
                        type="button"
                        className="role-delete-action"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeletePopup(template);
                        }}
                        disabled={saving}
                        aria-label={`Delete ${template.name || template.roleCode}`}
                        title="Delete role template"
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
 
                {filteredTemplates.length === 0 && (
                  <tr>
                    <td colSpan={7} className="role-empty-state">
                      {loading
                        ? "Loading role templates…"
                        : "No role templates found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ------------------ PAGINATION ------------------ */}
<div className="role-pagination">
  <Pagination
    currentPage={currentPage}
    totalPages={totalPages}
    totalItems={totalEntries}
    pageSize={pageSize}
    onPageChange={setCurrentPage}
    onPageSizeChange={(newPageSize) => {
      setPageSize(newPageSize);
      setCurrentPage(1);
    }}
    itemLabel="role templates"
  />
</div>
        </div>
      </section>

      {/* ------------------ DELETE (Deactivate) MODAL ------------------ */}
      {deletePopup && templateToDelete && (
        <div
          className="role-delete-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-role-template-title"
        >
          <div className="role-delete-modal">
            <div className="role-delete-icon">
              <i className="bi bi-trash" />
            </div>

            <h3 id="delete-role-template-title">Deactivate Role Template?</h3>
 
            <p>
              Are you sure you want to deactivate{" "}
              <strong>
                {templateToDelete.name || templateToDelete.roleCode}
              </strong>
              ?
            </p>
 
            <p>
              This role template will be set to <strong>Inactive</strong>.
            </p>
 
            <p>This action cannot be undone.</p>

            {deleteError && (
              <p
                className="role-error-message"
                style={{ margin: "12px 0", color: "#dc2626" }}
                role="alert"
              >
                {deleteError}
              </p>
            )}
 
            <div className="role-delete-actions">
              <button
                type="button"
                className="role-secondary-btn"
                onClick={closeDeletePopup}
                disabled={saving}
              >
                Cancel
              </button>
 
              <button
                type="button"
                className="role-delete-confirm-btn"
                onClick={confirmDeleteTemplate}
                disabled={saving}
              >
                {saving ? "Deactivating…" : "Yes, Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

 