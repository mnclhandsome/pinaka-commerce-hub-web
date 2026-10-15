import { pendingStoreRead } from "../api/http";
import { useMemo, useState, useEffect } from "react";
import { listMerchants } from "../api/merchants";
import Pagination from "../components/Pagination";
import ListActions from "../components/ListActions";
import FiltersBar from "../components/FiltersBar";
import {

  Eye,
  Search,
  ChevronDown,
  Download,
  Store,
  Crown,
  Zap,
  Star,
  CheckCircle2,
  XCircle,
  Clock3,
  ArrowLeft,
  ArrowRight,
  Check,
  ArrowLeftRight,
  Info,
  CreditCard,
  Lock,
  Smartphone,
  Landmark,
  CircleCheck,
  RefreshCw,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import { listPlans, getMerchantFormPlans } from "../api/plans";

import {

  changeSubscriptionPlan,
  listSubscriptions,
  listSubscriptionPlans,
  getSubscription,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  subscriptionPayload,
  mapSubscriptionToRow,

} from "../api/subscriptions";

import "../styles/Merchant-subscriptions.css";

const emptySubscription = {
  merchantId: "",
  planCode: "",
  planName: "",
  maxStoresAllowed: 1,
  entitlements: "",
  billingCycle: "MONTHLY",
  trialDays: 0,
  price: 0,
  status: "ACTIVE",
  currentPeriodStart: "",
  currentPeriodEnd: "",
};

const crudPlanCode = (plan) => plan?.planCode || plan?.code || plan?.id || "";
const crudPlanName = (plan) => plan?.planName || plan?.name || plan?.planCode || plan?.code || "Plan";
const crudPlanFeatures = (plan) => {
  const features = plan?.entitlements || plan?.includedFeatures || plan?.included_features || plan?.features || [];
  return Array.isArray(features)
    ? features.map((item) => typeof item === "string" ? item : item?.name || item?.featureKey || item?.code).filter(Boolean)
    : String(features || "").split(",").map((item) => item.trim()).filter(Boolean);
};

const planKey = (plan) => String(plan?.id || plan?.planCode || plan?.code || plan?.name || "");

const planName = (plan) => plan?.name || plan?.planName || plan?.planCode || "Plan";

const planFeatures = (plan) => {

  const features = plan?.includedFeatures || plan?.included_features || plan?.features || [];

  return features.map((feature) =>

    typeof feature === "string" ? feature : feature?.name || feature?.featureKey || feature?.code

  ).filter(Boolean);

};

const normalizeStoreTypeValue = (value) =>

  String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

const storeTypeValues = (value) => {

  if (!value) return [];

  if (typeof value !== "object") return [value];

  return [

    value.id,

    value._id,

    value.storeTypeId,

    value.store_type_id,

    value.storeTypeCode,

    value.store_type_code,

    value.code,

    value.name,

    value.storeTypeName,

  ].filter(Boolean);

};

const planStoreTypeValues = (plan) => {

  const storeType =

    plan?.storeType || plan?.store_type || plan?.applicableStoreType || {};

  return [

    ...storeTypeValues(storeType),

    plan?.storeTypeId,

    plan?.store_type_id,

    plan?.applicableStoreTypeId,

    plan?.applicable_store_type_id,

  ].filter(Boolean).map(normalizeStoreTypeValue);

};

const planMatchesStoreType = (plan, merchant) => {

  const selectedValues = [

    merchant?.storeTypeId,

    merchant?.storeTypeCode,

    merchant?.storeTypeName,

  ].map(normalizeStoreTypeValue).filter(Boolean);

  const planValues = planStoreTypeValues(plan);

  return planValues.some((value) => selectedValues.includes(value));

};

const planPrice = (plan, cycle = "MONTHLY") => {

  const basePrice = Number(plan?.basePrice ?? plan?.base_price ?? plan?.price ?? 0);

  const normalizedCycle = String(plan?.billingCycle || plan?.billing_cycle || "").toUpperCase();

  if (cycle === "ANNUAL") {

    return Number(plan?.annualPrice ?? plan?.yearlyPrice ?? plan?.yearly ??

      (normalizedCycle === "YEARLY" || normalizedCycle === "ANNUAL" ? basePrice : basePrice * 12));

  }

  return Number(plan?.monthlyPrice ??

    (normalizedCycle === "YEARLY" || normalizedCycle === "ANNUAL" ? basePrice / 12 : basePrice));

};

const formatPrice = (amount, currency = "INR") => {

  try {

    return new Intl.NumberFormat("en-IN", {

      style: "currency",

      currency: String(currency || "INR").toUpperCase(),

      maximumFractionDigits: 2,

    }).format(Number(amount) || 0);

  } catch {

    return `${currency || "INR"} ${Number(amount || 0).toLocaleString("en-IN")}`;

  }

};

const findCurrentPlan = (merchant, plans) =>

  plans.find((plan) =>

    (merchant?.planId && String(plan.id) === String(merchant.planId)) ||

    planName(plan).toLowerCase() === String(merchant?.plan || "").toLowerCase()

  ) || {

    id: merchant?.planId,

    name: merchant?.plan || "Current plan",

    basePrice: merchant?.price || 0,

    currency: merchant?.currency || "INR",

    includedStores: merchant?.stores || 0,

    includedTerminals: merchant?.devices || 0,

    includedFeatures: merchant?.entitlements || [],

  };

const addCycleToDate = (date, cycle) => {

  const nextDate = new Date(`${date}T00:00:00Z`);

  if (cycle === "ANNUAL") nextDate.setUTCFullYear(nextDate.getUTCFullYear() + 1);

  else nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);

  return nextDate.toISOString().slice(0, 10);

};

/* ========================================

   COMMON COMPONENTS

\======================================== */

function StatusBadge({ status }) {

  const normalized = String(status || "Inactive")

    .toLowerCase()

    .replaceAll(" ", "-");

  return (

    <span className={`status-badge ${normalized}`}>

      <i />

      {status}

    </span>

  );

}

function PageBack({ label, onClick }) {

  return (

    <button className="page-back" onClick={onClick}>

      <ArrowLeft size={17} />

      {label}

    </button>

  );

}

function SelectField({ value, onChange, children }) {

  return (

    <div className="select-field">

      <select value={value} onChange={onChange}>

        {children}

      </select>

      <ChevronDown size={16} />

    </div>

  );

}

function DetailRow({ label, value }) {

  return (

    <div className="detail-row">

      <span>{label}</span>

      <strong>{value}</strong>

    </div>

  );

}

/* ========================================

   LIST SCREEN

\======================================== */

