import FilterDropdown from "../components/FilterDropdown";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    getAdministrationOverview,
  getDashboardFeatures,
  getDashboardPlatformHealth,
  getDashboardSharedMetrics,
} from "../api/dashboard";

/* =========================================================
   KPI DATA
========================================================= */

const defaultAdministrationOverview = {
  merchants: {},
  stores: {},
  employees: {},
  subscriptions: {},
  features: {},
};

const displayNumber = (value) =>
  value == null ? "—" : Number(value).toLocaleString();

const displayGrowth = (value) => {
  if (value == null || value === "") return "—";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "—";
  return `${numericValue > 0 ? "+" : ""}${numericValue}%`;
};

function buildKpis(overview) {
  return [
    {
      label: "Merchants",
      value: overview.merchants.total_count,
      trend: overview.merchants.growth_percentage,
      details: [
        ["active", overview.merchants.active_count, "is-good"],
        ["onboarding", overview.merchants.onboarding_count],
        ["inactive", overview.merchants.inactive_count],
      ],
      icon: "bi-shop",
      tone: "blue",
    },
    {
      label: "Stores",
      value: overview.stores.total_count,
      trend: overview.stores.growth_percentage,
      details: [
        ["active", overview.stores.active_count, "is-good"],
        ["pending", overview.stores.pending_count],
        ["inactive", overview.stores.inactive_count],
      ],
      icon: "bi-buildings",
      tone: "green",
    },
    {
      label: "Employees",
      value: overview.employees.total_count,
      trend: overview.employees.growth_percentage,
      details: [
        ["without roles", overview.employees.without_roles_count, "is-warning"],
        ["locked", overview.employees.locked_count],
      ],
      icon: "bi-people",
      tone: "orange",
    },
    {
      label: "Active subscriptions",
      value: overview.subscriptions.active_count,
      trend: overview.subscriptions.growth_percentage,
      details: [
        ["expiring", overview.subscriptions.expiring_count, "is-warning"],
        ["payment pending", overview.subscriptions.payment_pending_count],
      ],
      icon: "bi-credit-card-2-front",
      tone: "purple",
    },
  ];
}

/* =========================================================
   PLATFORM HEALTH
========================================================= */

const defaultHealth = {
  score: null,
  rows: [
    ["Devices active", "—", "—", "good", "0%"],
    ["Stores synchronized", "—", "—", "warn", "0%"],
    ["POS configuration complete", "—", "—", "warn", "0%"],
  ],
};

const defaultFeatures = { total: null, active: null, inactive: null, included: null, excluded: null };

const unwrapDashboardData = (response) => response?.data?.data ?? response?.data ?? response ?? {};
const firstValue = (source, keys, fallback) => {
  for (const key of keys) if (source?.[key] != null) return source[key];
  return fallback;
};
const asPercent = (value) => `${String(value).replace(/%$/, "")}%`;

function normalizeHealth(response) {
  const data = unwrapDashboardData(response);
  const health = data.platformHealth ?? data.platform_health ?? data.health ?? data;
  const metricRow = (label, metric, valueKey, totalKey, percentKey, tone) => {
    const value = metric?.[valueKey];
    const total = metric?.[totalKey];
    const numericPercent = metric?.[percentKey] ?? (Number(total) > 0 ? Math.round((Number(value) / Number(total)) * 100) : null);
    return [
      label,
      value != null && total != null ? `${value} / ${total}` : "—",
      numericPercent == null ? "—" : asPercent(numericPercent),
      tone,
      `${numericPercent ?? 0}%`,
    ];
  };
  const apiScore = Object.prototype.hasOwnProperty.call(health, "platform_health_score_pct")
    ? health.platform_health_score_pct
    : firstValue(health, ["healthScore", "health_score", "score", "overallHealth"], null);
  const rows = [
    metricRow("Devices active", health.devices, "active_count", "total_count", "active_pct", "good"),
    metricRow("Stores synchronized", health.stores_synchronized, "synchronized_count", "eligible_count", "synchronized_pct", "warn"),
    metricRow("POS configuration complete", health.pos_configuration, "completed_count", "eligible_count", "completed_pct", "warn"),
  ];
  const availablePercentages = rows
    .map(([, , percent]) => percent === "—" ? null : Number(String(percent).replace(/%$/, "")))
    .filter(value => Number.isFinite(value));
  const score = apiScore == null
    ? (availablePercentages.length
      ? Math.round(availablePercentages.reduce((sum, value) => sum + value, 0) / availablePercentages.length)
      : null)
    : Number(String(apiScore).replace(/%$/, ""));
  return {
    score: Number.isFinite(score) ? score : null,
    rows,
  };
}

