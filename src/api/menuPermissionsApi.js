import { api } from "./http";
import { endpoints } from "./endpoints";

export function getMenuPermissions(principalRole, roleTemplateId) {
  const params = new URLSearchParams({ principalRole });
  if (roleTemplateId) params.set("roleTemplateId", roleTemplateId);
  return api.get(`${endpoints.menuPermissions}?${params.toString()}`);
}

export function saveMenuPermissions({ principalRole, roleTemplateId, grants }) {
  const menuKeys = (grants || [])
    .filter((grant) => (grant.actions || []).includes("view"))
    .map((grant) => grant.menuKey);
  return api.put(endpoints.menuPermissions, {
    principalRole,
    roleTemplateId: roleTemplateId || null,
    grants,
    menuKeys,
  });
}
