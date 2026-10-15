import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { roleTemplatesApi } from "../api/roleTemplatesApi";
import { listFeaturePermissions } from "../api/featurePermissionsApi";

const readFeatureList = (response) => {
  const candidates = [
    response?.features,
    response?.data?.features,
    response?.data?.data,
    response?.data?.items,
    response?.data?.results,
    response?.data,
    response?.items,
    response?.results,
    response,
  ];

  return candidates.find((value) => Array.isArray(value)) || [];
};

const getSelectedStoreTypeIds = (response) => {
  const candidates = [response?.storeTypes, response?.data?.storeTypes, response?.data?.data, response?.data?.items, response?.data?.results, response?.data, response?.items, response?.results, response];
  const entries = candidates.find((value) => Array.isArray(value)) || [];
  return entries.filter((item) => {
    const storeType = item?.storeType ?? item ?? {};
    return Boolean(item?.checked ?? storeType.checked ?? item?.mapped ?? item?.isAssigned ?? item?.is_assigned ?? false);
  }).map((item) => {
    const storeType = item?.storeType ?? item ?? {};
    return item?.storeTypeId ?? item?.store_type_id ?? storeType.id ?? item?.id;
  }).filter(Boolean);
};

const readAccessFlag = (...values) => {
  const value = values.find((item) => item !== undefined && item !== null);

  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
};

const normalizePermission = (permission, featureId, permissionIndex) => {
  const permissionRecord = permission?.permission ?? permission ?? {};
  const permissionAssignment =
    permission?.permissionAccess ??
    permission?.roleTemplatePermission ??
    permission?.assignment ??
    permission?.data ??
    {};
  const backendPermissionId =
    permission?.permissionId ??
    permission?.permission_id ??
    permissionRecord.permissionId ??
    permissionRecord.permission_id ??
    permissionRecord.id ??
    permission?.id ??
    permissionRecord.uuid;
  const permissionId = backendPermissionId;

  return {
    id: permissionId ? String(permissionId) : "",
    key: permissionId ? String(permissionId) : `${featureId}-permission-row-${permissionIndex}`,
    backendId: backendPermissionId ? String(backendPermissionId) : "",
    name:
      permissionRecord.name ??
      permissionRecord.permissionName ??
      permission?.name ??
      permission?.permissionName ??
      permissionRecord.label ??
      permissionRecord.permissionKey ??
      permissionRecord.key ??
      "Permission",
    code:
      permissionRecord.code ??
      permissionRecord.permissionCode ??
      permission?.code ??
      permission?.permissionCode ??
      permissionRecord.permissionKey ??
      permissionRecord.key ??
      permissionRecord.name ??
      "PERMISSION",
    checked: readAccessFlag(
      permissionAssignment?.assigned,
      permissionAssignment?.isAssigned,
      permissionAssignment?.hasAccess,
      permissionAssignment?.isEnabled,
      permission?.assigned,
      permissionRecord?.assigned,
      permission?.isAssigned,
      permissionRecord?.isAssigned,
      permission?.hasAccess,
      permissionRecord?.hasAccess,
      permission?.isEnabled,
      permissionRecord?.isEnabled,
      permission?.checked,
      permissionRecord?.checked,
      permission?.enabled,
      permissionRecord?.enabled,
      permission?.mapped,
      permissionRecord?.mapped,
      permission?.defaultAllowed,
      permissionRecord?.defaultAllowed,
      permission?.defaultEnabled,
      permissionRecord?.defaultEnabled
    ),
  };
};

