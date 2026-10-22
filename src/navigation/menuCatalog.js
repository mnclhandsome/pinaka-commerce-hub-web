/** Console menu contract shared by Menu Permissions and, later, the sidebar. */

export const MENU_SECTIONS = [
  {
    title: "Home",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        to: "/dashboard",
        icon: "bi-house-fill",
        description: "Landing screen after sign-in",
      },
    ],
  },
  {
    title: "MANAGE",
    items: [
      {
        key: "merchants",
        label: "Merchants",
        to: "/merchants",
        icon: "bi-person-badge",
        description: "All merchant accounts",
      },
      {
        key: "stores",
        label: "Stores",
        to: "/stores",
        icon: "bi-shop",
        description: "Store records, create, edit, and configuration",
      },
      {
        key: "subscriptions",
        label: "Subscriptions",
        to: "/subscriptions",
        icon: "bi-cart3",
        description: "Merchant subscription records",
      },
      {
        key: "vendors",
        label: "Vendors",
        to: "/vendors",
        icon: "bi-truck",
        description: "Vendor master data",
      },
    ],
  },
  {
    title: "MASTER SETUP",
    items: [
      {
        key: "store-types",
        label: "Store Types",
        to: "/store-types/new",
        icon: "bi-shop",
        description: "Store type definitions",
      },
      {
        key: "features",
        label: "Features",
        to: "/features",
        icon: "bi-grid-1x2",
        description: "Product feature catalog",
      },
      {
        key: "feature-permissions",
        label: "Feature Permissions",
        to: "/feature-permissions",
        icon: "bi-shield-check",
        description: "Permissions attached to features",
      },
      {
        key: "role-templates",
        label: "Role Templates",
        to: "/role-templates",
        icon: "bi-person-badge",
        description: "Role template catalog",
      },
      {
        key: "plans",
        label: "Plans",
        to: "/plans/new",
        icon: "bi-credit-card",
        description: "Subscription plans",
      },
      {
        key: "tenders",
        label: "Tenders",
        to: "/tenders",
        icon: "bi-cash-coin",
        description: "Tender types",
      },
      {
        key: "menu-permissions",
        label: "Menu Permissions",
        to: "/menu-permissions",
        icon: "bi-list-check",
        description: "Which menus each role can see",
      },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      {
        key: "pos-configuration",
        label: "POS Configuration",
        to: "/pos-configuration",
        icon: "bi-cpu",
        description: "Point of sale setup",
      },
      {
        key: "orders",
        label: "Orders",
        to: "/orders",
        icon: "bi-receipt",
        description: "Order operations",
      },
      {
        key: "cash-management",
        label: "Cash Management",
        to: "/cash-management",
        icon: "bi-wallet2",
        description: "Cash drawer and safe operations",
      },
      {
        key: "employees",
        label: "Employees",
        to: "/employees",
        icon: "bi-people",
        description: "Merchant employees",
      },
      {
        key: "devices",
        label: "Devices",
        to: "/devices",
        icon: "bi-display",
        description: "Registered devices",
      },
      {
        key: "shifts",
        label: "Shifts",
        to: "/shifts",
        icon: "bi-clock",
        description: "Shift records",
      },
      {
        key: "attendance",
        label: "Attendance",
        to: "/attendance",
        icon: "bi-person-check",
        description: "Attendance records",
      },
    ],
  },
  {
    title: "INTEGRATIONS",
    items: [
      {
        key: "integrations",
        label: "Integrations",
        to: "/integrations",
        icon: "bi-diagram-3",
        description: "External system connections",
      },
      {
        key: "synchronization",
        label: "Synchronization",
        to: "/synchronization",
        icon: "bi-arrow-repeat",
        description: "Catalog and data sync",
      },
      {
        key: "reconciliation",
        label: "Reconciliation",
        to: "/reconciliation",
        icon: "bi-arrow-left-right",
        description: "Payment and order reconciliation",
      },
      {
        key: "notifications",
        label: "Notifications",
        to: "/notifications",
        icon: "bi-bell",
        description: "Notification settings",
      },
    ],
  },
];

export const MENU_ITEMS = MENU_SECTIONS.flatMap((section) => section.items);

export const ALL_MENU_KEYS = MENU_ITEMS.map((item) => item.key);

const MERCHANT_MENU_KEYS = [
  "dashboard",
  "stores",
  "subscriptions",
  "pos-configuration",
  "orders",
  "cash-management",
  "employees",
  "devices",
  "shifts",
  "attendance",
];

export function defaultMenuKeys(principalRole) {
  if (principalRole === "MERCHANT") return [...MERCHANT_MENU_KEYS];
  if (principalRole === "MERCHANT_EMPLOYEE") return ["dashboard"];
  return [...ALL_MENU_KEYS];
}

const CRUD_KEYS = new Set([
  "merchants",
  "stores",
  "subscriptions",
  "vendors",
  "store-types",
  "features",
  "feature-permissions",
  "role-templates",
  "plans",
  "tenders",
  "employees",
  "devices",
  "pos-configuration",
]);

export const ACTION_NAMES = ["view", "create", "update", "delete"];

export function actionsFor(menuKey) {
  if (CRUD_KEYS.has(menuKey)) return ["view", "create", "update", "delete"];
  return ["view"];
}

export function resourceForPath(path) {
  return MENU_ITEMS.find((item) => item.to === path)?.key || null;
}
