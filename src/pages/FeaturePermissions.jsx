import FilterDropdown from "../components/FilterDropdown";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Pagination from "../components/Pagination";
import { listFeatures } from "../api/features";
import {
  listFeaturePermissions,
  getFeaturePermissionById,
  createFeaturePermission,
  updateFeaturePermission,
  deleteFeaturePermission,
} from "../api/featurePermissionsApi";
import "../styles/featurepermissions.css";

/* =========================================================
   FEATURE CATEGORIES
   Frontend-only grouping
   ========================================================= */

const featureCategories = {
  "Device & Display": [
    "KDS",
    "Customer Display",
  ],

  "Business & Transaction": [
    "Refund",
    "Age Verification",
    "Coupons",
    "Discount",
  ],
};

/* =========================================================
   EMPTY FORM
   ========================================================= */

const emptyForm = {
  key: "",
  name: "",
  featureId: "",
  description: "",
  status: "Select Status",
};

/* =========================================================
   HELPERS
   ========================================================= */

const normalizeFeatureName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getFeatureCategory = (featureName) => {
  const normalizedName =
    normalizeFeatureName(featureName);

  const matchingCategory = Object.entries(
    featureCategories,
  ).find(([, featureNames]) =>
    featureNames.some(
      (name) =>
        normalizeFeatureName(name) ===
        normalizedName,
    ),
  );

  return matchingCategory
    ? matchingCategory[0]
    : "";
};

const inferPermissionType = (name) => {
  const value = String(name || "").toLowerCase();
  if (/\b(create|add|insert|new)\b/.test(value)) return "CREATE";
  if (/\b(update|edit|modify|change)\b/.test(value)) return "UPDATE";
  if (/\b(delete|remove|erase)\b/.test(value)) return "DELETE";
  return "READ";
};

/* =========================================================
   DESCRIPTION CELL
   ========================================================= */

function PermissionDescriptionCell({ description = "" }) {
  return (
    <td className="fp-description-cell">
      <div className="fp-description-content">
        <span className="fp-description-clamp">
          {description || "—"}
        </span>
      </div>
    </td>
  );
}

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

