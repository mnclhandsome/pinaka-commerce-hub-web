import FilterDropdown from "../components/FilterDropdown";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

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

const healthRows = [
  ["Devices online", "974 / 982", "99%", "good"],
  ["Stores synchronized", "337 / 342", "98%", "warn"],
  ["POS configuration complete", "336 / 342", "98%", "warn"],
  ["Integrations connected", "144 / 148", "97%", "warn"],
];

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

const planEntitlements = [
  ["Basic · 1 store", "48"],
  ["Pro · 3 stores", "46"],
  ["Executive · 5 stores", "18"],
];

/* =========================================================
   ROLE & PERMISSION METRICS
   KEEP AS-IS
========================================================= */

const roleMetrics = [
  ["System Roles", "8", "bi-shield-check", "blue"],
  ["Custom Roles", "6", "bi-person-badge", "purple"],
  ["Active role templates", "126", "bi-key", "purple"],
  ["Total permissions", "24", "bi-exclamation-circle", "orange"],
  ["Employees Assigned", "2,456", "bi-person-check", "blue"],
  
];

/* =========================================================
   DONUT
========================================================= */

function Donut({ value, className = "" }) {
  return (
    <div className={`dashboard-donut ${className}`}>
      <div className="dashboard-donut-hole">
        <strong>{value}</strong>

        <span>
          {className.includes("coverage")
            ? "Active features"
            : "Healthy"}
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

          <div className="health-content">

            <div className="health-summary">

              <Donut value="91%" />


            </div>

            <div className="health-metrics">

              {healthRows.map(
                ([label, count, percent, tone]) => (
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
                        style={{ width: percent }}
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

          <div className="coverage-content">

            <div className="coverage-visual">

              <Donut
                value="44"
                className="coverage"
              />

            </div>

            <div className="coverage-legend">

            {/* Total Features */}
            <div className="feature-metric">
              <span className="legend-dot blue" />
              <span>Total Features</span>
              <b>48</b>
            </div>

            {/* Active Features */}
            <div className="feature-metric">
              <span className="legend-dot green" />
              <span>Active Features</span>
              <b>44</b>
            </div>

            {/* Inactive Features */}
            <div className="feature-metric">
              <span className="legend-dot slate" />
              <span>Inactive Features</span>
              <b>4</b>
            </div>

            {/* Included in Plans */}
            <div className="feature-metric">
              <span className="legend-dot teal" />
              <span>Included in Plans</span>
              <b>41</b>
            </div>

            {/* Not Included in Any Plan */}
            <div className="feature-metric">
              <span className="legend-dot orange" />
              <span>Not Included in Any Plan</span>
              <b>3</b>
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

            {planEntitlements.map(
              ([label, value], index) => (
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

              <b>21</b>

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

              <b>5</b>

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
                3
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
            <strong>14</strong>
            <span>active role templates</span>
          </div>

          <span className="attention-text">
            <i className="bi bi-exclamation-circle" />
            {" "}
            3 require attention
          </span>

        </div>

        <div className="roles-grid">

          {roleMetrics.map(
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
