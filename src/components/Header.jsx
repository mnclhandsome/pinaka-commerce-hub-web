import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { listMerchants } from "../api/merchants";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Header({ onMobileMenu }) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const isStoreTypesScreen = pathname.startsWith("/store-types");
  const storeRouteId = pathname.match(/^\/(?:merchants\/[^/]+\/)?stores\/([^/]+)(?:\/|$)/)?.[1];
  const isStoreDetailsScreen = Boolean(storeRouteId && storeRouteId !== "new");
  const [merchants, setMerchants] = useState([]),
    [merchantError, setMerchantError] = useState("");
  useEffect(() => {
    if (isStoreTypesScreen || isStoreDetailsScreen) {
      setMerchants([]);
      setMerchantError("");
      return undefined;
    }

    let active = true;
    listMerchants()
      .then((rows) => {
        if (active) {
          setMerchants(rows);
          setMerchantError("");
        }
      })
      .catch((e) => {
        if (active) setMerchantError(e.message);
      });
    return () => {
      active = false;
    };
  }, [isStoreTypesScreen, isStoreDetailsScreen, pathname]);
  const { user, logout } = useAuth();
  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.email ||
      "Admin User"
    : "Admin User";
  const role = user?.role || "Super Admin";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "AD";

  const handleLogout = async () => {
    await logout();
    nav("/login", { replace: true });
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="sidebar-toggle" onClick={onMobileMenu}>
          <i className="bi bi-list" />
        </button>
        {!isStoreDetailsScreen && <select
          aria-label="Merchant"
          title={merchantError || "Choose merchant"}
          className="merchant-select"
          value={pathname.match(/^\/merchants\/([^/]+)\/stores/)?.[1] || "all"}
          onChange={(e) =>
            nav(
              e.target.value === "all"
                ? "/merchants"
                : `/merchants/${encodeURIComponent(e.target.value)}/stores`,
            )
          }
        >
          <option value="all">All Merchants</option>
          {merchants.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
          {merchantError && <option disabled>Unable to load merchants</option>}
        </select>}
        <div className="global-search">
          <i className="bi bi-search" />
          <input
            placeholder="Search merchants, stores, orders..."
            onKeyDown={(event) => event.key === "Enter" && nav("/merchants")}
          />
          <span className="search-shortcut">/</span>
        </div>
      </div>
      <div className="topbar-right">
        <button className="top-icon">
          <i className="bi bi-bell" />
          <span className="notification-count">12</span>
        </button>
        <button className="top-icon">
          <i className="bi bi-question-circle" />
        </button>
        <div className="profile">
          <div className="profile-avatar">{initials}</div>
          <div className="profile-info">
            <strong>{displayName}</strong>
            <small>{role}</small>
          </div>
          <button type="button" className="logout-btn" onClick={handleLogout}>
            Signout
          </button>
        </div>
      </div>
    </header>
  );
}
