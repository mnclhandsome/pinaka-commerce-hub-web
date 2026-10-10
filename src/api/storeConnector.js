import { api } from "./http";
import { endpoints } from "./endpoints";

const storageKey = (storeId) => `pch.wpConnector.${storeId}`;

export function getWordpressConnector(storeId) {
  if (!storeId) return null;
  try {
    return JSON.parse(localStorage.getItem(storageKey(storeId)) || "null");
  } catch {
    return null;
  }
}

export function getWordpressAuthHeader(storeId) {
  const connector = getWordpressConnector(storeId);
  if (!connector?.jwtToken) return {};
  return { Authorization: `Bearer ${connector.jwtToken}` };
}

export async function fetchWordpressConnector(storeId, merchantId) {
  if (!storeId) return null;
  const local = getWordpressConnector(storeId) || {};

  let remote = null;
  try {
    const res = await api.get(`/connector/api/v1/stores/${storeId}/connector`);
    remote = res?.connector || res?.connection || res?.data?.connector || res;
  } catch {
    try {
      const res = await api.get(endpoints.storeConnector(storeId));
      remote = res?.connector || res?.connection || res?.data?.connector || res;
    } catch {
      try {
        const res = await api.get(`/stores/${storeId}/configuration`);
        remote = res?.websiteConnection || res?.connector || null;
      } catch {
        remote = null;
      }
    }
  }

  const remoteSaved = Boolean(remote?.wordpressUrl || remote?.wordpressJwt || remote?.updatedAt);
  if (!remoteSaved) {
    if (!local.siteUrl && !local.jwtToken) return null;
    return {
      ...local,
      storeId,
      merchantId: merchantId || local.merchantId || "",
    };
  }

  const siteUrl = remote.wordpressUrl || remote.siteUrl || local.siteUrl || "";
  const connected = remote.status === "CONNECTED";
  const lastTestMessage = remote.lastTestMessage || local.lastTestMessage || "";
  const lastTestedAt = remote.lastTestedAt || local.lastTestedAt || null;
  const jwtToken = remote.wordpressJwt || local.jwtToken || "";

  const merged = {
    storeId,
    merchantId: merchantId || local.merchantId || "",
    siteUrl,
    jwtToken,
    connected,
    lastTestedAt,
    lastTestMessage,
    wordpressJwtConfigured: Boolean(remote?.wordpressJwtConfigured || jwtToken),
  };

  localStorage.setItem(storageKey(storeId), JSON.stringify(merged));
  return merged;
}

export async function saveWordpressConnector(storeId, merchantId, values) {
  if (!storeId) throw new Error("Store ID is required");
  const siteUrl = String(values.siteUrl || "").replace(/\/+$/, "");
  const jwtToken = String(values.jwtToken || "").trim();

  const payload = {
    storeId,
    merchantId: merchantId || "",
    siteUrl,
    jwtToken,
    savedAt: new Date().toISOString(),
    connected: Boolean(values.connected),
    lastTestedAt: values.lastTestedAt || null,
    lastTestMessage: values.lastTestMessage || "",
  };

  const body = {
    storeId,
    merchantId,
    wordpressUrl: siteUrl,
    wordpressJwt: jwtToken,
  };

  const applyResult = (result) => {
    const status = result?.connector?.status;
    payload.syncedToApi = true;
    payload.lastTestMessage = result?.connector?.lastTestMessage || result?.message || payload.lastTestMessage;
    if (status === "CONNECTED" || status === "NOT_CONNECTED") {
      payload.connected = status === "CONNECTED";
    }
    return payload;
  };

  // Single dynamic PUT request to save & connect
  try {
    applyResult(await api.put(`/connector/api/v1/stores/${storeId}/connector`, body));
  } catch (err) {
    try {
      applyResult(await api.put(endpoints.storeConnector(storeId), body));
    } catch {
      payload.syncedToApi = false;
    }
  }

  localStorage.setItem(storageKey(storeId), JSON.stringify(payload));
  return payload;
}

export async function syncWordpressCatalog(storeId, values = {}) {
  if (!storeId) throw new Error("Store ID is required.");
  const body = {
    wordpressUrl: String(values.siteUrl || "").replace(/\/+$/, ""),
    wordpressJwt: String(values.jwtToken || "").trim(),
  };
  try {
    return await api.post(`/connector/api/v1/stores/${storeId}/catalog/sync`, body);
  } catch (err) {
    try {
      return await api.post(`/stores/${encodeURIComponent(storeId)}/catalog/sync`, body);
    } catch (fallbackErr) {
      throw new Error(err?.message || fallbackErr?.message || "Unable to sync categories and products.");
    }
  }
}

async function postStoreSync(storeId, step) {
  if (!storeId) throw new Error("Store ID is required.");
  const path = `/stores/${encodeURIComponent(storeId)}/catalog/sync/${step}`;
  try {
    return await api.post(`/connector/api/v1${path}`);
  } catch (err) {
    try {
      return await api.post(path);
    } catch (fallbackErr) {
      throw new Error(err?.message || fallbackErr?.message || `Unable to sync ${step}.`);
    }
  }
}

export function syncWordpressProducts(storeId) {
  return postStoreSync(storeId, "products");
}

export function syncWordpressCategories(storeId) {
  return postStoreSync(storeId, "categories");
}

export function syncWordpressAttributes(storeId) {
  return postStoreSync(storeId, "attributes");
}

export function syncWordpressTags(storeId) {
  return postStoreSync(storeId, "tags");
}

// export async function syncWordpressCatalog(storeId, { siteUrl, jwtToken, merchantId } = {}) {
//   const result = await testWordpressConnection(siteUrl, jwtToken, storeId, merchantId);
//   if (!result?.ok) {
//     throw new Error(result?.message || "Unable to sync WordPress categories and products.");
//   }

//   const data = result.data || {};
//   return {
//     ...result,
//     catalog: {
//       categoryCount: data.categoryCount ?? data.syncedCategoriesCount ?? data.catalog?.categoryCount ?? 0,
//       productCount: data.productCount ?? data.syncedProductsCount ?? data.catalog?.productCount ?? 0,
//     },
//   };
// }