function SubscriptionList({
  subscriptions,
  loading,
  error,
  onReload,
  onView,
  onAdd,
  onEdit,
  onDelete,
  crudBusy,
}) {
const [search, setSearch] = useState("");
const [plan, setPlan] = useState("");
const [status, setStatus] = useState("");
const [stores, setStores] = useState("");

const [dateRange, setDateRange] = useState("");
const [startDate, setStartDate] = useState("");
const [endDate, setEndDate] = useState("");
const [datePickerOpen, setDatePickerOpen] = useState(false);

const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(10);

const handlePageSizeChange = (size) => {
  setPageSize(size);
  setPage(1);
};

  /* ========================================
     OVERVIEW STATS
  ======================================== */

  const stats = useMemo(() => {
    const total = subscriptions.length;

    const active = subscriptions.filter(
      (s) => String(s.status || "").toLowerCase() === "active"
    ).length;

    const inactive = subscriptions.filter((s) => {
      const value = String(s.status || "").toLowerCase();

      return value === "inactive" || value === "cancelled";
    }).length;

    const expiring = subscriptions.filter((s) => {
      const value = String(s.status || "").toLowerCase();

      return value === "expiring soon" || value === "expired";
    }).length;

    const activePercentage =
      total > 0 ? ((active / total) * 100).toFixed(1) : "0.0";

    const inactivePercentage =
      total > 0 ? ((inactive / total) * 100).toFixed(1) : "0.0";

    return {
      total,
      active,
      inactive,
      expiring,
      activePercentage,
      inactivePercentage,
    };
  }, [subscriptions]);

  /* ========================================
     FILTER OPTIONS
  ======================================== */

  const availablePlans = useMemo(() => {
    return [
      ...new Set(
        subscriptions
          .map((s) => s.plan)
          .filter(Boolean)
      ),
    ];
  }, [subscriptions]);

  const availableStatuses = useMemo(() => {
    const list = ["Active", "Inactive"];
    subscriptions.forEach((s) => {
      if (s.status) {
        const formatted =
          String(s.status).trim().charAt(0).toUpperCase() +
          String(s.status).trim().slice(1).toLowerCase();
        if (
          !list.some(
            (item) => item.toLowerCase() === formatted.toLowerCase()
          )
        ) {
          list.push(formatted);
        }
      }
    });
    return list;
  }, [subscriptions]);

  const availableStoreCounts = useMemo(() => {
    return [
      ...new Set(
        subscriptions
          .map((s) => s.stores)
          .filter(
            (value) =>
              value !== undefined &&
              value !== null &&
              value !== ""
          )
      ),
    ].sort((a, b) => Number(a) - Number(b));
  }, [subscriptions]);

  /* ========================================
     FILTERED DATA
  ======================================== */

  const filtered = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return subscriptions.filter((item) => {
      const merchantName = String(item.merchant || "").toLowerCase();
      const subscriptionId = String(item.id || "").toLowerCase();
      const merchantId = String(item.merchantId || "").toLowerCase();
      const itemPlan = String(item.plan || "").toLowerCase();
      const itemStatus = String(item.status || "").toLowerCase();
      const itemStores = String(item.stores ?? "");

      /*
       * Normalize subscription start date.
       * rawStart is preferred because it contains the API date.
       */
      const itemStartDate = item.rawStart
        ? String(item.rawStart).slice(0, 10)
        : "";

      const matchesSearch =
        !searchValue ||
        merchantName.includes(searchValue) ||
        subscriptionId.includes(searchValue) ||
        merchantId.includes(searchValue);

      const matchesPlan =
        !plan ||
        itemPlan === String(plan).toLowerCase();

      const filterStatus = String(status || "").trim().toLowerCase();

      const matchesStatus =
        !status ||
        itemStatus === filterStatus ||
        (filterStatus === "inactive" &&
          (itemStatus === "inactive" ||
            itemStatus === "cancelled" ||
            itemStatus === "canceled" ||
            itemStatus === "expired" ||
            item.is_deleted === true ||
            Boolean(item.deletedAt))) ||
        (filterStatus === "active" && itemStatus === "active");

      const matchesStores =
        !stores ||
        itemStores === String(stores);

      /*
       * Date range:
       * Start Date From = inclusive
       * Start Date To   = inclusive
       */
      const matchesStartDateFrom =
        !startDate ||
        (itemStartDate && itemStartDate >= startDate);

      const matchesStartDateTo =
        !endDate ||
        (itemStartDate && itemStartDate <= endDate);

      return (
        matchesSearch &&
        matchesPlan &&
        matchesStatus &&
        matchesStores &&
        matchesStartDateFrom &&
        matchesStartDateTo
      );
    });
  }, [
    subscriptions,
    search,
    plan,
    status,
    stores,
    startDate,
    endDate,
  ]); 

  /* ========================================
     PAGINATION
  ======================================== */

 const totalPages = Math.ceil(filtered.length / pageSize) || 1;

const currentPage = Math.min(page, totalPages);

const paginatedData = filtered.slice(
  (currentPage - 1) * pageSize,
  currentPage * pageSize
);

useEffect(() => {
  setPage(1);
}, [
  search,
  plan,
  status,
  stores,
  startDate,
  endDate,
]);

useEffect(() => {
  setPage((currentPage) =>
    Math.min(currentPage, totalPages)
  );
}, [totalPages]); 

