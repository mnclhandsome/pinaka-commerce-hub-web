import {
  ACTION_NAMES,
  MENU_ITEMS,
  actionsFor,
  defaultMenuKeys,
} from "../navigation/menuCatalog";

const ROUTE_RESOURCES = [
  ["/menu-permissions", "menu-permissions"],
  ["/feature-permissions", "feature-permissions"],
  ["/permissions", "feature-permissions"],
  ["/role-templates", "role-templates"],
  ["/store-types", "store-types"],
  ["/pos-configuration", "pos-configuration"],
  ["/cash-management", "cash-management"],
  ["/subscriptions", "subscriptions"],
  ["/merchants", "merchants"],
  ["/employees", "employees"],
  ["/features", "features"],
  ["/devices", "devices"],
  ["/vendors", "vendors"],
  ["/tenders", "tenders"],
  ["/orders", "orders"],
  ["/stores", "stores"],
  ["/plans", "plans"],
  ["/shifts", "shifts"],
  ["/attendance", "attendance"],
  ["/integrations", "integrations"],
  ["/synchronization", "synchronization"],
  ["/reconciliation", "reconciliation"],
  ["/notifications", "notifications"],
  ["/dashboard", "dashboard"],
];

export function principalFromUser(user) {
  const role = String(user?.role || user?.roleName || user?.roleCode || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (role.includes("SUPER")) {
    return { principalRole: "SUPER_ADMIN", roleTemplateId: null, locked: true };
  }
  if (role === "MERCHANT_EMPLOYEE" || user?.roleTemplateId) {
    return {
      principalRole: "MERCHANT_EMPLOYEE",
      roleTemplateId: user?.roleTemplateId ? String(user.roleTemplateId) : null,
      locked: false,
    };
  }
  if (role === "MERCHANT" || role === "MERCHANT_OWNER") {
    return { principalRole: "MERCHANT", roleTemplateId: null, locked: false };
  }
  if (role === "ADMIN") {
    return { principalRole: "ADMIN", roleTemplateId: null, locked: false };
  }
  return { principalRole: "SUPER_ADMIN", roleTemplateId: null, locked: true };
}

export function defaultGrants(principalRole) {
  return defaultMenuKeys(principalRole).map((menuKey) => ({
    menuKey,
    actions: [...actionsFor(menuKey)],
  }));
}

export function normalizeGrants(grants) {
  const byMenu = new Map();
  for (const grant of grants || []) {
    const menuKey = String(grant?.menuKey || "");
    const known = actionsFor(menuKey);
    if (!MENU_ITEMS.some((item) => item.key === menuKey)) continue;
    const actions = [...new Set((grant.actions || []).filter((action) => known.includes(action)))];
    if (actions.some((action) => action !== "view") && !actions.includes("view")) {
      actions.unshift("view");
    }
    if (actions.length) byMenu.set(menuKey, actions);
  }
  if (!byMenu.has("dashboard")) byMenu.set("dashboard", ["view"]);
  return [...byMenu.entries()].map(([menuKey, actions]) => ({ menuKey, actions }));
}

export function grantsFromResponse(response, principalRole) {
  if (Array.isArray(response?.grants) && response.grants.length) {
    return normalizeGrants(response.grants);
  }
  if (Array.isArray(response?.menuKeys) && response.menuKeys.length) {
    return normalizeGrants(
      response.menuKeys.map((menuKey) => ({
        menuKey,
        actions: actionsFor(menuKey),
      })),
    );
  }
  return defaultGrants(principalRole);
}

export function grantsToSet(grants) {
  const allowed = new Set();
  for (const grant of grants || []) {
    for (const action of grant.actions || []) {
      allowed.add(`${grant.menuKey}.${action}`);
    }
  }
  return allowed;
}

export function grantAllows(allowed, resource, action = "view") {
  if (!resource) return true;
  return allowed.has(`${resource}.${action}`);
}

export function sameGrants(left, right) {
  const a = grantsToSet(normalizeGrants(left));
  const b = grantsToSet(normalizeGrants(right));
  if (a.size !== b.size) return false;
  for (const code of a) if (!b.has(code)) return false;
  return true;
}

export function requiredAccess(pathname) {
  const match = ROUTE_RESOURCES
    .filter(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    .sort((left, right) => right[0].length - left[0].length)[0];
  if (!match) return null;

  let resource = match[1];
  if (pathname.includes("/employees")) resource = "employees";
  else if (pathname.includes("/devices")) resource = "devices";
  else if (pathname.includes("/stores")) resource = "stores";

  let action = "view";
  if (/\/(?:new|add)(?:\/|$)/.test(pathname)) action = "create";
  else if (/\/edit(?:\/|$)/.test(pathname) || pathname.includes("/configuration")) action = "update";

  const known = actionsFor(resource);
  if (!known.includes(action)) action = "view";
  return { resource, action };
}

export function emptyGrantMap() {
  return Object.fromEntries(MENU_ITEMS.map((item) => [item.key, []]));
}

export function grantsToMap(grants) {
  const map = emptyGrantMap();
  for (const grant of normalizeGrants(grants)) {
    map[grant.menuKey] = [...grant.actions];
  }
  return map;
}

export function mapToGrants(map) {
  return normalizeGrants(
    Object.entries(map)
      .filter(([, actions]) => actions?.length)
      .map(([menuKey, actions]) => ({ menuKey, actions })),
  );
}

export { ACTION_NAMES };