const normalizeFeature = (feature, featureIndex) => {
  const featureRecord = feature?.feature ?? feature ?? {};
  const featureAssignment =
    feature?.featureAccess ??
    feature?.roleTemplateFeature ??
    feature?.assignment ??
    feature?.data ??
    {};
  const backendFeatureId =
    feature?.featureId ??
    feature?.feature_id ??
    featureRecord.featureId ??
    featureRecord.feature_id ??
    featureRecord.id ??
    feature?.id;
  const featureId = backendFeatureId ?? `feature-${featureIndex}`;

  const permissions = Array.isArray(feature?.permissions)
    ? feature.permissions
    : Array.isArray(featureRecord?.permissions)
      ? featureRecord.permissions
      : [];

  return {
    id: String(featureId),
    backendId: backendFeatureId ? String(backendFeatureId) : "",
    name:
      featureRecord.name ??
      feature?.name ??
      featureRecord.featureName ??
      "Feature",
    code:
      featureRecord.code ??
      featureRecord.featureCode ??
      feature?.code ??
      feature?.featureCode ??
      featureRecord.featureKey ??
      feature?.featureKey ??
      "FEATURE",
    description:
      featureRecord.description ??
      feature?.description ??
      "",
    status: String(featureRecord.status ?? feature?.status ?? "ACTIVE").toUpperCase(),
    checked: readAccessFlag(
      featureAssignment?.assigned,
      featureAssignment?.isAssigned,
      featureAssignment?.hasAccess,
      featureAssignment?.isEnabled,
      feature?.assigned,
      featureRecord?.assigned,
      feature?.isAssigned,
      featureRecord?.isAssigned,
      feature?.hasAccess,
      featureRecord?.hasAccess,
      feature?.isEnabled,
      featureRecord?.isEnabled,
      feature?.checked,
      featureRecord?.checked,
      feature?.enabled,
      featureRecord?.enabled,
      feature?.mapped,
      featureRecord?.mapped,
      feature?.defaultEnabled,
      featureRecord?.defaultEnabled
    ),
    permissions: permissions.map((permission, index) =>
      normalizePermission(permission, featureId, index)
    ),
  };
};