export default function FeaturePermissions() {
  const [features, setFeatures] = useState([]);

  const [permissions, setPermissions] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [form, setForm] =
    useState(emptyForm);

  const [errors, setErrors] =
    useState({});

  const [editingId, setEditingId] =
    useState(null);

  const [
    permissionToDelete,
    setPermissionToDelete,
  ] = useState(null);

  const [isDeleting, setIsDeleting] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("All Statuses");

  const [sortBy, setSortBy] =
    useState("newest");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

    const navigate = useNavigate();

  /* =========================================================
     CASCADING FORM STATE
     ========================================================= */

  const [
    featureCategory,
    setFeatureCategory,
  ] = useState("");

  const [
    featurePermission,
    setFeaturePermission,
  ] = useState("");
  const [lastSavedCode, setLastSavedCode] = useState("");


  const isEditing =
    editingId !== null;

  /* =========================================================
     SELECTED FEATURE
     ========================================================= */

  const selectedFeature = useMemo(() => {
    return features.find(
      (feature) =>
        String(feature.id) ===
        String(form.featureId),
    );
  }, [features, form.featureId]);

  /* =========================================================
     AVAILABLE FEATURES FOR SELECTED CATEGORY
     ========================================================= */

  const availableFeatures = useMemo(() => {
    return features.filter((feature) => feature.id !== undefined && feature.id !== null);
  }, [features]);

  const generatedPermissionKey = isEditing ? form.key : lastSavedCode;

  /* =========================================================
     REQUIRED FIELDS
     ========================================================= */

  const requiredFieldsComplete =
  form.name.trim() !== "" &&
  String(form.featureId).trim() !== "" &&
  form.status !== "Select Status";

  /* =========================================================
     ORIGINAL EDITING RECORD
     ========================================================= */

  const originalEditingPermission =
    isEditing
      ? permissions.find(
          (item) =>
            String(item.id) ===
            String(editingId),
        )
      : null;

  const originalEditingStatus =
    String(
      originalEditingPermission?.status ||
        "ACTIVE",
    ).toUpperCase() === "ACTIVE"
      ? "Active"
      : "Inactive";

  /* =========================================================
     CHECK EDIT CHANGES
     ========================================================= */

  const hasEditChanges =
    !isEditing ||
    !originalEditingPermission ||
    form.key
      .trim()
      .toUpperCase() !==
      String(
        originalEditingPermission.key ||
          "",
      )
        .trim()
        .toUpperCase() ||
    form.name.trim() !==
      String(
        originalEditingPermission.name ||
          "",
      ).trim() ||
    String(form.featureId) !==
      String(
        originalEditingPermission.featureId ??
          "",
      ) ||
    form.description.trim() !==
      String(
        originalEditingPermission.description ||
          "",
      ).trim() ||
    form.status !== originalEditingStatus;

  const canSubmit =
    requiredFieldsComplete &&
    (!isEditing || hasEditChanges);

  /* =========================================================
     NORMALIZE STATUS
     ========================================================= */

  const normalizeStatus = (status) =>
    String(
      status || "ACTIVE",
    ).toUpperCase() === "ACTIVE"
      ? "Active"
      : "Inactive";

  /* =========================================================
     NORMALIZE PERMISSION
     ========================================================= */

  const normalizePermission = (
    item,
    feature,
  ) => {
    const source =
      item?.permission ||
      item?.data ||
      item ||
      {};

    return {
      ...source,

      id:
        source.id ??
        source._id ??
        source.permissionId ??
        source.permission_id,

      key:
        source.permissionCode ||
        source.permission_code ||
        source.permissionKey ||
        source.permission_key ||
        source.key ||
        "",

      permissionType:
        source.permissionType ||
        source.permission_type ||
        "READ",

      name: source.name || "",

      featureId:
        source.featureId ??
        source.feature_id ??
        source.feature?.id ??
        feature?.id ??
        "",

      featureName:
        source.feature?.name ||
        source.featureName ||
        feature?.name ||
        "",

      description:
        source.description || "",

      status: normalizeStatus(
        source.status,
      ),

      createdAt:
        source.createdAt ||
        source.created_at ||
        "",

      updatedAt:
        source.updatedAt ||
        source.updated_at ||
        "",
    };
  };

  /* =========================================================
     LOAD DATA
     ========================================================= */

  const loadData = async () => {
    setLoading(true);

    try {
      const featureList =
        await listFeatures();

      setFeatures(featureList);

      const permissionGroups =
        await Promise.all(
          featureList
            .filter(
              (feature) =>
                feature?.id !==
                  undefined &&
                feature?.id !== null,
            )
            .map(async (feature) => {
              try {
                const list =
                  await listFeaturePermissions(
                    feature.id,
                  );

                return (
                  Array.isArray(list)
                    ? list
                    : []
                ).map((item) =>
                  normalizePermission(
                    item,
                    feature,
                  ),
                );
              } catch (error) {
                console.error(
                  `Failed to load permissions for feature ${feature.name}:`,
                  error,
                );

                return [];
              }
            }),
        );

      setPermissions(
        permissionGroups.flat(),
      );
    } catch (error) {
      console.error(
        "Feature permissions load failed:",
        error,
      );

      window.alert(
        error?.message ||
          "Unable to load feature permissions.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* =========================================================
     UPDATE NORMAL FORM FIELD
     ========================================================= */

  const updateField = (event) => {
    const field =
      event.target.dataset.field ||
      event.target.name;

    const { value } =
      event.target;

    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));

    setErrors((prev) => {
      const next = {
        ...prev,
      };

      delete next[field];

      return next;
    });
  };

  /* =========================================================
     CATEGORY CHANGE
     ========================================================= */

  const handleCategoryChange = (
    event,
  ) => {
    const value =
      event.target.value;

    setFeatureCategory(value);

    /*
     * Category changed:
     * reset Feature
     * reset Permission Name
     */

    setFeaturePermission("");

    setForm((prev) => ({
      ...prev,
      featureId: "",
      name: "",
    }));

    setErrors((prev) => {
      const next = {
        ...prev,
      };

      delete next.featureId;
      delete next.name;

      return next;
    });
  };

  /* =========================================================
     FEATURE CHANGE
     ========================================================= */

  const handleFeatureChange = (
    event,
  ) => {
    const value =
      event.target.value;

    setLastSavedCode("");

    /*
     * Feature changed:
     * reset Permission Name
     */

    setFeaturePermission("");

    setForm((prev) => ({
      ...prev,
      featureId: value,
      name: "",
    }));

    setErrors((prev) => {
      const next = {
        ...prev,
      };

      delete next.featureId;
      delete next.name;

      return next;
    });
  };

  /* =========================================================
     PERMISSION NAME CHANGE
     ========================================================= */

  const handlePermissionChange = (
    event,
  ) => {
    const value =
      event.target.value;

    setLastSavedCode("");

    setFeaturePermission(value);

    setForm((prev) => ({
      ...prev,
      name: value,
    }));

    setErrors((prev) => {
      const next = {
        ...prev,
      };

      delete next.name;

      return next;
    });
  };

  /* =========================================================
     CLEAR / RESET FORM
     ========================================================= */

  const clearForm = () => {
    setEditingId(null);

    setForm({
      ...emptyForm,
    });

    setFeatureCategory("");

    setFeaturePermission("");

    setLastSavedCode("");

    setErrors({});
  };

  /* =========================================================
     SAVE / UPDATE PERMISSION
     ========================================================= */

  const savePermission = async () => {
    const permissionName =
      form.name.trim();

    const selectedFeature =
      features.find(
        (feature) =>
          String(feature.id) ===
          String(form.featureId),
      );

    const validationErrors = {};

    if (!permissionName) {
      validationErrors.name =
        "Permission name is required.";
    }

    if (!selectedFeature) {
      validationErrors.featureId =
        "Please select a feature.";
    }

    if (
      Object.keys(
        validationErrors,
      ).length > 0
    ) {
      setErrors(
        validationErrors,
      );

      return;
    }

    /* =======================================================
       DUPLICATE VALIDATION
       ======================================================= */

    const normalizedName =
      permissionName.toLowerCase();

    const duplicateName =
      permissions.some(
        (item) =>
          String(item.id) !==
            String(editingId) &&
          String(item.name || "")
            .trim()
            .toLowerCase() ===
            normalizedName,
      );

    if (duplicateName) {
      validationErrors.name =
        "Permission name already exists.";
    }

    if (
      Object.keys(
        validationErrors,
      ).length > 0
    ) {
      setErrors(
        validationErrors,
      );

      return;
    }

    /* =======================================================
       PAYLOAD
       ======================================================= */

    const payload = isEditing
      ? {
          name: permissionName,
          permissionType: originalEditingPermission.permissionType || inferPermissionType(permissionName),
          ...(String(selectedFeature.id) !== String(originalEditingPermission.featureId)
            ? { featureId: selectedFeature.id }
            : {}),

          description:
            form.description.trim(),

          status:
            form.status.toUpperCase(),
        }
      : {
          permissionType: inferPermissionType(permissionName),
          name: permissionName,

          description:
            form.description.trim(),

          status:
            form.status.toUpperCase(),
        };

    try {
      const savedPermission = await (isEditing
        ? updateFeaturePermission(
            originalEditingPermission.featureId,
            editingId,
            payload,
          )
        : createFeaturePermission(
          selectedFeature.id,
          payload,
        ));

      const generatedCode = savedPermission?.permissionCode || savedPermission?.permission_code || "";

      await loadData();

      if (!isEditing) {
        setCurrentPage(1);
      }

      clearForm();
      if (!isEditing) setLastSavedCode(generatedCode);
    } catch (error) {
      console.error(
        "Save permission failed:",
        error,
      );

      window.alert(
        error?.message ||
          "Unable to save permission.",
      );
    }
  };

  /* =========================================================
     EDIT PERMISSION
     ========================================================= */

  const editPermission = async (
    permission,
  ) => {
    try {
      const record =
        await getFeaturePermissionById(
          permission.featureId,
          permission.id,
        );

      const loaded =
        normalizePermission(
          record,
          features.find(
            (item) =>
              String(item.id) ===
              String(
                permission.featureId,
              ),
          ),
        );

      const loadedFeature =
        features.find(
          (item) =>
            String(item.id) ===
            String(
              loaded.featureId ||
                permission.featureId,
            ),
        );

      const loadedFeatureName =
        loadedFeature?.name ||
        loaded.featureName ||
        permission.featureName ||
        "";

      const loadedCategory =
        getFeatureCategory(
          loadedFeatureName,
        );

      const loadedPermission =
        loaded.name ||
        permission.name ||
        "";

      setEditingId(
        loaded.id ?? permission.id,
      );

      setForm({
        key:
          loaded.key ||
          permission.key ||
          "",

        name: loadedPermission,

        featureId: String(
          loaded.featureId ||
            permission.featureId ||
            "",
        ),

        description:
          loaded.description || "",

        status:
          loaded.status ||
          permission.status ||
          "Active",
      });

      /*
       * Restore cascading state
       */

      setFeatureCategory(
        loadedCategory,
      );

      setFeaturePermission(
        loadedPermission,
      );

      setErrors({});

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      console.error(
        "Get permission failed:",
        error,
      );

      window.alert(
        error?.message ||
          "Unable to load permission.",
      );
    }
  };

  /* =========================================================
     DELETE PERMISSION
     ========================================================= */

  const openDeleteConfirmation = (
    permission,
  ) => {
    setPermissionToDelete(
      permission,
    );
  };

  const closeDeleteConfirmation = () => {
    if (isDeleting) return;

    setPermissionToDelete(null);
  };

  const confirmDeletePermission =
    async () => {
      const permission =
        permissionToDelete;

      if (!permission) return;

      const permissionId =
        permission.id;

      const featureId =
        permission.featureId;

      if (
        permissionId ===
          undefined ||
        permissionId === null ||
        featureId === undefined ||
        featureId === null ||
        String(
          permissionId,
        ).trim() === "" ||
        String(
          featureId,
        ).trim() === ""
      ) {
        window.alert(
          "Permission ID or feature ID is missing.",
        );

        return;
      }

      setIsDeleting(true);

      try {
        await deleteFeaturePermission(
          featureId,
          permissionId,
        );

        setPermissions((current) => current.map((item) =>
          String(item.id) === String(permissionId)
            ? { ...item, status: "Inactive", updatedAt: new Date().toISOString() }
            : item,
        ));

        if (
          String(editingId) ===
          String(permissionId)
        ) {
          clearForm();
        }

        setPermissionToDelete(null);
      } catch (error) {
        console.error(
          "Delete permission failed:",
          error,
        );

        window.alert(
          error?.message ||
            "Unable to delete permission.",
        );
      } finally {
        setIsDeleting(false);
      }
    };

  /* =========================================================
     RESET FILTERS
     ========================================================= */

  const resetFilters = () => {
    setSearch("");

    setStatusFilter(
      "All Statuses",
    );

    setSortBy("newest");
  };

  /* =========================================================
     FILTERED PERMISSIONS
     ========================================================= */

  const filteredPermissions =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      const getCreatedTime = (
        item,
      ) => {
        const parsed =
          new Date(
            item.createdAt || "",
          ).getTime();

        return Number.isNaN(parsed)
          ? 0
          : parsed;
      };

      const getUpdatedTime = (
        item,
      ) => {
        const parsed =
          new Date(
            item.updatedAt || "",
          ).getTime();

        return Number.isNaN(parsed)
          ? 0
          : parsed;
      };

      const filtered =
        permissions.filter(
          (item) => {
            const featureName =
              item.featureName || "";

            const matchesSearch =
              String(
                item.key || "",
              )
                .toLowerCase()
                .includes(query) ||
              String(
                item.name || "",
              )
                .toLowerCase()
                .includes(query) ||
              String(
                item.description || "",
              )
                .toLowerCase()
                .includes(query) ||
              String(
                featureName,
              )
                .toLowerCase()
                .includes(query);

            const matchesStatus =
              statusFilter ===
                "All Statuses" ||
              item.status ===
                statusFilter;

            return (
              matchesSearch &&
              matchesStatus
            );
          },
        );

      return [...filtered].sort(
        (a, b) => {
          if (
            sortBy === "oldest"
          ) {
            return (
              getCreatedTime(a) -
              getCreatedTime(b)
            );
          }

          if (
            sortBy === "updated"
          ) {
            return (
              getUpdatedTime(b) -
              getUpdatedTime(a)
            );
          }

          if (
            sortBy === "name-asc"
          ) {
            return String(
              a.name || "",
            ).localeCompare(
              String(
                b.name || "",
              ),
            );
          }

          if (
            sortBy === "name-desc"
          ) {
            return String(
              b.name || "",
            ).localeCompare(
              String(
                a.name || "",
              ),
            );
          }

          return (
            getCreatedTime(b) -
            getCreatedTime(a)
          );
        },
      );
    }, [
      permissions,
      search,
      statusFilter,
      sortBy,
    ]);

  /* =========================================================
     PAGINATION
     ========================================================= */

  const totalEntries = filteredPermissions.length;

