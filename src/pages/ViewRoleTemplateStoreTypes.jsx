import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { roleTemplatesApi } from "../api/roleTemplatesApi";

function readStoreTypes(response) {
  const candidates = [
    response?.storeTypes,
    response?.data?.storeTypes,
    response?.data?.data,
    response?.data?.items,
    response?.data?.results,
    response?.data,
    response?.items,
    response?.results,
    response,
  ];

  return candidates.find((value) => Array.isArray(value)) || [];
}

function normalizeStoreTypeEntry(item) {
  const storeType = item?.storeType ?? item ?? {};
  const id = storeType.id ?? storeType._id ?? item?.storeTypeId ?? item?.id;

  if (!id) return null;

  return {
    ...storeType,
    id,
    name:
      storeType.name ??
      storeType.storeTypeName ??
      item?.name ??
      "Unnamed store type",
    code: storeType.code ?? storeType.storeTypeCode ?? item?.code ?? "",
    checked: Boolean(
      item?.checked ?? storeType.checked ?? item?.mapped ?? false,
    ),
  };
}
const getStateArray = (value) => (Array.isArray(value) ? value : []);
function readSavedStoreTypeIds(response) {
  const mappings = [response?.items, response?.data?.items].find(Array.isArray);
  if (!mappings) return null;

  return mappings
    .map((item) => item?.storeTypeId ?? item?.storeType?.id ?? item?.id)
    .filter((id) => typeof id === "string" && id.length > 0);
}