export default function ViewRoleTemplateAccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roleId } = useParams();
  const roleTemplate = {
    ...(location.state?.roleTemplate ?? {}),
  };
  const storeTypeIdsFromNavigation = Array.isArray(location.state?.selectedStoreTypes)
    ? location.state.selectedStoreTypes.filter(Boolean)
    : [location.state?.storeType?.id ?? location.state?.storeTypeId].filter(Boolean);
  const [featurePermissions, setFeaturePermissions] = useState([]);
  const [search, setSearch] = useState("");
  const [enabledFeatures, setEnabledFeatures] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [pendingFeatureChecks, setPendingFeatureChecks] = useState({});
  const [pendingPermissionChecks, setPendingPermissionChecks] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingFeatureId, setSavingFeatureId] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRoleFeatureAccess() {
      setLoading(true);
      setError("");

      try {
        let selectedStoreTypeIds = storeTypeIdsFromNavigation;
        if (selectedStoreTypeIds.length === 0) {
          const storeTypesResponse = await roleTemplatesApi.getAvailableStoreTypes(roleId);
          selectedStoreTypeIds = getSelectedStoreTypeIds(storeTypesResponse);
        }

        if (selectedStoreTypeIds.length === 0) {
          if (!cancelled) {
            setFeaturePermissions([]);
            setEnabledFeatures([]);
            setSelectedPermissions([]);
          }
          return;
        }

        const response = await roleTemplatesApi.getFeatures(roleId, selectedStoreTypeIds);
        const selectedStoreTypeSet = new Set(selectedStoreTypeIds.map(String));
        const scopedFeatures = readFeatureList(response).filter((rawFeature) => {
          const applicableStoreTypeIds = rawFeature?.storeTypeIds ?? rawFeature?.store_type_ids ?? rawFeature?.feature?.storeTypeIds ?? rawFeature?.feature?.store_type_ids;
          return !Array.isArray(applicableStoreTypeIds) || applicableStoreTypeIds.some((id) => selectedStoreTypeSet.has(String(id)));
        });
        const features = await Promise.all(scopedFeatures.map(async (rawFeature, index) => {
          const normalized = normalizeFeature(rawFeature, index);
          if (normalized.permissions.length > 0 || !normalized.backendId) return normalized;
          try {
            const permissions = await listFeaturePermissions(normalized.backendId, { status: "ACTIVE" });
            return {
              ...normalized,
              permissions: permissions
                .filter((permission) => {
                  if (String(permission.status ?? "ACTIVE").toUpperCase() === "INACTIVE") return false;
                  const applicableStoreTypeIds = permission?.storeTypeIds ?? permission?.store_type_ids;
                  return !Array.isArray(applicableStoreTypeIds) || applicableStoreTypeIds.some((id) => selectedStoreTypeSet.has(String(id)));
                })
                .map((permission, permissionIndex) => normalizePermission(permission, normalized.id, permissionIndex)),
            };
          } catch {
            return normalized;
          }
        }));

        if (!cancelled) {
          setFeaturePermissions(features);
          setEnabledFeatures(
            features.filter((feature) => Boolean(feature.checked)).map((feature) => feature.id)
          );
          setSelectedPermissions(
            features.flatMap((feature) =>
              feature.permissions
                .filter((permission) => Boolean(permission.checked))
                .map((permission) => permission.id)
            )
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError?.message || "Unable to load feature access.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRoleFeatureAccess();

    return () => {
      cancelled = true;
    };
  }, [roleId, JSON.stringify(storeTypeIdsFromNavigation)]);

  const tabs = [
    ["overview", "Overview", `/role-templates/${roleId}`],
    ["store-types", "Applicable Store Types", `/role-templates/${roleId}/store-types`],
    ["access", "Feature & Permission Access", `/role-templates/${roleId}/access`],
  ];

  const filteredFeatures = useMemo(() => {
    const query = search.trim().toLowerCase();

    return featurePermissions.filter((feature) => {
      const permissionText = feature.permissions
        .map((permission) => `${permission.name} ${permission.code}`)
        .join(" ");

      return `${feature.name} ${feature.description} ${permissionText}`
        .toLowerCase()
        .includes(query);
    });
  }, [featurePermissions, search]);

  function getBackendFeatureIds(featureIds) {
    return featureIds
      .map((featureId) => featurePermissions.find((feature) => feature.id === featureId)?.backendId)
      .filter(Boolean);
  }

  function getBackendPermissionIds(permissionIds) {
    return permissionIds
      .map((permissionId) =>
        featurePermissions
          .flatMap((feature) => feature.permissions)
          .find((permission) => permission.id === permissionId)?.backendId
      )
      .filter(Boolean);
  }

  async function toggleFeature(featureId) {
    const isEnabled = enabledFeatures.includes(featureId);
    const feature = featurePermissions.find((item) => item.id === featureId);
    if (feature?.status === "INACTIVE") return;
    setHasUnsavedChanges(true);

    if (!isEnabled) {
      const permissionIds = feature?.permissions
        .map((permission) => permission.backendId)
        .filter(Boolean);

      const featureBackendId = feature?.backendId;

      if (!featureBackendId || !permissionIds.length) {
        setError("This feature must have valid permission IDs before it can be enabled.");
        return;
      }

      setPendingFeatureChecks((current) => ({ ...current, [featureId]: true }));

      setSavingFeatureId(featureId);
      setError("");

      try {
        const nextEnabledFeatures = [...enabledFeatures, featureId];
        const nextSelectedPermissions = [
          ...new Set([
            ...selectedPermissions,
            ...feature.permissions.filter((permission) => permission.backendId).map((permission) => permission.id),
          ]),
        ];

        await roleTemplatesApi.addFeaturePermissions(
          roleId,
          getBackendFeatureIds(nextEnabledFeatures),
          getBackendPermissionIds(nextSelectedPermissions)
        );
        setEnabledFeatures(nextEnabledFeatures);
        setSelectedPermissions(nextSelectedPermissions);
      } catch (requestError) {
        setError(requestError?.message || "Unable to enable feature access.");
      } finally {
        setPendingFeatureChecks((current) => {
          const next = { ...current };
          delete next[featureId];
          return next;
        });
        setSavingFeatureId(null);
      }
      return;
    }

    setSavingFeatureId(featureId);
    setError("");
    setPendingFeatureChecks((current) => ({ ...current, [featureId]: false }));

    try {
      if (!feature?.backendId) {
        throw new Error("This feature has no valid backend ID and cannot be removed.");
      }

      await roleTemplatesApi.removeFeaturePermissions(roleId, [feature.backendId]);
      setEnabledFeatures((current) => current.filter((item) => item !== featureId));
      setSelectedPermissions((current) =>
        current.filter(
          (permissionId) =>
            !featurePermissions
              .find((feature) => feature.id === featureId)
              ?.permissions.some((permission) => permission.id === permissionId)
        )
      );
    } catch (requestError) {
      setError(requestError?.message || "Unable to remove feature access.");
    } finally {
      setPendingFeatureChecks((current) => {
        const next = { ...current };
        delete next[featureId];
        return next;
      });
      setSavingFeatureId(null);
    }
  }

  async function togglePermission(featureId, permissionId) {
    const feature = featurePermissions.find((item) => item.id === featureId);
    if (feature?.status === "INACTIVE") return;
    setHasUnsavedChanges(true);

    if (!selectedPermissions.includes(permissionId)) {
      const permission = feature?.permissions.find((item) => item.id === permissionId);
      const featureBackendId = feature?.backendId;
      const permissionBackendId = permission?.backendId;

      if (!featureBackendId || !permissionBackendId) {
        setError("This permission has no valid backend ID and cannot be enabled.");
        return;
      }

      setPendingPermissionChecks((current) => ({ ...current, [permissionId]: true }));
      setPendingFeatureChecks((current) => ({ ...current, [featureId]: true }));

      setSavingFeatureId(featureId);
      setError("");

      try {
        await roleTemplatesApi.addFeaturePermissions(
          roleId,
          getBackendFeatureIds(
            enabledFeatures.includes(featureId)
              ? enabledFeatures
              : [...enabledFeatures, featureId]
          ),
          getBackendPermissionIds([...selectedPermissions, permissionId])
        );
        setSelectedPermissions((current) => [...new Set([...current, permissionId])]);
        setEnabledFeatures((current) =>
          current.includes(featureId) ? current : [...current, featureId]
        );
      } catch (requestError) {
        setError(requestError?.message || "Unable to enable permission access.");
      } finally {
        setPendingPermissionChecks((current) => {
          const next = { ...current };
          delete next[permissionId];
          return next;
        });
        setPendingFeatureChecks((current) => {
          const next = { ...current };
          delete next[featureId];
          return next;
        });
        setSavingFeatureId(null);
      }
      return;
    }

    const remainingPermissionIds = selectedPermissions.filter(
      (item) => item !== permissionId
    );
    const featureHasSelectedPermissions = feature?.permissions.some((permission) =>
      remainingPermissionIds.includes(permission.id)
    );

    if (featureHasSelectedPermissions) {
      setPendingPermissionChecks((current) => ({ ...current, [permissionId]: false }));
      setSavingFeatureId(featureId);
      setError("");

      try {
        await roleTemplatesApi.addFeaturePermissions(
          roleId,
          getBackendFeatureIds(enabledFeatures),
          getBackendPermissionIds(remainingPermissionIds)
        );
        setSelectedPermissions(remainingPermissionIds);
      } catch (requestError) {
        setError(requestError?.message || "Unable to remove permission access.");
      } finally {
        setPendingPermissionChecks((current) => {
          const next = { ...current };
          delete next[permissionId];
          return next;
        });
        setSavingFeatureId(null);
      }
      return;
    }

    setSavingFeatureId(featureId);
    setError("");
    setPendingPermissionChecks((current) => ({ ...current, [permissionId]: false }));
    setPendingFeatureChecks((current) => ({ ...current, [featureId]: false }));

    try {
      if (!feature?.backendId) {
        throw new Error("This feature has no valid backend ID and cannot be removed.");
      }

      await roleTemplatesApi.removeFeaturePermissions(roleId, [feature.backendId]);
      setSelectedPermissions(remainingPermissionIds);
      setEnabledFeatures((current) => current.filter((item) => item !== featureId));
    } catch (requestError) {
      setError(requestError?.message || "Unable to remove permission access.");
    } finally {
      setPendingPermissionChecks((current) => {
        const next = { ...current };
        delete next[permissionId];
        return next;
      });
      setPendingFeatureChecks((current) => {
        const next = { ...current };
        delete next[featureId];
        return next;
      });
      setSavingFeatureId(null);
    }
  }

 async function selectAll() {
  const activeFeatures = featurePermissions.filter((feature) => feature.status !== "INACTIVE");
  const hasInvalidAccessIds = activeFeatures.some((feature) => !feature.backendId || feature.permissions.length === 0 || feature.permissions.some((permission) => !permission.backendId));
  if (hasInvalidAccessIds) { setError("Every active feature must have valid permission IDs before all features can be enabled."); return; }
  const nextFeatureIds = activeFeatures.map((feature) => feature.id);
  const nextPermissionIds = activeFeatures.flatMap((feature) => feature.permissions.map((permission) => permission.id));
  setError("");
  try {
    await roleTemplatesApi.addFeaturePermissions(roleId, getBackendFeatureIds(nextFeatureIds), getBackendPermissionIds(nextPermissionIds));
    setEnabledFeatures(nextFeatureIds); setSelectedPermissions(nextPermissionIds); setHasUnsavedChanges(true);
  } catch (requestError) { setError(requestError?.message || "Unable to select all feature access."); }
}
async function clearAll() {
  setError("");
  try {
    await roleTemplatesApi.removeFeaturePermissions(roleId, getBackendFeatureIds(featurePermissions.map((feature) => feature.id)));
    setEnabledFeatures([]); setSelectedPermissions([]); setHasUnsavedChanges(true);
  } catch (requestError) { setError(requestError?.message || "Unable to clear feature access."); }
}

  function requestLeave() {
  if (hasUnsavedChanges) {
    setShowLeaveWarning(true);
    return;
  }

  navigate("/role-templates");
}

function discardAndLeave() {
  setShowLeaveWarning(false);
  setHasUnsavedChanges(false);
  navigate("/role-templates");
}

function saveAndLeave() {
  setShowLeaveWarning(false);
  setHasUnsavedChanges(false);

  navigate(`/role-templates/${roleId}`, {
    state: { roleTemplate },
  });
}

  return (
    <section className="role-details-page">
      <button
  type="button"
  className="role-details-back"
  onClick={requestLeave}
  aria-label="Back to role templates"
>
  <i className="bi bi-arrow-left" />
</button>

      <div className="role-details-heading">
        <div>
          <h1>{roleTemplate.name || "Role Template"}</h1>
          <p>Configure store types, features and permissions for this role.</p>
        </div>

        <span className="role-details-active">
          <i className="bi bi-circle-fill" />
          {roleTemplate.status || "Active"}
        </span>
      </div>

      <nav className="role-details-tabs">
        {tabs.map(([id, label, path]) => (
          <button
            type="button"
            key={id}
            className={id === "access" ? "active" : ""}
            onClick={() => {
  if (hasUnsavedChanges) {
    setShowLeaveWarning(true);
    return;
  }

  navigate(path, { state: { roleTemplate } });
}}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="role-details-card">
        <div className="role-details-card-title role-access-heading">
          <div className="role-access-title">
            <span>
              <i className="bi bi-grid-1x2" />
            </span>

            <div>
              <h2>Features & Permissions</h2>
              <p>
                Select the features and permissions included in this role template.
              </p>
            </div>
          </div>

          <div className="role-access-actions">
            <button type="button" onClick={selectAll}>Select All</button>
            <button type="button" onClick={clearAll}>Deselect All</button>
          </div>
        </div>

        <label className="role-access-search pch-master-search pch-master-control">
          <i className="bi bi-search" />

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search features or permissions..."
          />
        </label>

        {error && (
          <p className="role-error-message" role="alert">
            {error}
          </p>
        )}

        {loading && <p>Loading feature access...</p>}

        {!loading && (
          <>
            <p className="role-access-count">
              {enabledFeatures.length} Features selected ·{" "}
              {selectedPermissions.length} Permissions selected
            </p>

            {filteredFeatures.length === 0 ? (
              <div className="role-empty-state" style={{ padding: "24px", textAlign: "center", border: "1px dashed #cad1e6", borderRadius: "12px", color: "#53627b", background: "#f8faff" }}>
                <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
                  No feature permissions are assigned to this role template yet.
                </p>
                <small style={{ display: "block", marginTop: "8px" }}>
                  The backend returned an empty features list for this role template.
                </small>
              </div>
            ) : (
              <div className="role-feature-list">
                {filteredFeatures.map((feature) => {
                  const isEnabled = Object.prototype.hasOwnProperty.call(
                    pendingFeatureChecks,
                    feature.id,
                  )
                    ? pendingFeatureChecks[feature.id]
                    : enabledFeatures.includes(feature.id);

                  return (
                    <section className="role-feature-access-card" key={feature.id}>
                      <div className="role-feature-access-top">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          disabled={savingFeatureId === feature.id || feature.status === "INACTIVE"}
                          onChange={() => toggleFeature(feature.id)}
                        />

                        <span className="role-feature-access-icon">
                          <i className="bi bi-grid" />
                        </span>

                        <div>
                          <h3>
                            {feature.name} <small>{feature.code}</small>
                          </h3>
                          <p>{feature.description}</p>
                        </div>

                        <span className={isEnabled ? "role-enabled" : "role-disabled"}>
                          {isEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>

                      <div className="role-permissions-heading">
                        <strong>Permissions</strong>
                        <span>Available permissions for this feature</span>
                      </div>

                      <div className="role-permissions-grid">
                        {feature.permissions.length === 0 ? (
                          <div style={{ padding: "10px 0", color: "#53627b" }}>
                            No permissions configured for this feature.
                          </div>
                        ) : (
                          feature.permissions.map((permission) => (
                            <label
                              key={permission.key}
                              className={
                                Object.prototype.hasOwnProperty.call(
                                  pendingPermissionChecks,
                                  permission.id,
                                )
                                  ? pendingPermissionChecks[permission.id]
                                  : selectedPermissions.includes(permission.id)
                                  ? "selected"
                                  : ""
                              }
                            >
                              <input
                                type="checkbox"
                                checked={Object.prototype.hasOwnProperty.call(
                                  pendingPermissionChecks,
                                  permission.id,
                                )
                                  ? pendingPermissionChecks[permission.id]
                                  : selectedPermissions.includes(permission.id)}
                                disabled={savingFeatureId === feature.id || feature.status === "INACTIVE"}
                                onChange={() => togglePermission(feature.id, permission.id)}
                              />

                              <span>
                                <strong>{permission.name}</strong>
                                <small>{permission.code}</small>
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

<div className="role-details-actions">
  <button
    type="button"
    className="role-details-secondary-btn"
    onClick={requestLeave}
  >
    Cancel
  </button>

  <button
    type="button"
    className="role-details-primary-btn"
    onClick={saveAndLeave}
  >
    Save Changes
  </button>
</div>

{showLeaveWarning && (
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

      <h3 id="role-leave-title">Leave without saving?</h3>

      <p>
        You have changed feature or permission access. Do you want to save
        your changes before leaving?
      </p>

      <div className="role-leave-actions">
        <button
          type="button"
          className="role-leave-cancel-btn"
          onClick={() => setShowLeaveWarning(false)}
        >
          Keep Editing
        </button>

        <button
          type="button"
          className="role-leave-discard-btn"
          onClick={discardAndLeave}
        >
          Leave Anyway
        </button>

        <button
          type="button"
          className="role-leave-save-btn"
          onClick={saveAndLeave}
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
)}

          </>
        )}
      </section>
    </section>
  );
}
