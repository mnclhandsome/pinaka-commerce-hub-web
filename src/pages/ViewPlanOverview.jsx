import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getPlan } from "../api/plans";

export default function ViewPlanOverview() {
  const navigate = useNavigate();
  const { planId } = useParams();
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
        const plan = await getPlan(planId);
        if (!cancelled) {
          setResult({ id: planId, loading: false, plan, error: "" });
        }
      } catch (error) {
        if (!cancelled) {
          setResult({
            id: planId,
            loading: false,
            plan: null,
            error: error?.message || "Failed to load plan details.",
          });
        }
      }
    }

    loadPlan();
    return () => {
      cancelled = true;
    };
  }, [planId, retry]);

  const loading = result.id !== planId || result.loading;
  const plan = loading ? null : result.plan;
  const error = loading ? "" : result.error;
  const basePath = `/plans/${encodeURIComponent(planId ?? "")}`;
  const tabs = [
    ["overview", "Overview", basePath],
    ["pricing", "Pricing", `${basePath}/pricing`],
    ["features", "Features & Limits", `${basePath}/features-limits`],
  ];

  return (
    <section className="plan-details-page" aria-busy={loading}>
      {/* BACK BUTTON */}
      {/* <button
        type="button"
        className="plan-details-back"
        onClick={() => navigate("/plans/new")}
        aria-label="Back to Plans"
      >
        <span className="plan-details-back-icon">
          <i className="bi bi-arrow-left" />
        </span>
      </button> */}

      {/* LOADING */}
      {loading && <p role="status"> Loading plan details... </p>}

      {/* API ERROR */}
      {error && (
        <div className="plan-api-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Retry
          </button>
        </div>
      )}

      {/* PLAN DETAILS */}
      {plan && (
        <>
          {/* PAGE HEADING */}
          <div className="plan-details-heading">
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
              </button>
              <h1> {plan.name || "Unnamed plan"} </h1>
              
            </div>
            <p> {plan.description || "No description provided."} </p>
          </div>

          {/* TABS */}
          <nav className="plan-details-tabs" aria-label="Plan sections">
            {tabs.map(([id, label, path]) => (
              <button
                type="button"
                key={id}
                className={id === "overview" ? "active" : ""}
                aria-current={id === "overview" ? "page" : undefined}
                onClick={() => navigate(path, { state: { plan } })}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* PLAN INFORMATION CARD */}
          <section className="plan-details-card">
            <div className="plan-details-card-heading">
              <div className="plan-details-icon">
                <i className="bi bi-card-text" />
              </div>
              <div>
                <h2> Plan Details </h2>
                <p>View plan details and the applicable store type.</p>
              </div>
            </div>

            {/* GRID OF FIELDS (2 PER ROW + FULL-WIDTH DESCRIPTION) */}
            <div className="plan-details-grid">
              {/* Row 1: Plan Code */}
              <label className="plan-details-field">
                <span>
                  Plan Code <b>*</b>
                </span>
                <input value={plan.code || ""} readOnly />
                <small>Unique identifier for this subscription plan.</small>
              </label>

              {/* Row 1: Status */}
              <label className="plan-details-field">
                <span>
                  Status <b>*</b>
                </span>
                <input
                  className={
                    plan.status === "Inactive"
                      ? "plan-details-status-inactive"
                      : "plan-details-status"
                  }
                  value={plan.status ? `● ${plan.status}` : "—"}
                  readOnly
                />
                <small>
                  Inactive plans cannot be assigned to new subscriptions.
                </small>
              </label>

              {/* Row 2: Plan Name */}
              <label className="plan-details-field">
                <span>
                  Plan Name <b>*</b>
                </span>
                <input value={plan.name || ""} readOnly />
              </label>

              {/* Row 2: Applicable Store Type*/}
              <label className="plan-details-field">
                <span>
                  Applicable Store Type <b>*</b>
                </span>
                <input value={plan.storeTypeName || plan.storeType || ""} readOnly />
                {/* <small>The store type this plan can be assigned to.</small> */}
              </label>

              {/* Row 3: Description (Spans full width) */}
              <label className="plan-details-field plan-details-description">
                <span>Description</span>
                <textarea value={plan.description || ""} readOnly />
                <small>{(plan.description || "").length}/500</small>
              </label>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
