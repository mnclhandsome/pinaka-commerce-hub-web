import { api } from "./http";
import { endpoints } from "./endpoints";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unwrap(response) {
  let value = response;
  for (let depth = 0; depth < 4 && value && typeof value === "object"; depth += 1) {
    if (value.mapping) value = value.mapping;
    else if (value.data) value = value.data;
    else break;
  }
  return value;
}

function mappingRows(response) {
  const value = unwrap(response);
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.mappings)) return value.mappings;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  return [];
}

export async function getStoreDeviceMappings(storeId) {
  if (!UUID_PATTERN.test(String(storeId || ""))) {
    throw new Error("A valid store UUID is required to load device mappings.");
  }
  const response = await api.get(`${endpoints.storeDeviceMappings}?store_id=${encodeURIComponent(storeId)}`);
  return mappingRows(response);
}

export async function createStoreDeviceMapping({ storeId, deviceId }) {
  if (!UUID_PATTERN.test(String(storeId || ""))) {
    throw new Error("A valid store UUID is required to map a device.");
  }
  const response = await api.post(endpoints.storeDeviceMappings, {
    store_id: storeId,
    device_id: deviceId,
  });
  return unwrap(response);
}

export function deleteStoreDeviceMapping(mappingId) {
  if (!mappingId) throw new Error("A mapping ID is required to remove a device mapping.");
  return api.delete(`${endpoints.storeDeviceMappings}/${encodeURIComponent(mappingId)}`);
}
