import { api } from './http';

const unwrap = (response, keys = []) => {
  if (Array.isArray(response)) return response;
  for (const key of keys) if (Array.isArray(response?.[key])) return response[key];
  for (const key of keys) {
    if (Array.isArray(response?.data?.[key])) return response.data[key];
    if (Array.isArray(response?.result?.[key])) return response.result[key];
  }
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.result)) return response.result;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

export const listMappedStoreTypes = (featureId) =>
  api.get(`/features/${encodeURIComponent(featureId)}/store-types`).then((r) => unwrap(r, ['store_types', 'storeTypes', 'mappings', 'items']));

export const addStoreTypeToFeature = (featureId, payload) =>
  api.post(`/store-types/${encodeURIComponent(payload.storeTypeId)}/features`, {
    featureId,
  });

export const bulkAddStoreTypes = (featureId, storeTypeIds) =>
  api.post(`/features/${encodeURIComponent(featureId)}/store-types/bulk`, { storeTypeIds });

export const removeStoreTypeFromFeature = (featureId, storeTypeId) =>
  api.delete(`/store-types/${encodeURIComponent(storeTypeId)}/features/${encodeURIComponent(featureId)}`);