const totalPages = Math.max(
  1,
  Math.ceil(totalEntries / pageSize)
);

const startIndex = (currentPage - 1) * pageSize;

const endIndex = Math.min(
  startIndex + pageSize,
  totalEntries
);

const paginatedPermissions = filteredPermissions.slice(
  startIndex,
  endIndex
);

  useEffect(() => {
  const pages = Math.max(
    1,
    Math.ceil(filteredPermissions.length / pageSize)
  );

  if (currentPage > pages) {
    setCurrentPage(pages);
  }
}, [filteredPermissions.length, currentPage, pageSize]);

  /* =========================================================
     DATE FORMAT
     ========================================================= */

  const formatPermissionDate = (
    value,
  ) => {
    if (!value) {
      return {
        date: "—",
        time: "",
      };
    }

    const parsedDate =
      new Date(value);

    if (
      Number.isNaN(
        parsedDate.getTime(),
      )
    ) {
      return {
        date: "—",
        time: "",
      };
    }

    return {
      date:
        parsedDate.toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          },
        ),

      time:
        parsedDate.toLocaleTimeString(
          "en-US",
          {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          },
        ),
    };
  };

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="feature-permissions-page">
      {/* =====================================================
          PAGE HEADER
          ===================================================== */}

      <div className="fp-page-head">
        <div className="fp-title-wrap">
          <div>
            <h1>
              Feature Permissions
            </h1>

            <p>
              Manage permissions for PCH features.
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================
          PERMISSION INFORMATION CARD
          ===================================================== */}

      <section className="fp-info-card">
        <div className="fp-info-top">
          <div className="fp-info-heading">
            <div className="fp-info-icon">
              <i className="bi bi-key" />
            </div>

            <div>
              <h2>
                {isEditing
                  ? "Edit Permission"
                  : "Add Permission"}
              </h2>

              <p>
                Enter the permission details.
              </p>
            </div>
          </div>
        </div>

        {/* ===================================================
            FORM
            =================================================== */}

  