export default function ViewRoleTemplateStoreTypes() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roleId } = useParams();

  const roleTemplate = {
    ...(location.state?.roleTemplate ?? {}),
  };

  const initialSelectedStoreTypes = getStateArray(
    location.state?.selectedStoreTypes,
  );

  // Removed the static fallback data. Now initializes as an empty array.
  const [storeTypesList, setStoreTypesList] = useState([]);
  const [selectedStoreTypes, setSelectedStoreTypes] = useState(
    initialSelectedStoreTypes,
  );
  const [enabledFeatures, setEnabledFeatures] = useState(
    getStateArray(location.state?.enabledFeatures),
  );
  const [selectedPermissions, setSelectedPermissions] = useState(
    getStateArray(location.state?.selectedPermissions),
  );

  const [loading, setLoading] = useState(true);
  const [savingStoreTypeIds, setSavingStoreTypeIds] = useState([]);
  const [error, setError] = useState("");

  const [showLeavePopup, setShowLeavePopup] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  // This snapshot represents the last state received/saved for this screen.
  const [savedStoreTypes, setSavedStoreTypes] = useState(
    initialSelectedStoreTypes,
  );
  const selectedStoreTypesRef = useRef(initialSelectedStoreTypes);
  const savedStoreTypesRef = useRef(initialSelectedStoreTypes);
  const saveQueueRef = useRef(Promise.resolve());
  const queuedSaveCountRef = useRef(0);
  const saving = savingStoreTypeIds.length > 0;

  const tabs = [
    ["overview", "Overview", `/role-templates/${roleId}`],
    [
      "store-types",
      "Applicable Store Types",
      `/role-templates/${roleId}/store-types`,
    ],
    [
      "access",
      "Feature & Permission Access",
      `/role-templates/${roleId}/access`,
    ],
  ];

  useEffect(() => {
    let cancelled = false;

    async function loadStoreTypes() {
      setLoading(true);
      setError("");

      try {
        const response = await roleTemplatesApi.getAvailableStoreTypes(roleId);
        const items = readStoreTypes(response).map(normalizeStoreTypeEntry);

        if (!cancelled) {
          setStoreTypesList(items);
          const savedIds = items
            .filter((storeType) => Boolean(storeType.checked))
            .map((storeType) => storeType.id);
          setSelectedStoreTypes(savedIds);
          setSavedStoreTypes(savedIds);
          selectedStoreTypesRef.current = savedIds;
          savedStoreTypesRef.current = savedIds;
        }
      } catch (requestError) {
        if (!cancelled) {
          const errorBody = requestError?.body ?? requestError?.response?.data;
          const rawMessage =
            errorBody?.message ||
            errorBody?.errors?.[0]?.message ||
            errorBody?.error ||
            requestError?.message;
          const errMsg = Array.isArray(rawMessage)
            ? rawMessage.filter(Boolean).join(", ")
            : rawMessage || "Unable to load store types.";
          setError(errMsg);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStoreTypes();

    return () => {
      cancelled = true;
    };
  }, [roleId]);

  function toggleStoreType(id) {
    if (!roleId || savingStoreTypeIds.includes(id)) return;

    const currentSelection = selectedStoreTypesRef.current;
    const nextSelectedStoreTypes = currentSelection.includes(id)
      ? currentSelection.filter((item) => item !== id)
      : [...currentSelection, id];

    selectedStoreTypesRef.current = nextSelectedStoreTypes;
    setSelectedStoreTypes(nextSelectedStoreTypes);
    setSavingStoreTypeIds((current) => [...current, id]);
    setError("");

    queuedSaveCountRef.current += 1;
    saveQueueRef.current = saveQueueRef.current
      .catch(() => {})
      .then(async () => {
        const requestedSelection = selectedStoreTypesRef.current;
        let failed = false;

        try {
          const response = await roleTemplatesApi.bulkUpdateStoreTypes(
            roleId,
            requestedSelection,
          );
          const savedIds = readSavedStoreTypeIds(response) ?? requestedSelection;
          savedStoreTypesRef.current = savedIds;
          setSavedStoreTypes(savedIds);
        } catch (requestError) {
          failed = true;
          const errorBody = requestError?.body ?? requestError?.response?.data;
          const rawMessage =
            errorBody?.message ||
            errorBody?.errors?.[0]?.message ||
            errorBody?.error ||
            requestError?.message;
          const errorMessage = Array.isArray(rawMessage)
            ? rawMessage.filter(Boolean).join(", ")
            : rawMessage || "Unable to save store type selection.";
          setError(errorMessage);
        } finally {
          queuedSaveCountRef.current -= 1;
          setSavingStoreTypeIds((current) => current.filter((item) => item !== id));

          if (failed && queuedSaveCountRef.current === 0) {
            const savedIds = savedStoreTypesRef.current;
            selectedStoreTypesRef.current = savedIds;
            setSelectedStoreTypes(savedIds);
          }
        }
      });
  }

  function buildNavigationState() {
    return {
      roleTemplate,
      selectedStoreTypes,
      enabledFeatures,
      selectedPermissions,
    };
  }

  function navigateBackToOverview() {
    navigate(`/role-templates/${roleId || "store-manager"}`, {
      state: buildNavigationState(),
    });
  }

  function handleSaveAndContinue() {
    if (saving) return;
    setError("");

    if (selectedStoreTypes.length === 0) {
      setError("Please select at least one store type before continuing.");
      return;
    }

    setSavedStoreTypes(selectedStoreTypes);
    savedStoreTypesRef.current = selectedStoreTypes;

    navigate(`/role-templates/${roleId || "store-manager"}/access`, {
      state: buildNavigationState(),
    });

  }

  function hasUnsavedChanges() {
    return (
      JSON.stringify(selectedStoreTypes) !== JSON.stringify(savedStoreTypes)
    );
  }

  function handleBack() {
    if (hasUnsavedChanges()) {
      setPendingNavigation(() => navigateBackToOverview);
      setShowLeavePopup(true);
      return;
    }

    navigateBackToOverview();
  }

  function closeLeavePopup() {
    if (saving) return;

    setShowLeavePopup(false);
    setPendingNavigation(null);
  }

  function leaveWithoutSaving() {
    if (saving) return;

    setShowLeavePopup(false);

    if (pendingNavigation) {
      pendingNavigation();
    }

    setPendingNavigation(null);
  }

  function saveAndExit() {
    if (saving) return;
    if (selectedStoreTypes.length === 0) {
      setShowLeavePopup(false);
      setPendingNavigation(null);
      setError("Please select at least one store type before saving.");
      return;
    }

    // Front-end persistence until the role-configuration save API is connected.
    const configuration = {
      roleTemplateId: roleId,
      roleTemplate,
      enabledFeatures,
      selectedPermissions,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(
      "pinaka_role_template_configs",
      JSON.stringify(configuration),
    );

    setSavedStoreTypes(selectedStoreTypes);
    savedStoreTypesRef.current = selectedStoreTypes;
    setShowLeavePopup(false);

    if (pendingNavigation) {
      pendingNavigation();
    } else {
      navigateBackToOverview();
    }

    setPendingNavigation(null);
  }

  function handleTabNavigation(path) {
    navigate(path, {
      state: buildNavigationState(),
    });
  }

  return (
    <>
      <section className="role-details-page">
        <div className="role-details-top">
          <button
            type="button"
            className="role-details-back"
            onClick={handleBack}
            aria-label="Back to role template"
          >
            <i className="bi bi-arrow-left" />
          </button>

          <div className="role-details-heading">
            <div>
              <h1>{roleTemplate.name || "Role Template"}</h1>
              <p>
                Configure store types, features and permissions for this role.
              </p>
            </div>

            <span className="role-details-active">
              <i className="bi bi-circle-fill" />
              {roleTemplate.status || "Active"}
            </span>
          </div>
        </div>

        <nav className="role-details-tabs">
          {tabs.map(([id, label, path]) => (
            <button
              type="button"
              key={id}
              className={id === "store-types" ? "active" : ""}
              onClick={() => handleTabNavigation(path)}
            >
              {label}
            </button>
          ))}
        </nav>

        <section className="role-details-card">
          <div className="role-details-card-title">
            <span>
              <i className="bi bi-shop" />
            </span>

            <div>
              <h2>Applicable Store Types</h2>
              <p>
                Select the store types where this role template can be used.
              </p>
            </div>
          </div>

          {error && (
            <p className="role-error-message" role="alert">
              <i className="bi bi-exclamation-circle-fill" />
              {error}
            </p>
          )}

          <div className="role-store-types-grid">
            {loading && (
              <p className="role-loading-message">Loading store types...</p>
            )}

            {!loading && storeTypesList.length === 0 && (
              <p className="role-empty-message">No store types found.</p>
            )}

            {!loading &&
              storeTypesList.map((storeType) => {
                const storeTypeId =
                  storeType.id ?? storeType._id ?? storeType.storeTypeId;

                const storeTypeName =
                  storeType.name || storeType.storeTypeName || "Store Type";

                const storeTypeCode =
                  storeType.code || storeType.storeTypeCode || "";

                const isSelected = selectedStoreTypes.includes(storeTypeId);

                return (
                  <label
                    key={storeTypeId}
                    className={`role-store-type-option ${
                      isSelected ? "selected" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={savingStoreTypeIds.includes(storeTypeId)}
                      onChange={() => toggleStoreType(storeTypeId)}
                    />

                    <span>
                      <strong>{storeTypeName}</strong>
                      <small>{storeTypeCode}</small>
                    </span>
                  </label>
                );
              })}
          </div>

          <div className="role-selection-summary">
            <span>
              {selectedStoreTypes.length} store type
              {selectedStoreTypes.length === 1 ? "" : "s"} selected
            </span>
          </div>

          <div className="role-details-actions">
            <button
              type="button"
              className="role-details-secondary-btn"
              onClick={handleBack}
              disabled={saving}
            >
              Back
            </button>

            <button
              type="button"
              className="role-details-primary-btn"
              onClick={handleSaveAndContinue}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save & Continue"}
              
            </button>
          </div>
        </section>
      </section>

      {showLeavePopup && (
        <div
          className="role-leave-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-leave-title"
        >
          <div className="role-leave-modal">
            <div className="role-leave-icon">
              <i className="bi bi-exclamation-triangle" />
            </div>

            <h3 id="role-leave-title">Leave Configuration?</h3>

            <p>
              You have unsaved changes. Would you like to save your changes
              before leaving?
            </p>

            <div className="role-leave-actions">
              <button
                type="button"
                className="role-leave-cancel-btn"
                onClick={closeLeavePopup}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="role-leave-discard-btn"
                onClick={leaveWithoutSaving}
                disabled={saving}
              >
                Leave Without Saving
              </button>

              <button
                type="button"
                className="role-leave-save-btn"
                onClick={saveAndExit}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save & Exit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