const handleDateRangeChange = (value) => {
    setDateRange(value);

    const today = new Date();

    if (value === "") {
        setStartDate("");
        setEndDate("");
    } else if (value === "today") {
        const date = today.toISOString().split("T")[0];

        setStartDate(date);
        setEndDate(date);
    } else if (value === "7days") {
        const from = new Date(today);
        from.setDate(today.getDate() - 6);

        setStartDate(from.toISOString().split("T")[0]);
        setEndDate(today.toISOString().split("T")[0]);
    } else if (value === "30days") {
        const from = new Date(today);
        from.setDate(today.getDate() - 29);

        setStartDate(from.toISOString().split("T")[0]);
        setEndDate(today.toISOString().split("T")[0]);
    } else if (value === "month") {
        const from = new Date(
            today.getFullYear(),
            today.getMonth(),
            1
        );

        setStartDate(from.toISOString().split("T")[0]);
        setEndDate(today.toISOString().split("T")[0]);
    } else if (value === "custom") {
        setDatePickerOpen(true);
    }

    setPage(1);
};


  /* ========================================
     RESET FILTERS
  ======================================== */

  const resetFilters = () => {
    setSearch("");
    setPlan("");
    setStatus("");
    setStores("");
    setDateRange("");
    setStartDate("");
    setEndDate("");
    setDatePickerOpen(false);
    setPage(1);
};

  const hasActiveFilters =
    search !== "" ||
    plan !== "" ||
    status !== "" ||
    stores !== "" ||
    startDate !== "" ||
    endDate !== "";

  /* ========================================
     EXPORT
  ======================================== */

  const handleExport = () => {
    if (!filtered.length) return;

    const headers = [
      "Subscription ID",
      "Merchant",
      "Merchant ID",
      "Plan",
      "Stores",
      "Devices",
      "Start Date",
      "End Date",
      "Status",
      "Price",
      "Billing Cycle",
    ];

    const rows = filtered.map((item) => [
      `"${item.id || ""}"`,
      `"${String(item.merchant || "").replace(/"/g, '""')}"`,
      `"${item.merchantId || ""}"`,
      `"${item.plan || ""}"`,
      item.stores ?? "",
      item.devices ?? "",
      `"${item.start || ""}"`,
      `"${item.end || ""}"`,
      `"${item.status || ""}"`,
      `"${item.currency || "INR"} ${item.price ?? 0}"`,
      `"${item.billingCycle || ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);

    const link = document.createElement("a");

    link.setAttribute("href", encodedUri);

    link.setAttribute(
      "download",
      `subscriptions_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
    );

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);
  };


  /* ========================================
     RENDER
  ======================================== */

  return (
    <section className="merchant-subscriptions-page">

      {/* ========================================
          PAGE HEADER
      ======================================== */}

      <div className="subscriptions-heading-row">

        <div>
          <h1>Merchant Subscriptions</h1>

          <p>
            View and manage subscription details for all merchants.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
          }}
        >

 <button
            type="button"
            className="flow-button primary"
            onClick={onAdd}
            disabled={crudBusy}
            title="Add Subscription"
          >
             <i className="bi bi-plus-lg" />
            Add Subscription
          </button>

          <button
            className="flow-button secondary"
            onClick={handleExport}
            disabled={!filtered.length}
          >
            <Download size={17} />
            Export
          </button>

         

        </div>

      </div>

      {/* ========================================
          ERROR
      ======================================== */}

      {error && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: "16px",
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            borderRadius: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{error}</span>

          <button
            type="button"
            onClick={onReload}
            style={{
              background: "none",
              border: "none",
              color: "#991b1b",
              textDecoration: "underline",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ========================================
          OVERVIEW
      ======================================== */}

      <div className="subscription-overview subscription-overview-refined">

        <div className="overview-cards">

          <div className="overview-card total-card">

            <span className="overview-icon purple">
              <i className="bi bi-shop-window" aria-hidden="true" />
            </span>

            <div>
              <p>Total Subscriptions</p>

              <strong>{stats.total}</strong>

              <small className="positive overview-meta">
                <i /> Live Records
              </small>
            </div>

          </div>

          <div className="overview-card active-card">

            <span className="overview-icon green">
              <i className="bi bi-check-circle-fill" aria-hidden="true" />
            </span>

            <div>
              <p>Active Subscriptions</p>

              <strong>{stats.active}</strong>

              <small className="positive overview-meta">
                <i /> {stats.activePercentage}% of total
              </small>
            </div>

          </div>

          <div className="overview-card inactive-card">

            <span className="overview-icon red">
              <i className="bi bi-x-circle-fill" aria-hidden="true" />
            </span>

            <div>
              <p>Inactive Subscriptions</p>

              <strong>{stats.inactive}</strong>

              <small className="negative overview-meta">
                <i /> {stats.inactivePercentage}% of total
              </small>
            </div>

          </div>

          <div className="overview-card expiring-card">

            <span className="overview-icon orange">
              <i className="bi bi-clock-fill" aria-hidden="true" />
            </span>

            <div>
              <p>Expiring Soon</p>

              <strong>{stats.expiring}</strong>

              <small className="warning overview-meta">
                <i />{" "}
                {stats.expiring > 0
                  ? "Within next 30 days"
                  : "Review required"}
              </small>
            </div>

          </div>

        </div>

      </div>

      {/* ========================================
          TABLE CARD
      ======================================== */}

      <div className="subscription-table-card">

        {/* ========================================
            FILTER BAR
        ======================================== */}

       <FiltersBar
    searchValue={search}
    onSearchChange={(value) => {
        setSearch(value);
        setPage(1);
    }}
    searchPlaceholder="Search merchant name, code or ID"
    filters={[
        {
            key: "plan",
            label: "Plan",
            value: plan,
            options: [
                { label: "All Plans", value: "" },
                ...availablePlans.map((item) => ({
                    label: item,
                    value: item,
                })),
            ],
            onChange: (value) => {
                setPlan(value);
                setPage(1);
            },
        },
        {
            key: "status",
            label: "Status",
            value: status,
            options: [
                { label: "All Statuses", value: "" },
                ...availableStatuses.map((item) => ({
                    label: item,
                    value: item,
                })),
            ],
            onChange: (value) => {
                setStatus(value);
                setPage(1);
            },
        },
        {
            key: "stores",
            label: "Store Count",
            value: stores,
            options: [
                { label: "Any Store Count", value: "" },
                ...availableStoreCounts.map((item) => ({
                    label: `${item} ${
                        Number(item) === 1 ? "Store" : "Stores"
                    }`,
                    value: String(item),
                })),
            ],
            onChange: (value) => {
                setStores(value);
                setPage(1);
            },
        },
        {
            key: "dateRange",
            label: "Date Range",
            value: dateRange,
            options: [
                { label: "Any Date", value: "" },
                { label: "Today", value: "today" },
                { label: "Last 7 Days", value: "7days" },
                { label: "Last 30 Days", value: "30days" },
                { label: "This Month", value: "month" },
                { label: "Custom Range", value: "custom" },
            ],
            onChange: handleDateRangeChange,
        },
    ]}
    onClear={resetFilters}
/>

        {/* ========================================
            FILTER RESULT INFO
        ======================================== */}

  

        {/* ========================================
            TABLE
        ======================================== */}

        <div className="subscription-table-wrapper">

          <table className="subscription-table">

            <thead>

              <tr>
                <th>Merchant</th>
                <th>Plan</th>
                <th>Stores</th>
                <th>Devices</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>
                  <td
                    colSpan="9"
                    style={{
                      textAlign: "center",
                      padding: "40px",
                    }}
                  >
                    Loading subscriptions...
                  </td>
                </tr>

              ) : paginatedData.length === 0 ? (

                <tr>
                  <td
                    colSpan="9"
                    style={{
                      textAlign: "center",
                      padding: "40px",
                    }}
                  >
                    No subscriptions found.
                  </td>
                </tr>

              ) : (

                paginatedData.map(
                  (item, index) => (
                    <tr
                      key={item.id || index}
                      onClick={() => onView(item)}
                      style={{ cursor: "pointer" }}
                    >


                      <td>
                        <div className="subscription-merchant-cell">

                          <strong>
                            {item.merchant}
                          </strong>

                          {item.merchantId && item.merchantId !== item.merchant && (
                            
                            <small>
                              {item.merchantId}
                            </small>
                            
                          )}

                        </div>
                      </td>

                      <td>
                        {item.plan || "-"}
                      </td>

                      <td>
                        {item.stores ?? "-"}
                      </td>

                      <td>
                        {item.devices ?? "-"}
                      </td>

                      <td>
                        {item.start || "-"}
                      </td>

                      <td>
                        {item.end || "-"}
                      </td>

                      <td>
                        <StatusBadge
                          status={
                            item.status ||
                            "Inactive"
                          }
                        />
                      </td>

                      <td onClick={(e) => e.stopPropagation()}>
    <ListActions
        onView={() => onView(item)}
        viewLabel={`View ${item.merchant || "Subscription"}`}
    />
</td>
                    </tr>
                  )
                )

              )}

            </tbody>

          </table>

        </div>

        {/* ========================================
            PAGINATION
        ======================================== */}

      
 <Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  totalItems={filtered.length}
  pageSize={pageSize}
  onPageChange={setPage}
  onPageSizeChange={handlePageSizeChange}
  itemLabel="subscriptions"
  showWhenEmpty={true}
/>

      </div>

    </section>
  );
}

/* ========================================

   DETAILS SCREEN

\======================================== */

function SubscriptionDetails({ merchant, onBack, onChangePlan }) {


  if (!merchant) return null;

  const entitlements =

    Array.isArray(merchant.entitlements) && merchant.entitlements.length > 0

      ? merchant.entitlements

      : planFeatures(merchant.planDetails || {});

  const planLabel = merchant.plan || "Current Plan";

  const billingLabel = merchant.billingCycle || "MONTHLY";

  const entitlementItems = entitlements.map((entry, index) => {

    const value = typeof entry === "object" && entry ? entry : {};

    const reference = String(

      value.id || value.featureId || value.feature_id || value.code || entry || "",

    ).trim();


    return {

      id: reference || String(index),

      name:


        value.name ||

        value.featureName ||

        value.feature_name ||

        value.featureKey ||

        value.code ||

        reference,

    };

  });

  return (

    <section className="subscription-flow-page subscription-details-redesign">

      <PageBack label="Back to Subscriptions" onClick={onBack} />

      <div className="subscription-details-heading">

        <h1>Subscription Details</h1>

        <p className="flow-subtitle">View subscription information for this merchant.</p>

      </div>

      <div className="subscription-details-summary">

        <div className="subscription-merchant-profile">

          <div className="subscription-merchant-logo"><Store size={32} /></div>

          <div className="subscription-merchant-copy">

            <h2>{merchant.merchant}</h2>

            <div className="subscription-reference-line">

              <span>{merchant.merchantId || merchant.id}</span>

            </div>

            <div className="subscription-profile-badges">

              <StatusBadge status={merchant.status} />

              <span className="subscription-plan-pill">{planLabel}</span>

            </div>

          </div>

        </div>

        <div className="subscription-summary-metric">

          <div className="subscription-metric-icon purple"><Store size={23} /></div>

          <div><span>Stores Allowed</span><strong>{merchant.stores}</strong></div>

        </div>

        <div className="subscription-summary-metric">

          <div className="subscription-metric-icon blue"><Smartphone size={23} /></div>

          <div><span>Devices Allowed</span><strong>{merchant.devices}</strong></div>

        </div>

        <div className="subscription-summary-metric validity">

          <div className="subscription-metric-icon orange"><Clock3 size={23} /></div>

          <div>

            <span>Plan Validity</span>

            <strong className="validity-dates">{merchant.start} to {merchant.end}</strong>

            <small>{billingLabel === "YEARLY" || billingLabel === "ANNUAL" ? "(1 Year)" : billingLabel}</small>

          </div>

        </div>

      </div>

      <div className="subscription-details-content-grid">

        <div className="subscription-details-panel information-panel">

          <div className="subscription-panel-heading">

            <div className="subscription-panel-icon blue"><Info size={22} /></div>

            <div>

              <h3>Subscription Information</h3>

              <p>Key details about this merchant&apos;s subscription.</p>

            </div>

          </div>

          <div className="subscription-information-list">

            <div className="subscription-information-row"><span>Merchant Name</span><strong>{merchant.merchant}</strong></div>

            <div className="subscription-information-row"><span>Subscription Reference</span><strong>{merchant.id}</strong></div>

            <div className="subscription-information-row">

              <span>Current Plan</span>

              <strong><span className="subscription-plan-pill inline">{planLabel}</span></strong>

            </div>

            <div className="subscription-information-row"><span>Status</span><strong><StatusBadge status={merchant.status} /></strong></div>

            <div className="subscription-information-row"><span>Start Date</span><strong>{merchant.start}</strong></div>

            <div className="subscription-information-row"><span>End Date</span><strong>{merchant.end}</strong></div>

            <div className="subscription-information-row"><span>Stores</span><strong>{merchant.stores} allowed</strong></div>

            <div className="subscription-information-row"><span>Devices</span><strong>{merchant.devices} allowed</strong></div>

            <div className="subscription-information-row"><span>Pricing</span><strong>{merchant.currency || "USD"} {merchant.price} / {billingLabel}</strong></div>

          </div>

        </div>

        <div className="subscription-details-panel entitlements-panel">

          <div className="subscription-panel-heading">

            <div className="subscription-panel-icon green"><Store size={22} /></div>

            <div>

              <h3>Plan Features &amp; Entitlements <span className="subscription-entitlements-count">{entitlementItems.length}</span></h3>

              <p>Features included in the {planLabel} for this merchant.</p>

            </div>

          </div>

          <div className="subscription-entitlements-list">

            {entitlementItems.map((feature) => (

              <div className="subscription-entitlement-item" key={feature.id}>

                <span className="subscription-feature-check"><Check size={17} /></span>

                <div className="subscription-feature-copy"><strong>{feature.name}</strong></div>

                <span className="subscription-included-pill">Included</span>

              </div>

            ))}

            {entitlementItems.length === 0 && (

              <div className="subscription-empty-entitlements">No plan features are available for this subscription.</div>

            )}

          </div>

        </div>

      </div>

      <div className="subscription-change-plan-bar">

        <div className="subscription-change-message">

          <span className="subscription-change-info"><Info size={18} /></span>

          <div>

            <strong>Need to change the plan?</strong>

            <p>Upgrade or downgrade the subscription plan for this merchant.</p>

          </div>

        </div>

        <button className="subscription-change-plan-button" onClick={onChangePlan}>

          <ArrowLeftRight size={18} />Change Subscription Plan

        </button>

      </div>

    </section>

  );

}

