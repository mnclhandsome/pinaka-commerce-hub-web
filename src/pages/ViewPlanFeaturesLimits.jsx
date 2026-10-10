import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Pagination from "../components/Pagination";
import { getPlan } from "../api/plans";
function displayText(value, fallback = "—") {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim() || fallback;
  }
  if (value && typeof value === "object") {
    return displayText(
      value.name ?? value.categoryName ?? value.code,
      fallback,
    );
  }
  return fallback;
}
function featureRows(features) {
  if (!Array.isArray(features)) {
    return [];
  }
  return features.map((entry, index) => {
    /* * The normalized plan can contain: * * 1. A string feature code * 2. A feature object */ if (
      typeof entry === "string"
    ) {
      return { id: `${entry}-${index}`, name: entry, category: "—" };
    }
    if (!entry || typeof entry !== "object") {
      throw new Error(
        "Unexpected included feature format in the plan response.",
      );
    }
    /* * Support expanded feature objects as well. */ const feature =
      entry.feature && typeof entry.feature === "object"
        ? entry.feature
        : entry;
    const name =
      feature.name ??
      feature.featureName ??
      feature.featureKey ??
      feature.feature_key ??
      feature.code;
    if (name == null) {
      throw new Error(
        "An included feature has no name or code in the plan response.",
      );
    }
    return {
      id: `${feature.id ?? entry.featureId ?? name}-${index}`,
      name: displayText(name),
      category: displayText(
        feature.category ?? feature.categoryName ?? feature.featureCategory,
      ),
    };
  });
}
export default function ViewPlanFeaturesLimits() {
  const navigate = useNavigate();
  const { planId } = useParams();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState({
    id: null,
    loading: true,
    plan: null,
    features: [],
    error: "",
  });
  useEffect(() => {
    let cancelled = false;
    setResult({
      id: planId,
      loading: true,
      plan: null,
      features: [],
      error: "",
    });
    async function loadPlan() {
      try {
        if (!planId) {
          throw new Error("The plan ID is missing from the URL.");
        }
        /* * getPlan() already: * * 1. Calls GET /plans/:id * 2. Extracts the plan from the response * 3. Normalizes the API response */ const plan =
          await getPlan(planId);
        if (!plan) {
          throw new Error("Plan details were not found.");
        }
        /* * normalizePlan() already converts: * * included_features * includedFeatures * * into: * * plan.includedFeatures */ const features =
          featureRows(plan.includedFeatures);
        if (!cancelled) {
          setResult({ id: planId, loading: false, plan, features, error: "" });
        }
      } catch (error) {
        if (!cancelled) {
          setResult({
            id: planId,
            loading: false,
            plan: null,
            features: [],
            error: error?.message || "Failed to load plan features.",
          });
        }
      }
    }
    loadPlan();
    return () => {
      cancelled = true;
    };
  }, [planId, retry]);
  /* * Never show the previous plan while a different * route ID is loading. */ const loading =
    result.id !== planId || result.loading;
  const plan = loading ? null : result.plan;
  const error = loading ? "" : result.error;
  const selectedFeatures = loading ? [] : result.features;
  // Reset pagination when switching plans or changing page size
useEffect(() => {
  setCurrentPage(1);
}, [planId, pageSize]);

const totalEntries = selectedFeatures.length;

const totalPages = Math.max(
  1,
  Math.ceil(totalEntries / pageSize)
);

const paginatedFeatures = selectedFeatures.slice(
  (currentPage - 1) * pageSize,
  currentPage * pageSize
);

useEffect(() => {
  if (currentPage > totalPages) {
    setCurrentPage(totalPages);
  }
}, [currentPage, totalPages]);
  const basePath = `/plans/${encodeURIComponent(planId ?? "")}`;
  const tabs = [
    ["overview", "Overview", basePath],
    ["pricing", "Pricing", `${basePath}/pricing`],
    ["features", "Features & Limits", `${basePath}/features-limits`],
  ];
  return (
    <section className="plan-details-page" aria-busy={loading}>
      {" "}
      {/* ===================================================== BACK BUTTON ===================================================== */}{" "}
      {/* <button
        type="button"
        className="plan-details-back"
        onClick={() => navigate("/plans/new")}
      >
        {" "}
        <i className="bi bi-arrow-left" /> Back to Plans{" "}
      </button>{" "} */}
      {/* ===================================================== LOADING ===================================================== */}{" "}
      {loading && <p role="status"> Loading plan features... </p>}{" "}
      {/* ===================================================== ERROR ===================================================== */}{" "}
      {error && (
        <div className="plan-api-error" role="alert">
          {" "}
          <p>{error}</p>{" "}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            {" "}
            Retry{" "}
          </button>{" "}
        </div>
      )}{" "}
      {/* ===================================================== PLAN ===================================================== */}{" "}
      {plan && (
        <>
          {" "}
          {/* ================================================= PAGE HEADING ================================================= */}{" "}
          <div className="plan-details-heading">
            {" "}
            <div className="plan-details-title-line">
              <button
                type="button"
                className="plan-details-back"
                onClick={() => navigate("/plans/new")}
                aria-label="Back to Plans"
              >
                <span className="plan-details-back-icon">
                  <i className="bi bi-arrow-left" />
                </span>
              </button>{" "}
              <h1> {plan.name || "Unnamed plan"} </h1>{" "}
              {/* <span
                className={`plan-details-active-badge ${plan.status === "Inactive" ? "plan-details-inactive-badge" : ""}`}
              >
                {" "}
                <i className="bi bi-circle-fill" /> {plan.status || "—"}{" "}
              </span>{" "} */}
            </div>{" "}
            <p> {plan.description || "No description provided."} </p>{" "}
          </div>{" "}
          {/* ================================================= TABS ================================================= */}{" "}
          <nav className="plan-details-tabs" aria-label="Plan sections">
            {" "}
            {tabs.map(([id, label, path]) => (
              <button
                type="button"
                key={id}
                className={id === "features" ? "active" : ""}
                aria-current={id === "features" ? "page" : undefined}
                onClick={() => navigate(path, { state: { plan } })}
              >
                {" "}
                {label}{" "}
              </button>
            ))}{" "}
          </nav>{" "}
          {/* ================================================= FEATURES & LIMITS ================================================= */}{" "}
          <section className="plan-details-card">
            {" "}
            <div className="plan-details-card-heading">
              {" "}
              <div className="plan-details-icon">
                {" "}
                <i className="bi bi-stars" />{" "}
              </div>{" "}
              <div>
                {" "}
                <h2> Included Features </h2>{" "}
                <p> View features included in this plan. </p>{" "}
              </div>{" "}
            </div>{" "}
            {/* ================================================= FEATURES TABLE ================================================= */}{" "}
            <div className="plan-view-features-table-wrap">
              {" "}
              <table className="plan-view-features-table">
                {" "}
                <thead>
                  {" "}
                  <tr>
                    {" "}
                    <th>Feature Name</th> <th>Feature Category</th> <th>Included in Plan</th>{" "}
                  </tr>{" "}
                </thead>{" "}
                
<tbody>
  {paginatedFeatures.length === 0 ? (
    <tr>
      <td colSpan={3} className="plan-view-features-empty">
        No included features are configured for this plan.
      </td>
    </tr>
  ) : (
    paginatedFeatures.map((feature) => (
      <tr key={feature.id}>
        <td>
          <strong>{feature.name}</strong>
        </td>
        <td>{feature.category}</td>
        <td>
          <span className="plan-feature-included-badge">
            <i className="bi bi-circle-fill" /> Included
          </span>
        </td>
      </tr>
    ))
  )}
</tbody>
{" "}
              </table>{" "}
            </div>{" "}
            {/* ================================================= COUNT ================================================= */}{" "}
            
<div className="plan-view-features-footer">
  <Pagination
    currentPage={currentPage}
    totalPages={totalPages}
    totalItems={totalEntries}
    pageSize={pageSize}
    onPageChange={setCurrentPage}
    onPageSizeChange={(newPageSize) => {
      setPageSize(newPageSize);
      setCurrentPage(1);
    }}
    itemLabel="features"
    showWhenEmpty={true}
  />
</div>
{" "}
          </section>{" "}
        </>
      )}{" "}
    </section>
  );
}