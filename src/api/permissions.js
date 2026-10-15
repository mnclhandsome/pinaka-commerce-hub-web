import { api } from "./http";
import { endpoints } from "./endpoints";

const permissionFrom = (response) =>
  response?.permission ?? response?.data?.permission ?? response?.data ?? response;

const permissionsFrom = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.permissions)) return response.permissions;
  if (Array.isArray(response?.data?.permissions)) return response.data.permissions;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

export async function listPermissions(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const suffix = query.toString();
  const response = await api.get(suffix ? `${endpoints.permissions}?${suffix}` : endpoints.permissions);
  return permissionsFrom(response);
}

export async function getPermission(idOrKey) {
  if (!idOrKey) throw new Error("Permission ID or key is required");
  return permissionFrom(await api.get(endpoints.permission(encodeURIComponent(idOrKey))));
}

export async function createPermission(payload) {
  return permissionFrom(await api.post(endpoints.permissions, payload));
}

export async function updatePermission(idOrKey, payload) {
  if (!idOrKey) throw new Error("Permission ID or key is required");
  return permissionFrom(await api.put(endpoints.permission(encodeURIComponent(idOrKey)), payload));
}

export async function deletePermission(idOrKey) {
  if (!idOrKey) throw new Error("Permission ID or key is required");
  return api.delete(endpoints.permission(encodeURIComponent(idOrKey)));
}
