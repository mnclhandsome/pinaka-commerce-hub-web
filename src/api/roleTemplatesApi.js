import { api, pendingStoreRead } from "./http";

const readRoleTemplate = path => pendingStoreRead(`role-template-read:${path}`, () => api.get(path));

const unwrap = (response) => response?.data ?? response;

export const roleTemplatesApi = {
  getAll: () => readRoleTemplate("/role-templates"),

  assignToStoreType: (storeTypeId, values) =>
    api.post(
      `/store-types/${encodeURIComponent(storeTypeId)}/role-templates`,
      values,
    ),

  getForStoreType: (storeTypeId) =>
    readRoleTemplate(`/store-types/${encodeURIComponent(storeTypeId)}/role-templates`),

  removeFromStoreType: (storeTypeId, roleTemplateId) =>
    api.delete(
      `/store-types/${encodeURIComponent(storeTypeId)}/role-templates/${encodeURIComponent(roleTemplateId)}`,
    ),

  getById: (id) => readRoleTemplate(`/role-templates/${encodeURIComponent(id)}`),

  getAvailableStoreTypes: (id) =>
    readRoleTemplate(`/role-templates/${encodeURIComponent(id)}/store-types/available`),

  getFeatures: (id, storeTypeIds = []) => {
    const ids = Array.isArray(storeTypeIds)
      ? storeTypeIds.filter(Boolean).join(",")
      : String(storeTypeIds ?? "");

    const query = ids ? `?storeTypeIds=${encodeURIComponent(ids)}` : "";

    return readRoleTemplate(
      `/role-templates/${encodeURIComponent(id)}/features${query}`,
    );
  },

  bulkUpdateStoreTypes: (id, storeTypeIds) =>
    api.put(`/role-templates/${encodeURIComponent(id)}/store-types/bulk`, {
      storeTypeIds,
      replace: true,
    }),

  updateFeatureAccess: (id, featureAccess) =>
    api.put(
      `/role-templates/${encodeURIComponent(id)}/features`,
      featureAccess,
    ),

  removeFeaturePermissions: (id, featureIds) =>
    api.put(`/role-templates/${encodeURIComponent(id)}/permissions/bulk`, {
      removeFeatureIds: featureIds.filter(Boolean),
    }),

  addFeaturePermissions: (id, featureIds, permissionIds) =>
    api.put(`/role-templates/${encodeURIComponent(id)}/permissions/bulk`, {
      featureIds: featureIds.filter(Boolean),
      permissionIds: permissionIds.filter(Boolean),
    }),

  create: (values) => api.post("/role-templates", values),

  update: (id, values) =>
    api.put(`/role-templates/${encodeURIComponent(id)}`, values),

  patch: (id, values) =>
    api.patch(`/role-templates/${encodeURIComponent(id)}`, values),

  remove: (id) => api.delete(`/role-templates/${encodeURIComponent(id)}`),
};

export function readRoleTemplatesList(response) {
  const candidates = [
    response,
    response?.data,
    response?.result,
    response?.data?.data,
    response?.data?.result,
  ];

  for (const data of candidates) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.roleTemplates)) return data.roleTemplates;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.results)) return data.results;
  }

  throw new Error(
    "Unexpected role templates response. Expected an array or roleTemplates array.",
  );
}
