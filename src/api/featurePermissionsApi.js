import { api, pendingStoreRead } from "./http";

const collectionPath = (featureId) => `/features/${encodeURIComponent(featureId)}/permissions`;
const itemPath = (featureId, permissionId) => `${collectionPath(featureId)}/${encodeURIComponent(permissionId)}`;

export const listFeaturePermissions = async (featureId, params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.set("status", String(params.status).toUpperCase());
  const suffix = query.toString() ? `?${query}` : "";
  const response = await pendingStoreRead(`feature-permissions:${featureId}:${suffix}`, () => api.get(`${collectionPath(featureId)}${suffix}`));
  const permissions = Array.isArray(response?.permissions)
    ? response.permissions
    : Array.isArray(response?.data?.permissions)
      ? response.data.permissions
      : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response?.result)
            ? response.result
      : Array.isArray(response)
        ? response
        : [];
  // Preserve the array API used by existing callers while exposing any
  // snake_case pagination metadata returned by the backend.
  permissions.pagination = response?.pagination || response?.data?.pagination || null;
  permissions.total_records = response?.total_records ?? response?.count ?? response?.pagination?.total_records ?? permissions.length;
  return permissions;
};

export const getFeaturePermissionById = async (featureId, permissionId) => {
  const response = await pendingStoreRead(`feature-permission:${featureId}:${permissionId}`, () => api.get(itemPath(featureId, permissionId)));
  return response?.permission || response?.data?.permission || response?.data || response;
};

export const createFeaturePermission = (featureId, payload) =>
  api.post(collectionPath(featureId), payload);

export const updateFeaturePermission = (featureId, permissionId, payload) =>
  api.put(itemPath(featureId, permissionId), payload);

export const deleteFeaturePermission = (featureId, permissionId) =>
  api.delete(itemPath(featureId, permissionId));

export const toggleFeaturePermissionStatus = (featureId, permissionId, status) =>
  api.patch(`${itemPath(featureId, permissionId)}/status`, { status: String(status).toUpperCase() });
