import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
} from "../api/auth";
import { getMenuPermissions } from "../api/menuPermissionsApi";
import {
  defaultGrants,
  grantAllows,
  grantsFromResponse,
  grantsToSet,
  principalFromUser,
} from "./access";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  setRememberMe,
} from "./tokenStore";

const AuthContext = createContext(null);

function buildAccess(user, ready) {
  const principal = principalFromUser(user);
  return {
    ready,
    locked: principal.locked,
    configured: false,
    principalRole: principal.principalRole,
    grants: grantsToSet(defaultGrants(principal.principalRole)),
  };
}

async function loadAccess(user) {
  const principal = principalFromUser(user);
  if (!user || principal.locked) {
    return {
      ready: true,
      locked: true,
      configured: true,
      principalRole: principal.principalRole,
      grants: grantsToSet(defaultGrants("SUPER_ADMIN")),
    };
  }

  try {
    const response = await getMenuPermissions(principal.principalRole, principal.roleTemplateId);
    const grants = grantsFromResponse(response, principal.principalRole);
    return {
      ready: true,
      locked: false,
      configured: Boolean(response?.configured),
      principalRole: principal.principalRole,
      grants: grantsToSet(grants),
    };
  } catch {
    return {
      ready: true,
      locked: false,
      configured: false,
      principalRole: principal.principalRole,
      grants: grantsToSet(defaultGrants(principal.principalRole)),
    };
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(getAccessToken() || getStoredUser())
  );
  const [access, setAccess] = useState(() => buildAccess(getStoredUser(), false));

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        if (!getAccessToken()) {
          if (getRefreshToken()) {
            await refreshSession();
          } else {
            throw new Error("No stored session");
          }
        }

        if (!cancelled) {
          const nextUser = getStoredUser();
          setUser(nextUser);
          setIsAuthenticated(Boolean(getAccessToken() || nextUser));
          setAccess(await loadAccess(nextUser));
        }
      } catch {
        if (!cancelled) {
          clearSession();
          setUser(null);
          setIsAuthenticated(false);
          setAccess(buildAccess(null, true));
        }
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleStorageChange(event) {
      if (event.key === "pch.accessToken") {
        if (!event.newValue) {
          clearSession();
          setUser(null);
          setIsAuthenticated(false);
          setAccess(buildAccess(null, true));
        } else {
          const nextUser = getStoredUser();
          setUser(nextUser);
          setIsAuthenticated(true);
          loadAccess(nextUser).then(setAccess);
        }
      }
    }

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      isReady,
      isAuthenticated,
      accessReady: access.ready,
      can(resource, action = "view") {
        if (!resource) return true;
        if (access.locked || !access.ready) return true;
        if (!access.configured) {
          return grantAllows(grantsToSet(defaultGrants(access.principalRole)), resource, action);
        }
        return grantAllows(access.grants, resource, action);
      },
      async login(email, password, remember = false) {
        setRememberMe(remember);
        const data = await loginRequest(email, password, remember);
        const nextUser = data.user || getStoredUser() || { email };
        setUser(nextUser);
        setIsAuthenticated(true);
        setAccess(await loadAccess(nextUser));
        return data;
      },
      async logout() {
        try {
          await logoutRequest();
        } finally {
          setUser(null);
          setIsAuthenticated(false);
          setAccess(buildAccess(null, true));
        }
      },
    }),
    [user, isReady, isAuthenticated, access]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
