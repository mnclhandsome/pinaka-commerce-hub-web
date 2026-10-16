import { api } from "./http";
import { listStoreEmployees } from "./employees";
import { getDevice, listAllDevicesByMerchantId } from "./devices";

import { getStoreDeviceMappings } from "./storeDeviceMappings";

export async function listStoreShifts(merchantId, storeId, { signal, onEmployees, onEmployeeError, onDevices, onDeviceError } = {}) {
  if (!storeId) throw new Error("Store is required to load shifts.");
  const base = (import.meta.env.VITE_POS_API_BASE_URL || "/connector/api/v1/pos").replace(/\/+$/, "");
  const url = new URL(`${base}/stores/${encodeURIComponent(storeId)}/shifts`, window.location.origin);
  const response = await api.get(url.toString(), { signal });
  if (response?.success === false) throw new Error(response.message || "Unable to load shifts.");
  const shifts = response?.shifts ?? response?.data?.shifts;
  if (!Array.isArray(shifts)) throw new Error("The shifts API returned an invalid response.");
  const ownerId = merchantId || response?.merchant_id || response?.merchantId || response?.data?.merchant_id || response?.data?.merchantId || shifts.find(shift => shift.merchantId || shift.merchant_id)?.merchantId || shifts.find(shift => shift.merchant_id)?.merchant_id;
  const [employeeResult, deviceResult, mappingResult] = await Promise.allSettled([
    ownerId ? listStoreEmployees(ownerId, storeId) : Promise.reject(new Error("Merchant information is unavailable for employee filters.")),
    ownerId ? listAllDevicesByMerchantId(ownerId) : Promise.resolve([]),
    getStoreDeviceMappings(storeId),
  ]);
  const employeeNames = new Map();
  const deviceNames = new Map();
  if (employeeResult.status === "fulfilled") {
    const options = normalizeShiftEmployees(employeeResult.value);
    if (!signal?.aborted) onEmployees?.(options);
    for (const employee of options) {
      for (const id of [employee.id, employee.employeeId]) {
        if (id && employee.name) employeeNames.set(String(id), employee.name);
      }
    }
  }
  if (employeeResult.status === "rejected" && !signal?.aborted) onEmployeeError?.("Unable to load employee filters. Please retry.");
  if (deviceResult.status === "fulfilled") {
    for (const device of deviceResult.value) {
      for (const id of [device.id, device.deviceId, device.code, device.serial, device.terminalId, device.terminal_id]) {
        if (id && device.name) deviceNames.set(String(id), device.name);
      }
    }
  }
  if (mappingResult.status === "fulfilled") {
    const results = await Promise.allSettled(mappingResult.value.map(async mapping => {
      const id = String(mapping.device_id || mapping.deviceId || mapping.device?.id || "");
      if (!id || mapping.is_mapped === false || mapping.isMapped === false) return null;
      let device = (deviceResult.status === "fulfilled" ? deviceResult.value : []).find(device => String(device.id) === id || String(device.deviceId) === id);
      if (!device) device = mapping.device || await getDevice(id);
      const name = device.name || device.device_name || device.deviceName || mapping.device_name || mapping.deviceName;
      if (!name) throw new Error("Device name unavailable.");
      const ids = [...new Set([id, device.id, device.deviceId, device.device_id, device.code, device.serial, device.terminalId, device.terminal_id].filter(Boolean).map(String))];
      for (const alias of ids) deviceNames.set(alias, name);
      return { id, name, ids };
    }));
    if (!signal?.aborted) {
      onDevices?.(results.filter(result => result.status === "fulfilled" && result.value).map(result => result.value).sort((a, b) => a.name.localeCompare(b.name)));
      if (results.some(result => result.status === "rejected")) onDeviceError?.("Some device names could not be loaded. Please retry.");
    }
  } else if (!signal?.aborted) onDeviceError?.("Unable to load the device filter. Please retry.");
  return shifts.map((shift) => resolveShiftNames(shift, employeeNames, deviceNames));
}