function normalizeFeatures(response) {
  const data = unwrapDashboardData(response);
  const features = data.featureSummary ?? data.feature_summary ?? data.summary ?? data;
  const totalValue = firstValue(features, ["totalFeatures", "total_features", "total_features_count", "total"], null);
  const activeValue = firstValue(features, ["activeFeatures", "active_features", "active_features_count", "active"], null);
  const total = totalValue == null ? null : Number(totalValue);
  const active = activeValue == null ? null : Number(activeValue);
  const inactiveValue = firstValue(features, ["inactiveFeatures", "inactive_features", "inactive_features_count", "inactive"], null);
  const inactive = inactiveValue == null
    ? (total != null && active != null ? total - active : null)
    : Number(inactiveValue);
  return {
    total, active, inactive,
    included: firstValue(features, ["includedInPlans", "included_in_plans", "included_in_plans_count", "includedFeatures", "included_features"], null) == null
      ? null
      : Number(firstValue(features, ["includedInPlans", "included_in_plans", "included_in_plans_count", "includedFeatures", "included_features"], null)),
    excluded: firstValue(features, ["notIncludedInAnyPlan", "not_included_in_any_plan", "not_included_in_any_plan_count", "notIncludedFeatures", "not_included_features"], null) == null
      ? null
      : Number(firstValue(features, ["notIncludedInAnyPlan", "not_included_in_any_plan", "not_included_in_any_plan_count", "notIncludedFeatures", "not_included_features"], null)),
  };
}

function normalizeAdministrationOverview(response) {
  const data = unwrapDashboardData(response);
  return {
    merchants: data.merchants ?? {},
    stores: data.stores ?? {},
    employees: data.employees ?? {},
    subscriptions: data.subscriptions ?? {},
    features: data.features ?? {},
  };
}

/* =========================================================
   ADMINISTRATION MODULES
========================================================= */

function buildAdminModules(overview) {
  return [
    {
      title: "Merchants",
      icon: "bi-shop",
      rows: [
        ["Active merchants", overview.merchants.active_count],
        ["Pending onboarding", overview.merchants.onboarding_count],
        ["Inactive merchants", overview.merchants.inactive_count],
      ],
      path: "/merchants",
    },
    {
      title: "Users & Access",
      icon: "bi-people",
      rows: [
        ["Total employees", overview.employees.total_count],
        ["Employees without roles", overview.employees.without_roles_count],
        ["Locked employees", overview.employees.locked_count],
      ],
      path: "/employees",
    },
    {
      title: "Stores",
      icon: "bi-buildings",
      rows: [
        ["Active stores", overview.stores.active_count],
        ["Pending stores", overview.stores.pending_count],
        ["Inactive stores", overview.stores.inactive_count],
      ],
      path: "/stores",
    },
    {
      title: "Subscriptions",
      icon: "bi-credit-card",
      rows: [
        ["Active subscriptions", overview.subscriptions.active_count],
        ["Expiring soon", overview.subscriptions.expiring_count],
        ["Payment pending", overview.subscriptions.payment_pending_count],
      ],
      path: "/subscriptions",
    },
  ];
}

/* =========================================================
   PLANS & ENTITLEMENTS
========================================================= */

/* =========================================================
   DONUT
========================================================= */

function Donut({ value, className = "", percent = 91, style = {}, status = "Healthy" }) {
  return (
    <div className={`dashboard-donut ${className}`} style={{ "--donut-percent": `${percent}%`, ...style }}>
      <div className="dashboard-donut-hole">
        <strong>{value}</strong>

        <span>
          {className.includes("coverage") ? "Active features" : status}
        </span>
      </div>
    </div>
  );
}

