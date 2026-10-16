
import { api } from "./http";
import { endpoints } from "./endpoints";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function extractList(response, keys) {
  if (Array.isArray(response)) return response;

  const body = asObject(response);

  for (const containerValue of [body, body.data, body.result]) {
    const container = asObject(containerValue);

    for (const key of keys) {
      if (Array.isArray(container[key])) {
        return container[key];
      }
    }
  }

  return [];
}

export function normalizeEmployee(value) {
  const employee = asObject(value);
  const fullName = [
    employee.firstName,
    employee.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const code = String(
    employee.employeeCode ??
      employee.employee_code ??
      employee.code ??
      ""
  );

  return {
    ...employee,
    id: employee.id ?? employee.employeeId ?? code,
    employeeCode: code,
    name:
      fullName ||
      employee.employeeName ||
      employee.username ||
      "Employee",
    roleName:
      employee.roleName ||
      employee.role?.name ||
      employee.designation ||
      "Staff",
  };
}

export function normalizeAttendance(value) {
  const row = asObject(value);
  const employee = asObject(row.employee);

  const employeeCode = String(
    row.employeeCode ??
      row.employee_code ??
      employee.employeeCode ??
      employee.employee_code ??
      ""
  );

  const rawClockIn =
    row.clockIn ?? row.clock_in ?? row.clockInAt ?? null;

  const rawClockOut =
    row.clockOut ?? row.clock_out ?? row.clockOutAt ?? null;

  const clockIn = rawClockIn ? new Date(rawClockIn) : null;
  const clockOut = rawClockOut ? new Date(rawClockOut) : null;

  const status = String(row.status ?? "")
    .trim()
    .toUpperCase();

  const isOpen = Boolean(clockIn && !clockOut);

  return {
    id: String(
      row.id ??
        row.attendanceId ??
        `${employeeCode}-${rawClockIn ?? "attendance"}`
    ),
    employeeCode,
    employeeName:
      row.employeeName ??
      employee.employeeName ??
      employee.name ??
      "",
    clockIn,
    clockOut,
    status: isOpen
      ? "PRESENT"
      : status || (clockOut ? "COMPLETED" : "NOT_MARKED"),
    isOpen,
  };
}

// Fetch employees assigned to the selected store.
export async function getStoreEmployees(merchantId, storeId) {
  if (!merchantId || !storeId) {
    throw new Error("Merchant ID and store ID are required.");
  }

  const response = await api.get(
    endpoints.storeEmployees(merchantId, storeId)
  );

  return extractList(response, [
    "employees",
    "records",
    "items",
  ]).map(normalizeEmployee);
}

// Fetch attendance history.
export async function getAttendanceRecords({
  merchantId,
  storeId,
  employeeCode,
  page = 1,
  limit = 100,
} = {}) {
  if (!merchantId || !storeId) {
    throw new Error("Merchant and store IDs are required to load attendance.");
  }

  const params = new URLSearchParams({
    merchantId: String(merchantId),
    storeId: String(storeId),
    page: String(page),
    limit: String(limit),
  });

  if (employeeCode) {
    params.set("employeeCode", employeeCode.trim());
  }

  const response = await api.get(
    `${endpoints.attendance}?${params.toString()}`
  );

  return extractList(response, [
    "records",
    "attendance",
    "items",
  ]).map(normalizeAttendance);
}

// Fetch one attendance record by ID, scoped to the selected merchant and store.
export async function getAttendanceRecordById({ id, merchantId, storeId } = {}) {
  if (!id || !merchantId || !storeId) {
    throw new Error("Attendance, merchant, and store IDs are required.");
  }

  const params = new URLSearchParams({
    merchantId: String(merchantId),
    storeId: String(storeId),
  });
  try {
    const response = await api.get(
      `${endpoints.attendance}/${encodeURIComponent(String(id))}?${params.toString()}`
    );
    const body = asObject(response);
    const record = body.attendance ?? body.data?.attendance ?? body.data ?? body.record ?? body;

    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error("The attendance API returned no record.");
    }

    return normalizeAttendance(record);
  } catch (error) {
    // Older running HUB instances may not yet expose the ID route. Resolve the
    // selected record from the store-scoped list until that service is restarted.
    if (error?.status !== 404) throw error;

    const records = await getAttendanceRecords({ merchantId, storeId, page: 1, limit: 100 });
    const match = records.find((item) => String(item.id) === String(id));
    if (match) return match;

    throw new Error("This attendance record could not be found for the selected store.");
  }
}

// Fetch the authenticated employee's current open attendance.
export async function getMyOpenAttendance() {
  const response = await api.get(endpoints.attendanceMe);
  const body = asObject(response);

  const record =
    body.currentAttendance ??
    body.attendance ??
    body.data?.currentAttendance ??
    null;

  return record ? normalizeAttendance(record) : null;
}

async function submitAttendanceAction(action, {
  employeeCode,
  pin,
  merchantId,
  storeId,
}) {
  if (!employeeCode?.trim()) {
    throw new Error("Employee code is required.");
  }

  if (!/^\d{6}$/.test(String(pin ?? "").trim())) {
    throw new Error("PIN must be exactly 6 digits.");
  }

  if (!merchantId?.trim() || !storeId?.trim()) {
    throw new Error("Merchant/store context is missing.");
  }

  const response = await api.post(
    action === "clock-in"
      ? endpoints.attendanceClockIn
      : endpoints.attendanceClockOut,
    {
      employeeCode: employeeCode.trim(),
      pin: String(pin).trim(),
      merchantId: merchantId.trim(),
      storeId: storeId.trim(),
    }
  );

  const body = asObject(response);
  const record =
    body.attendance ??
    body.data?.attendance ??
    body.data ??
    body;

  const attendance = Array.isArray(record)
    ? record[0]
    : record;

  if (!attendance || typeof attendance !== "object") {
    throw new Error("The attendance API returned no record.");
  }

  return normalizeAttendance({
    ...attendance,
    employeeCode:
      attendance.employeeCode ??
      attendance.employee_code ??
      employeeCode,
  });
}

export function clockInEmployee(payload) {
  return submitAttendanceAction("clock-in", payload);
}

export function clockOutEmployee(payload) {
  return submitAttendanceAction("clock-out", payload);
}