<form
  autoComplete="off"
  onSubmit={(event) => {
    event.preventDefault();
    savePermission();
  }}
>
  <div className="fp-form-grid">
    {/* =================================================
        PERMISSION CODE
        ================================================= */}

    <div
      className={`fp-field${
        errors.key ? " fp-field-invalid" : ""
      }`}
    >
      <label htmlFor="permission-key">
        Permission Code
      </label>

<input
  id="permission-key"
  type="text"
  value=""
  readOnly
  disabled
  autoComplete="off"
  placeholder="Auto Generated"
  aria-invalid={Boolean(errors.key)}
/>

{errors.key && (
  <p className="fp-field-error">
    {errors.key}
  </p>
)}
    </div>

    {/* =================================================
        FEATURE
        ================================================= */}

    <div
      className={`fp-field${
        errors.featureId ? " fp-field-invalid" : ""
      }`}
    >
      <label htmlFor="permission-feature">
        Feature
        <span>*</span>
      </label>

      <div className="fp-select-wrap">
        <select
          id="permission-feature"
          name="featureId"
          value={form.featureId}
          onChange={handleFeatureChange}
          autoComplete="off"
          aria-invalid={Boolean(errors.featureId)}
        >
          <option value="">
            Select Feature
          </option>

          {availableFeatures.map((feature) => (
            <option
              key={feature.id}
              value={feature.id}
            >
              {feature.name}
            </option>
          ))}
        </select>

        <i className="bi bi-chevron-down" />
      </div>

      {errors.featureId && (
        <p className="fp-field-error">
          {errors.featureId}
        </p>
      )}
    </div>

    {/* =================================================
        PERMISSION NAME
        ================================================= */}

    <div
  className={`fp-field${
    errors.name ? " fp-field-invalid" : ""
  }`}
