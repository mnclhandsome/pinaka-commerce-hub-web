import FilterDropdown from "../components/FilterDropdown";
import { useEffect, useMemo, useState } from "react";
import { storeTypesApi } from "../api/storeTypes";
import Pagination from "../components/Pagination";
import { tendorsApi } from "../api/tendors";
import { useNavigate } from "react-router-dom";

const emptyForm = {
  code: "",
  name: "",
  status: "",
};

function generateNextTendorCode(tendors) {
  const highestSequence = tendors.reduce((highest, tendor) => {
    const match = /^TND_(\d+)$/i.exec(String(tendor.code || ""));
    const sequence = match ? Number(match[1]) : 0;

    return Number.isSafeInteger(sequence) ? Math.max(highest, sequence) : highest;
  }, 19);

  return `TND_${String(highestSequence + 1).padStart(3, "0")}`;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDateDate(value) {
  const date = parseDate(value);

  if (!date) {
    return value ? String(value) : "-";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value) {
  const date = parseDate(value);

  if (!date) {
    return "";
  }

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) {
    return value ? String(value) : "-";
  }

  return `${formatDateDate(date)} ${formatDateTime(date)}`;
}

function mapTendorToUI(tendor) {
  const rawStatus = String(tendor.status || "").toUpperCase();
  const deletionFlag =
    tendor.isDeleted ?? tendor.is_deleted ?? tendor.deleted ?? false;
  const isDeleted =
    Boolean(tendor.deletedAt || tendor.deleted_at) ||
    deletionFlag === true ||
    deletionFlag === 1 ||
    String(deletionFlag).toLowerCase() === "true" ||
    rawStatus === "DELETED";

  return {
    id: tendor.id,
    code: tendor.code || tendor.tendorCode || "",
    name: tendor.tendorName || tendor.name || "",
    status: isDeleted
      ? "Inactive"
      : rawStatus === "ACTIVE"
        ? "Active"
        : rawStatus === "INACTIVE"
          ? "Inactive"
          : tendor.status || "Active",
    createdAt: tendor.createdAt || tendor.created_at || null,
    updatedAt: tendor.updatedAt || tendor.updated_at || null,
    changedBy:
      tendor.changedBy || tendor.updatedBy || tendor.createdBy || "Admin",
    changedAt: tendor.changedAt || tendor.updatedAt || tendor.createdAt || null,
  };
}

function getTendorList(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.items)) {
    return response.data.items;
  }

  if (Array.isArray(response?.data?.tendors)) {
    return response.data.tendors;
  }

  if (Array.isArray(response?.tendors)) {
    return response.tendors;
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  return [];
}

function getTendorData(response) {
  if (response?.data?.id) {
    return response.data;
  }

  if (response?.tendor?.id) {
    return response.tendor;
  }

  if (response?.id) {
    return response;
  }

  return null;
}

