export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

// Store reads and writes use different shapes. Keep both editing entry points
// on the same write contract rather than sending a GET response back to PUT.
export function buildStoreSetupPayload(store, overrides = {}) {
  const address = store.address && typeof store.address === "object" ? store.address : {};
  const text = value => String(value ?? "").trim();
  const addressLine1 = store.addressLine1 || address.addressLine1 || address.street ||
    (typeof store.address === "string" ? store.address : "");
  const addressLine2 = store.addressLine2 || address.addressLine2 || "";
  const setup = store.onboardingSetup || {};
  const features = store.features ?? store.enabledFeatures ?? setup.features;
  const rolePermissions = store.rolePermissions ?? setup.rolePermissions;
  const payload = {
    merchantId: store.merchantId || store.merchant?.id || store.merchant,
    storeId: text(store.storeCode || store.code || store.storeID || store.storeId || store.id).slice(0, 50),
    name: text(store.name || store.storeName),
    type: text(store.storeType?.storeTypeCode || store.storeType?.code || store.storeTypeCode ||
      store.type?.code || store.type?.name || store.type || store.storeType?.name || store.storeType || "Retail").slice(0, 50),
    phone: text(store.phone),
    email: text(store.email || store.storeEmail),
    url: text(store.url || store.baseUrl || store.websiteUrl),
    currency: store.currency,
    status: text(store.status || "Active").toUpperCase(),
    address: [addressLine1, addressLine2].map(text).filter(Boolean).join(", ").slice(0, 1000),
    addressLine2: text(addressLine2),
    city: text(store.city || address.city),
    state: text(store.state || address.state),
    zip: text(store.zip || store.postalCode || address.zipCode || address.postalCode),
    country: store.country || address.country,
    timezone: store.timezone,
    defaultLanguage: store.defaultLanguage || "",
    taxRegion: store.taxRegion || store.state || address.state || "",
    hours: store.hours ?? setup.hours,
    logo: store.logo ?? store.logoUrl,
    ...(features !== undefined ? { features } : {}),
    ...(rolePermissions !== undefined ? { rolePermissions } : {}),
  };
  return { ...payload, ...overrides };
}

export function storeListFromResponse(response) {
  if (Array.isArray(response)) return response;
  for (const key of ["stores", "items", "results", "data"]) {
    const value = response?.[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const nested = storeListFromResponse(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

export function normalizeStoreForConfiguration(store) {
  const address = store.address && typeof store.address === "object" ? store.address : {};
  const storeCode = [store.storeCode, store.store_code, store.code, store.storeId, store.storeID]
    .find(value => value && !isUuid(value)) || "";
  const type = store.storeType?.name || store.storeType || store.type?.name || store.type || "";
  const location = [
    address.street || (typeof store.address === "string" ? store.address : ""),
    address.city || store.city,
    address.state || store.state,
  ].filter(Boolean).join(", ");

  return {
    ...store,
    id: store.id || store._id || store.storeUUID || store.storeId || store.storeID,
    storeCode,
    name: store.storeName || store.name || storeCode || "Store",
    type,
    location: location || store.location || "—",
    status: store.status || store.operationalStatus || "Unknown",
    url: store.baseUrl || store.websiteUrl || store.url || "",
  };
}




