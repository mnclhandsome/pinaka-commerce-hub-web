import { api } from "./http";

const configuredDashboardBase =
  import.meta.env.VITE_ADMIN_DASHBOARD_API_BASE_URL ||
  "/admin-api/api/v1/admin/dashboard";
const dashboardBase = configuredDashboardBase.replace(
  /^\/api\/v1(?=\/admin\/dashboard(?:\/|$))/,
  "/admin-api/api/v1",
);

export const getDashboardPlatformHealth = () => api.get(`${dashboardBase}/platform-health`);
export const getDashboardFeatures = () => api.get(`${dashboardBase}/features`);

const roleMetric = (label, value, icon, tone) => [
  label,
  value === null || value === undefined ? "—" : Number(value).toLocaleString(),
  icon,
  tone,
];

async function loadPlansEntitlements() {
  const response = await api.get(`${dashboardBase}/plans-entitlements`);
  const plans = Array.isArray(response?.plans) ? response.plans : [];
  const totals = response?.totals || {};

  return {
    plans: plans.slice(0, 3).map(plan => {
      const stores = Number(plan.includedStores ?? 0);
      return {
        label: `${plan.planName || "Plan"} · ${stores} ${stores === 1 ? "store" : "stores"}`,
        value: Number(plan.activeSubscriptions ?? 0).toLocaleString(),
      };
    }),
    entitlements: {
      storeCapacityReached: Number(totals.merchantsAtStoreCapacity ?? 0),
      terminalLimitReached: Number(totals.merchantsAtTerminalCapacity ?? 0),
      expiredSubscriptions: Number(totals.expiredSubscriptions ?? 0),
    },
  };
}

async function loadRolesPermissions() {
  const response = await api.get(`${dashboardBase}/roles-permissions`);
  return {
    activeTemplateCount: Number(response?.activeRoleTemplates ?? 0),
    needsAttention: Number(response?.rolesRequiringAttention ?? 0),
    metrics: [
      roleMetric("System Roles", response?.systemRoles, "bi-shield-check", "blue"),
      roleMetric("Custom Roles", response?.customRoles, "bi-person-badge", "purple"),
      roleMetric("Active role templates", response?.activeRoleTemplates, "bi-key", "purple"),
      roleMetric("Total permissions", response?.totalPermissions, "bi-exclamation-circle", "orange"),
      roleMetric("Employees Assigned", response?.employeesAssigned, "bi-person-check", "blue"),
    ],
  };
}

export async function getDashboardSharedMetrics() {
  const [plansResult, rolesResult] = await Promise.allSettled([
    loadPlansEntitlements(),
    loadRolesPermissions(),
  ]);

  return {
    plans: plansResult.status === "fulfilled" ? plansResult.value.plans : null,
    entitlements: plansResult.status === "fulfilled" ? plansResult.value.entitlements : null,
    roles: rolesResult.status === "fulfilled" ? rolesResult.value : null,
    failedSources: [
      ...(plansResult.status === "rejected" ? ["Plans & Entitlements"] : []),
      ...(rolesResult.status === "rejected" ? ["Roles & Permissions"] : []),
    ],
  };
}
