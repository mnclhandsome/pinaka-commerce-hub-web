import { API_BASE_URL } from "../config/env";
import { getAccessToken, getRefreshToken, setAccessToken, setRefreshToken, setStoredUser } from "../auth/tokenStore";
import { endpoints } from "./endpoints";

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// Fixed buildUrl with safety checks
function buildUrl(path) {
  if (!path || typeof path !== "string") {
    return API_BASE_URL || "/";
  }
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
 
  if (/^https?:\/\//i.test(API_BASE_URL || "")) {
    try {
      const urlObj = new URL(API_BASE_URL);
      const basePath = urlObj.pathname.replace(/\/+$/, "");
      if (basePath && (normalizedPath.startsWith(basePath) || normalizedPath.startsWith("/connector/"))) {
        return `${urlObj.origin}${normalizedPath}`;
      }
      return `${API_BASE_URL}${normalizedPath}`;
    } catch {
      return `${API_BASE_URL}${normalizedPath}`;
    }
  }
 
  if (normalizedPath.startsWith("/connector/") || normalizedPath.startsWith("/connectors/")) {
    return normalizedPath;
  }
  return `${API_BASE_URL || ""}${normalizedPath}`;
}
 
 
async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

let refreshPromise = null;
 
async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) throw new Error("No refresh token");
      const res = await apiRequest(endpoints.refresh, {
        method: "POST",
        body: { refreshToken },
        skipAuthRefresh: true,
      });
      const payload = res?.data && typeof res.data === "object" ? res.data : res;
      const accessToken = payload?.accessToken || payload?.access_token || payload?.token || null;
      const newRefreshToken = payload?.refreshToken || payload?.refresh_token || null;
      const user = payload?.user || null;
      if (accessToken) setAccessToken(accessToken);
      if (newRefreshToken) setRefreshToken(newRefreshToken);
      if (user) setStoredUser(user);
      return { ...payload, accessToken, refreshToken: newRefreshToken, user };
    })().finally(() => {
      refreshPromise = null;
    });
  }
 
  return refreshPromise;
}

export async function apiRequest(
  path,
  {
    method = "GET",
    body,
    headers,
    signal,
    token: tokenOverride,
    skipAuthRefresh = false,
  } = {}
) {
  const token = tokenOverride ?? getAccessToken();
  const requestUrl = buildUrl(path);
  const payload = body !== undefined ? body : undefined;
  const isFormData = payload instanceof FormData;

  console.log("[API REQUEST]", {
    method,
    url: requestUrl,
    path,
    payload,
    authenticated: Boolean(token),
  });

  const response = await fetch(requestUrl, {
    method,
    credentials: "include",
    signal,
    headers: {
      Accept: "application/json",
      ...(payload !== undefined && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: payload !== undefined ? (isFormData ? payload : JSON.stringify(payload)) : undefined,
  });

  const data = await parseBody(response);

  console.log("[API RESPONSE]", {
    method,
    url: requestUrl,
    status: response.status,
    ok: response.ok,
    data,
  });

  if (
    response.status === 401 &&
    !skipAuthRefresh &&
    path !== endpoints.login &&
    path !== endpoints.refresh
  ) {
    try {
      await refreshAccessToken();
      return apiRequest(path, {
        method,
        body,
        headers,
        signal,
        skipAuthRefresh: true,
      });
    } catch {
      setAccessToken(null);
    }
  }

  if (!response.ok) {
    const message =
      (data && (data.message || data.error)) ||
      `Request failed with status ${response.status}`;
    console.error("[API ERROR DETAILS]", {
      method,
      url: requestUrl,
      status: response.status,
      body: data,
    });
    throw new ApiError(
      Array.isArray(message) ? message.join(", ") : message,
      response.status,
      data
    );
  }

  return data;
}

export const api = {
  get: (path, options) => apiRequest(path, { ...options, method: "GET" }),
  post: (path, body, options) =>
    apiRequest(path, { ...options, method: "POST", body }),
  put: (path, body, options) =>
    apiRequest(path, { ...options, method: "PUT", body }),
  patch: (path, body, options) =>
    apiRequest(path, { ...options, method: "PATCH", body }),
  delete: (path, options) => apiRequest(path, { ...options, method: "DELETE" }),
};
 
 

// Share concurrent reads only; settled requests are never cached.
const pendingStoreReads = new Map();
export function pendingStoreRead(key, read) {
  if (!pendingStoreReads.has(key)) {
    pendingStoreReads.set(key, Promise.resolve().then(read).finally(() => pendingStoreReads.delete(key)));
  }
  return pendingStoreReads.get(key);
}