export function normalizeShiftEmployees(response) {
  const rows = Array.isArray(response) ? response : response?.employees ?? response?.data?.employees ?? response?.data ?? [];
  if (!Array.isArray(rows) || response?.success === false) throw new Error("Invalid store employee response.");
  const options = rows.map(employee => ({
    id: String(employee.employeeId || employee.employee_id || employee.id || ""),
    name: employee.name || employee.fullName || employee.full_name || [employee.firstName ?? employee.first_name, employee.lastName ?? employee.last_name].filter(Boolean).join(" "),
  })).filter(employee => employee.id && employee.name);
  return [...new Map(options.map(employee => [employee.id, employee])).values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function resolveShiftNames(shift, employeeNames, deviceNames) {
  const deviceName = (...ids) => ids.map(id => id && deviceNames.get(String(id))).find(Boolean) || "";
  return {
    ...shift,
    openedByName: employeeNames.get(String(shift.openedByEmployeeId)) || shift.cashierName || "",
    closedByName: employeeNames.get(String(shift.closedByEmployeeId)) || shift.closedByEmployeeName || "",
    openingDeviceName: deviceName(shift.openingDeviceId, shift.terminalId, shift.registerId),
    closingDeviceName: deviceName(shift.closed_by_device_id, shift.closingDeviceId),
  };
}

const amount = (value) => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const timestamp = (value) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
};
const pad = (value) => String(value).padStart(2, "0");
export function normalizeShift(row) {
  const opened = timestamp(row.openedAt);
  const closed = timestamp(row.closedAt);
  const seconds = opened && closed ? Math.max(0, Math.floor((closed - opened) / 1000)) : null;
  const cashSales = amount(row.totalCashSales);
  const cardSales = amount(row.totalCardSales);
  return {
    id: row.id,
    date: opened ? `${opened.getFullYear()}-${pad(opened.getMonth() + 1)}-${pad(opened.getDate())}` : "",
    openedBy: row.openedByName || row.cashierName || "",
    openedCode: "",
    openedByEmployeeId: String(row.openedByEmployeeId || ""),
    closedByEmployeeId: String(row.closedByEmployeeId || ""),
    closedBy: row.closedByName || "",
    closedCode: "",
    deviceIds: [row.openingDeviceId, row.terminalId, row.registerId, row.closed_by_device_id, row.closingDeviceId].filter(Boolean).map(String),
    openDevice: row.openingDeviceName || "",
    closeDevice: row.closingDeviceName || "",
    openTime: row.openedAt || "",
    closeTime: row.closedAt || "",
    duration: seconds == null ? "—" : `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`,
    status: row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1).toLowerCase() : "Unknown",
    openingBalance: amount(row.openingCash),
    closingBalance: amount(row.closingCashActual),
    expectedClosing: amount(row.expectedCashInDrawer),
    actualClosing: amount(row.closingCashActual),
    cashDifference: amount(row.cashDifference ?? row.discrepancy),
    safeDrop: amount(row.totalSafeDrops),
    payouts: amount(row.total_payouts ?? row.totalPaidOuts),
    cashSales, cardSales,
    sales: amount(row.total_order_sale_amount) ?? (cashSales == null && cardSales == null ? null : (cashSales ?? 0) + (cardSales ?? 0)),
    paymentTotal: [cashSales, cardSales, amount(row.total_ebt_sales), amount(row.total_pay_later)].every(value => value == null) ? null : (cashSales ?? 0) + (cardSales ?? 0) + (amount(row.total_ebt_sales) ?? 0) + (amount(row.total_pay_later) ?? 0),
    orders: amount(row.total_orders),
    cashback: amount(row.total_cashback),
    refund: amount(row.total_refunds),
    voidItems: amount(row.total_void_items),
    cancelledOrders: amount(row.total_cancelled_orders),
    ebtSales: amount(row.total_ebt_sales), payLater: amount(row.total_pay_later),
    paymentCounts: { Cash: null, Card: null, EBT: null, "Pay Later": null },
  };
}
