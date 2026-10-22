import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { resourceForPath } from "../navigation/menuCatalog";

const sections = [
  {
    title: "",
    items: [["/dashboard", "bi-house-fill", "Dashboard"]],
  },
  {
    title: "MANAGE",
    items: [
      ["/merchants", "bi-person-badge", "Merchants"],
      ["/stores", "bi-shop", "Stores"],
      ["/subscriptions", "bi-cart3", "Subscriptions"],
       ["/vendors", "bi-truck", "Vendors"],
    ],
  },
  {
    title: "MASTER SETUP",
    items: [
      [
        "/master-setup",
        "bi-sliders",
        "Master Setup",
        true,
        [
          ["/store-types/new", "bi-shop", "Store Types"],
          ["/features", "bi-grid-1x2", "Features"],
          ["/feature-permissions", "bi-shield-check", "Feature Permissions"],
          ["/role-templates", "bi-person-badge", "Role Templates"],
          ["/plans/new", "bi-credit-card", "Plans"],
          ["/tenders", "bi-cash-coin", "Tenders"],
        ],
      ],
      ["/menu-permissions", "bi-list-check", "Menu Permissions"],
    ],
  },
  {
    title: "OPERATIONS",
    items: [

      // ["/pos-configuration", "bi-cpu", "POS Configuration",],
      ["/orders", "bi-receipt", "Orders"],
      // ["/cash-management", "bi-wallet2", "Cash Management"],
      ["/employees", "bi-people", "Employees",],
      ["/devices", "bi-display", "Devices",],
      // ["/shifts", "bi-clock", "Shifts"],
      // ["/attendance", "bi-person-check", "Attendance"],
    ],
  },
  {
    title: "INTEGRATIONS",
    items: [
      ["/integrations", "bi-diagram-3", "Integrations"],
      ["/synchronization", "bi-arrow-repeat", "Synchronization"],
      ["/reconciliation", "bi-arrow-left-right", "Reconciliation"],
      ["/notifications", "bi-bell", "Notifications"],
    ],
  },
];

