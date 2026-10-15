import { api, pendingStoreRead } from "./http";
import { endpoints } from "./endpoints";
import { buildStoreSetupPayload } from "./storeDetails";

export function toStorePayload(store, merchantId) {
  return {
    merchantId: merchantId || store.merchantId || store.merchant,
    name: store.name || store.storeName,
    storeId: store.id || store.storeID,
    type: store.type || store.storeType,
    phone: store.phone,
    url: store.url,
    currency: store.currency,
    status: store.status,
    address: store.address,
    timezone: store.timezone,
    city: store.city,
    state: store.state,
    zip: store.zip,
    devices: store.devices || [],
    features: store.features || [],
    roles: store.roles || [],
  };
}

export function storeListFromResponse(response) {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== "object") return [];
  for (const key of ["stores", "items", "results", "records", "data"]) {
    const value = response[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const nested = storeListFromResponse(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

export function normalizeStore(item) {
  const wrapper = item || {};
  const store = wrapper.store || wrapper.data?.store || wrapper.data || wrapper;
  const merchantValue = store.merchant || wrapper.merchant;
  const merchant = merchantValue && typeof merchantValue === "object" ? merchantValue : {};
  const address = store.address && typeof store.address === "object" ? store.address : {};
  const storeType = store.storeType && typeof store.storeType === "object" ? store.storeType : {};
  return {
    ...store,
    id: store.id || store._id || store.storeUUID || store.storeUuid || store.store_uuid || store.storeId || store.storeID || store.store_id || store.storeCode || store.store_code || store.code || "",
    storeId: store.storeId || store.storeID || store.store_id || store.id || store._id || "",
    storeCode: store.storeCode || store.store_code || store.storeIdCode || store.code || "",
    storeName: store.storeName || store.store_name || store.name || "",
    merchantId: store.merchantId || store.merchant_id || merchant.id || merchant.merchantId || merchant.merchant_id || (typeof store.merchant === "string" ? store.merchant : ""),
    merchantName: store.merchantName || store.merchant_name || merchant.name || merchant.businessDisplayName || merchant.business_display_name || merchant.businessName || "",
    storeTypeName: store.storeTypeName || store.store_type_name || storeType.name || store.store_type?.name || store.type?.name || (typeof store.storeType === "string" ? store.storeType : "") || (typeof store.store_type === "string" ? store.store_type : "") || store.type || "",
    storeTypeId: store.storeTypeId || store.store_type_id || storeType.id || "",
    addressLine1: store.addressLine1 || store.address_line1 || address.addressLine1 || address.street || (typeof store.address === "string" ? store.address : ""),
    addressLine2: store.addressLine2 || store.address_line2 || address.addressLine2 || address.unit || "",
    address: store.address || [store.addressLine1 || store.address_line1 || address.street, store.addressLine2 || store.address_line2 || address.addressLine2].filter(Boolean).join(", "),
    city: store.city || address.city || "",
    state: store.state || address.state || "",
    zip: store.zip || store.postalCode || store.postal_code || address.zipCode || address.zip_code || "",
    country: store.country || address.country || "",
    phone: store.phone || store.phoneNumber || store.phone_number || "",
    email: store.email || store.storeEmail || store.store_email || "",
    url: store.url || store.baseUrl || store.base_url || store.websiteUrl || store.website_url || "",
    currency: store.currency || "",
    timezone: store.timezone || store.timeZone || "",
    defaultLanguage: store.defaultLanguage || store.default_language || "",
    status: String(store.status || store.operationalStatus || store.operational_status || "Unknown").toUpperCase(),
    createdAt: store.createdAt || store.created_at || store.createdDate || "",
    updatedAt: store.updatedAt || store.updated_at || store.updatedDate || "",
    connectionStatus: String(store.connectionStatus || store.connection_status || "").toUpperCase() || null,
    syncStatus: String(store.syncStatus || store.sync_status || "").toUpperCase() || null,
    devices: store.devices || store.registeredDevices || store.registered_devices || [],
  };
}

export async function listStores() {
  const response = await pendingStoreRead("stores-list", () => api.get(endpoints.stores));
  const stores = storeListFromResponse(response).map(normalizeStore);
  return { ...response, stores, count: response?.count ?? stores.length };
}

export async function listMerchantStores(merchantId) {
  if (!merchantId) return [];
  const response = await api.get(
    endpoints.merchantStores(encodeURIComponent(merchantId)),
  );
  const findList = (value) => {
    if (Array.isArray(value)) return value;
    for (const key of ["stores", "items", "results", "data"]) {
      const nested = value?.[key];
      if (Array.isArray(nested)) return nested;
      if (nested && typeof nested === "object") {
        const found = findList(nested);
        if (found.length) return found;
      }
    }
    return [];
  };
  return findList(response)
    .map((store) => ({
      value: String(store.storeId || store.id || store._id || ""),
      label: store.name || store.storeName || store.storeId || store.id || "",
    }))
    .filter((store) => store.value && store.label);
}
export function createStore(store, merchantId) {
  const path = merchantId
    ? endpoints.merchantStores(merchantId)
    : endpoints.stores;
  return api.post(path, toStorePayload(store, merchantId));
}

export function createStores(stores, merchantId) {
  const owner = merchantId || stores[0]?.merchant;
  if (
    !owner ||
    stores.some((store) => (merchantId || store.merchant) !== owner)
  ) {
    throw new Error("Choose the same merchant for all stores in a batch.");
  }
  return api.post(endpoints.merchantStores(owner) + "/bulk", {
    stores: stores.map((store) => toStorePayload(store, owner)),
  });
}

export async function getStore(id) {
  const { store } = await pendingStoreRead(`store:${id}`, () => api.get(endpoints.store(encodeURIComponent(id))));
  return {
    merchant: store.merchantId,
    storeID: store.id,
    storeName: store.storeName,
    storeType: store.storeType,
    phone: store.phone || "",
    url: store.baseUrl || "",
    currency: store.currency,
    status: store.status,
    timezone: store.timezone,
    address: store.address?.street || "",
    city: store.address?.city || "",
    state: store.address?.state || "",
    zip: store.address?.zipCode || "",
    devices: store.devices || store.registeredDevices || [],
    features: store.features || store.enabledFeatures || [],
    roles: store.roles || store.merchantRoles || [],
  };
}
export function updateStore(id, store) {
  return api.put(
    endpoints.store(encodeURIComponent(id)),
    toStorePayload(store),
  );
}

export function deleteStore(id) {
  return api.get(endpoints.store(encodeURIComponent(id))).then((response) => {
    const store = normalizeStore(response);
    return deactivateStore(store.storeCode || store.id || id, store);
  });
}

export async function deactivateStore(id, store) {
  const payload = buildStoreSetupPayload(store, { status: "INACTIVE" });
  const response = await api.put(endpoints.store(encodeURIComponent(id)), payload);
  if (response?.success === false) throw new Error(response.message || "Unable to deactivate store.");
  return response;
}

export async function activateStore(id, store) {
  const payload = buildStoreSetupPayload(store, { status: "ACTIVE" });
  const response = await api.put(endpoints.store(encodeURIComponent(id)), payload);
  if (response?.success === false) throw new Error(response.message || "Unable to activate store.");
  return response;
}
