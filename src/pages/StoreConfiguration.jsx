import { isUuid, normalizeStoreForConfiguration } from "../api/storeDetails";
import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";

import { getMerchant } from "../api/merchants";
import { getStoreCoupons } from "../api/storeCoupons";
import AddStore from "./AddStore";
import { getActiveSubscriptions, extractActiveSubscription } from "../api/subscriptions_stores";

import PosConfiguration from "./pos/PosConfiguration";
import Products from "./Products";
import Coupons from "./Coupons";
import Discounts from "./Discounts";
import Orders from "./Orders";
import StoreCustomers from "./StoreCustomers";
import FastKeys from "./FastKeys";
import StoreCategories from "./StoreCategories";
import StoreShifts from "./StoreShifts";
import SafeDrops from "./SafeDrops";
import StorePaymentRecords from "./StorePaymentRecords";
import VendorPayments from "./VendorPayments";
import MerchantVendors from "./MerchantVendors";
import EmployeeAttendance, { AttendanceDetails } from "./EmployeeAttendance";

import { api, ApiError, pendingStoreRead } from "../api/http";
import { endpoints } from "../api/endpoints";


import {
  fetchWordpressConnector,
  getWordpressConnector,
  saveWordpressConnector,
  syncWordpressAttributes,
  syncWordpressCategories,
  syncWordpressProducts,
  syncWordpressTags,
} from "../api/storeConnector";


/* =========================================================
   SIDEBAR GROUPS
   ========================================================= */

const navGroups = [
  {
    id: "store-setup",
    label: "Store Overview",
    items: [
      ["details", "bi-shop", "Store Details"],
      ["subscription", "bi-credit-card", "Subscription"],
    ],
  },
  {
    id: "access",
    label: "Access & Permissions",
    items: [
      ["features", "bi-grid", "Features"],
      ["roles", "bi-shield-check", "Roles & Permissions"],
    ],
  },

  {
    id: "configurations",
    label: "Configuration",
    collapsible: true,
    items: [
      ["overview", "bi-globe", "Website Connection"],
      ["pos", "bi-phone", "POS Configuration"],
    ],
  },

  {
    id: "people",
    label: "People",
    items: [
      ["users", "bi-people", "Employees"],
      ["attendance", "bi-calendar-check", "Employee Attendance"],
      ["customers", "bi-person-lines-fill", "Customers"],
      ["vendors", "bi-truck", "Vendors"],
    ],
  },

  {
    id: "catalog",
    label: "Catalog",
    items: [
      ["categories", "bi-tags", "Categories"],
      ["products", "bi-box-seam", "Products"],
      ["fastkeys", "bi-key-fill", "Fast Keys"],
    ],
  },

  {
    id: "sales",
    label: "Sales & Payments",
    items: [
      ["orders", "bi-receipt", "Orders"],
      ["paymentrecords", "bi-credit-card", "Payment History"],
      ["vendorhistory", "bi-clock-history", "Vendor History"],
    ],
  },

  {
    id: "promotions",
    label: "Promotions",
    items: [
      ["coupons", "bi-ticket-perforated", "Coupons"],
      ["discounts", "bi-percent", "Discounts"],
    ],
  },

  {
    id: "operations",
    label: "Store Operations",
    items: [
      ["shifts", "bi-clock-history", "Shift Management"],
      ["safedrops", "bi-safe", "Safe Drops"],
    ],
  },
];

/* =========================================================
   STORE CONFIGURATION
   ========================================================= */

function SummaryFields({ title, items }) {
  return <section className="store-overview-card">
    <h2>{title}</h2>
    <dl>{items.map(([label, value]) => <div key={label}>
      <dt>{label}</dt><dd>{value == null || value === "" ? "—" : value}</dd>
    </div>)}</dl>
  </section>;
}