/* ========================================

   CHOOSE PLAN SCREEN

\======================================== */

function ChoosePlan({
  merchant,
  plans,
  plansLoading,
  plansError,
  selectedPlan,
  setSelectedPlan,
  onBack,
  onNext,
}) {
  const currentPlan = findCurrentPlan(merchant, plans);
  const currentKey = merchant?.planId || planKey(currentPlan);
  const planIcons = [Crown, Zap, Star];

  return (
    <section className="subscription-flow-page choose-plan-redesign">
      <div className="choose-plan-back-strip">
        <PageBack label="Back to Subscription Details" onClick={onBack} />
      </div>

      <div className="choose-plan-layout">
        <aside className="subscription-stepper choose-plan-stepper" aria-label="Subscription change progress">
          <div className="subscription-step active">
            <span className="step-number">1</span>
            <div><strong>Choose Subscription Plan</strong><p>Select a plan for your merchant.</p></div>
          </div>
          <div className="subscription-step">
            <span className="step-number">2</span>
            <div><strong>Confirm Plan Change</strong><p>Review the plan details.</p></div>
          </div>
          <div className="subscription-step">
            <span className="step-number">3</span>
            <div><strong>Payment</strong><p>Complete the payment.</p></div>
          </div>
          <div className="subscription-step">
            <span className="step-number">4</span>
            <div><strong>Confirmation</strong><p>Plan updated successfully.</p></div>
          </div>
        </aside>

        <div className="choose-plan-main">
          <div className="choose-plan-heading">
            <h1>Choose Subscription Plan</h1>
            <p className="flow-subtitle">
              Plans for {merchant?.storeTypeName || "this store type"} ({merchant?.merchant}).
            </p>
          </div>

          {plansError && <div className="payment-error">{plansError}</div>}

          <div className="plans-grid choose-plan-grid">
            {plansLoading ? (
              <p className="choose-plan-loading">Loading plans…</p>
            ) : plans.map((plan, index) => {
              const key = planKey(plan);
              const isSelected = selectedPlan === key;
              const isCurrent =
                (merchant?.planId && String(plan.id) === String(merchant.planId)) ||
                planName(plan).toLowerCase() === String(merchant?.plan || "").toLowerCase();
              const price = planPrice(plan);
              const annualPrice = planPrice(plan, "ANNUAL");
              const features = planFeatures(plan);
              const PlanIcon = planIcons[index % planIcons.length];

              return (
                <div
                  className={`plan-card choose-plan-card plan-tone-${index % 3} ${isSelected ? "selected" : ""} ${isCurrent ? "current" : ""}`}
                  key={key}
                  onClick={() => {
                    if (!isCurrent) setSelectedPlan(key);
                  }}
                >
                  <div className="choose-plan-card-top">
                    <span className="plan-visual-icon"><PlanIcon size={27} /></span>
                    {isCurrent && <span className="current-plan-badge">Current Plan</span>}
                  </div>

                  <div className="plan-card-header">
                    <div>
                      <h3>{planName(plan)}</h3>
                      <p>{plan.description || "Subscription plan"}</p>
                    </div>
                  </div>

                  <div className="plan-divider" />

                  <div className="plan-price">
                    {formatPrice(price, plan.currency)}
                    <span> / month</span>
                  </div>
                  <div className="plan-yearly">{formatPrice(annualPrice, plan.currency)} / annual</div>

                  <div className="plan-capacity-row">
                    <div className="plan-capacity-item">
                      <span className="capacity-icon"><Store size={21} /></span>
                      <div><strong>Stores</strong><small>Up to {plan.includedStores ?? plan.included_stores ?? 0} Stores</small></div>
                    </div>
                    <div className="plan-capacity-item">
                      <span className="capacity-icon"><Smartphone size={21} /></span>
                      <div><strong>Devices</strong><small>Up to {plan.includedTerminals ?? plan.included_terminals ?? 0} Devices</small></div>
                    </div>
                  </div>

                  <ul className="feature-list choose-plan-features">
                    {features.map((feature) => (
                      <li key={feature}><Check size={16} />{feature}</li>
                    ))}
                  </ul>

                  <button
                    className={`select-plan-btn ${isSelected ? "chosen" : ""}`}
                    disabled={isCurrent}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isCurrent) setSelectedPlan(key);
                    }}
                  >
                    {isCurrent ? "Current Plan" : isSelected ? "Selected" : "Select Plan"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="info-banner choose-plan-info-banner">
            <Info size={21} />
            <div>
              <strong>You are changing the subscription plan for {merchant?.merchant}.</strong>
              <p>After selecting a plan, you will be able to review the changes before proceeding to payment.</p>
            </div>
          </div>

          <div className="flow-bottom-actions choose-plan-actions">
            <button
              className="primary-flow-button"
              disabled={!selectedPlan || selectedPlan === currentKey || plansLoading || !plans.length}
              onClick={onNext}
            >
              Next <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ========================================

   CONFIRM PLAN CHANGE

\======================================== */

function ConfirmPlanChange({ merchant, plans, selectedPlan, onBack, onNext }) {
  const current = findCurrentPlan(merchant, plans);
  const next = plans.find((plan) => planKey(plan) === selectedPlan) || current;
  const difference = planPrice(next) - planPrice(current);
  const currentFeatures = planFeatures(current);
  const nextFeatures = planFeatures(next);
  const comparedFeatures = [...new Set([...currentFeatures, ...nextFeatures])];
  const currency = next.currency || current.currency || "INR";

  const currentStores = current.includedStores ?? current.included_stores ?? merchant?.stores ?? 0;
  const currentDevices = current.includedTerminals ?? current.included_terminals ?? merchant?.devices ?? 0;
  const nextStores = next.includedStores ?? next.included_stores ?? 0;
  const nextDevices = next.includedTerminals ?? next.included_terminals ?? 0;

  return (
    <section className="subscription-flow-page confirm-plan-redesign">
      <div className="confirm-plan-back-strip">
        <PageBack label="Back to Choose Plan" onClick={onBack} />
      </div>

      <div className="confirm-plan-layout">
        <aside className="subscription-stepper confirm-stepper" aria-label="Subscription plan change progress">
          <div className="subscription-step">
            <span className="step-number">1</span>
            <div><strong>Choose Subscription Plan</strong><p>Select a plan for your merchant.</p></div>
          </div>
          <div className="subscription-step active">
            <span className="step-number">2</span>
            <div><strong>Confirm Plan Change</strong><p>Review the plan details.</p></div>
          </div>
          <div className="subscription-step">
            <span className="step-number">3</span>
            <div><strong>Payment</strong><p>Complete the payment.</p></div>
          </div>
          <div className="subscription-step">
            <span className="step-number">4</span>
            <div><strong>Confirmation</strong><p>Plan updated successfully.</p></div>
          </div>
        </aside>

        <main className="confirm-plan-content">
          <div className="confirm-plan-heading">
            <h1>Confirm Plan Change</h1>
            <p className="flow-subtitle">Please review the changes before proceeding to payment.</p>
          </div>

          <div className="confirm-plan-cards">
            <div className="confirm-plan-card current">
              <div className="confirm-plan-card-icon"><Store size={21} /></div>
              <div className="confirm-plan-card-body">
                <span className="confirm-plan-label">Current Plan</span>
                <h3>{planName(current)}</h3>
                <strong className="confirm-plan-price">{formatPrice(planPrice(current), currency)} <small>/ month</small></strong>
              </div>
              <div className="confirm-plan-limits">
                <div className="confirm-plan-limit-item">
                  <span className="confirm-plan-limit-icon"><Store size={15} /></span>
                  <div><strong>Stores</strong><small>Up to {currentStores} Stores</small></div>
                </div>
                <div className="confirm-plan-limit-divider" />
                <div className="confirm-plan-limit-item">
                  <span className="confirm-plan-limit-icon"><Smartphone size={15} /></span>
                  <div><strong>Devices</strong><small>Up to {currentDevices} Devices</small></div>
                </div>
              </div>
            </div>

            <div className="confirm-plan-arrow" aria-hidden="true"><ArrowRight size={20} /></div>

            <div className="confirm-plan-card next">
              <div className="confirm-plan-card-icon"><ArrowLeftRight size={21} /></div>
              <div className="confirm-plan-card-body">
                <span className="confirm-plan-label">New Plan</span>
                <h3>{planName(next)}</h3>
                <strong className="confirm-plan-price">{formatPrice(planPrice(next), currency)} <small>/ month</small></strong>
              </div>
              <div className="confirm-plan-limits">
                <div className="confirm-plan-limit-item">
                  <span className="confirm-plan-limit-icon"><Store size={15} /></span>
                  <div><strong>Stores</strong><small>Up to {nextStores} Stores</small></div>
                </div>
                <div className="confirm-plan-limit-divider" />
                <div className="confirm-plan-limit-item">
                  <span className="confirm-plan-limit-icon"><Smartphone size={15} /></span>
                  <div><strong>Devices</strong><small>Up to {nextDevices} Devices</small></div>
                </div>
              </div>
            </div>
          </div>

          <h3 className="change-title">What will change?</h3>

          <div className="comparison-table-wrapper confirm-comparison-wrapper">
            <table className="comparison-table confirm-comparison-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Current Plan</th>
                  <th>New Plan</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Plan Price</td>
                  <td>{formatPrice(planPrice(current), currency)} / month</td>
                  <td>{formatPrice(planPrice(next), currency)} / month</td>
                </tr>
                <tr>
                  <td>Stores Allowed</td>
                  <td>{currentStores}</td>
                  <td>{nextStores}</td>
                </tr>
                <tr>
                  <td>Devices Allowed</td>
                  <td>{currentDevices}</td>
                  <td>{nextDevices}</td>
                </tr>
                {comparedFeatures.map((feature) => (
                  <tr key={feature}>
                    <td>{feature}</td>
                    <td>{currentFeatures.includes(feature) ? "Included" : "Not included"}</td>
                    <td>{nextFeatures.includes(feature) ? "Included" : "Not included"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="warning-banner confirm-warning-banner">
            <Info size={18} />
            <div>
              <strong>
                This change will {difference >= 0 ? "increase" : "decrease"} monthly billing by {formatPrice(Math.abs(difference), currency)}.
              </strong>
              <p>The new plan supports {nextStores} stores and {nextDevices} devices.</p>
            </div>
          </div>

          <div className="flow-bottom-actions confirm-plan-actions">
            <button className="secondary-flow-button" onClick={onBack}>Cancel</button>
            <button className="primary-flow-button" onClick={onNext}>
              Proceed to Payment
              <ArrowRight size={17} />
            </button>
          </div>
        </main>
      </div>
    </section>
  );
}

/* ========================================

   PAYMENT SCREEN

\======================================== */

function PaymentScreen({

  merchant,

  plans,

  selectedPlan,

  billingCycle,

  setBillingCycle,

  paymentMethod,

  setPaymentMethod,

  paymentDetails,

  updatePaymentField,

  paymentError,

  paymentSubmitting,

  onBack,

  onSubmit,

}) {

  const current = findCurrentPlan(merchant, plans);

  const next = plans.find((plan) => planKey(plan) === selectedPlan) || current;

  const amount = planPrice(next, billingCycle);

  const taxRate = Number(next.taxRate ?? next.tax_rate ?? 0);

  const tax = Number((amount * taxRate / 100).toFixed(2));

  const totalDueToday = Number((amount + tax).toFixed(2));

  const currency = next.currency || "INR";

  return (

    <section className="subscription-flow-page payment-page payment-page-redesign">      <div className="payment-back-strip">
        <PageBack label="Back to Confirm Plan Change" onClick={onBack} />
      </div>
      <div className="payment-layout">
        <aside className="subscription-stepper payment-stepper" aria-label="Subscription plan change progress">
          <div className="subscription-step"><span className="step-number">1</span><div><strong>Choose Subscription Plan</strong><p>Select a plan for your merchant.</p></div></div>
          <div className="subscription-step"><span className="step-number">2</span><div><strong>Confirm Plan Change</strong><p>Review the plan details.</p></div></div>
          <div className="subscription-step active"><span className="step-number">3</span><div><strong>Payment</strong><p>Complete the payment.</p></div></div>
          <div className="subscription-step"><span className="step-number">4</span><div><strong>Confirmation</strong><p>Plan updated successfully.</p></div></div>
        </aside>
        <main className="payment-main">

      <h1>Payment</h1>

      <p className="flow-subtitle">

        Complete the payment to activate the new subscription plan.

      </p>

      <div className="payment-summary">

        <h3>Subscription Summary</h3>

        <DetailRow

          label="Merchant"

          value={`${merchant?.merchant} (${merchant?.merchantId || merchant?.id})`}

        />

        <DetailRow

          label="Current Plan"

          value={`${planName(current)} (${formatPrice(planPrice(current, billingCycle), currency)} / ${billingCycle === "ANNUAL" ? "annual" : "month"})`}

        />

        <DetailRow

          label="New Plan"

          value={`${planName(next)} (${formatPrice(amount, currency)} / ${billingCycle === "ANNUAL" ? "annual" : "month"})`}

        />

        <div className="detail-row">

          <span>Billing Cycle</span>

          <select

            value={billingCycle}

            onChange={(e) => setBillingCycle(e.target.value)}

          >

            <option value="MONTHLY">Monthly</option>

            <option value="ANNUAL">Annual</option>

          </select>

        </div>

        <DetailRow label="Tax" value={formatPrice(tax, currency)} />

        <div className="payment-total">

          <span>Amount to Pay</span>

          <strong>{formatPrice(totalDueToday, currency)}</strong>

        </div>

        <small className="payment-note">Plan price plus applicable tax</small>

      </div>

      <div className="payment-card">

        <h3>Select Payment Method</h3>

        <div className="payment-tabs">

          <button

            className={paymentMethod === "Card" ? "active" : ""}

            onClick={() => setPaymentMethod("Card")}

          >

            <CreditCard size={16} />

            Card

          </button>

          <button

            className={paymentMethod === "UPI" ? "active" : ""}

            onClick={() => setPaymentMethod("UPI")}

          >

            <Smartphone size={16} />

            UPI

          </button>

          <button

            className={paymentMethod === "Net Banking" ? "active" : ""}

            onClick={() => setPaymentMethod("Net Banking")}

          >

            <Landmark size={16} />

            Net Banking

          </button>

        </div>

        {paymentMethod === "Card" && (

          <div className="payment-form">

            <label>

              Card Number

              <input

                value={paymentDetails.cardNumber}

                onChange={(e) =>

                  updatePaymentField("cardNumber", e.target.value)

                }

                placeholder="1234 5678 9012 3456"

                maxLength={19}

              />

            </label>

            <label>

              Cardholder Name

              <input

                value={paymentDetails.cardholderName}

                onChange={(e) =>

                  updatePaymentField("cardholderName", e.target.value)

                }

                placeholder="John Doe"

              />

            </label>

            <div className="form-grid">

              <label>

                Expiry Date

                <input

                  value={paymentDetails.expiry}

                  onChange={(e) =>

                    updatePaymentField("expiry", e.target.value)

                  }

                  placeholder="MM/YY"

                />

              </label>

              <label>

                CVV

                <input

                  value={paymentDetails.cvv}

                  onChange={(e) =>

                    updatePaymentField("cvv", e.target.value)

                  }

                  placeholder="123"

                  maxLength={4}

                />

              </label>

            </div>

            <label className="save-card">

              <input

                type="checkbox"

                checked={paymentDetails.saveCard}

                onChange={(e) =>

                  updatePaymentField("saveCard", e.target.checked)

                }

              />

              Save this card for future payments

            </label>

          </div>

        )}

        {paymentMethod === "UPI" && (

          <div className="payment-form">

            <label>

              UPI ID

              <input

                value={paymentDetails.upi}

                onChange={(e) => updatePaymentField("upi", e.target.value)}

                placeholder="example@upi"

              />

            </label>

          </div>

        )}

        {paymentMethod === "Net Banking" && (

          <div className="payment-form">

            <label>

              Select Bank

              <select

                value={paymentDetails.bank}

                onChange={(e) => updatePaymentField("bank", e.target.value)}

              >

                <option value="">Select your bank</option>

                <option>State Bank of India</option>

                <option>HDFC Bank</option>

                <option>ICICI Bank</option>

                <option>Axis Bank</option>

              </select>

            </label>

          </div>

        )}

        {paymentError && <div className="payment-error">{paymentError}</div>}

        <div className="payment-actions">

         <button className="flow-button secondary">
            Back
            </button>



            <button className="flow-button primary"

            disabled={paymentSubmitting}

            onClick={() => onSubmit({ agreementPrice: amount, tax, totalDueToday })}

          >

            <Lock size={16} />

            {paymentSubmitting ? "Processing…" : `Pay ${formatPrice(totalDueToday, currency)}`}

          </button>

        </div>

      </div>

            </main>
      </div>
    </section>

  );

}

/* ========================================

   PAYMENT SUCCESS

\======================================== */

function PaymentSuccess({

  merchant,

  plans,

  selectedPlan,

  amountPaid,

  billingCycle,

  onBack,

}) {

  const next = plans.find((plan) => planKey(plan) === selectedPlan) || {};

  return (
    <section className="subscription-flow-page success-page success-page-redesign">
      <div className="success-back-strip">
        <PageBack label="Back to Payment" onClick={() => {}} />
      </div>
      <div className="success-layout">
        <aside className="subscription-stepper success-stepper" aria-label="Subscription plan change progress">
          <div className="subscription-step">
            <span className="step-number">1</span>
            <div><strong>Choose Subscription Plan</strong><p>Select a plan for your merchant.</p></div>
          </div>
          <div className="subscription-step">
            <span className="step-number">2</span>
            <div><strong>Confirm Plan Change</strong><p>Review the plan details.</p></div>
          </div>
          <div className="subscription-step">
            <span className="step-number">3</span>
            <div><strong>Payment</strong><p>Complete the payment.</p></div>
          </div>
          <div className="subscription-step active">
            <span className="step-number">4</span>
            <div><strong>Confirmation</strong><p>Plan updated successfully.</p></div>
          </div>
        </aside>
        <main className="success-main">
          <div className="success-icon"><Check size={38} /></div>
          <h1>Subscription Plan Updated</h1>
          <p className="flow-subtitle">The subscription plan for {merchant?.merchant} has been successfully updated.</p>
          <div className="flow-card success-details">
            <h3>Subscription Details</h3>
            <div className="success-detail-row">
              <span className="success-row-icon"><Store size={17} /></span>
              <span className="success-row-label">Merchant</span>
              <strong>{`${merchant?.merchant} (${merchant?.merchantId || merchant?.id})`}</strong>
            </div>
            <div className="success-detail-row">
              <span className="success-row-icon"><Star size={17} /></span>
              <span className="success-row-label">New Plan</span>
              <strong>{planName(next)}</strong>
            </div>
            <div className="success-detail-row">
              <span className="success-row-icon"><CreditCard size={17} /></span>
              <span className="success-row-label">Amount Paid</span>
              <strong>{formatPrice(amountPaid, next.currency)}</strong>
            </div>
            <div className="success-detail-row">
              <span className="success-row-icon"><CreditCard size={17} /></span>
              <span className="success-row-label">Billing Cycle</span>
              <strong>{billingCycle === "ANNUAL" ? "Annual" : "Monthly"}</strong>
            </div>
            <div className="success-detail-row">
              <span className="success-row-icon"><CircleCheck size={17} /></span>
              <span className="success-row-label">Effective From</span>
              <strong>{merchant?.start}</strong>
            </div>
            <div className="success-detail-row">
              <span className="success-status-dot" />
              <span className="success-row-label">Status</span>
              <span className="success-status-pill">Active</span>
            </div>
          </div>
          <div className="success-banner">
            <CircleCheck size={18} />
            <span>The merchant can now use the features of the {planName(next)}.</span>
          </div>
          <button className="primary-flow-button success-back-button" onClick={onBack}>
            <ArrowLeft size={17} />Back to Subscription Details
          </button>
        </main>
      </div>
    </section>
  );
}

function SubscriptionCrudForm({
  form,
  setForm,
  editing,
  merchants,
  plans,
  reference,
  busy,
  error,
  onCancel,
  onSubmit,
}) {
  const field = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const activePlans = plans.filter((plan) =>
    !plan.status || String(plan.status).toUpperCase() === "ACTIVE"
  );

  const choosePlan = (code) => {
    const selected = plans.find((plan) => crudPlanCode(plan) === code);

    if (!selected) {
      field("planCode", code);
      return;
    }

    const features = crudPlanFeatures(selected);

    setForm((previous) => ({
      ...previous,
      planCode: crudPlanCode(selected),
      planName: crudPlanName(selected),
      maxStoresAllowed: selected.maxStoresAllowed ?? selected.includedStores ?? previous.maxStoresAllowed ?? 1,
      entitlements: features.join(", "),
      billingCycle: selected.billingCycle || selected.billing_cycle || previous.billingCycle || "MONTHLY",
      trialDays: selected.trialDays ?? selected.trial_days ?? previous.trialDays ?? 0,
      price: selected.price ?? selected.basePrice ?? selected.base_price ?? previous.price ?? 0,
    }));
  };

  const billingCycles = reference?.billingCycles?.length
    ? reference.billingCycles
    : ["MONTHLY", "YEARLY"];

  const statuses = reference?.subscriptionStatuses?.length
    ? reference.subscriptionStatuses
    : ["ACTIVE", "INACTIVE", "CANCELLED"];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-crud-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: "min(920px, 100%)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 20px 60px rgba(15, 23, 42, 0.2)",
          padding: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <h2 id="subscription-crud-title" style={{ margin: 0 }}>
              {editing ? "Edit Subscription" : "Add Subscription"}
            </h2>
            <p style={{ margin: "6px 0 0", color: "#667085", fontSize: "13px" }}>
              Manage the merchant subscription record and billing details.
            </p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Close" style={{ border: 0, background: "transparent", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: "10px 12px", marginBottom: "16px", background: "#fff1f2", color: "#b42318", borderRadius: "8px", fontSize: "13px" }} role="alert">
            {error}
          </div>
        )}

        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <label className="form-group">
              Merchant
              <select
                required
                disabled={Boolean(editing)}
                value={form.merchantId || ""}
                onChange={(event) => field("merchantId", event.target.value)}
              >
                <option value="">Select merchant</option>
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.name || merchant.businessName || merchant.business_name || merchant.id} ({merchant.id})
                  </option>
                ))}
              </select>
            </label>

            <label className="form-group">
              Plan
              <select
                required
                value={form.planCode || ""}
                onChange={(event) => choosePlan(event.target.value)}
              >
                <option value="">Select plan</option>
                {[
                  ...new Map(
                    [...activePlans, ...(form.planCode ? [{ planCode: form.planCode, planName: form.planName }] : [])]
                      .map((plan) => [crudPlanCode(plan), plan])
                  ).values(),
                ].map((plan) => (
                  <option key={crudPlanCode(plan)} value={crudPlanCode(plan)}>
                    {crudPlanName(plan)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-group">
              Plan name
              <input readOnly value={form.planName || ""} />
            </label>

            <label className="form-group">
              Maximum stores
              <input
                required
                type="number"
                min="1"
                value={form.maxStoresAllowed ?? 1}
                readOnly
                onChange={(event) => field("maxStoresAllowed", event.target.value)}
              />
            </label>

            <label className="form-group">
              Trial days
              <input
                required
                type="number"
                min="0"
                value={form.trialDays ?? 0}
                readOnly
                onChange={(event) => field("trialDays", event.target.value)}
              />
            </label>

            <label className="form-group">
              Price
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.price ?? 0}
                readOnly
                onChange={(event) => field("price", event.target.value)}
              />
            </label>

            <label className="form-group">
              Billing cycle
              <select
                disabled
                value={form.billingCycle || "MONTHLY"}
                onChange={(event) => field("billingCycle", event.target.value)}
              >
                {billingCycles.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>

            <label className="form-group">
              Status
              <select value={form.status || "ACTIVE"} onChange={(event) => field("status", event.target.value)}>
                {statuses.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>

            <label className="form-group">
              Period start (UTC)
              <input
                type="datetime-local"
                value={form.currentPeriodStart ? String(form.currentPeriodStart).slice(0, 16) : ""}
                onChange={(event) => field("currentPeriodStart", event.target.value ? `${event.target.value}:00Z` : "")}
              />
            </label>

            <label className="form-group">
              Period end (UTC)
              <input
                type="datetime-local"
                value={form.currentPeriodEnd ? String(form.currentPeriodEnd).slice(0, 16) : ""}
                onChange={(event) => field("currentPeriodEnd", event.target.value ? `${event.target.value}:00Z` : "")}
              />
            </label>

            <label className="form-group" style={{ gridColumn: "1 / -1" }}>
              Entitlements (comma-separated)
              <input readOnly value={form.entitlements || ""} />
            </label>
          </div>

          <div className="form-actions" style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : editing ? "Update subscription" : "Save subscription"}
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}

/* ========================================

   MAIN COMPONENT

\======================================== */

export default function MerchantSubscriptions() {



  const [subscriptions, setSubscriptions] = useState([]);

  const [plans, setPlans] = useState([]);

  const [plansLoading, setPlansLoading] = useState(false);

  const [plansError, setPlansError] = useState("");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [reloadToken, setReloadToken] = useState(0);

  const [screen, setScreen] = useState("list");

  const [selectedMerchant, setSelectedMerchant] = useState(null);

  const [selectedPlan, setSelectedPlan] = useState("");

  const [billingCycle, setBillingCycle] = useState("MONTHLY");

  const [paymentMethod, setPaymentMethod] = useState("Card");

  const [amountPaid, setAmountPaid] = useState(0);

  const [paymentError, setPaymentError] = useState("");

  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const [crudMerchants, setCrudMerchants] = useState([]);

  const [crudPlans, setCrudPlans] = useState([]);

  const [crudForm, setCrudForm] = useState(null);

  const [crudEditing, setCrudEditing] = useState(null);

  const [crudBusy, setCrudBusy] = useState(false);

  const [crudError, setCrudError] = useState("");

  const [paymentDetails, setPaymentDetails] = useState({

    cardNumber: "",

    cardholderName: "",

    expiry: "",

    cvv: "",

    saveCard: true,

    upi: "",

    bank: "",

  });

  const loadData = () => setReloadToken((n) => n + 1);

  useEffect(() => {
    let active = true;

    if (!crudForm) return;
    Promise.all([crudEditing ? Promise.resolve([]) : pendingStoreRead("subscription-form-merchants", () => listMerchants()), listSubscriptionPlans()])
      .then(([merchantResponse, planResponse]) => {
        if (!active) return;

        const merchantList = Array.isArray(merchantResponse)
          ? merchantResponse
          : Array.isArray(merchantResponse?.merchants)
          ? merchantResponse.merchants
          : Array.isArray(merchantResponse?.data)
          ? merchantResponse.data
          : [];

        const planList = Array.isArray(planResponse)
          ? planResponse
          : Array.isArray(planResponse?.plans)
          ? planResponse.plans
          : Array.isArray(planResponse?.data?.plans)
          ? planResponse.data.plans
          : [];

        setCrudMerchants(merchantList);
        setCrudPlans(planList);
      })
      .catch((err) => {
        if (active) setCrudError(err.message || "Failed to load subscription form data.");
      });

    return () => {
      active = false;
    };
  }, [Boolean(crudForm), crudEditing]);

  const openAddSubscription = () => {
    setCrudEditing(null);
    setCrudForm({ ...emptySubscription });
    setCrudError("");
  };

  const openEditSubscription = async (row) => {
    setCrudBusy(true);
    setCrudError("");

    try {
      const response = await getSubscription(row.id);
      const subscription = response?.subscription || response?.data?.subscription || response?.data || response;
      const entitlements = Array.isArray(subscription?.entitlements)
        ? subscription.entitlements.join(", ")
        : String(subscription?.entitlements || "");

      setCrudForm({
        ...emptySubscription,
        ...subscription,
        merchantId: subscription?.merchantId || row?.merchantId || "",
        planCode: subscription?.planCode || row?.planCode || "",
        planName: subscription?.planName || row?.plan || "",
        maxStoresAllowed: subscription?.maxStoresAllowed ?? subscription?.includedStores ?? row?.stores ?? 1,
        entitlements,
        billingCycle: subscription?.billingCycle || row?.billingCycle || "MONTHLY",
        trialDays: subscription?.trialDays ?? 0,
        price: subscription?.price ?? row?.price ?? 0,
        status: subscription?.status || row?.status || "ACTIVE",
        currentPeriodStart: subscription?.currentPeriodStart || subscription?.startDate || row?.rawStart || "",
        currentPeriodEnd: subscription?.currentPeriodEnd || subscription?.renewalDate || row?.rawEnd || "",
      });
      setCrudEditing(row.id);
    } catch (err) {
      setCrudError(err.message || "Unable to load the subscription.");
    } finally {
      setCrudBusy(false);
    }
  };

  const saveSubscription = async (event) => {
    event.preventDefault();
    if (!crudForm) return;

    setCrudBusy(true);
    setCrudError("");

    try {
      const selectedPlan = crudPlans.find((plan) => crudPlanCode(plan) === String(crudForm.planCode));
      const selectedPlanStatus = selectedPlan?.status;

      if (!selectedPlan || (selectedPlanStatus && String(selectedPlanStatus).toUpperCase() !== "ACTIVE")) {
        throw new Error("Select an active master plan.");
      }

      const payload = subscriptionPayload(crudForm);

      if (crudEditing) {
        await updateSubscription(crudEditing, payload);
      } else {
        await createSubscription({ ...payload, merchantId: crudForm.merchantId });
      }

      setCrudForm(null);
      setCrudEditing(null);
      setCrudError("");
      loadData();
    } catch (err) {
      setCrudError(err.message || "Unable to save the subscription.");
    } finally {
      setCrudBusy(false);
    }
  };

  const removeSubscription = async (row) => {
    const confirmed = window.confirm(`Delete subscription ${row?.id || ""} for ${row?.merchantId || row?.merchant || "this merchant"}?`);
    if (!confirmed) return;

    setCrudBusy(true);
    setCrudError("");

    try {
      await deleteSubscription(row.id);

      if (selectedMerchant?.id === row.id) {
        setSelectedMerchant(null);
        setScreen("list");
      }

      loadData();
    } catch (err) {
      setCrudError(err.message || "Unable to delete the subscription.");
    } finally {
      setCrudBusy(false);
    }
  };

  useEffect(() => {

    let active = true;

    setLoading(true);

    setError("");

    listSubscriptions()

      .then((response) => {

        if (!active) return;

        const rawList = Array.isArray(response)

          ? response

          : Array.isArray(response?.subscriptions)

          ? response.subscriptions

          : Array.isArray(response?.data?.subscriptions)

          ? response.data.subscriptions

          : Array.isArray(response?.data)

          ? response.data

          : [];

        const mapped = rawList

          .map((item, idx) => mapSubscriptionToRow(item, idx))

          .filter(Boolean);

        setSubscriptions(mapped);

      })

      .catch((err) => {

        if (!active) return;

        console.error("Error fetching subscriptions:", err);

        setError(err.message || "Failed to load subscriptions.");

      })

      .finally(() => {

        if (active) setLoading(false);

      });

    return () => {

      active = false;

    };

  }, [reloadToken]);

  useEffect(() => {

    if (screen !== "choose") return undefined;

    let active = true;

    setPlansLoading(true);

    setPlansError("");

    const storeTypeId = String(selectedMerchant?.storeTypeId || "").trim();

    if (!storeTypeId) {

      setPlans([]);

      setSelectedPlan("");

      setPlansError("This subscription has no store type ID, so plans cannot be filtered.");

      setPlansLoading(false);

      return () => {

        active = false;

      };

    }

    getMerchantFormPlans()

      .then((allPlans) => {

        if (!active) return;

        const matchingPlans = allPlans.filter(

          (plan) => planMatchesStoreType(plan, selectedMerchant)

        );

        setPlans(matchingPlans);

        const current = findCurrentPlan(selectedMerchant, matchingPlans);

        setSelectedPlan(planKey(current) || selectedMerchant?.planId || "");

        if (matchingPlans.length === 0) {

          setPlansError("No subscription plans are configured for this store type.");

        }

      })

      .catch((err) => {

        if (!active) return;

        setPlans([]);

        setPlansError(err.message || "Failed to load subscription plans.");

      })

      .finally(() => {

        if (active) setPlansLoading(false);

      });

    return () => {

      active = false;

    };

  }, [screen, selectedMerchant]);

  

  const updatePaymentField = (field, value) => {

    setPaymentDetails((previous) => ({

      ...previous,

      [field]: value,

    }));

    setPaymentError("");

  };

  const openDetails = async (merchant) => {
    setCrudBusy(true);
    setCrudError("");
    try {
      const response = await getSubscription(merchant.id);
      const data = response?.subscription || response?.data?.subscription || response?.data || response;
      const mapped = mapSubscriptionToRow(data);
      if (!mapped) throw new Error("Subscription not found.");
      setSelectedMerchant({ ...merchant, ...mapped });
      setScreen("details");
    } catch (error) {
      setCrudError(error.message || "Unable to load subscription.");
    } finally {
      setCrudBusy(false);
    }
  };

  const openChoosePlan = () => {

    setPlans([]);

    setSelectedPlan(selectedMerchant?.planId || "");

    setScreen("choose");

  };

  const openConfirm = () => {

    setScreen("confirm");

  };

  const openPayment = () => {

    setPaymentError("");

    setScreen("payment");

  };

  const submitPayment = async ({ agreementPrice, tax, totalDueToday }) => {

    if (paymentMethod === "Card") {

      if (

        !paymentDetails.cardNumber ||

        !paymentDetails.cardholderName ||

        !paymentDetails.expiry ||

        !paymentDetails.cvv

      ) {

        setPaymentError("Please fill all card details.");

        return;

      }

    }

    if (paymentMethod === "UPI" && !paymentDetails.upi) {

      setPaymentError("Please enter your UPI ID.");

      return;

    }

    if (paymentMethod === "Net Banking" && !paymentDetails.bank) {

      setPaymentError("Please select your bank.");

      return;

    }

    const plan = plans.find((item) => planKey(item) === selectedPlan);

    const merchantId = selectedMerchant?.merchantApiId;

    if (!merchantId || !plan?.id) {

      setPaymentError("The merchant or selected plan ID is missing. Refresh the subscription list and try again.");

      return;

    }

    const startDate = new Date().toISOString().slice(0, 10);

    const apiBillingCycle = billingCycle === "ANNUAL" ? "YEARLY" : "MONTHLY";

    const payload = {

      merchantId,

      planId: plan.id,

      billingCycle: apiBillingCycle,

      startDate,

      renewalDate: addCycleToDate(startDate, billingCycle),

      agreementPrice: Number(agreementPrice),

      tax: Number(tax),

      totalDueToday: Number(totalDueToday),

      paymentMethod:

        paymentMethod === "Card"

          ? "CARD"

          : paymentMethod === "Net Banking"

            ? "NET_BANKING"

            : "UPI",

    };

    setPaymentSubmitting(true);

    setPaymentError("");

    try {

      await changeSubscriptionPlan(payload);

      const updatedPlan = {

        plan: planName(plan),

        planId: plan.id,

        planDetails: plan,

        price: Number(agreementPrice),

        currency: plan.currency || "INR",

        billingCycle: apiBillingCycle,

        stores: Number(plan.includedStores ?? plan.included_stores ?? selectedMerchant.stores),

        devices: Number(plan.includedTerminals ?? plan.included_terminals ?? selectedMerchant.devices),

        entitlements: planFeatures(plan),

      };

      setAmountPaid(totalDueToday);

      setSubscriptions((previous) =>

        previous.map((item) =>

          item.id === selectedMerchant?.id ? { ...item, ...updatedPlan } : item

        )

      );

      setSelectedMerchant((previous) => ({ ...previous, ...updatedPlan }));

      setScreen("success");

    } catch (err) {

      setPaymentError(err.message || "Unable to change the subscription plan.");

    } finally {

      setPaymentSubmitting(false);

    }

  };

  if (screen === "details") {

    return (

      <SubscriptionDetails

        merchant={selectedMerchant}

        onBack={() => setScreen("list")}

        onChangePlan={openChoosePlan}

      />

    );

  }

  if (screen === "choose") {

    return (

      <ChoosePlan

        merchant={selectedMerchant}

        plans={plans}

        plansLoading={plansLoading}

        plansError={plansError}

        selectedPlan={selectedPlan}

        setSelectedPlan={setSelectedPlan}

        onBack={() => setScreen("details")}

        onNext={openConfirm}

      />

    );

  }

  if (screen === "confirm") {

    return (

      <ConfirmPlanChange

        merchant={selectedMerchant}

        plans={plans}

        selectedPlan={selectedPlan}

        onBack={() => setScreen("choose")}

        onNext={openPayment}

      />

    );

  }

  if (screen === "payment") {

    return (

      <PaymentScreen

        merchant={selectedMerchant}

        plans={plans}

        selectedPlan={selectedPlan}

        billingCycle={billingCycle}

        setBillingCycle={setBillingCycle}

        paymentMethod={paymentMethod}

        setPaymentMethod={setPaymentMethod}

        paymentDetails={paymentDetails}

        updatePaymentField={updatePaymentField}

        paymentError={paymentError}

        paymentSubmitting={paymentSubmitting}

        onBack={() => setScreen("confirm")}

        onSubmit={submitPayment}

      />

    );

  }

  if (screen === "success") {

    return (

      <PaymentSuccess

        merchant={selectedMerchant}

        plans={plans}

        selectedPlan={selectedPlan}

        amountPaid={amountPaid}

        billingCycle={billingCycle}

        onBack={() => setScreen("details")}

      />

    );

  }

  return (
    <>
      <SubscriptionList
        subscriptions={subscriptions}
        loading={loading}
        error={error || crudError}
        onReload={loadData}
        onView={openDetails}
        onAdd={openAddSubscription}
        onEdit={openEditSubscription}
        onDelete={removeSubscription}
        crudBusy={crudBusy}
      />

      {crudForm && (
        <SubscriptionCrudForm
          form={crudForm}
          setForm={setCrudForm}
          editing={crudEditing}
          merchants={crudMerchants}
          plans={crudPlans}
          busy={crudBusy}
          error={crudError}
          onCancel={() => {
            setCrudForm(null);
            setCrudEditing(null);
            setCrudError("");
          }}
          onSubmit={saveSubscription}
        />
      )}
    </>
  );

}