function getFeatureDonutStyle(features) {
  const values = [features.total, features.active, features.inactive, features.included, features.excluded]
    .map(value => Math.max(0, Number(value) || 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return {};

  const zeroSlice = 1.5;
  const zeroCount = values.filter(value => value === 0).length;
  const visibleSpace = 100 - zeroCount * zeroSlice;
  const slices = values.map(value => value === 0 ? zeroSlice : (value / total) * visibleSpace);
  let edge = 0;
  const ends = slices.map(slice => (edge += slice));

  return {
    "--feature-total-end": `${ends[0]}%`,
    "--feature-active-end": `${ends[1]}%`,
    "--feature-inactive-end": `${ends[2]}%`,
    "--feature-included-end": `${ends[3]}%`,
  };
}

/* =========================================================
   SECTION HEADER
========================================================= */

function SectionHeader({
  icon,
  title,
  action,
  onAction,
}) {
  return (
    <div className="dash-section-header">
      <div className="dash-section-title">
        <span className="dash-section-icon">
          <i className={`bi ${icon}`} />
        </span>

        <h2>{title}</h2>
      </div>

      {action && (
        <button
          type="button"
          className="dash-link"
          onClick={onAction}
        >
          {action}
          <i className="bi bi-arrow-right" />
        </button>
      )}
    </div>
  );
}

/* =========================================================
   DASHBOARD
========================================================= */

export default function Dashboard() {
  const nav = useNavigate();

  const [health, setHealth] = useState(defaultHealth);
  const [features, setFeatures] = useState(defaultFeatures);
  const [administrationOverview, setAdministrationOverview] = useState(defaultAdministrationOverview);
  const [sharedMetrics, setSharedMetrics] = useState({ plans: null, entitlements: null, roles: null });
  const [healthLoadError, setHealthLoadError] = useState("");
  const [featuresLoadError, setFeaturesLoadError] = useState("");
  const [administrationLoadError, setAdministrationLoadError] = useState("");

  const loadDashboard = useCallback(async () => {
    const [healthResult, featuresResult, sharedMetricsResult, administrationResult] = await Promise.allSettled([
      getDashboardPlatformHealth(),
      getDashboardFeatures(),
      getDashboardSharedMetrics(),
      getAdministrationOverview(),
    ]);

    if (healthResult.status === "fulfilled") {
      setHealth(normalizeHealth(healthResult.value));
      setHealthLoadError("");
    } else {
      setHealthLoadError(healthResult.reason?.message || "Could not load Platform Health.");
    }

    if (featuresResult.status === "fulfilled") {
      setFeatures(normalizeFeatures(featuresResult.value));
      setFeaturesLoadError("");
    } else {
      setFeaturesLoadError(featuresResult.reason?.message || "Could not load Features.");
    }

    if (sharedMetricsResult.status === "fulfilled") setSharedMetrics(sharedMetricsResult.value);

    if (administrationResult.status === "fulfilled") {
      const overview = normalizeAdministrationOverview(administrationResult.value);
      setAdministrationOverview(overview);
      setFeatures((currentFeatures) => ({
        ...currentFeatures,
        total: overview.features.total_count ?? currentFeatures.total,
        active: overview.features.active_count ?? currentFeatures.active,
        inactive: overview.features.inactive_count ?? currentFeatures.inactive,
      }));
      setAdministrationLoadError("");
    } else {
      setAdministrationLoadError(
        administrationResult.reason?.message || "Could not load Administration Overview."
      );
    }
  }, []);

  useEffect(() => {
    loadDashboard().catch(() => {
      // Individual source failures are handled above with Promise.allSettled.
    });
  }, [loadDashboard]);

  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState("Today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [planFilter, setPlanFilter] = useState("All plans");

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadDashboard();
    } finally {
      setRefreshing(false);
    }
  };

  const kpis = buildKpis(administrationOverview);
  const adminModules = buildAdminModules(administrationOverview);

  return (
    <div className="page-content super-admin-dashboard">

      {/* =====================================================
          DASHBOARD HEADER
      ===================================================== */}

      <div className="super-dashboard-head">

        <div>
          <h1>Super Admin Dashboard</h1>

          <p>
            Platform administration, access governance and
            service health
          </p>
          <button
            type="button"
            className="dashboard-header-export"
          >
            <i className="bi bi-download" />
            Export Report
          </button>
        </div>

        <div className="dashboard-toolbar">

         {/* DATE RANGE FILTER */}
<FilterDropdown className="dashboard-filter dashboard-date-filter" aria-label="Date range" value={dateFilter}
  triggerIcon={<i className="bi bi-calendar3" aria-hidden="true" />}
  onChange={(event) => setDateFilter(event.target.value)}
  renderFooter={(close) => <div className="dashboard-custom-date">
    <span>Custom</span>
    <div className="dashboard-date-inputs">
      <input type="date" aria-label="Custom start date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} />
      <span>to</span>
      <input type="date" aria-label="Custom end date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} />
    </div>
    <button type="button" className="dashboard-custom-apply" disabled={!customStartDate || !customEndDate}
      onClick={() => { setDateFilter(`${customStartDate} - ${customEndDate}`); close(); }}>Apply</button>
  </div>}>
  <option>Today</option><option>Last 7 days</option><option>Last 30 days</option>
  {!["Today", "Last 7 days", "Last 30 days"].includes(dateFilter) && <option hidden disabled>{dateFilter}</option>}
</FilterDropdown>

      {/* MERCHANT FILTER */}
      <button className="dashboard-filter">
        All merchants
        <i className="bi bi-chevron-down" />
      </button>

      {/* PLAN FILTER */}
      <FilterDropdown className="dashboard-filter dashboard-plan-filter" aria-label="Plan" value={planFilter}
        onChange={(event) => setPlanFilter(event.target.value)}>
        <option>All plans</option><option>Basic</option><option>Pro</option><option>Enterprise</option>
      </FilterDropdown>

      {/* STORE FILTER */}
      <button className="dashboard-filter">
        All stores
        <i className="bi bi-chevron-down" />
      </button>

          <button
            className="dashboard-icon-btn"
            onClick={refresh}
            aria-label="Refresh"
          >
            <i
              className={`bi bi-arrow-clockwise ${
                refreshing ? "spin" : ""
              }`}
            />
          </button>

        </div>
      </div>

      {/* =====================================================
          KPI CARDS
      ===================================================== */}

      <section className="dashboard-kpis">

        {kpis.map((item) => (
          <article
            className={`dashboard-kpi ${item.tone}`}
            key={item.label}
          >
            <div className="dashboard-kpi-icon">
              <i className={`bi ${item.icon}`} />
            </div>

            <div className="dashboard-kpi-body">

              <span>{item.label}</span>

              <div className="dashboard-kpi-value-row">

                <strong>{displayNumber(item.value)}</strong>

                <small>
                  <span className="dashboard-kpi-trend">
                    <i className={`bi ${Number(item.trend) < 0 ? "bi-arrow-down" : "bi-arrow-up"}`} />
                    {" "}
                    {displayGrowth(item.trend)}
                  </span>
                  <span className="trend-period">vs last 30 days</span>
                </small>

              </div>

              <div className="dashboard-kpi-details">
                {item.details.map(([label, value, className]) => {
                  const detail = <><strong>{displayNumber(value)}</strong>{" "}<span>{label}</span></>;
                  return className
                    ? <b className={className} key={label}>{detail}</b>
                    : <span key={label}>{detail}</span>;
                })}
              </div>

            </div>
          </article>
        ))}

      </section>

      {/* =====================================================
          PLATFORM HEALTH + FEATURES
      ===================================================== */}

      <div className="dashboard-health-feature-grid">

        {/* ===================================================
            PLATFORM HEALTH
        =================================================== */}

        <section className="dashboard-panel platform-health-panel">

          <SectionHeader
            icon="bi-heart-pulse"
            title="Platform Health"
            action="Diagnostics"
            onAction={() => nav("/reports")}
          />

          {healthLoadError && <p className="dashboard-data-error">Platform Health: {healthLoadError}</p>}

          <div className="health-content">

            <div className="health-summary">

              <Donut
                value={health.score == null ? "—" : `${health.score}%`}
                percent={health.score ?? 0}
                status={health.score == null ? "Unavailable" : "Platform health"}
                className={health.score == null ? "unavailable" : ""}
                style={{ "--health-percent": `${health.score ?? 0}%` }}
              />


            </div>

            <div className="health-metrics">

              {health.rows.map(
                ([label, count, percent, tone, widthPercent = percent]) => (
                  <div
                    className="health-row"
                    key={label}
                  >

                    <div className="health-row-top">
                      <span>{label}</span>
                      <strong>{count}</strong>
                    </div>

                    <div className="health-progress-line">
                      <span
                        className={tone}
                        style={{ width: widthPercent }}
                      />
                    </div>

                    <b className="health-percent">
                      {percent}
                    </b>

                  </div>
                )
              )}

            </div>

          </div>

        </section>

        {/* ===================================================
            FEATURES & PLAN COVERAGE
        =================================================== */}

        <section className="dashboard-panel coverage-panel">

          <SectionHeader
            icon="bi-boxes"
            title="Features"
            action="Manage features"
            onAction={() => nav("/features")}
          />

          {featuresLoadError && <p className="dashboard-data-error">Features: {featuresLoadError}</p>}

          <div className="coverage-content">

            <div className="coverage-visual">

              <Donut
                value={features.active ?? "—"}
                className="coverage"
                percent={features.total ? (features.active / features.total) * 100 : 0}
                style={getFeatureDonutStyle(features)}
              />

            </div>

            <div className="coverage-legend">

            {/* Total Features */}
            <div className="feature-metric">
              <span className="legend-dot blue" />
              <span>Total Features</span>
              <b>{features.total ?? "—"}</b>
            </div>

            {/* Active Features */}
            <div className="feature-metric">
              <span className="legend-dot green" />
              <span>Active Features</span>
              <b>{features.active ?? "—"}</b>
            </div>

            {/* Inactive Features */}
            <div className="feature-metric">
              <span className="legend-dot slate" />
              <span>Inactive Features</span>
              <b>{features.inactive ?? "—"}</b>
            </div>

            {/* Included in Plans */}
            <div className="feature-metric">
              <span className="legend-dot teal" />
              <span>Included in Plans</span>
              <b>{features.included ?? "—"}</b>
            </div>

            {/* Not Included in Any Plan */}
            <div className="feature-metric">
              <span className="legend-dot orange" />
              <span>Not Included in Any Plan</span>
              <b>{features.excluded ?? "—"}</b>
            </div>

         
            </div>

          </div>

          <div className="coverage-bottom">

            

            {/*
            <div className="attention">
              <span>
                <i className="bi bi-exclamation-triangle" />
                Plan Gaps
              </span>
              <strong>2</strong>
            </div>
            */}

          </div>

        </section>

      </div>

      {/* =====================================================
          PLANS + ADMINISTRATION MODULES
      ===================================================== */}

      <div className="dashboard-lower-grid">

        {/* ===================================================
            PLANS & ENTITLEMENTS
        =================================================== */}

        <section className="dashboard-panel plans-entitlements-panel">

          <SectionHeader
            icon="bi-boxes"
            title="Plans & Entitlements"
            action="Manage plans"
            onAction={() => nav("/subscriptions")}
          />

          <div className="plan-tier-grid">

            {(sharedMetrics.plans || [
              { label: "Basic · 1 store", value: "—" },
              { label: "Pro · 3 stores", value: "—" },
              { label: "Executive · 5 stores", value: "—" },
            ]).map(
              ({ label, value }, index) => (
                <div
                  className="plan-tier-card"
                  key={label}
                >

                  <i
                    className={`plan-tier-icon bi ${["bi-shop", "bi-buildings", "bi-award"][index]}`}
                    aria-hidden="true"
                  />

                  <span>{label}</span>

                  <strong>{value}</strong>

                </div>
              )
            )}

          </div>

          <div className="plan-entitlement-list">

            <div className="plan-entitlement-row">

              <div>
                <strong>
                  Store capacity reached
                </strong>

                <span>
                  Merchants using all included stores
                </span>
              </div>

              <b>{sharedMetrics.entitlements?.storeCapacityReached ?? "—"}</b>

            </div>

            <div className="plan-entitlement-row">

              <div>
                <strong>
                  Terminal limit reached
                </strong>

                <span>
                  May require an additional terminal
                </span>
              </div>

              <b>{sharedMetrics.entitlements?.terminalLimitReached ?? "—"}</b>

            </div>

            <div className="plan-entitlement-row">

              <div>
                <strong>
                  Expired subscriptions
                </strong>

                <span>
                  Requires renewal or account review
                </span>
              </div>

              <b className="expired-value">
                {sharedMetrics.entitlements?.expiredSubscriptions ?? "—"}
              </b>

            </div>

          </div>

        </section>

        {/* ===================================================
            ADMINISTRATION MODULES
        =================================================== */}

        <section className="dashboard-panel administration-panel">

          <SectionHeader
            icon="bi-grid"
            title="Administration Overview"
            action="View all modules"
            onAction={() => nav("/merchants")}
          />

          {administrationLoadError && (
            <p className="dashboard-data-error">Administration Overview: {administrationLoadError}</p>
          )}

          <div className="admin-grid">

            {adminModules.map((module) => (

              <button
                className="admin-module"
                key={module.title}
                onClick={() => nav(module.path)}
              >

                <div className="admin-module-top">

                  <span className="admin-module-icon">
                    <i
                      className={`bi ${module.icon}`}
                    />
                  </span>

                  <strong>
                    {module.title}
                  </strong>

                  <i
                    className="bi bi-arrow-right admin-module-arrow"
                  />

                </div>

                <div className="admin-module-rows">

                  {module.rows.map(
                    ([label, value]) => (

                      <div key={label}>

                        <span>{label}</span>

                        <b>{displayNumber(value)}</b>

                      </div>

                    )
                  )}

                </div>

              </button>

            ))}

          </div>

        </section>

      </div>

      {/* =====================================================
          ROLES & PERMISSIONS
          DO NOT REMOVE / CHANGE
      ===================================================== */}

      <section className="dashboard-panel roles-panel">

        <SectionHeader
          icon="bi-shield-lock"
          title="Roles & Permissions"
          action="Manage roles"
          onAction={() => nav("/role-templates")}
        />

        <div className="roles-summary">

          <div>
            <strong>{sharedMetrics.roles?.activeTemplateCount ?? "—"}</strong>
            <span>active role templates</span>
          </div>

        </div>

        <div className="roles-grid">

          {(sharedMetrics.roles?.metrics || [
            ["System Roles", null, "bi-shield-check", "blue"],
            ["Custom Roles", null, "bi-person-badge", "purple"],
            ["Active role templates", null, "bi-key", "purple"],
            ["Total permissions", null, "bi-exclamation-circle", "orange"],
            ["Employees Assigned", null, "bi-person-check", "blue"],
          ]).map(
            ([label, value, icon, tone]) => (

              <div
                className={`role-metric ${tone}`}
                key={label}
              >

                <span className="role-metric-icon">
                  <i className={`bi ${icon}`} />
                </span>

                <div>

                  <span>{label}</span>

                  <strong>{value}</strong>

                </div>

              </div>

            )
          )}

        </div>

      </section>

      {/* =====================================================
          GROWTH / REPORTS
      ===================================================== */}

      <div className="dashboard-growth">

        <div className="growth-icon">
          <i className="bi bi-rocket-takeoff" />
        </div>

        <div>

          <strong>
            Platform growing steadily!
          </strong>

          <span>
            Keep your merchants, stores and teams
            connected for the best experience.
          </span>

        </div>

        <button
          onClick={() => nav("/reports")}
        >
          View Reports
          <i className="bi bi-arrow-right" />
        </button>

      </div>

    </div>
  );
}
