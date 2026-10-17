import FilterDropdown from "../components/FilterDropdown";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getDashboardFeatures,
  getDashboardPlatformHealth,
  getDashboardSharedMetrics,
} from "../api/dashboard";

/* =========================================================
   KPI DATA
========================================================= */

const kpis = [
  {
    label: "Merchants",
    value: "148",
    trend: "+12%",
    detail: (
      <>
        <b className="is-good"><strong>139</strong>{" "}<span>active</span></b>
        <span><strong>4</strong>{" "}<span>onboarding</span></span>
        <span><strong>5</strong>{" "}<span>inactive</span></span>
      </>
    ),
    icon: "bi-shop",
    tone: "blue",
  },
  {
    label: "Stores",
    value: "342",
    trend: "+8%",
    detail: (
      <>
        <b className="is-good"><strong>331</strong>{" "}<span>active</span></b>
        <span><strong>6</strong>{" "}<span>pending</span></span>
        <span><strong>5</strong>{" "}<span>inactive</span></span>
      </>
    ),
    icon: "bi-buildings",
    tone: "green",
  },
  {
    label: "Employees",
    value: "2,486",
    trend: "+5%",
    detail: (
      <>
        <b className="is-warning"><strong>24</strong>{" "}<span>without roles</span></b>
        <span><strong>6</strong>{" "}<span>locked</span></span>
      </>
    ),
    icon: "bi-people",
    tone: "orange",
  },
  {
    label: "Active subscriptions",
    value: "136",
    trend: "+3%",
    detail: (
      <>
        <b className="is-warning"><strong>3</strong>{" "}<span>expiring</span></b>
        <span><strong>4</strong>{" "}<span>payment pending</span></span>
      </>
    ),
    icon: "bi-credit-card-2-front",
    tone: "purple",
  },
];

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
  const score = Object.prototype.hasOwnProperty.call(health, "platform_health_score_pct")
    ? health.platform_health_score_pct
    : firstValue(health, ["healthScore", "health_score", "score", "overallHealth"], null);
  return {
    score: score == null ? null : Number(String(score).replace(/%$/, "")),
    rows: [
      metricRow("Devices active", health.devices, "active_count", "total_count", "active_pct", "good"),
      metricRow("Stores synchronized", health.stores_synchronized, "synchronized_count", "eligible_count", "synchronized_pct", "warn"),
      metricRow("POS configuration complete", health.pos_configuration, "completed_count", "eligible_count", "completed_pct", "warn"),
    ],
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

/* =========================================================
   ADMINISTRATION MODULES
========================================================= */

const adminModules = [
  {
    title: "Merchants",
    icon: "bi-shop",
    rows: [
      ["Pending onboarding", "10"],
      ["Suspended accounts", "4"],
      ["Setup completion", "96%"],
    ],
    path: "/merchants",
  },
  {
    title: "Users & Access",
    icon: "bi-people",
    rows: [
      ["Total employees", "14"],
      ["Employees without roles", "126"],
      ["inactive", "30"],
    ],
    path: "/employees",
  },
  {
    title: "Stores",
    icon: "bi-buildings",
    rows: [
      ["Active stores", "331"],
      ["Pending stores", "6"],
      ["Inactive stores", "5"],
    ],
    path: "/stores",
  },
  {
    title: "Subscriptions",
    icon: "bi-credit-card",
    rows: [
      ["Trial", "5"],
      ["Expiring soon", "3"],
      ["Expired", "2"],
    ],
    path: "/subscriptions",
  },
];

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
  const [sharedMetrics, setSharedMetrics] = useState({ plans: null, entitlements: null, roles: null });
  const [healthLoadError, setHealthLoadError] = useState("");
  const [featuresLoadError, setFeaturesLoadError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      getDashboardPlatformHealth(),
      getDashboardFeatures(),
      getDashboardSharedMetrics(),
    ]).then(([healthResult, featuresResult, sharedMetricsResult]) => {
      if (!active) return;
      if (healthResult.status === "fulfilled") setHealth(normalizeHealth(healthResult.value));
      else setHealthLoadError(healthResult.reason?.message || "Could not load Platform Health.");
      if (featuresResult.status === "fulfilled") setFeatures(normalizeFeatures(featuresResult.value));
      else setFeaturesLoadError(featuresResult.reason?.message || "Could not load Features.");
      if (sharedMetricsResult.status === "fulfilled") setSharedMetrics(sharedMetricsResult.value);
    });
    return () => { active = false; };
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState("Today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [planFilter, setPlanFilter] = useState("All plans");

  const refresh = () => {
    setRefreshing(true);

    window.setTimeout(() => {
      setRefreshing(false);
    }, 700);
  };

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

                <strong>{item.value}</strong>

                <small>
                  <span className="dashboard-kpi-trend">
                    <i className="bi bi-arrow-up" />
                    {" "}
                    {item.trend}
                  </span>
                  <span className="trend-period">vs last 30 days</span>
                </small>

              </div>

              <div className="dashboard-kpi-details">
                {item.detail}
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
                style={{
                  "--included-percent": `${features.total ? (features.included / features.total) * 100 : 0}%`,
                  "--included-end": `${features.total ? ((features.included + features.excluded) / features.total) * 100 : 0}%`,
                }}
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

                        <b>{value}</b>

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
