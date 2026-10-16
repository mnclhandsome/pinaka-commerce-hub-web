import { api, pendingStoreRead } from "./http";
import { endpoints } from "./endpoints";

const readDevice = path => pendingStoreRead(`device-read:${path}`, () => api.get(path));

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Convert UI form data into the backend device payload.
 *
 * Match the local merchant-service device DTO, which uses snake-case fields.
 */
export function toDevicePayload(data, { includeMerchant = true } = {}) {
  const merchantId = data.merchantId || data.merchant_id || data.merchant || "";
  const deviceId = String(data.deviceId || data.device_id || "").trim();
  if (includeMerchant && !UUID_PATTERN.test(String(merchantId))) {
    throw new Error("Select a merchant with a valid UUID before saving the device.");
  }

  return {
    ...(deviceId ? { device_id: deviceId } : {}),
    ...((data.deviceName || data.device_name || data.name)
      ? { device_name: (data.deviceName || data.device_name || data.name).trim() }
      : {}),
    ...((data.deviceType || data.device_type || data.type)
      ? { device_type: data.deviceType || data.device_type || data.type }
      : {}),
    ...((data.serialNumber || data.serial_number || data.serial)
      ? { serial_number: (data.serialNumber || data.serial_number || data.serial).trim() }
      : {}),
    ...(includeMerchant ? { merchant_id: merchantId } : {}),
    status: String(data.status || "ACTIVE").toUpperCase(),
  };
}

function unwrapDevice(response) {
  let value = response;
  for (let depth = 0; depth < 3 && value && typeof value === "object"; depth += 1) {
    if (value.device) value = value.device;
    else if (value.data) value = value.data;
    else break;
  }
  return value;
}

/**
 * Normalize API response so the UI has predictable fields.
 *
 * This intentionally supports common response wrappers:
 * { device: {...} }
 * { data: {...} }
 * or direct {...}
 */
export function normalizeDevice(device) {
  if (!device) return null;

  const rawCode = device.device_code || device.deviceCode || device.code || "";
  const code = String(rawCode).replace(/^DVC-/i, "DVC_");

  const rawStatus = String(device.status || device.connection_status || "").toUpperCase();
  const status = rawStatus === "ACTIVE"
    ? "Active"
    : rawStatus === "INACTIVE"
      ? "Inactive"
      : rawStatus.charAt(0) + rawStatus.slice(1).toLowerCase();

  return {
    ...device,

    id: device.id || device.uuid || device.deviceUuid || device.device_id || device.deviceId || device.device_code || device.deviceCode || "",
    code,
    deviceId: device.device_id || device.deviceId || "",
    name: device.device_name || device.deviceName || device.name || "",
    type: device.device_type || device.deviceType || device.type || "",
    serial: device.serial_number || device.serialNumber || device.serial || "",
    merchantId: device.merchant_id || device.merchantId || "",
    merchantName: device.merchant_name || device.merchantName || device.merchant?.name || "",
    storeId: device.store_id || device.storeId || "",
    merchant:
      device.merchant_name || device.merchantName || device.merchant?.name || device.merchant || "",
    store: device.store_name || device.storeName || device.store?.name || device.store || "",
    status,
    lastSeen: device.lastSeen || device.last_seen || "-",
    notes: device.notes || "",
    enableImmediately: device.enableImmediately ?? device.enabled ?? false,
  };
}

/**
 * GET /devices
 */
export async function listDevices() {
  const response = await readDevice(endpoints.devices);

  const unwrapped = unwrapDevice(response);
  const items = Array.isArray(unwrapped)
    ? unwrapped
    : unwrapped?.devices || unwrapped?.items || [];

  return items.map(normalizeDevice);
}

/** GET /devices/available?merchant_id=:merchantId */
export async function getDevicesByMerchantId(merchantId) {
  if (!UUID_PATTERN.test(String(merchantId || ""))) {
    throw new Error("A valid merchant UUID is required to load devices.");
  }
  const response = await readDevice(
    `${endpoints.availableDevices}?merchant_id=${encodeURIComponent(merchantId)}`,
  );
  const unwrapped = unwrapDevice(response);
  const items = Array.isArray(unwrapped)
    ? unwrapped
    : unwrapped?.devices || unwrapped?.availableDevices || unwrapped?.available_devices || unwrapped?.items || [];
  return items.map(normalizeDevice).filter(Boolean);
}

/** GET /devices/merchant/:merchantId (includes devices already mapped to stores) */
export async function listAllDevicesByMerchantId(merchantId) {
  if (!UUID_PATTERN.test(String(merchantId || ""))) {
    throw new Error("A valid merchant UUID is required to load devices.");
  }
  const response = await readDevice(endpoints.merchantDevices(merchantId));
  const unwrapped = unwrapDevice(response);
  const items = Array.isArray(unwrapped)
    ? unwrapped
    : unwrapped?.devices || unwrapped?.items || [];
  return items.map(normalizeDevice).filter(Boolean);
}

/**
 * GET /devices/:deviceId
 */
export async function getDevice(deviceId) {
  if (!deviceId) {
    throw new Error("Device ID is required");
  }

  return normalizeDevice(unwrapDevice(await readDevice(endpoints.device(deviceId))));
}

/**
 * POST /devices
 */
export async function createDevice(data) {
  const payload = toDevicePayload(data);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    return await api.post(endpoints.devices, payload, { signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Creating the device timed out after 30 seconds. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * PUT /devices/:deviceId
 */
export async function updateDevice(deviceId, data) {
  if (!deviceId) {
    throw new Error("Device ID is required");
  }

  const payload = toDevicePayload(data, { includeMerchant: false });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    return await api.put(endpoints.device(deviceId), payload, { signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Updating the device timed out after 30 seconds. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** DELETE /devices/:deviceId */
export async function deleteDevice(deviceId) {
  if (!deviceId) {
    throw new Error("Device ID is required");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await api.delete(endpoints.device(deviceId), { signal: controller.signal });
    if (response?.success === false) {
      throw new Error(response.message || "Failed to delete device.");
    }
    return response;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Deleting the device timed out after 30 seconds. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const devicesApi = {
  list: listDevices,
  listByMerchantId: getDevicesByMerchantId,
  listAllByMerchantId: listAllDevicesByMerchantId,
  get: getDevice,
  create: createDevice,
  update: updateDevice,
  delete: deleteDevice,
};
