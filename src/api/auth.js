import { api } from "./http";
import { endpoints } from "./endpoints";
import {
  clearSession,
  getRememberMe,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  setStoredUser,
} from "../auth/tokenStore";

function unwrapAuthPayload(data) {
  if (!data || typeof data !== "object") return data;
  if (data.data && typeof data.data === "object") return data.data;
  return data;
}

function applyAuthResponse(data, remember = getRememberMe()) {
  const payload = unwrapAuthPayload(data);
  const accessToken =
    payload?.accessToken || payload?.access_token || payload?.token || null;
  const refreshToken =
    payload?.refreshToken || payload?.refresh_token || null;
  const user = payload?.user || null;

  if (accessToken) {
    setAccessToken(accessToken, remember);
  }

  if (refreshToken) {
    setRefreshToken(refreshToken, remember);
  }

  if (user) {
    setStoredUser(user, remember);
  }

  return {
    ...payload,
    accessToken,
    refreshToken,
    user,
  };
}

export async function login(email, password, remember = false) {
  const data = await api.post(
    endpoints.login,
    { email, password },
    { skipAuthRefresh: true }
  );

  if (data && data.success === false) {
    const message = data.message || "Invalid email or password.";
    const error = new Error(message);
    error.name = "ApiError";
    error.status = 401;
    throw error;
  }

  return applyAuthResponse(data, remember);
}

export async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token");
  }

  const data = await api.post(
    endpoints.refresh,
    { refreshToken },
    { skipAuthRefresh: true }
  );
  return applyAuthResponse(data);
}

export async function logout() {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      await api.post(
        endpoints.logout,
        { refreshToken },
        { skipAuthRefresh: true }
      );
    }
  } catch {
    // Clear the local session even if logout is not implemented yet.
  } finally {
    clearSession();
  }
}

export function getProfile() {
  return api.get(endpoints.me);
}
