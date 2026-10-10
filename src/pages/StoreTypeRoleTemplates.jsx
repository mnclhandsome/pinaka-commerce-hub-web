import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Pagination from "../components/Pagination";
import {
  readRoleTemplatesList,
  roleTemplatesApi,
} from "../api/roleTemplatesApi";
import { storeTypesApi } from "../api/storeTypes";

const initialStoreType = {
  name: "Store Type",
  description: "Manage the role templates assigned to this store type.",
  status: "ACTIVE",
};

function normalizeRole(role, index) {
  const template = role.roleTemplate ?? role.template ?? role;

  return {
    id:
      role.roleTemplateId ??
      template.id ??
      template._id ??
      role.id ??
      `role-${index}`,
    name:
      template.name ??
      template.roleName ??
      template.templateName ??
      template.code ??
      "Unnamed role template",
    scope: template.scope ?? template.roleScope ?? "Store",
    active: template.status ? template.status !== "INACTIVE" : true,
  };
}

export default function StoreTypeRoleTemplates() {
  const navigate = useNavigate();
  const location = useLocation();
  const { storeTypeId } = useParams();
  const initialState = location.state?.storeType;

  const [storeType, setStoreType] = useState(() => ({
    ...initialStoreType,
    ...(initialState
      ? {
          name: initialState.name ?? initialStoreType.name,
          description:
            initialState.description ?? initialStoreType.description,
          status: initialState.status ?? initialStoreType.status,
        }
      : {}),
  }));
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [modalSearch, setModalSearch] = useState("");
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loadingAvailableRoles, setLoadingAvailableRoles] = useState(false);
  const [roleListError, setRoleListError] = useState("");
  const [savingRoles, setSavingRoles] = useState(false);

  useEffect(() => {
    let cancelled = false;

    storeTypesApi
       .getById(storeTypeId)
      .then((response) => {
        const item = response?.storeType ?? response?.data ?? response;

        if (!item || typeof item !== "object" || cancelled) return;

        setStoreType({
          name: item.name ?? initialStoreType.name,
          description: item.description ?? initialStoreType.description,
          status: item.status ?? initialStoreType.status,
        });
      })
      .catch((err) => {
        if (!cancelled) setRoleListError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [storeTypeId]);

  useEffect(() => {
    let cancelled = false;

    roleTemplatesApi
      .getForStoreType(storeTypeId)
      .then((response) => {
        if (cancelled) return;

        const assignments = readRoleTemplatesList(response);
        setRoles(assignments.map(normalizeRole));
      })
      .catch((err) => {
        if (!cancelled) {
          setRoleListError(
            err.message || "Unable to load assigned role templates."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [storeTypeId]);

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return roles.filter((role) =>
      role.name.toLowerCase().includes(query)
    );
  }, [roles, search]);

  useEffect(() => {
  setCurrentPage(1);
}, [search]);

const totalPages = Math.max(
  1,
  Math.ceil(filteredRoles.length / pageSize)
);

const paginatedRoles = useMemo(() => {
  const startIndex = (currentPage - 1) * pageSize;

  return filteredRoles.slice(startIndex, startIndex + pageSize);
}, [filteredRoles, currentPage, pageSize]);

useEffect(() => {
  const lastValidPage = Math.max(1, totalPages);

  if (currentPage > lastValidPage) {
    setCurrentPage(lastValidPage);
  }
}, [currentPage, totalPages]);

  function toggleRole(id) {
    setRoles((current) =>
      current.map((role) =>
        role.id === id
          ? { ...role, active: !role.active }
          : role
      )
    );
  }

  const filteredModalRoles = useMemo(() => {
    const query = modalSearch.trim().toLowerCase();

    return availableRoles.filter((role) =>
      role.name.toLowerCase().includes(query)
    );
  }, [availableRoles, modalSearch]);

  function toggleSelectedRole(roleId) {
    setSelectedRoles((current) =>
      current.includes(roleId)
        ? current.filter((item) => item !== roleId)
        : [...current, roleId]
    );
  }

  async function openRoleModal() {
    const existingIds = new Set(roles.map((role) => role.id));
    setModalSearch("");
    setRoleListError("");
    setShowModal(true);

    setLoadingAvailableRoles(true);
    try {
      const response = await roleTemplatesApi.getAll();
      const apiRoles = readRoleTemplatesList(response).map(normalizeRole);

      setAvailableRoles(apiRoles);
      setSelectedRoles(
        apiRoles
          .filter((role) => existingIds.has(role.id))
          .map((role) => role.id)
      );
    } catch (err) {
      setAvailableRoles([]);
      setSelectedRoles([]);
      setRoleListError(err.message || "Unable to load role templates.");
    } finally {
      setLoadingAvailableRoles(false);
    }
  }

  async function addSelectedRoles() {
    if (!storeTypeId || selectedRoles.length === 0) return;

    const existingIds = new Set(roles.map((role) => role.id));
    const selected = availableRoles.filter((role) =>
      selectedRoles.includes(role.id)
    );

    setSavingRoles(true);
    setRoleListError("");

    try {
      await Promise.all(
        selected
          .filter((role) => !existingIds.has(role.id))
          .map((role) =>
            roleTemplatesApi.assignToStoreType(storeTypeId, {
              roleTemplateId: role.id,
              status: "ACTIVE",
            })
          )
      );

      setRoles((current) => [
        ...current,
        ...selected.filter((role) => !existingIds.has(role.id)),
      ]);
      setShowModal(false);
      setSelectedRoles([]);
    } catch (err) {
      setRoleListError(err.message || "Unable to add role templates.");
    } finally {
      setSavingRoles(false);
    }
  }

  async function confirmDeleteRole() {
    if (!deleteTarget || !storeTypeId) return;

    setSavingRoles(true);
    setRoleListError("");

    try {
      await roleTemplatesApi.removeFromStoreType(storeTypeId, deleteTarget.id);
      setRoles((current) =>
        current.filter((role) => role.id !== deleteTarget.id)
      );
      setDeleteTarget(null);
    } catch (err) {
      setRoleListError(err.message || "Unable to delete role template.");
    } finally {
      setSavingRoles(false);
    }
  }

  return (
    <section className="role-templates-page">
      <div className="role-templates-top">
  <button
    type="button"
    className="role-templates-back"
    onClick={() => navigate("/store-types/new")}
    aria-label="Back to Store Types"
    title="Back to Store Types"
  >
    <i className="bi bi-arrow-left" />
  </button>

  <div className="role-templates-title">
    <div className="store-type-title-line">
      <h1>{storeType.name}</h1>

      {/* <span
        className={`store-type-active-badge ${
          storeType.status === "INACTIVE" ? "inactive" : ""
        }`}
      >
        <i className="bi bi-circle-fill" />
        {storeType.status === "INACTIVE" ? "Inactive" : "Active"}
      </span> */}
    </div>

    <p>{storeType.description}</p>
  </div>
</div>

      <nav className="role-templates-tabs">
        <button
          type="button"
          onClick={() => navigate(`/store-types/${storeTypeId}`)}
        >
          Store Type Details
        </button>

        <button
          type="button"
          onClick={() => navigate(`/store-types/${storeTypeId}/features`)}
        >
          Assigned Features
        </button>

        <button type="button" className="active">
          Assigned Role Templates
        </button>
      </nav>

      <section className="role-templates-card">
        <div className="role-templates-card-header">
          <div className="role-templates-card-title">
            <div className="role-templates-title-icon">
              <i className="bi bi-person-badge" />
            </div>

            <div>
              <h2>Assigned Role Templates</h2>
              <p>Role templates mapped to this store type.</p>
            </div>
          </div>

          <div className="role-templates-tools">
            <label className="role-templates-search pch-master-search pch-master-control">
              <i className="bi bi-search" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search role templates…"
              />
            </label>

            <button
              type="button"
              className="role-templates-add-button"
              onClick={openRoleModal}
            >
              <i className="bi bi-plus-lg" />
              Assign Role Templates
            </button>
          </div>
        </div>

       
<div className="role-templates-table">
  <div className="role-template-row role-template-row-head">
    <div>Role Template Name</div>
    <div>Access Scope</div>
    <div>Actions</div>
  </div>

  {paginatedRoles.length > 0 ? (
    paginatedRoles.map((role) => (
      <div className="role-template-row" key={role.id}>
        <div className="role-template-name">{role.name}</div>

        <div>{role.scope}</div>

        <div>
          <button
            type="button"
            className="role-template-delete-button"
            title={`Remove ${role.name} assignment`}
            aria-label={`Remove ${role.name} assignment`}
            onClick={() => setDeleteTarget(role)}
          >
            <i className="bi bi-trash3" aria-hidden="true" />
          </button>
        </div>
      </div>
    ))
  ) : (
    <div className="role-templates-empty">
      {search.trim()
        ? "No role templates match your search."
        : "No role templates assigned yet."}
    </div>
  )}
</div>


       
<div className="role-templates-footer">
  <Pagination
    currentPage={currentPage}
    totalPages={totalPages}
    totalItems={filteredRoles.length}
    pageSize={pageSize}
    onPageChange={setCurrentPage}
    onPageSizeChange={(newPageSize) => {
      setPageSize(newPageSize);
      setCurrentPage(1);
    }}
    itemLabel="entries"
    showWhenEmpty={true}
  />
</div>

      </section>

      {showModal && (
        <div
          className="role-template-modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="role-template-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="role-template-modal-heading">
              <h2>Assign Role Template</h2>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close dialog"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <label className="role-template-search pch-master-search pch-master-control">
              <i className="bi bi-search" />
              <input
                type="search"
                value={modalSearch}
                onChange={(event) => setModalSearch(event.target.value)}
                placeholder="Search role templates…"
                autoFocus
              />
            </label>

            <div className="role-template-list">
              {loadingAvailableRoles ? (
                <span className="role-template-empty">Loading roles...</span>
              ) : roleListError ? (
                <span className="role-template-empty" role="alert">
                  {roleListError}
                </span>
              ) : filteredModalRoles.length > 0 ? (
                filteredModalRoles.map((role) => (
                  <label className="role-template-option" key={role.id}>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.id)}
                      onChange={() => toggleSelectedRole(role.id)}
                      disabled={savingRoles}
                    />
                    <span>{role.name}</span>
                  </label>
                ))
              ) : (
                <span className="role-template-empty">No matching roles found</span>
              )}
            </div>

            <div className="role-template-preview">
              <div className="role-template-preview-header">
                <span>Selected Roles</span>
                <strong>{selectedRoles.length}</strong>
              </div>

              <div className="role-template-preview-list">
                {selectedRoles.length > 0 ? (
                  selectedRoles.map((roleId) => {
                    const role = availableRoles.find((item) => item.id === roleId);

                    return (
                    <span className="role-template-preview-pill" key={roleId}>
                      {role?.name ?? roleId}
                    </span>
                    );
                  })
                ) : (
                  <span className="role-template-preview-empty">
                    No roles selected yet
                  </span>
                )}
              </div>
            </div>

            <div className="role-template-modal-actions">
              <button
                type="button"
                className="role-template-cancel-button"
                onClick={() => setShowModal(false)}
                disabled={savingRoles}
              >
                Cancel
              </button>

              <button
                type="button"
                className="role-template-create-button"
                onClick={addSelectedRoles}
                disabled={selectedRoles.length === 0 || savingRoles}
              >
                {savingRoles ? "Adding..." : `Add Selected (${selectedRoles.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="delete-roletemplate-overlay"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="delete-roletemplate-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="delete-roletemplate-icon">
              <i className="bi bi-exclamation-triangle" />
            </div>

            <h2>Delete Role Template?</h2>

            <p>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
            </p>

            <p className="delete-roletemplate-warning">
              This action cannot be undone.
            </p>

            {roleListError && <p role="alert">{roleListError}</p>}

            <div className="delete-roletemplate-actions">
              <button
                type="button"
                className="delete-roletemplate-keep-button"
                onClick={() => setDeleteTarget(null)}
                disabled={savingRoles}
              >
                No, Keep It
              </button>

              <button
                type="button"
                className="delete-roletemplate-confirm-button"
                onClick={confirmDeleteRole}
                disabled={savingRoles}
              >
                {savingRoles ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
