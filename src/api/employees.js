import { pendingStoreRead } from "./http";
import { api } from "./http";
import { endpoints } from "./endpoints";

// Keep UI camelCase values at the API boundary; employee HTTP fields are snake_case.
export function toEmployeeUpdatePayload(data) {
  const phone = data.phone ?? data.phoneNumber ?? data.phone_number ?? data.contactNo ?? data.contact_no ?? data.contactNumber ?? "";
  const temporaryPassword = data.password || data.temporaryPassword || data.temporary_password || "";
  const payload = {
    first_name: data.firstName?.trim() || "",
    last_name: data.lastName?.trim() || "",
    email: data.email?.trim() || "",
    phone: String(phone).trim(),
    gender: data.gender || "",
    address_line1: data.address1?.trim() || data.addressLine1?.trim() || "",
    address_line2: data.address2?.trim() || data.addressLine2?.trim() || "",
    city: data.city?.trim() || "",
    state: data.state?.trim() || "",
    postal_code: data.pinCode || data.postalCode || "",
    country: data.country || "India",
    username: data.username?.trim() || "",
    ...(data.status ? { status: data.status.toUpperCase() } : {}),
    ...(String(temporaryPassword).length > 0 ? { temporary_password: String(temporaryPassword) } : {}),
    ...(typeof data.sendCredentials === "boolean" ? { send_credentials: data.sendCredentials } : {}),
  };
  const dob = data.dob || data.dateOfBirth;
  if (dob) payload.date_of_birth = dob;
  if (data.employeeLoginPin || data.loginPin) payload.login_pin = data.employeeLoginPin || data.loginPin;
  return payload;
}

export function toEmployeePayload(data, assignments = []) {
  return {
    ...toEmployeeUpdatePayload(data),
    merchant_id: data.merchantId || data.merchant,
    status: String(data.status || "ACTIVE").toUpperCase(),
    ...(assignments.length ? { store_assignments: assignments.map(item => ({
      store: item.store,
      roles: item.roles || [],
      ...(item.loginPin ? { login_pin: item.loginPin } : {}),
    })) } : {}),
  };
}

function employeeBody(payload, image) {
  if (!image) return payload;
  const body = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) body.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  body.append("image", image);
  return body;
}

function normalizeEmployee(value) {
  if (Array.isArray(value)) return value.map(normalizeEmployee);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, field]) => [
    key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), normalizeEmployee(field),
  ]));
}

function employeeResponse(response) {
  const result = normalizeEmployee(response?.data || response);
  if (result?.employee) result.employee = mapEmployeeToRow(result.employee);
  return result;
}

export async function createEmployee(data, assignments = [], image) {
  return employeeResponse(await api.post(endpoints.employees, employeeBody(toEmployeePayload(data, assignments), image)));
}

export async function updateEmployee(employeeId, data, image) {
  const response = await api.put(
    endpoints.employee(employeeId),
    employeeBody(toEmployeeUpdatePayload(data), image),
  );
  const result = response?.data ?? response;
  if (result?.success === false) {
    throw new Error(result.message || result.error || "Unable to update employee.");
  }
  return employeeResponse(response);
}

export async function getEmployee(employeeId) {
  return employeeResponse(await pendingStoreRead(`employee:${employeeId}`, () => api.get(endpoints.employee(employeeId))));
}

export function deleteEmployee(employeeId) {
  return api.delete(endpoints.employee(employeeId));
}