>
  <label htmlFor="permission-name">
    Permission Name
    <span>*</span>
  </label>

  <input
    id="permission-name"
    type="text"
    name="name"
    value={featurePermission}
    onChange={handlePermissionChange}
    autoComplete="off"
    placeholder="Enter permission name"
    aria-invalid={Boolean(errors.name)}
  />

  {errors.name && (
    <p className="fp-field-error">
      {errors.name}
    </p>
  )}
</div>

    {/* =================================================
        DESCRIPTION
        ================================================= */}

    <div className="fp-field fp-description-field">
      <label htmlFor="permission-description">
        Description
      </label>

      <textarea
        id="permission-description"
        data-field="description"
        value={form.description}
        onChange={updateField}
        onInput={(event) => {
          event.currentTarget.style.height = "44px";
          event.currentTarget.style.height = `${Math.max(
            44,
            event.currentTarget.scrollHeight
          )}px`;
        }}
        autoComplete="off"
        placeholder="Describe what this permission allows."
        rows={1}
      />
    </div>

    {/* =================================================
        STATUS
        ================================================= */}

    
<div className="fp-field">
  <label htmlFor="permission-status">
    Status
    <span>*</span>
  </label>

  <div className="fp-select-wrap">
    <select
      className={`fp-form-status-select ${
        form.status === "Active"
          ? "active"
          : form.status === "Inactive"
          ? "inactive"
          : ""
      }`}
      id="permission-status"
      name="status"
      value={form.status}
      onChange={updateField}
      autoComplete="off"
      aria-invalid={Boolean(errors.status)}
    >
      <option value="Select Status">
        Select Status
      </option>

      <option value="Active">
        Active
      </option>

      <option value="Inactive">
        Inactive
      </option>
    </select>

    <i className="bi bi-chevron-down" />
  </div>

  {errors.status && (
    <p className="fp-field-error">
      {errors.status}
    </p>
  )}