function StoreDetailsSummary({ store, merchant }) {
  const address = typeof store.address === "object" && store.address ? store.address : {};
  const hours = store.hours || store.onboardingSetup?.hours || [];
  return <>
    <SummaryFields title="Store Details" items={[
      ["Store Name", store.name], ["Store Code", store.storeCode || store.id],
      ["Merchant", merchant?.name || store.merchantName],
      ["Store Type", typeof store.type === "object" ? store.type.name || store.type.code : store.type],
      ["Status", store.status], ["Currency", store.currency],
    ]} />
    <SummaryFields title="Contact & Location" items={[
      ["Phone", store.phone], ["Email", store.email || store.storeEmail], ["Website", store.url],
      ["Address", store.addressLine1 || address.street || address.addressLine1 || (typeof store.address === "string" ? store.address : "")],
      ["Address Line 2", store.addressLine2 || address.addressLine2],
      ["City", store.city || address.city], ["State / Province", store.state || address.state],
      ["Country", store.country || address.country], ["Postal Code", store.zip || store.postalCode || address.zipCode || address.postalCode],
    ]} />
    <section className="store-overview-card"><h2>Operating Hours</h2>
      <div className="store-overview-table"><table>
        <thead><tr>{["Day", "Status", "Open", "Close", "Shifts"].map(label => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{Array.isArray(hours) && hours.length ? hours.map((row, index) => <tr key={row.day || index}>
          <td>{row.day || "—"}</td><td>{row.status || "—"}</td><td>{row.open || "—"}</td><td>{row.close || "—"}</td><td>{row.shifts ?? "—"}</td>
        </tr>) : <tr><td colSpan={5}>No operating hours saved.</td></tr>}</tbody>
      </table></div>
    </section>
  </>;
}

function StoreSubscriptionSummary({ merchantId }) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setSubscription(null);
    async function load() {
      try {
        if (!merchantId) throw new Error("Merchant information is unavailable for this store.");
        const result = await pendingStoreRead(`merchant-active-subscriptions:${merchantId}`, () => getActiveSubscriptions(merchantId));
        if (active) setSubscription(extractActiveSubscription(result));
      } catch (err) {
        if (active) setError(err.message || "Unable to load subscription.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [merchantId, attempt]);
  if (loading) return <p role="status">Loading subscription…</p>;
  if (error) return <div className="alert alert-danger" role="alert">{error} <button type="button" className="btn btn-secondary" onClick={() => setAttempt(value => value + 1)}>Retry</button></div>;
  if (!subscription) return <section className="store-overview-card"><h2>Subscription</h2><p className="store-overview-empty">No active subscription found.</p></section>;
  const plan = subscription.plan || subscription.subscriptionPlan || {};
  return <SummaryFields title="Subscription" items={[
    ["Plan", subscription.planName || plan.name || (typeof plan === "string" ? plan : "")],
    ["Status", subscription.status], ["Billing", subscription.billingCycle || subscription.billingPeriod || plan.billingCycle],
    ["Price", subscription.price ?? subscription.amount ?? plan.price], ["Currency", subscription.currency || plan.currency],
    ["Start Date", subscription.startDate || subscription.startsAt],
    ["Renewal / End Date", subscription.renewalDate || subscription.endDate || subscription.expiresAt],
    ["Store Limit", subscription.storeLimit ?? subscription.locationLimit ?? plan.includedStores ?? plan.included_stores],
  ]} />;
}

function StoreCouponOverview({ merchantId, storeId }) {
  const [coupons, setCoupons] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getStoreCoupons(merchantId, storeId)
      .then((rows) => { if (active) setCoupons(rows); })
      .catch((failure) => { if (active) setError(failure.message || "Unable to load coupons."); });
    return () => { active = false; };
  }, [merchantId, storeId]);
  const activeCoupons = coupons.filter((coupon) => {
    const expiry = coupon.date_expires || coupon.expiryDate || coupon.expiry_date;
    const used = Number(coupon.usage_count ?? coupon.usedCount ?? coupon.used_count ?? 0);
    const limit = Number(coupon.usage_limit ?? coupon.usageLimit ?? 0);
    return (!expiry || new Date(expiry) >= new Date()) && !(limit > 0 && used >= limit) &&
      ["active", "enabled", ""].includes(String(coupon.status || "active").toLowerCase());
  });
  return <section className="store-overview-card">
    <h2>Coupons</h2>
    {error ? <p className="store-overview-empty" role="alert">{error}</p> : activeCoupons.length ? (
      <div className="store-overview-table"><table>
        <thead><tr><th>Coupon</th></tr></thead>
        <tbody>{activeCoupons.map((coupon, index) => <tr key={coupon.id || coupon.coupon_id || coupon.code || index}>
          <td>{coupon.code || coupon.coupon_code || "—"}</td>
        </tr>)}</tbody>
      </table></div>
    ) : <p className="store-overview-empty">No active coupons.</p>}
  </section>;
}

export default function StoreConfiguration() {
  const {
    merchantId,
    storeId,
    section = "details",
  } = useParams();

  const nav = useNavigate();
  const location = useLocation();
  const [editingSection, setEditingSection] = useState(false);
  const [revision, setRevision] = useState(0);
  const [attendanceDetailRecord, setAttendanceDetailRecord] = useState(null);
  useEffect(() => {
    setEditingSection(false);
    setAttendanceDetailRecord(null);
  }, [section, storeId]);

  /* =======================================================
     STORE STATE
     ======================================================= */

  const [merchant, setMerchant] = useState(null);
  const [storeResponse, setStoreResponse] = useState(null);
  const [store, setStore] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* =======================================================
     WORDPRESS CONNECTION STATE
     ======================================================= */

  const [siteUrl, setSiteUrl] = useState("");
  const [jwtToken, setJwtToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);

  const [message, setMessage] = useState("");
  const [connected, setConnected] = useState(false);
  const [jwtConfigured, setJwtConfigured] = useState(false);

  /* =======================================================
     SIDEBAR GROUP STATE
     ======================================================= */

  const [openGroup, setOpenGroup] = useState("store-setup");

  /*
   * Find the group that contains the current section.
   */
  const activeGroupId = useMemo(() => {
    return (
      navGroups.find((group) =>
        group.items.some(([id]) => id === section)
      )?.id || "store-setup"
    );
  }, [section]);

  /*
   * Automatically open the group containing
   * the currently selected screen.
   */
  useEffect(() => {
    setOpenGroup(activeGroupId);
  }, [activeGroupId]);

  /* =======================================================
     BASE PATH
     ======================================================= */

  const basePath = merchantId
    ? `/merchants/${merchantId}/stores/${storeId}/configuration`
    : `/stores/${storeId}/configuration`;

  /* =======================================================
     LOAD STORE
     ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadStore() {
      setLoading(true);
      setError("");

      try {
        const response = await pendingStoreRead(`store:${storeId}`, () => api.get(endpoints.store(encodeURIComponent(storeId))));
        const raw = response?.store || response?.data?.store || response?.data || response;
        if (!raw || typeof raw !== "object" || ![raw.id,raw.storeId,raw.storeID,raw.storeName,raw.name].some(Boolean)) throw new Error("Store not found.");
        const found = normalizeStoreForConfiguration(raw);
        found.uuid = [raw.id, raw._id, raw.storeUUID, raw.storeUuid, raw.store_uuid, raw.uuid, raw.storeId, raw.storeID]
          .find(isUuid) || "";
        const owner = found.merchantId || found.merchant_id || found.merchant?.id || found.merchant_uuid || merchantId;
        const hasMerchantName = Boolean(found.merchantName || found.merchant?.name);
        const result = owner && !hasMerchantName
          ? await pendingStoreRead(`merchant:${owner}`, () => getMerchant(owner)).catch(() => null)
          : null;
        if (!cancelled) { setStoreResponse(raw); setStore(found); setMerchant(result?.merchant || {name:found.merchantName || found.merchant?.name || "",id:owner}); }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Unable to load this store."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStore();

    return () => {
      cancelled = true;
    };
  }, [merchantId, storeId, revision]);

  /* =======================================================
     LOAD WORDPRESS CONNECTOR
     ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadConnector() {
      /*
       * Load saved connector information from the store record.
       */
      try {
        const saved = await pendingStoreRead(`connector:${storeId}:${merchantId}`, () => fetchWordpressConnector(storeId, merchantId));

        if (saved && !cancelled) {
          setSiteUrl(saved.siteUrl || "");
          setJwtToken(saved.jwtToken || "");
          setConnected(Boolean(saved.connected));
          setJwtConfigured(Boolean(saved.wordpressJwtConfigured || saved.jwtToken));

          if (saved.lastTestMessage) {
            setMessage(saved.lastTestMessage);
          }
        }
      } catch (err) {
        console.warn(
          "Could not load saved WordPress connector:",
          err
        );
      }
    }

    if (storeId && section === "overview") {
      loadConnector();
    }

    return () => {
      cancelled = true;
    };
  }, [merchantId, storeId, section]);

  /* =======================================================
     SET WEBSITE URL FROM STORE
     ======================================================= */

  useEffect(() => {
    if (!siteUrl && store?.url) {
      setSiteUrl(store.url);
    }
  }, [store, siteUrl]);

  /* =======================================================
     SAVE WORDPRESS CONNECTION
     ======================================================= */

  const restoreConnection = () => {
    const saved = getWordpressConnector(storeId);
    setSiteUrl(saved?.siteUrl || store?.url || "");
    setJwtToken(saved?.jwtToken || "");
    setConnected(Boolean(saved?.connected));
    setJwtConfigured(Boolean(saved?.wordpressJwtConfigured || saved?.jwtToken));
    setMessage("");
    setShowToken(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!editingSection || saving || syncing) return;

    if (!siteUrl.trim() || !jwtToken.trim()) {
      setMessage(
        "Enter the WordPress site URL and JWT token."
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const saved = await saveWordpressConnector(
        storeId,
        merchantId,
        {
          siteUrl,
          jwtToken,
          connected,
        }
      );

      setConnected(Boolean(saved?.connected));
      setJwtConfigured(Boolean(saved?.wordpressJwtConfigured || saved?.jwtToken));
      setMessage(
        saved?.lastTestMessage ||
          (saved?.syncedToApi
            ? "WordPress JWT saved for this store."
            : "WordPress JWT saved for this store on this browser.")
      );
      setEditingSection(false);
      setShowToken(false);
    } catch (err) {
      setMessage(
        err?.message ||
          "Unable to save the WordPress token."
      );
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     TEST WORDPRESS CONNECTION
     ======================================================= */

  const runSyncSteps = async (steps, doneMessage) => {
    if (syncing || saving || !connected) return;
    setSyncing(true);
    setMessage("");
    try {
      for (let index = 0; index < steps.length; index += 1) {
        const [label, action] = steps[index];
        setSyncProgress({
          label,
          percent: Math.round((index / steps.length) * 100),
        });
        await action(storeId);
      }
      setSyncProgress({ label: "Sync complete", percent: 100 });
      setMessage(doneMessage);
    } catch (err) {
      setMessage(err?.message || "Unable to sync WordPress data.");
      setSyncProgress(null);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncProducts = () => runSyncSteps(
    [["Syncing Products", syncWordpressProducts]],
    "Products synced.",
  );

  const handleSyncCategories = () => runSyncSteps(
    [
      ["Syncing Categories", syncWordpressCategories],
      ["Syncing Attributes", syncWordpressAttributes],
      ["Syncing Tags", syncWordpressTags],
    ],
    "Categories, attributes, and tags synced.",
  );

  /* =======================================================
     BACK TO STORES
     ======================================================= */

  const backToStores = () => {
    if (location.state?.returnTo) {
      nav(location.state.returnTo);
      return;
    }
    if (merchantId) {
      nav(`/merchants?view=${encodeURIComponent(merchantId)}&tab=stores`);
    } else {
      nav("/stores");
    }
  };

  const statusClass = useMemo(
    () =>
      (store?.status || "active")
        .toLowerCase()
        .replace(/\s+/g, "-"),
    [store]
  );

  const displayStoreCode = store?.storeCode || (String(store?.id || "").startsWith("STR-") ? store.id : "");
  const displayStoreName = store?.name && !isUuid(store.name)
    ? store.name
    : displayStoreCode || "Store";

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="page-content store-workspace-page">

      {/* ===================================================
          BREADCRUMB
          =================================================== */}

      <header className="breadcrumb-area store-workspace-topbar">

        {section === "attendance" && attendanceDetailRecord ? <>
          <button className="link-button" onClick={backToStores}><i className="bi bi-arrow-left" />Stores</button>
          <span>/</span><span>Store Details &amp; Configuration</span><span>/</span><span>Employee Attendance</span><span>/</span><strong>View Details</strong>
        </> : <>
          <button className="link-button" onClick={backToStores}><i className="bi bi-arrow-left" />Stores</button>
          <span>/</span><strong>Store Details &amp; Configuration</strong>
        </>}

      </header>

      {/* ===================================================
          LOADING
          =================================================== */}

      {loading ? (
        <section className="store-workspace-card">
          Loading store...
        </section>
      ) : error ? (
        <section className="store-workspace-card">
          {error}
        </section>
      ) : (
        <>
          {/* ===============================================
              STORE HEADER
              =============================================== */}

          {/* ===============================================
              WORKSPACE
              =============================================== */}

          <div className="store-workspace">

            {/* =============================================
                SIDEBAR
                ============================================= */}

            <aside className="store-subnav">

              {navGroups.map((group) => {

                const isCollapsible = group.collapsible !== false;
                const isOpen =
                  !isCollapsible || openGroup === group.id;

                return (
                  <div
                    className={`store-subnav-group ${
                      isOpen ? "open" : ""
                    } ${!isCollapsible ? "store-subnav-group-direct" : ""}`}
                    key={group.id}
                  >

                    {/* GROUP HEADER */}

                    {isCollapsible && <button
                      type="button"
                      className={`store-subnav-group-header ${
                        isOpen ? "open" : ""
                      }`}
                      onClick={() =>
                        setOpenGroup(
                          (current) =>
                            current === group.id
                              ? null
                              : group.id
                        )
                      }
                      aria-expanded={isOpen}
                    >

                      <span>
                        {group.label}
                      </span>

                      <i
                        className={`bi ${
                          isOpen
                            ? "bi-chevron-up"
                            : "bi-chevron-down"
                        }`}
                      />

                    </button>}

                    {/* GROUP ITEMS */}

                    {isOpen && (
                      <div className="store-subnav-group-items">

                        {group.items.map(
                          ([id, icon, label]) => (
                            <NavLink
                              key={id}
                              to={`${basePath}/${id}`}
                              end
                              className={`store-subnav-item ${
                                section === id
                                  ? "active"
                                  : ""
                              }`}
                            >

                              <i
                                className={`bi ${icon}`}
                              />

                              <span>
                                {label}
                              </span>

                            </NavLink>
                          )
                        )}

                      </div>
                    )}

                  </div>
                );
              })}

            </aside>

            {/* =============================================
                MAIN CONTENT
                ============================================= */}

            <section className="store-workspace-main">
              <div className="store-workspace-header">

                <div>

                  <h1>
                    {displayStoreName}
                  </h1>

                  <p>
                    {displayStoreCode || "Store ID unavailable"}

                    {merchant?.name
                      ? ` • ${merchant.name}`
                      : ""}
                  </p>

                </div>

                <span
                  className={`store-status ${statusClass}`}
                >
                  {connected
                    ? "Website Connected"
                    : store?.status || "Active"}
                </span>

              </div>

              {/* ===========================================
                  STORE OVERVIEW & SETUP
                  =========================================== */}

              <div className="store-workspace-card">
              {section === "attendance" && attendanceDetailRecord ? (
                <AttendanceDetails record={attendanceDetailRecord} store={store} onBack={() => setAttendanceDetailRecord(null)} />
              ) : section === "details" ? (
                <StoreDetailsSummary store={store} merchant={merchant} />
              ) : section === "subscription" ? (
                <StoreSubscriptionSummary merchantId={merchantId || store.merchantId || merchant?.id} />
              ) : ["features", "roles", "users"].includes(section) ? (
                <div>
                  <AddStore existingStore={storeResponse} merchantContext={merchant} key={section + ":" + revision + ":" + editingSection} embeddedStep={{features:2,roles:3,users:4}[section]} readOnly={!editingSection} onEdit={() => setEditingSection(true)} onDone={() => {setEditingSection(false);setRevision(v => v + 1);}} />
                </div>
              ) : section === "overview" ? (
                <>
                <div className="store-panel">
                  <div className="store-panel-heading">
                    <div><h2>Website Connection</h2><p>{editingSection ? "Update the website URL and JWT token for this store." : "View the saved JWT connection status."}</p></div>
                    <div className="store-panel-actions">
                      {connected && <>
                        <button type="button" className="sf-outline" onClick={handleSyncCategories} disabled={syncing || saving}>Sync Category</button>
                        <button type="button" className="sf-outline" onClick={handleSyncProducts} disabled={syncing || saving}>Sync Product</button>
                      </>}
                      {!editingSection && <button type="button" className="store-config-btn" onClick={() => {restoreConnection();setEditingSection(true);}}><i className="bi bi-pencil" aria-hidden="true" /> Edit</button>}
                    </div>
                  </div>
                  {!editingSection ? (
                    <SummaryFields title="Website Connection" items={[
                      ["Connection Status", <span className={`connection-pill ${connected ? "connected" : "not-connected"}`}>{connected ? "Connected" : "Not connected"}</span>],
                      ["Website URL", siteUrl],
                      ["JWT Token", jwtConfigured || jwtToken ? "Configured" : "Not configured"],
                    ]} />
                  ) : (
                    <form className="store-connection-section" onSubmit={handleSave}>
                      <fieldset disabled={saving || syncing} style={{border:0,padding:0,margin:0,minWidth:0}}>
                        <label className="store-field">WordPress Site URL
                          <input type="url" placeholder="https://your-store.com" value={siteUrl} onChange={event => setSiteUrl(event.target.value)} required />
                        </label>
                        <label className="store-field">WordPress JWT Token
                          <div className="token-input">
                            <textarea rows={5} placeholder="Paste the JWT generated by WordPress" value={jwtToken} onChange={event => setJwtToken(event.target.value)} required spellCheck={false} style={{WebkitTextSecurity:showToken ? "none" : "disc"}} />
                            <button type="button" className="token-toggle-btn" onClick={() => setShowToken(value => !value)} aria-pressed={showToken}>{showToken ? "Hide Token" : "Show Token"}</button>
                          </div>
                        </label>
                        <div className="store-form-actions">
                          <button type="button" className="sf-outline" onClick={() => {restoreConnection();setEditingSection(false);}}>Cancel</button>
                          <button type="submit" className="store-config-btn">{saving ? "Saving…" : "Save Changes"}</button>
                        </div>
                      </fieldset>
                    </form>
                  )}
                  {syncProgress && <div className="store-sync-progress" role="status">
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span>{syncProgress.label}</span>
                      <span>{syncProgress.percent}%</span>
                    </div>
                    <progress max={100} value={syncProgress.percent} style={{ width: "100%" }} />
                  </div>}
                  {message && <div className="store-message info" role="status">{message}</div>}
                </div>
                <StoreCouponOverview merchantId={merchant?.id || merchant?.merchantId || merchant?.merchant_id || store?.merchantId || store?.merchant_id || store?.merchant?.id || merchantId} storeId={store?.uuid || storeId} />
                </>

              ) : section === "pos" ? (

                <PosConfiguration
                  merchantId={merchant?.id || merchant?.merchantId || merchant?.merchant_id || store?.merchantId || store?.merchant_id || store?.merchant?.id || merchantId}
                  storeId={store?.uuid || ""}
                  store={store}
                  embedded
                />

              /* ===========================================
                 EMPLOYEES
                 =========================================== */

              ) : section === "products" ? (

                <Products
                  merchantId={merchantId}
                  storeId={storeId}
                  store={store}
                  embedded
                />

              /* ===========================================
                 CATEGORIES
                 =========================================== */

              ) : section === "categories" ? (

                <StoreCategories
                  merchantId={merchantId}
                  storeId={storeId}
                  store={store}
                  embedded
                />

              /* ===========================================
                 VENDORS
                 =========================================== */

              ) : section === "vendors" ? (

                <MerchantVendors
                  storeId={store?.uuid || storeId}
                  merchantId={merchant?.id || merchant?.merchantId || merchant?.merchant_id || store?.merchantId || store?.merchant_id || store?.merchant?.id || merchantId}
                />

              ) : section === "vendorhistory" ? (

                <VendorPayments
                  key={section}
                  viewMode="payments"
                  merchantId={merchantId}
                  storeId={storeId}
                  store={store}
                  embedded
                />

              /* ===========================================
                 COUPONS
                 =========================================== */

              ) : section === "coupons" ? (

                <Coupons
                  merchantId={merchantId}
                  storeId={storeId}
                  store={store}
                  embedded
                />

              ) : section === "discounts" ? (

                <Discounts
                  merchantId={merchantId}
                  storeId={storeId}
                  store={store}
                  embedded
                />

              /* ===========================================
                 ORDERS
                 =========================================== */

              ) : section === "orders" ? (

                <Orders
                  merchantId={merchantId}
                  storeId={storeId}
                  store={store}
                  embedded
                />

              /* ===========================================
                 FAST KEYS
                 =========================================== */

              ) : section === "fastkeys" ? (

                <FastKeys />

              /* ===========================================
                 SHIFT MANAGEMENT
                 =========================================== */

              ) : section === "shifts" ? (

                <StoreShifts
                  merchantId={merchantId || store?.merchantId || store?.merchant_id || merchant?.id}
                  storeId={storeId}
                  store={store}
                  embedded
                />

              ) : section === "safedrops" ? (

                <SafeDrops store={store} />

              ) : section === "attendance" ? (

                <EmployeeAttendance store={store} embedded onViewRecord={setAttendanceDetailRecord} />

              /* ===========================================
                 PAYMENT RECORDS
                 =========================================== */

              ) : section === "paymentrecords" ? (

                <StorePaymentRecords
                  merchantId={merchantId}
                  storeId={storeId}
                  store={store}
                  embedded
                />

              /* ===========================================
                 CUSTOMERS
                 =========================================== */

              ) : section === "customers" ? (

                <StoreCustomers
                  merchantId={merchantId}
                  storeId={storeId}
                  store={store}
                  embedded
                />

              /* ===========================================
                 FALLBACK
                 =========================================== */

              ) : (

                <div className="store-panel">

                  <h2>
                    Store Configuration
                  </h2>

                  <p>
                    Select a configuration
                    section from the sidebar.
                  </p>

                </div>

              )}

              </div>
            </section>

          </div>
        </>
      )}
    </div>
  );
}



