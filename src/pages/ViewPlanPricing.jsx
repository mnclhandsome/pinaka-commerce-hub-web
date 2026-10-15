import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getPlan } from "../api/plans";
function formatAmount(value, currency) {
  if (value === "" || value == null) {
    return "—";
  }
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "—";
  }
  return [currency, amount.toFixed(2)].filter(Boolean).join(" ");
}
function formatTrial(value) {
  if (value === "" || value == null) {
    return "—";
  }
  const days = Number(value);
  if (!Number.isFinite(days)) {
    return String(value);
  }
  return days === 0 ? "No trial" : `${days}${days === 1 ? " day" : " days"}`;
}
function formatPlanDate(value) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}
export default function ViewPlanPricing() {
  const navigate = useNavigate();
  const { planId } = useParams();
  const navigationPlan = useLocation().state?.plan;
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState({
    id: null,
    loading: true,
    plan: null,
    error: "",
  });
  useEffect(() => {
    let cancelled = false;
    setResult({ id: planId, loading: true, plan: null, error: "" });
    async function loadPlan() {
      try {
        if (!planId) {
          throw new Error("The plan ID is missing from the URL.");
        }
        /* * getPlan() already: * 1. Calls GET /plans/:id * 2. Extracts the plan response * 3. Normalizes the API response */ const plan =
          retry === 0 && String(navigationPlan?.id) === String(planId) ? navigationPlan : await getPlan(planId);
        if (!cancelled) {
          setResult({ id: planId, loading: false, plan, error: "" });
        }
      } catch (error) {
        if (!cancelled) {
          setResult({
            id: planId,
            loading: false,
            plan: null,
            error: error?.message || "Failed to load plan pricing.",
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
  const routeId = encodeURIComponent(planId ?? "");
  const tabs = [
    ["overview", "Overview", `/plans/${routeId}`],
    ["pricing", "Pricing", `/plans/${routeId}/pricing`],
    ["features", "Features & Limits", `/plans/${routeId}/features-limits`],
  ];
  function goToTab(path) {
    navigate(path, { state: { plan } });
  }
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
      {loading && <p role="status"> Loading plan pricing... </p>}{" "}
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
            <div className="plan-details-details-top">
              <button
                type="button"
                className="plan-details-back"
                onClick={() => navigate("/plans/new")}
                aria-label="Back to Plans"
              >
                <span className="plan-details-back-icon">
                  <i className="bi bi-arrow-left" />
                </span>
              </button>
                <div className="plan-details-heading">
                     <div className="plan-details-title-line">
                           <h1> {plan.name || "Unnamed plan"} </h1>
                     </div>

                     <p> {plan.description || "No description provided."} </p>
                </div>
                   
            </div>  
           
          </div>
          {/* ================================================= TABS ================================================= */}{" "}
          <nav className="plan-details-tabs" aria-label="Plan sections">
            {" "}
            {tabs.map(([id, label, path]) => (
              <button
                type="button"
                key={id}
                className={id === "pricing" ? "active" : ""}
                aria-current={id === "pricing" ? "page" : undefined}
                onClick={() => goToTab(path)}
              >
                {" "}
                {label}{" "}
              </button>
            ))}{" "}
          </nav>{" "}
          {/* ================================================= PRICING CARD ================================================= */}{" "}
          <section className="plan-details-card">
            {" "}
            <div className="plan-details-card-heading">
              {" "}
              <div className="plan-details-icon">
                {" "}
                <i className="bi bi-coin" />{" "}
              </div>{" "}
              <div>
                {" "}
                <h2>Pricing & Limits</h2>{" "}
                <p>
                  {" "}
                 View pricing, included limits, and trial details.{" "}
                </p>{" "}
              </div>{" "}
            </div>{" "}
            <div className="plan-pricing-fields">
              {" "}
              {/* PRICING BASIS */}{" "}
              <label className="plan-details-field">
                {" "}
                <span> Pricing Basis </span>{" "}
                <input value={plan.billingModel || "—"} readOnly />{" "}
              </label>{" "}
              {/* CURRENCY */}{" "}
              <label className="plan-details-field">
                {" "}
                <span> Currency </span>{" "}
                <input value={plan.currency || "—"} readOnly />{" "}
              </label>{" "}
              {/* BILLING CYCLE */}{" "}
              <label className="plan-details-field">
                {" "}
                <span> Billing Cycle </span>{" "}
                <input value={plan.cycle || "—"} readOnly />{" "}
              </label>{" "}
              {/* BASE SUBSCRIPTION PRICE */}{" "}
              <label className="plan-details-field">
                {" "}
                <span> Base Subscription Price </span>{" "}
                <input
                  value={formatAmount(plan.price, plan.currency)}
                  readOnly
                />{" "}
              </label>{" "}
              {/* TRIAL PERIOD */}{" "}
              <label className="plan-details-field">
                {" "}
                <span> Trial Period </span>{" "}
                <input value={formatTrial(plan.trialPeriod)} readOnly />{" "}
              </label>{" "}
              {/* STORES INCLUDED */}{" "}
              <label className="plan-details-field">
                {" "}
                <span> Stores Included </span>{" "}
                <input value={plan.includedStores ?? "—"} readOnly />{" "}
              </label>{" "}
              {/* POS TERMINALS INCLUDED */}{" "}
              <label className="plan-details-field">
                {" "}
                <span> POS Terminals Included </span>{" "}
                <input value={plan.includedTerminals ?? "—"} readOnly />{" "}
              </label>{" "}
              {/* Price per Additional POS Terminal */}{" "}
              <label className="plan-details-field">
                {" "}
                <span> Price per Additional POS Terminal </span>{" "}
                <input
                  value={formatAmount(
                    plan.additionalTerminalPrice,
                    plan.currency,
                  )}
                  readOnly
                />{" "}
              </label>{" "}
              {/* INCLUDED USERS */}{" "}
              <label className="plan-details-field">
                {" "}
                <span> Employee Licenses Included </span>{" "}
                <input value={plan.includedUsers ?? "—"} readOnly />{" "}
              </label>{" "}
              {/* Price per Additional Employee License */}{" "}
              <label className="plan-details-field">
                {" "}
                <span> Price per Additional Employee License </span>{" "}
                <input
                  value={formatAmount(plan.additionalUserPrice, plan.currency)}
                  readOnly
                />{" "}
              </label>{" "}
              {/* EFFECTIVE DATE */}{" "}
              <label className="plan-details-field">
                {" "}
                <span> Effective Date </span>{" "}
                <input
                  value={formatPlanDate(plan.effectiveDate)}
                  readOnly
                />{" "}
              </label>{" "}
            </div>{" "}
          </section>{" "}
        </>
      )}{" "}
    </section>
  );
}