</div>

  </div>

  {/* =================================================
      FORM ACTIONS
      ================================================= */}

  <div className="fp-form-actions">
    <button
      type="button"
      className="fp-btn fp-btn-secondary"
      onClick={clearForm}
    >
      Cancel
    </button>

    <button
      type="submit"
      className="fp-btn fp-btn-primary"
      disabled={!canSubmit}
    >
      {isEditing
        ? "Update Permission"
        : "Add Permission"}
    </button>
  </div>
</form>


      </section>

      {/* =====================================================
          PERMISSIONS LIST
          ===================================================== */}

      <section className="fp-list-card">
        <div className="fp-list-toolbar">
          <h2>
            Permissions List
          </h2>

          <div className="fp-list-filters pch-master-toolbar pch-master-control">
            {/* SEARCH */}

            <div className="fp-search pch-master-search pch-master-control">
              <i className="bi bi-search" />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                autoComplete="off"
                placeholder="Search permissions..."
              />
            </div>

            {/* STATUS FILTER */}

            <div className="fp-status-filter">
              <FilterDropdown preserveToolbarLayout
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value,
                  )
                }
                autoComplete="off"
              >
                <option value="All Statuses">
                  All Statuses
                </option>

                <option value="Active">
                  Active
                </option>

                <option value="Inactive">
                  Inactive
                </option>
              </FilterDropdown>

              <i className="bi bi-chevron-down" />
            </div>

            {/* SORTING FILTER */}

            <div className="fp-sort-filter">
              <FilterDropdown preserveToolbarLayout
                value={sortBy}
                onChange={(event) =>
                  setSortBy(
                    event.target.value,
                  )
                }
                autoComplete="off"
                aria-label="Sort permissions"
              >
                <option value="newest">
                  Newest First
                </option>

                <option value="oldest">
                  Oldest First
                </option>

                <option value="updated">
                  Recently Updated
                </option>

                <option value="name-asc">
                  Name A-Z
                </option>

                <option value="name-desc">
                  Name Z-A
                </option>
              </FilterDropdown>

              <i className="bi bi-chevron-down" />
            </div>

            {/* RESET FILTER */}

            <button
              type="button"
              className="fp-reset-btn pch-master-reset pch-master-control"
              title="Reset filters"
              aria-label="Reset filters"
              onClick={
                resetFilters
              }
            >
              <i className="bi bi-arrow-counterclockwise" />
            </button>
          </div>
        </div>

        {/* ===================================================
            TABLE
            =================================================== */}

        <div className="fp-table-wrap">
          <table className="fp-table">
            <colgroup>
              <col className="fp-col-key" />
              <col className="fp-col-name" />
              <col className="fp-col-feature" />
              <col className="fp-col-description" />
              <col className="fp-col-status" />
              <col className="fp-col-created" />
              <col className="fp-col-updated" />
              <col className="fp-col-actions" />
            </colgroup>

            <thead>
              <tr>
                <th>
                  Permission Code
                </th>

                <th>
                  Permission Name
                </th>

                <th>
                  Feature Name
                </th>

                <th>
                  Description
                </th>

                <th>
                  Status
                </th>

                <th>
                  Created At
                </th>

                <th>
                  Updated At
                </th>

                <th>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedPermissions.map(
                (permission) => (   
                
                 <tr
                  key={permission.id}
                   className="fp-row-clickable"
                   onClick={() =>
                    navigate(
                         `/features/${permission.featureId}/permissions/${permission.id}`,
                            {
                        state: { permission },
                               })}>
                    {/* Server-generated Permission Code */}

                    <td className="fp-permission-code-cell">
                      {String(
                        permission.key ||
                          "—",
                      ).toUpperCase()}
                    </td>

                    {/* Permission Name */}

                    <td>
                      {
                        permission.name
                      }
                    </td>

                    {/* Feature Name */}

                    <td>
                      {
                        permission.featureName
                      }
                    </td>

                    {/* Description */}

                    <PermissionDescriptionCell
                      description={
                        permission.description
                      }
                    />

                    {/* Status */}

                    <td>
                      <span
                        className={`fp-status-pill ${permission.status.toLowerCase()}`}
                      >
                        <b />

                        {
                          permission.status
                        }
                      </span>
                    </td>

                    {/* Created At */}

                    <td className="fp-date-cell">
                      {(() => {
                        const created =
                          formatPermissionDate(
                            permission.createdAt,
                          );

                        return (
                          <div className="fp-date-stack">
                            <span className="fp-date-value">
                              {
                                created.date
                              }
                            </span>

                            {created.time && (
                              <span className="fp-time-value">
                                {
                                  created.time
                                }
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Updated At */}

                    <td className="fp-date-cell">
                      {(() => {
                        const updated =
                          formatPermissionDate(
                            permission.updatedAt,
                          );

                        return (
                          <div className="fp-date-stack">
                            <span className="fp-date-value">
                              {
                                updated.date
                              }
                            </span>

                            {updated.time && (
                              <span className="fp-time-value">
                                {
                                  updated.time
                                }
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Actions */}

                    <td>
                      <div className="fp-row-actions feature-row-actions">
                        {/* EDIT */}

                        <button
                          type="button"
                          className="edit edit-button"
                          aria-label={`Edit ${permission.name}`}
                          title="Edit permission"
                         onClick={(event) => {
                            event.stopPropagation();
                                editPermission(permission);
                               }}
                        >
                          <i className="bi bi-pencil" />
                        </button>

                        {/* DELETE */}

                        <button
                          type="button"
                          className="delete delete-button"
                          aria-label={`Deactivate ${permission.name}`}
                          disabled={permission.status === "Inactive"}
                          title={permission.status === "Inactive" ? "Already inactive" : "Deactivate permission"}
                          onClick={(event) => {
                              event.stopPropagation();
                              openDeleteConfirmation(permission);
                               }}
                        >
                          <i className="bi bi-trash3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>

          {loading && (
            <div className="fp-table-loading">
              Loading permissions...
            </div>
          )}

          {!loading &&
            paginatedPermissions.length ===
              0 && (
              <div className="fp-table-empty">
                No permissions found.
              </div>
            )}
        </div>

        {/* ===================================================
            TABLE FOOTER
            =================================================== */}

        
<div className="fp-list-footer">
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
    itemLabel="permissions"
  />
</div>

      </section>

      {/* =====================================================
          DELETE MODAL
          ===================================================== */}

      {permissionToDelete && (
        <div
          className="fp-delete-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeDeleteConfirmation();
            }
          }}
        >
          <div
            className="fp-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fp-delete-modal-title"
          >
            <div className="fp-delete-modal-icon">
              <i className="bi bi-trash3" />
            </div>

            <h2 id="fp-delete-modal-title">
              Deactivate Permission?
            </h2>

            <p className="fp-delete-modal-message">
              Are you sure you want to mark{" "}
              <strong>
                {permissionToDelete.name ||
                  permissionToDelete.key ||
                  "this permission"}
              </strong>
              as inactive?
            </p>

            <p className="fp-delete-modal-warning">
              The permission will remain in the list with Inactive status.
            </p>

            <div className="fp-delete-modal-actions">
              <button
                type="button"
                className="fp-delete-cancel-btn"
                onClick={
                  closeDeleteConfirmation
                }
                disabled={
                  isDeleting
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="fp-delete-confirm-btn"
                onClick={
                  confirmDeletePermission
                }
                disabled={
                  isDeleting
                }
              >
                {isDeleting
                  ? "Deactivating..."
                  : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