function getFullImageUrl(url) {
  if (!url || /^(https?:|blob:|data:)/i.test(url)) return url || null;
  // Relative uploaded photos use the API host; local requests use the Vite proxy.
  const apiBase = import.meta.env.VITE_API_BASE_URL || "";
  const origin = import.meta.env.VITE_API_ORIGIN ||
    (/^https?:\/\//i.test(apiBase) ? new URL(apiBase).origin : "");
  return origin ? origin.replace(/\/$/, "") + "/" + url.replace(/^\//, "") : url;
}
 
/*
 * LIST EMPLOYEES
 */
function formatDate(value) {
  if (!value) return "—";
 
  const date = new Date(value);
 
  if (Number.isNaN(date.getTime())) return "—";
 
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
 
function formatRelative(value) {
  if (!value) return "—";
 
  const date = new Date(value);
 
  if (Number.isNaN(date.getTime())) return "—";
 
  const minutes = Math.max(
    0,
    Math.round((Date.now() - date.getTime()) / 60000),
  );
 
  if (minutes < 1) return "Just now";
 
  if (minutes < 60) {
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }
 
  const hours = Math.round(minutes / 60);
 
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
 
  return `${Math.round(hours / 24)} days ago`;
}
 
function toInitials(firstName, lastName, name) {
  const parts = [firstName, lastName].filter(Boolean);
 
  const label = parts.length ? parts.join(" ") : name || "Employee";
 
  return (
    label
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "E"
  );
}
 
export function mapEmployeeToRow(employee) {
  employee = normalizeEmployee(employee);
  const firstName = employee.firstName || "";
  const lastName = employee.lastName || "";
 
  const name = employee.name || `${firstName} ${lastName}`.trim() || "Employee";
 
  // Capture profile photo URL from backend response
  const profileImage =
    employee.profileImageUrl ||
    employee.profileImage ||
    employee.avatarUrl ||
    employee.image ||
    null;
 
  return {
    ...employee,
 
    initials: toInitials(firstName, lastName, name),

    profileImage: getFullImageUrl(profileImage),
    profileImageUrl: getFullImageUrl(profileImage),

    name,
 
    id: employee.id || employee.employeeCode || employee.employeeId || "—",
 
    email: employee.email || "—",
 
    phone: employee.phone || employee.phoneNumber || employee.phone_number || employee.contactNo || employee.contact_no || employee.contactNumber || "—",

    loginPin: employee.loginPin || employee.employeeLoginPin || employee.pin || "",
 
    role: employee.role || "—",
 
    merchant:
      employee.merchantName ||
      employee.merchant?.name ||
      employee.merchantId ||
      "—",
 
    store: employee.storeName || employee.store?.name || employee.store || "—",
 
    status:
      String(employee.status || "INACTIVE").toUpperCase() === "ACTIVE"
        ? "Active"
        : "Inactive",
 
    joined: formatDate(employee.createdAt || employee.joinedAt),
 
    active: formatRelative(employee.lastActiveAt || employee.updatedAt),
 
    avatar: "purple",
  };
}
 
function mapEmployeeList(data) {
  const listKeys = [
    "employees",
    "items",
    "results",
    "records",
    "content",
    "docs",
    "data",
  ];
  function findItems(value, depth = 0) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object" || depth > 4) return [];
    for (const key of listKeys) {
      const items = findItems(value[key], depth + 1);
      if (items.length) return items;
    }
    return [];
  }
  const items = findItems(data);
 
  return items
    .filter((item) => item && typeof item === "object")
    .map(mapEmployeeToRow);
}

export async function getEmployeeList() {
  const response = await pendingStoreRead("employee-list", () => api.get(endpoints.employees));
  return { employees: mapEmployeeList(response), statistics: response?.statistics ?? response?.data?.statistics ?? null };
}

export async function listEmployees() {
  return (await getEmployeeList()).employees;
}
 
export async function listMerchantEmployees(merchantId) {
  return mapEmployeeList(
    await api.get(endpoints.merchantEmployees(merchantId)),
  );
}
 
export async function listStoreEmployees(merchantId, storeId) {
  return api.get(endpoints.storeEmployees(merchantId, storeId));
}
 
export async function listStoreRolePermissions(merchantId, storeId) {
  return api.get(endpoints.storeRolePermissions(merchantId, storeId));
}
 
export async function saveStoreEmployees(merchantId, storeId, employees) {
  return api.put(endpoints.storeEmployees(merchantId, storeId), {
    employees: employees.map((employee) => ({
      // The deployed store API has existed with both camelCase and snake_case
      // assignment DTOs. Keep both aliases in sync at this boundary, and always
      // send IDs as strings so class-validator accepts numeric employee codes.
      employeeId: String(employee.employeeId ?? employee.employee_id ?? ""),
      employee_id: String(employee.employeeId ?? employee.employee_id ?? ""),
      ...(employee.roleTemplateId || employee.role_template_id
        ? {
            roleTemplateId: String(employee.roleTemplateId || employee.role_template_id),
            role_template_id: String(employee.roleTemplateId || employee.role_template_id),
          }
        : {}),
      ...(employee.loginPin || employee.login_pin
        ? {
            loginPin: String(employee.loginPin || employee.login_pin),
            login_pin: String(employee.loginPin || employee.login_pin),
          }
        : {}),
    })),
  });
}
// Photos use the employee update API, with exactly one multipart image field.
export async function uploadEmployeeProfileImage(employeeId, file) {
  return employeeResponse(await api.put(endpoints.employee(employeeId), employeeBody({}, file)));
}
 
export async function getEmployeeProfileImage(employeeId) {
  return getEmployee(employeeId);
}
 
export async function deleteEmployeeProfileImage(employeeId) {
  return employeeResponse(await api.put(endpoints.employee(employeeId), { profile_image_url: "" }));
}