export default function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) {
  const location = useLocation();
  const { can, accessReady } = useAuth();
  const originPath = location.state?.from?.split("?")[0] || "";

  function allowedPath(path) {
    if (!accessReady) return true;
    const resource = resourceForPath(path);
    return !resource || can(resource, "view");
  }

  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => {
          if (item[4]) {
            return [item[0], item[1], item[2], item[3], item[4].filter((subItem) => allowedPath(subItem[0]))];
          }
          return item;
        })
        .filter((item) => (item[4] ? item[4].length > 0 : allowedPath(item[0]))),
    }))
    .filter((section) => section.items.length > 0);

  function isContextActive(path, isRouteActive) {
    // Order details are routed through /orders/:id even when opened from an
    // embedded merchant or store view. Keep the originating sidebar section
    // selected while the detail page is open.
    if (location.pathname.startsWith("/orders/") && originPath) {
      if (path === "/merchants") return originPath.startsWith("/merchants");
      if (path === "/stores") return originPath.startsWith("/stores");
      if (path === "/orders") return originPath.startsWith("/orders");
    }
    return isRouteActive;
  }

  const isMasterSetupRoute =
    location.pathname.startsWith("/store-types") ||
    location.pathname.startsWith("/features") ||
    location.pathname.startsWith("/permissions") ||
    location.pathname.startsWith("/role-templates") ||
    location.pathname.startsWith("/menu-permissions") ||
    location.pathname.startsWith("/plans") ||
    location.pathname.startsWith("/vendors") ||
    location.pathname.startsWith("/tenders");

  const [masterSetupOpen, setMasterSetupOpen] = useState(isMasterSetupRoute);

  useEffect(() => {
    if (isMasterSetupRoute) {
      setMasterSetupOpen(true);
    }
  }, [isMasterSetupRoute]);

  return (
    <aside
      className={`sidebar ${collapsed ? "sidebar-collapsed" : ""
        } ${mobileOpen ? "mobile-open" : ""}`}
    >
      <div className="sidebar-brand">
        <div className="brand-icon">
          <i className="bi bi-cloud-fill" />
        </div>

        {!collapsed && (
          <div className="brand-text">
            <div className="brand-title">PINAKA</div>
            <div className="brand-subtitle">COMMERCE HUB</div>
          </div>
        )}
      </div>

      <nav className="sidebar-menu">
        {visibleSections.map((section, sectionIndex) => (
          <div key={`${section.title}-${sectionIndex}`}>
            {section.title && !collapsed && (
              <div className="menu-section">{section.title}</div>
            )}

            {section.items.map(
              ([to, icon, label, hasArrow, subItems]) => {
                const isMasterSetup = label === "Master Setup";

                if (isMasterSetup) {
                  return (
                    <div key={to} className="master-setup-group">
                      <button
                        type="button"
                        className="menu-item master-setup-button"
                        aria-label={label}
                        aria-expanded={!collapsed && masterSetupOpen}
                        aria-controls="master-setup-submenu"
                        onClick={() => {
                          if (collapsed) {
                            setCollapsed(false);
                            setMasterSetupOpen(true);
                          } else {
                            setMasterSetupOpen((current) => !current);
                          }
                        }}
                      >
                        <i className={`bi ${icon}`} />

                        {!collapsed && <span>{label}</span>}

                        {!collapsed && (
                          <i
                            className={`bi bi-chevron-down arrow ${masterSetupOpen
                              ? "master-setup-arrow-open"
                              : ""
                              }`}
                          />
                        )}
                      </button>

                      {!collapsed && masterSetupOpen && (
                        <div id="master-setup-submenu" className="master-setup-submenu">
                          {subItems.map(([subTo, subIcon, subLabel]) => (
                            <NavLink
                              key={subTo}
                              to={subTo}
                              onClick={() => setMobileOpen(false)}

className={({ isActive }) => {
  const pathname = location.pathname;

  const isPermissionOverview =
    /^\/features\/[^/]+\/permissions\/[^/]+\/?$/.test(
      pathname
    );

  let active = isActive;

  // Store Types
  if (subTo === "/store-types/new") {
    active = pathname.startsWith("/store-types");
  }

  // Features
  if (subTo === "/features") {
    active =
      pathname === "/features" ||
      (pathname.startsWith("/features/") &&
        !isPermissionOverview);
  }

  // Feature Permissions
  if (subTo === "/feature-permissions") {
    active =
      pathname === "/feature-permissions" ||
      isPermissionOverview;
  }

  // Role Templates
  if (subTo === "/role-templates") {
    active =
      pathname === "/role-templates" ||
      pathname.startsWith("/role-templates/");
  }

  if (subTo === "/menu-permissions") {
    active = pathname.startsWith("/menu-permissions");
  }

  // Plans
  if (subTo === "/plans/new") {
    active =
      pathname === "/plans" ||
      pathname.startsWith("/plans/");
  }

  // Tenders
  if (subTo === "/tenders") {
    active =
      pathname === "/tenders" ||
      pathname.startsWith("/tenders/");
  }

  return `master-setup-submenu-item ${
    active ? "active" : ""
  }`;
}}

                            >
                              <i className={`bi ${subIcon}`} />
                              <span>{subLabel}</span>
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `menu-item ${isContextActive(to, isActive) ? "active" : ""}`
                    }
                  >
                    <i className={`bi ${icon}`} />

                    {!collapsed && <span>{label}</span>}

                    {!collapsed && hasArrow && (
                      <i className="bi bi-chevron-down arrow" />
                    )}
                  </NavLink>
                );
              }
            )}
          </div>
        ))}
      </nav>

      <button
        type="button"
        className="collapse-btn"
        onClick={() => setCollapsed(!collapsed)}
      >
        <i
          className={`bi ${collapsed ? "bi-chevron-right" : "bi-chevron-left"
            }`}
        />

        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}
