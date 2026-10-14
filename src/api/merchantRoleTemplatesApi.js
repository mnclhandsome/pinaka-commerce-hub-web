import { api, pendingStoreRead } from "./http";

const readMerchantRoles = path => pendingStoreRead(`merchant-role-read:${path}`, () => api.get(path));

const unwrapList = (response, keys = ["roleTemplates", "items"]) => {
  const candidates = [response, response?.data, response?.result, response?.data?.data];
  for (const data of candidates) {
    if (!data) continue;
    if (Array.isArray(data)) return data;
    for (const key of keys) {
      if (Array.isArray(data[key])) return data[key];
    }
  }
  return [];
};

export const merchantRoleTemplatesApi = {
  /** Templates from subscription store type + selected flags. */
  getAvailable: (merchantId) =>
    readMerchantRoles(`/merchants/${encodeURIComponent(merchantId)}/role-templates/available`),

  list: (merchantId, status = "ACTIVE") =>
    readMerchantRoles(
      `/merchants/${encodeURIComponent(merchantId)}/role-templates${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),

  /** Replace checkbox selections. Body: { roleTemplateIds: string[] } */
  save: (merchantId, roleTemplateIds) =>
    api.put(`/merchants/${encodeURIComponent(merchantId)}/role-templates`, {
      roleTemplateIds: Array.isArray(roleTemplateIds) ? roleTemplateIds : [],
    }),

  getStoreTypes: (merchantId) =>
    readMerchantRoles(`/merchants/${encodeURIComponent(merchantId)}/store-types`),
};

export function readAvailableRoleTemplates(response) {
  const root = response?.data ?? response ?? {};
  const roleTemplates = unwrapList(root).map((item, index) => {
    const template = item.roleTemplate || item.template || item;
    const id = String(
      item.roleTemplateId || template.id || template._id || item.id || `role-template-${index}`,
    );
    return {
      id,
      roleCode: String(template.roleCode || template.code || item.roleCode || "").trim(),
      name: String(template.name || template.roleName || template.templateName || "Unnamed role").trim(),
      description: String(template.description || item.description || "").trim(),
      scopeType: String(template.scopeType || item.scopeType || "STORE"),
      status: String(template.status || item.status || "ACTIVE"),
      required: Boolean(item.required ?? template.required),
      defaultEnabled: Boolean(item.defaultEnabled ?? template.defaultEnabled),
      selected: Boolean(item.selected),
      storeTypeId: item.storeTypeId || null,
      storeTypeName: item.storeTypeName || null,
    };
  });

  const storeTypes = Array.isArray(root.storeTypes)
    ? root.storeTypes
    : Array.isArray(root.data?.storeTypes)
      ? root.data.storeTypes
      : [];

  return {
    storeTypes,
    roleTemplates,
    count: Number(root.count ?? roleTemplates.length) || roleTemplates.length,
  };
}