export default function Tenders() {
  const [tenders, setTenders] = useState([]);
  const navigate = useNavigate();
  
const ITEMS_PER_PAGE = 5;
const [currentPage, setCurrentPage] = useState(1);


  const [form, setForm] = useState(emptyForm);
  const [originalForm, setOriginalForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");

  const [sortBy, setSortBy] = useState("newest");

  const [tendersLoading, setTendersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmTender, setDeleteConfirmTender] = useState(null);

  useEffect(() => {
    fetchTendors();
  }, []);

  async function fetchTendors() {
    try {
      setTendersLoading(true);

      const response = await tendorsApi.getAll();

      console.log("Tendors API response:", response);

      const list = getTendorList(response);

      const mappedTenders = list.map(mapTendorToUI);

      mappedTenders.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;

        return bTime - aTime;
      });

      setTenders(mappedTenders);
    } catch (error) {
      console.error("Failed to fetch tendors:", error);

      setTenders([]);
    } finally {
      setTendersLoading(false);
    }
  }

  const filteredTenders = useMemo(() => {
    const query = search.trim().toLowerCase();
    

    const filtered = tenders.filter((tender) => {
      const matchesSearch =
        !query || Object.values(tender).join(" ").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All Statuses" || tender.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "name-asc") {
        return String(a.name || "").localeCompare(
          String(b.name || ""),
          undefined,
          { sensitivity: "base" },
        );
      }

      if (sortBy === "name-desc") {
        return String(b.name || "").localeCompare(
          String(a.name || ""),
          undefined,
          { sensitivity: "base" },
        );
      }

      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      return sortBy === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [tenders, search, statusFilter, sortBy]);

const totalPages = Math.ceil(
  filteredTenders.length / ITEMS_PER_PAGE
);

const paginatedTenders = filteredTenders.slice(
  (currentPage - 1) * ITEMS_PER_PAGE,
  currentPage * ITEMS_PER_PAGE
);

useEffect(() => {
  setCurrentPage(1);
}, [search, statusFilter, sortBy]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  const generatedCode = generateNextTendorCode(tenders);
  const tenderFormComplete = Boolean(
  (editingId ? form.code : generatedCode).trim() &&
  form.name.trim() &&
  form.status
);

  const tenderFormChanged =
    editingId !== null &&
    originalForm !== null &&
    (form.code.trim() !== originalForm.code.trim() ||
      form.name.trim() !== originalForm.name.trim() ||
      form.status !== originalForm.status);

  const tenderCanSave =
    tenderFormComplete &&
    (editingId === null ? !tendersLoading : tenderFormChanged);

  function resetForm() {
    setForm(emptyForm);
    setOriginalForm(null);
    setEditingId(null);
  }

  async function saveTender(event) {
    event.preventDefault();

    if (!tenderFormComplete) {
      return;
    }

    try {
      setSaving(true);

      const payload = {
        tendorCode: (editingId ? form.code : generatedCode).trim(),
        tendorName: form.name.trim(),
        status: form.status === "Active" ? "ACTIVE" : "INACTIVE",
      };

      if (editingId) {
        await tendorsApi.update(editingId, payload);
      } else {
        await tendorsApi.create(payload);
      }

      await fetchTendors();
      resetForm();
    } catch (error) {
      console.error(
        editingId ? "Failed to update tendor:" : "Failed to create tendor:",
        error,
      );

      alert(
        error?.response?.data?.message ||
          error?.message ||
          (editingId ? "Failed to update tender." : "Failed to create tender."),
      );
    } finally {
      setSaving(false);
    }
  }

  function editTender(tender) {
    const editValues = {
      code: tender.code || "",
      name: tender.name || "",
      status: tender.status || "Active",
    };

    setEditingId(tender.id);
    setOriginalForm(editValues);
    setForm(editValues);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function requestDeleteTender(tender) {
    if (deleting) {
      return;
    }

    setDeleteConfirmTender(tender);
  }

  function cancelDeleteTender() {
    if (deleting) {
      return;
    }

    setDeleteConfirmTender(null);
  }

  async function confirmDeleteTender() {
    if (!deleteConfirmTender) {
      return;
    }

    const tender = deleteConfirmTender;

    try {
      setDeleting(true);
      setDeletingId(tender.id);

      const response = await tendorsApi.update(tender.id, {
        tendorCode: tender.code,
        tendorName: tender.name,
        status: "INACTIVE",
      });
      const updatedTendor = getTendorData(response);

      setTenders((current) =>
        current.map((item) =>
          item.id === tender.id
            ? {
                ...item,
                status: "Inactive",
                updatedAt:
                  updatedTendor?.updatedAt ||
                  updatedTendor?.updated_at ||
                  new Date().toISOString(),
              }
            : item,
        ),
      );

      if (editingId === tender.id) {
        resetForm();
      }

      setDeleteConfirmTender(null);
    } catch (error) {
      console.error("Failed to deactivate tendor:", error);

      alert(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to deactivate tender.",
      );
    } finally {
      setDeleting(false);
      setDeletingId(null);
    }
  }

  return (
    <section className="tenders-page">
      <div className="tenders-header">
        <div>
          <h1>Tender</h1>

          <p>Manage tenders and their availability.</p>
        </div>
      </div>

      <form className="tenders-form" onSubmit={saveTender} autoComplete="off">
        <div className="tenders-form-heading">
          <div className="tenders-heading-content">
            <div className="tenders-heading-icon">
              <i className="bi bi-cash-coin" />
            </div>

            <div>
              <h2>
                {editingId ? "Edit Tender" : "Add Tender"}
              </h2>

              <p>
                Enter the tender details.
              </p>
            </div>
          </div>
        </div>

        <div className="tenders-form-grid tender-create-fields-grid">
         
<label className="tenders-code-field">
  <span>
    Tender Code <b>*</b>
  </span>

  <input
    type="text"
    name="code"
    value={editingId ? form.code : ""}
    placeholder="Auto Generated"
    readOnly
    disabled
    aria-describedby="tender-code-help"
    autoComplete="off"
    class="tender-placeholder"
  
  />
</label>



          <label>
            <span>
              Tender Name <b>*</b>
            </span>

            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Store Credit"
              required
              autoComplete="off"
            />
          </label>

          <label>
  <span>
    Status <b>*</b>
  </span>

  <select
    name="status"
    value={form.status}
    onChange={handleChange}
    required
    className={`tender-status-select ${
      form.status === "Active"
        ? "status-active"
        : form.status === "Inactive"
          ? "status-inactive"
          : ""
    }`}
  >
    <option value="">Select Status</option>
    <option value="Active">Active</option>
    <option value="Inactive">Inactive</option>
  </select>
</label>
        </div>

        <div className="tenders-form-actions">
          <button
            type="button"
            className="tenders-clear-button"
            onClick={resetForm}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="tenders-save-button"
            disabled={saving || !tenderCanSave}
          >
            {saving
              ? "Saving..."
              : editingId
                ? "Update Tender"
                : "Add Tender"}
          </button>
        </div>
      </form>

      <div className="tenders-list-card">
        <div className="tenders-list-toolbar">
          <div>
            <h2>Tenders</h2>

            <p>
              {filteredTenders.length} payment method
              {filteredTenders.length === 1 ? "" : "s"} found
            </p>
          </div>

          <div className="tenders-filters pch-master-toolbar pch-master-control">
            <div className="tenders-search pch-master-search pch-master-control">
              <i className="bi bi-search" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tenders..."
              />
            </div>

            <FilterDropdown preserveToolbarLayout
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="All Statuses">All Statuses</option>

              <option value="Active">Active</option>

              <option value="Inactive">Inactive</option>
            </FilterDropdown>
            <FilterDropdown preserveToolbarLayout
              className="tenders-sort-select"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              aria-label="Sort tenders"
            >
              <option value="newest">Recently Added</option>

              <option value="oldest">Oldest to Newest</option>

              <option value="name-asc">Alphabetical A–Z</option>

              <option value="name-desc">Alphabetical Z–A</option>
            </FilterDropdown>

            <button
              type="button"
              className="tenders-reset-button pch-master-reset pch-master-control"
              onClick={() => {
                setSearch("");
                setStatusFilter("All Statuses");
                setSortBy("newest");
              }}
              title="Reset filters"
              aria-label="Reset filters"
            >
              <i className="bi bi-arrow-counterclockwise" />
            </button>
          </div>
        </div>

        <div className="tenders-table-wrap">
          <table className="tenders-table">
            <thead>
              <tr>
                <th>Tender Code</th>
                <th>Tender</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Updated At</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {tendersLoading ? (
                <tr>
                  <td
                    colSpan="6"
                    style={{
                      textAlign: "center",
                      padding: "30px",
                    }}
                  >
                    Loading tenders...
                  </td>
                </tr>
              ) : (
                paginatedTenders.map((tender) => (
                  
<tr
  key={tender.id}
  className="tender-row-clickable"
  onClick={() =>
    navigate(`/tenders/${tender.id}`, {
      state: { tender },
    })
  }
>
                    <td>{tender.code}</td>

                    <td>
                      <strong>{tender.name}</strong>
                    </td>

                    <td>
                      <span
                        className={`tenders-status ${String(
                          tender.status,
                        ).toLowerCase()}`}
                      >
                        <i className="bi bi-circle-fill" />
                        {tender.status}
                      </span>
                    </td>

                    <td className="tender-date-cell">
                      <span className="tender-date">
                        {formatDateDate(tender.createdAt)}
                      </span>
                      <span className="tender-time">
                        {formatDateTime(tender.createdAt)}
                      </span>
                    </td>

                    <td className="tender-date-cell">
                      <span className="tender-date">
                        {formatDateDate(tender.updatedAt)}
                      </span>
                      <span className="tender-time">
                        {formatDateTime(tender.updatedAt)}
                      </span>
                    </td>

                    <td className="tenders-actions">
                      <button
                        type="button"
                        onClick={(event) => {
                         event.stopPropagation();
                          editTender(tender);
                        }}
                      >
                        <i className="bi bi-pencil" />
                      </button>

                      <button
                        type="button"
                        className="tenders-delete-action"
                        onClick={(event) => {
                        event.stopPropagation();
                        requestDeleteTender(tender);
                            }}
                      >
                        <i
                          className={
                            deleting && deletingId === tender.id
                              ? "bi bi-hourglass-split"
                              : "bi bi-trash"
                          }
                        />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!tendersLoading && filteredTenders.length === 0 && (
            <div className="tenders-empty">No tenders found.</div>
          )}
        </div>
            <Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  totalItems={filteredTenders.length}
  pageSize={ITEMS_PER_PAGE}
  onPageChange={setCurrentPage}
  onPageSizeChange={(newPageSize) => {
    // Fixed at 5 items per page
    setCurrentPage(1);
  }}
  itemLabel="tenders"
  showWhenEmpty={false}
/>


      </div>

   
      {deleteConfirmTender && (
        <div className="tenders-confirm-backdrop" onClick={cancelDeleteTender}>
          <div
            className="tenders-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-tender-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="tenders-confirm-icon">
              <i className="bi bi-exclamation-triangle" />
            </div>

            <div className="tenders-confirm-content">
              <h2 id="delete-tender-title">Deactivate Tender?</h2>

              <p>
                Are you sure you want to deactivate{" "}
                <strong>{deleteConfirmTender.name}</strong>?
              </p>

              <span className="tenders-confirm-warning">
                This tender will remain in the list with Inactive status.
              </span>
            </div>

            <div className="tenders-confirm-actions">
              <button
                type="button"
                className="tenders-confirm-cancel"
                onClick={cancelDeleteTender}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="tenders-confirm-delete"
                onClick={confirmDeleteTender}
                disabled={deleting}
              >
                {deleting ? "Deactivating..." : "Yes, Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
