import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  createMerchant,
  getMerchant,
  mapMerchantToRow,
  updateMerchant,
} from "../api/merchants";
import { listPlans } from "../api/plans";
import { useLocationOptions } from "../data/useLocationOptions";
import { storeTypesApi } from "../api/storeTypes";
import FilterDropdown from "../components/FilterDropdown";
import PhoneInputModule from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import "../styles/merchant-form.css";

const PhoneInput = PhoneInputModule.default || PhoneInputModule;

const today = () => new Date().toISOString().slice(0, 10);
const TAX_RATE = 8.6;
const blankMerchant = () => ({
  code: "",
  ein: "",
  firstName: "",
  lastName: "",
  name: "",
  business: "",
  display: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postal: "",
  country: "",
});

function merchantDetailToDraft(result, fallback = {}) {
  const response = result?.raw || {};
  const raw = response.merchant || response.data?.merchant || response.data || response;
  const address = raw.businessAddress || raw.address || {};
  const subscription = result?.subscription || raw.subscription || {};
  const owner = String(raw.ownerName || raw.merchantName || "").trim().split(/\s+/);
  const planId = subscription.planId || subscription.plan_id || raw.planId || raw.plan_id || "";
  return {
    merchant: {
      ...blankMerchant(),
      code: String(raw.merchantCode || raw.merchant_code || raw.code || fallback.merchantCode || ""),
      ein: raw.ein || raw.EIN || "",
      firstName: raw.firstName || owner[0] || "",
      lastName: raw.lastName || owner.slice(1).join(" "),
      name: raw.ownerName || [raw.firstName, raw.lastName].filter(Boolean).join(" "),
      business: raw.legalBusinessName || raw.businessName || fallback.name || "",
      display: raw.businessDisplayName || raw.businessName || raw.name || fallback.name || "",
      email: raw.email || raw.merchantEmail || fallback.email || "",
      phone: normalizePhone(raw.phone || raw.merchantPhoneNumber || fallback.phone || ""),
      addressLine1: raw.addressLine1 || (typeof address === "string" ? address : address.addressLine1 || address.street || ""),
      addressLine2: raw.addressLine2 || address.addressLine2 || address.unit || "",
      city: raw.city || address.city || "",
      state: raw.state || address.state || "",
      postal: raw.postalCode || raw.pinCode || address.zipCode || "",
      country: raw.country || address.country || "",
    },
    planId,
    planName: subscription.planName || subscription.planCode || raw.plan || fallback.plan || "",
    cycle: normalizeCycle(subscription.billingCycle || subscription.billing_cycle || raw.billingCycle || raw.billing_cycle),
    start: String(subscription.startDate || subscription.start || "").slice(0, 10),
    subscriptionId: subscription.id || subscription.subscriptionId || "",
    subscriptionStatus: subscription.status || "Pending activation",
    employeeCount: raw.employeeCount ?? fallback.employeeCount ?? null,
    paymentHistory: raw.paymentHistory || [],
  };
}

function Field({ label, value, onChange, error, ...props }) {
  return (
    <label className={`pch-field${error ? " pch-field-invalid" : ""}`}>
      {label}
      <input {...props} aria-invalid={Boolean(error)} value={value ?? ""} onChange={(event) => onChange?.(event.target.value)} />
      {error && <span className="pch-field-error" role="alert">{error}</span>}
    </label>
  );
}

function Select({ label, value, options, onChange, placeholder, error, ...props }) {
  return (
    <label className={`pch-field${error ? " pch-field-invalid" : ""}`}>
      {label}
      <FilterDropdown {...props} aria-label={label} aria-required={props.required} aria-invalid={Boolean(error)} value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder || `Select ${label.replace(/\s*\*$/, "")}`}</option>
        {options.map((option) => {
          const item = typeof option === "string" ? { value: option, label: option } : option;
          return <option key={item.value} value={item.value}>{item.label}</option>;
        })}
      </FilterDropdown>
      {error && <span className="pch-field-error" role="alert">{error}</span>}
    </label>
  );
}

function Panel({ title, children }) {
  return <section className="pch-panel"><div className="pch-panel-heading"><h2>{title}</h2></div>{children}</section>;
}

function formatPrice(amount, currency = "USD") {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "â€”";
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function getPlanStoreType(plan, storeTypes) {
  const value = plan.applicableStoreType ?? plan.storeType ?? plan.store_type;
  if (!value) return "General Plans";
  if (typeof value === "object") return value.name || value.storeTypeName || value.title || value.code || "General Plans";
  const name = String(value).trim();
  const match = storeTypes.find((type) => [type.id, type.code, type.name].some((field) => String(field || "").toLowerCase() === name.toLowerCase()));
  return match?.name || name || "General Plans";
}

function renewalDate(start, cycle) {
  if (!start) return "";
  const date = new Date(`${start}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + (/annual|year/i.test(cycle) ? 12 : /quarter/i.test(cycle) ? 3 : 1));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

function normalizeCycle(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("annual") || normalized.includes("year")) return "Annual";
  if (normalized.includes("quarter")) return "Quarterly";
  return "Monthly";
}

function normalizePhone(value) {
  const phone = String(value || "").replace(/\D/g, "");
  return phone.length === 10 ? `91${phone}` : phone;
}

function Header({ editing, onBack }) {
  return <header><nav className="pch-breadcrumb" aria-label="Breadcrumb"><button type="button" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Merchants</button><span aria-hidden="true">/</span><span>{editing ? "Edit Merchant" : "Add Merchant"}</span></nav></header>;
}

export function onboardingToRow(data) {
  const merchant = data.merchant;
  const name = merchant.business || merchant.display || "Merchant";
  return {
    id: merchant.code || data.merchantId,
    merchantCode: merchant.code,
    name,
    email: merchant.email,
    phone: merchant.phone,
    employeeCount: data.employeeCount ?? null,
    country: merchant.country,
    state: merchant.state,
    stores: 0,
    plan: data.planDetails?.name || data.planName || "",
    status: "Inactive",
    createdAt: new Date().toISOString(),
    joined: new Date().toLocaleDateString(),
    active: "â€”",
    initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
    _onboarding: structuredClone(data),
  };
}

export default function AddMerchant({ localMerchants = [], onSave }) {
  const { merchantId } = useParams();
  return <MerchantEditor key={merchantId || "new"} merchantId={merchantId} localMerchants={localMerchants} onSave={onSave} />;
}

function MerchantEditor({ merchantId, localMerchants, onSave }) {
  const navigate = useNavigate();
  const location = useLocation();
  const selected = merchantId
    ? localMerchants.find((row) => String(row.id) === String(merchantId)) || location.state?.merchant || null
    : null;
  const [merchant, setMerchant] = useState(selected?._onboarding?.merchant || blankMerchant());
  const locationOptions = useLocationOptions(merchant);
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState(selected?._onboarding?.planId || "");
  const [cycle, setCycle] = useState(normalizeCycle(selected?._onboarding?.cycle || "Monthly"));
  const [start, setStart] = useState(selected?._onboarding?.start || today());
  const [step, setStep] = useState(0);
  const [storeTypes, setStoreTypes] = useState([]);
  const [loading, setLoading] = useState(Boolean(merchantId && !selected?._onboarding));
  const [plansLoading, setPlansLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [phoneCountry, setPhoneCountry] = useState("in");
  const [phoneDialCode, setPhoneDialCode] = useState("91");
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [saved, setSaved] = useState(null);
  const editing = Boolean(merchantId);
  const cancel = () => navigate("/merchants");
  const goToStep = (index) => setStep(index);

  useEffect(() => {
    let active = true;
    listPlans().then((items) => active && setPlans(items.filter((item) => String(item.status).toUpperCase() === "ACTIVE")))
      .catch((failure) => active && setError(failure.message || "Unable to load plans."))
      .finally(() => active && setPlansLoading(false));
    storeTypesApi.getAll().then((response) => active && setStoreTypes(response.storeTypes || [])).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!merchantId || selected?._onboarding) return;
    let active = true;
    getMerchant(merchantId).then((result) => {
      if (!active) return;
      const draft = merchantDetailToDraft(result, selected || result.merchant);
      setMerchant(draft.merchant);
      setPlanId(draft.planId || "");
      setCycle(normalizeCycle(draft.cycle));
      setStart(draft.start || today());
    }).catch((failure) => active && setError(failure.message || "Unable to load merchant details."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [merchantId]);

  const plan = plans.find((item) => String(item.id) === String(planId)) || null;
  const planGroups = useMemo(() => {
    const groups = new Map();
    plans.forEach((item) => {
      const name = getPlanStoreType(item, storeTypes);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(item);
    });
    return [...groups].map(([storeType, items]) => ({ storeType, items }));
  }, [plans, storeTypes]);
  useEffect(() => {
    if (!plan && plans.length && selected?._onboarding?.planName) {
      const match = plans.find((item) => item.name.toLowerCase() === selected._onboarding.planName.toLowerCase());
      if (match) setPlanId(match.id);
    }
  }, [plans]);

  const updateField = (key, value) => {
    setMerchant((previous) => ({ ...previous, [key]: value }));
    setFieldErrors((previous) => ({ ...previous, [key]: "" }));
  };
  const validatePhone = () => {
    const phoneDigits = String(merchant.phone || "").replace(/\D/g, "");
    if (!phoneDigits || phoneDigits.length <= phoneDialCode.length) return "Phone Number is required.";
    const nationalDigits = phoneDigits.startsWith(phoneDialCode) ? phoneDigits.slice(phoneDialCode.length) : phoneDigits;
    if (nationalDigits.length < 7 || phoneDigits.length > 15) return "Enter a valid phone number.";
    if (!String(merchant.country || "").trim()) return "Select a country before entering the phone number.";
    const countryMatches = locationOptions.selectedCountry?.iso2?.toLowerCase() === phoneCountry.toLowerCase();
    if (!countryMatches) return "Phone country code must match the selected merchant country.";
    return "";
  };
  const validateMerchant = () => {
    const errors = {};
    for (const [key, label] of [["business", "Legal Business Name"], ["display", "Business Display Name"], ["firstName", "First Name"], ["lastName", "Last Name"], ["addressLine1", "Address Line 1"], ["city", "City"], ["state", "State / Province"], ["postal", "ZIP Code"], ["country", "Country"]]) {
      if (!String(merchant[key] || "").trim()) errors[key] = `${label} is required.`;
    }
    if (!String(merchant.email || "").trim()) errors.email = "Email Address is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(merchant.email)) errors.email = "Enter a valid email address.";
    errors.phone = validatePhone();
    return errors;
  };

  const continueStep = () => {
    if (step === 0) {
      const validation = validateMerchant();
      setFieldErrors(validation);
      if (Object.values(validation).some(Boolean)) {
        setError("");
        return;
      }
    } else if (!plan) {
      setError("Choose an active plan.");
      return;
    }
    setError("");
    setStep((current) => current + 1);
  };

  async function save() {
    const validation = validateMerchant();
    setFieldErrors(validation);
    const firstFieldError = Object.values(validation).find(Boolean);
    if (firstFieldError) {
      setStep(0);
      setError("");
      return;
    }
    if (!plan) {
      setStep(1);
      return setError("Choose an active plan.");
    }
    if (!onSave) return setError("Merchant saving is not connected.");
    setError("");
    setSubmitting(true);
    const data = {
      merchant: { ...merchant, name: [merchant.firstName, merchant.lastName].filter(Boolean).join(" ") },
      planId: plan.id,
      planDetails: plan,
      planName: plan.name,
      cycle,
      start,
      renewalDate: renewalDate(start, cycle),
      agreementPrice: total,
      tax: Math.round(total * (TAX_RATE / 100) * 100) / 100,
      totalDueToday: Math.round(total * (1 + TAX_RATE / 100) * 100) / 100,
      paymentMethod: paymentMethod.toUpperCase(),
      employeeCount: selected?._onboarding?.employeeCount ?? 0,
      stores: [],
      roles: [],
    };
    try {
      const response = merchantId ? await updateMerchant(merchantId, data) : await createMerchant(data);
      const raw = response?.merchant || response?.data?.merchant || response?.data || response;
      const code = raw?.merchantCode || raw?.merchant_code || raw?.code || merchant.code;
      const row = onboardingToRow({ ...data, merchant: { ...merchant, code } });
      const mapped = mapMerchantToRow(response);
      row.id = selected?.id || raw?.id || raw?.merchantId || raw?._id || response?.merchantId || code;
      row.merchantId = raw?.merchantId || raw?.id || raw?._id || response?.merchantId || row.id;
      row.name = mapped?.name || row.name;
      row.status = mapped?.status || row.status;
      await onSave(row);
      setSaved({
        ...row,
        cycle,
        start,
        renewalDate: renewalDate(start, cycle),
        amount: total,
        currency: plan.currency || "USD",
        employeeLimit: plan.includedUsers,
        subscriptionId: response?.subscription?.id || response?.subscriptionId || "",
        subscriptionStatus: response?.subscription?.status || "Pending activation",
      });
    } catch (failure) {
      setError(failure.message || "Unable to save merchant.");
    } finally {
      setSubmitting(false);
    }
  }

  const address = [merchant.addressLine1, merchant.addressLine2, merchant.city, merchant.state, merchant.postal, merchant.country].filter(Boolean).join(", ");
  const cycleLabel = cycle === "Annual" ? "year" : cycle === "Quarterly" ? "quarter" : "month";
  const price = Number(plan?.price ?? plan?.basePrice ?? 0);
  const total = price * (cycle === "Annual" ? 12 : cycle === "Quarterly" ? 3 : 1);
  const features = useMemo(() => (plan?.includedFeatures || []).map((feature) => typeof feature === "string" ? feature : feature.name || feature.featureName || feature.code).filter(Boolean), [plan]);

  if (loading) return <div id="pch-new"><Header editing onBack={cancel} /><p className="pch-note">Loading merchantâ€¦</p></div>;
  if (saved) return (
    <div id="pch-new"><Header editing={editing} onBack={cancel} />
      <main className="pch-success-screen">
        <h1>Subscription Successful!</h1>
        <p>Welcome to Pinaka Commerce Hub, {saved.name}.</p>
        <section className="pch-success-details">
          <div className="pch-rule"><span className="pch-muted">Plan</span><span>{saved.plan}</span></div>
          <div className="pch-rule"><span className="pch-muted">Billing Cycle</span><span>{saved.cycle}</span></div>
          <div className="pch-rule"><span className="pch-muted">Employees</span><span>{saved.employeeCount ?? 0} / {saved.employeeLimit ?? "Not set"}</span></div>
          <div className="pch-rule"><span className="pch-muted">Amount</span><span>{formatPrice(saved.amount, saved.currency)} / {saved.cycle === "Annual" ? "year" : saved.cycle === "Quarterly" ? "quarter" : "month"}</span></div>
          <div className="pch-rule"><span className="pch-muted">Subscription ID</span><span>{saved.subscriptionId || "Pending assignment"}</span></div>
          <div className="pch-rule"><span className="pch-muted">Start Date</span><span>{saved.start}</span></div>
          <div className="pch-rule"><span className="pch-muted">Next Billing Date</span><span>{saved.renewalDate}</span></div>
          <div className="pch-rule"><span className="pch-muted">Status</span><span><span className="pch-subscription-status">{saved.subscriptionStatus}</span></span></div>
        </section>
        <div className="pch-success-actions">
          <button className="pch-subscribe-now" type="button" onClick={() => navigate("/dashboard")}>Go to Dashboard</button>
          <button className="pch-subscribe-now" type="button" onClick={cancel}>Back to Merchants</button>
        </div>
      </main>
    </div>
  );

  return (
    <div id="pch-new" className={`pch-merchant-one-page ${editing ? "pch-editing" : "pch-step-scroll"}`}><Header editing={editing} onBack={cancel} />
      <div className="pch-layout">
        <aside><div className="pch-eyebrow pch-aside-note">Add merchant</div><nav className="pch-rail" aria-label="Setup steps">
          {[
            ["Merchant details", "Business & primary contact"],
            ["Select Plan", "Plan Pricing and Included Limits"],
            ["Review & Confirm", "Merchant, Subscription, and Billing Summary"],
          ].map(([label, description], index) => <button key={label} type="button" disabled={!editing && index > step} className={index === step ? "pch-current" : ""} aria-current={index === step ? "step" : undefined} onClick={() => goToStep(index)}><span className="pch-number">{index < step ? "✓" : index + 1}</span><span>{label}<small className="pch-muted pch-rail-description">{description}</small></span></button>)}
        </nav></aside>
        <main>
          <section hidden={step !== 0} className="pch-merchant-step">
            <div className="pch-eyebrow">Step 1 - Merchant Details</div>
            <h1>Merchant details</h1>
            <p className="pch-muted">Business and primary contact</p>
            <Panel title="Business Information"><div className="pch-grid">
              <Field label="Legal Business Name *" placeholder="Enter legal business name" value={merchant.business} required error={fieldErrors.business} onChange={(v) => updateField("business", v)} />
              <Field label="Business Display Name *" placeholder="Enter business display name" value={merchant.display} required error={fieldErrors.display} onChange={(v) => updateField("display", v)} />
              <Field label="Merchant Code" value={merchant.code} readOnly placeholder=" Auto Generated" />
              <Field label="EIN" placeholder="Enter EIN" value={merchant.ein} onChange={(v) => updateField("ein", v)} />
            </div></Panel>
            <Panel title="Primary Contact"><div className="pch-grid">
              <Field label="First Name *" placeholder="Enter first name" value={merchant.firstName} required error={fieldErrors.firstName} onChange={(v) => updateField("firstName", v)} />
              <Field label="Last Name *" placeholder="Enter last name" value={merchant.lastName} required error={fieldErrors.lastName} onChange={(v) => updateField("lastName", v)} />
              <Field label="Email Address *" type="email" placeholder="Enter email address" value={merchant.email} required error={fieldErrors.email} onChange={(v) => updateField("email", v)} />
              <div className={`pch-field pch-phone-field${fieldErrors.phone ? " pch-field-invalid" : ""}`}>
                <label htmlFor="merchant-phone">Phone Number *</label>
                <PhoneInput country="in" enableSearch countryCodeEditable={false} autoFormat value={merchant.phone} onMount={(_value, data) => { if (data?.countryCode) setPhoneCountry(data.countryCode); if (data?.dialCode) setPhoneDialCode(data.dialCode); }} onChange={(value, data) => { updateField("phone", value); if (data?.countryCode) setPhoneCountry(data.countryCode); if (data?.dialCode) setPhoneDialCode(data.dialCode); }} inputProps={{ id: "merchant-phone", name: "phone", required: true, autoComplete: "tel", "aria-invalid": Boolean(fieldErrors.phone) }} />
                {fieldErrors.phone && <span className="pch-field-error" role="alert">{fieldErrors.phone}</span>}
              </div>
              <Field label="Address Line 1 *" placeholder="Enter street address" value={merchant.addressLine1} required error={fieldErrors.addressLine1} onChange={(v) => updateField("addressLine1", v)} />
              <Field label="Address Line 2" placeholder="Apartment, suite, etc. (optional)" value={merchant.addressLine2} onChange={(v) => updateField("addressLine2", v)} />
              <Field label="City *" placeholder="Enter city" value={merchant.city} required error={fieldErrors.city} onChange={(v) => updateField("city", v)} />
              <Select label="State / Province *" value={merchant.state} placeholder={merchant.country ? "Select state or province" : "Select country first"} options={locationOptions.states.map((value) => ({ value, label: value }))} required error={fieldErrors.state} onChange={(v) => updateField("state", v)} />
              <Field label="ZIP / Postal Code *" placeholder="Enter ZIP or postal code" value={merchant.postal} required error={fieldErrors.postal} onChange={(v) => updateField("postal", v)} />
              <Select label="Country *" value={merchant.country} options={locationOptions.countries.map((value) => ({ value, label: value }))} required error={fieldErrors.country} onChange={(v) => { updateField("country", v); updateField("state", ""); }} />
            </div></Panel>
            {error && <div className="pch-error" role="alert">{error}</div>}
            <div className="pch-footerbar"><span /><button className="pch-primary" type="button" disabled={submitting} onClick={continueStep}>Continue</button></div>
          </section>
          <section hidden={step !== 1} className="pch-plan-step">
            <div className="pch-eyebrow">Step 2 - Plan Selection</div>
            <h1>Choose plan</h1>
            <p className="pch-muted">Select an active plan and billing details.</p>
            <Panel title="Subscription Plan">
              {plansLoading ? <p className="pch-note">Loading plansâ€¦</p> : null}
              {!plansLoading && !plans.length ? <p className="pch-note">No active plans are available.</p> : null}
              <div className="pch-plan-browser">
                <section className="pch-plan-list" aria-label="Available plans">
                  <h4>Available plans</h4>
                  <div className="pch-plan-list-scroll">
                    {planGroups.map((group) => <div key={group.storeType} className="pch-plan-group">
                      <div className="pch-plan-group-heading"><span>{group.storeType}</span><span>{group.items.length} {group.items.length === 1 ? "plan" : "plans"}</span></div>
                      {group.items.map((item) => <label key={item.id} className={`pch-plan-option ${String(item.id) === String(planId) ? "pch-selected" : ""}`}>
                        <input type="radio" name="merchant-plan-selection" value={item.id} checked={String(item.id) === String(planId)} onChange={() => setPlanId(String(item.id))} aria-label={`Select ${item.name}`} />
                        <span className="pch-plan-option-copy"><strong>{item.name}</strong><span className="pch-plan-option-price">{formatPrice(item.price ?? item.basePrice, item.currency || "USD")}</span><small>per merchant / {item.billingCycle || "month"}</small><span className="pch-plan-option-limits">{item.includedStores ?? "Custom"} stores Â· {item.includedTerminals ?? "Custom"} devices Â· {item.includedUsers ?? "Custom"} employees</span></span>
                      </label>)}
                    </div>)}
                  </div>
                </section>
                <div className="pch-plan-detail-column">
                  <section className="pch-plan-detail" aria-live="polite">
                    {!plan ? <div className="pch-plan-empty"><span className="pch-plan-empty-icon" aria-hidden="true">â—‡<i>+</i></span><strong>Select a plan to view details</strong><span>Plan price, limits and included features will appear here.</span></div> : <div className="pch-plan-detail-content">
                      <div className="pch-plan-detail-heading"><div><span className="pch-small pch-muted">Plan details</span><h3>{plan.name}</h3><div className="pch-price">{formatPrice(plan.price ?? plan.basePrice, plan.currency || "USD")} <small>per merchant / {plan.billingCycle || "month"}</small></div></div><span className="pch-plan-selected-label">Selected</span></div>
                      <div className="pch-plan-detail-limits"><div><strong>{plan.includedStores ?? "Custom"}</strong><span>stores</span></div><div><strong>{plan.includedTerminals ?? "Custom"}</strong><span>devices</span></div><div><strong>{plan.includedUsers ?? "Custom"}</strong><span>employees</span></div></div>
                      <details className="pch-plan-features" open><summary>Included Features <span>{features.length}</span></summary>{features.length ? <ul>{features.map((feature) => <li key={feature}>{feature}</li>)}</ul> : <p>No included features configured for this plan.</p>}</details>
                    </div>}
                  </section>
                  <section className="pch-plan-agreement" aria-label="Billing Details"><h3>Billing Details</h3><div className="pch-grid">
                    <Select label="Billing cycle" value={cycle} options={["Monthly", "Quarterly", "Annual"]} onChange={(value) => setCycle(normalizeCycle(value))} />
                    <Field label="Start date" type="date" value={start} onChange={setStart} />
                    <Field label="Renewal date" type="date" value={renewalDate(start, cycle)} readOnly />
                    <Field label="Subscription Price" value={`${formatPrice(total, plan?.currency || "USD")} / ${cycleLabel}`} readOnly />
                  </div><p className="pch-note">Country-based merchant pricing. Annual amount is 12 monthly payments; tax excluded.</p></section>
                </div>
              </div>
            </Panel>
            {error && <div className="pch-error" role="alert">{error}</div>}
            <div className="pch-footerbar">
              <button type="button" disabled={submitting} onClick={() => { setError(""); setStep(0); }}>Back</button>
              <button className="pch-primary" type="button" disabled={submitting || plansLoading} onClick={continueStep}>Review &amp; Confirm</button>
            </div>
          </section>
          <section hidden={step !== 2} className="pch-review-step">
            <div className="pch-eyebrow">Step 3 - Review &amp; Subscribe</div>
            <h1>Review &amp; Subscribe</h1>
            <p className="pch-muted">Review merchant, plan, and billing information.</p>
            <div className="pch-review-grid">
              <Panel title="Merchant Details">
                <dl className="pch-review-list">
                  <div><dt>Business Name</dt><dd>{merchant.business || merchant.display || "—"}</dd></div>
                  <div><dt>Merchant Code</dt><dd>{merchant.code || "Auto Generated"}</dd></div>
                  <div><dt>EIN</dt><dd>{merchant.ein || "—"}</dd></div>
                  <div><dt>Primary Contact</dt><dd>{[merchant.firstName, merchant.lastName].filter(Boolean).join(" ") || "—"}</dd></div>
                  <div><dt>Email Address</dt><dd>{merchant.email || "—"}</dd></div>
                  <div><dt>Phone Number</dt><dd>{merchant.phone || "—"}</dd></div>
                  <div><dt>Business Address</dt><dd>{address || "—"}</dd></div>
                </dl>
              </Panel>
              <Panel title="Plan Details">
                <dl className="pch-review-list">
                  <div><dt>Subscription Plan</dt><dd>{plan?.name || "—"}</dd></div>
                  <div><dt>Store Type</dt><dd>{plan ? getPlanStoreType(plan, storeTypes) : "—"}</dd></div>
                  <div><dt>Billing Cycle</dt><dd>{cycle}</dd></div>
                  <div><dt>Plan Includes</dt><dd>{plan ? `${plan.includedStores ?? "Custom"} stores · ${plan.includedTerminals ?? "Custom"} devices · ${plan.includedUsers ?? "Custom"} employees` : "—"}</dd></div>
                  <div><dt>Start Date</dt><dd>{start || "—"}</dd></div>
                  <div><dt>Renewal Date</dt><dd>{renewalDate(start, cycle) || "—"}</dd></div>
                </dl>
              </Panel>
              <Panel title="Billing Summary">
                <div className="pch-billing-summary">
                  <div><span>Subscription Subtotal</span><strong>{formatPrice(total, plan?.currency || "USD")}</strong></div>
                  <div><span>Tax ({TAX_RATE.toFixed(2)}%)</span><strong>{formatPrice(Math.round(total * TAX_RATE) / 100, plan?.currency || "USD")}</strong></div>
                  <div className="pch-billing-total"><span>Total Due</span><strong>{formatPrice(Math.round(total * (1 + TAX_RATE / 100) * 100) / 100, plan?.currency || "USD")}</strong></div>
                </div>
              </Panel>
              <Panel title="Payment Method">
                <fieldset className="pch-payment-methods">
                  <legend>Select a payment method</legend>
                  <label><input type="radio" name="merchant-payment-method" value="card" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} /> Credit or Debit Card</label>
                  <label><input type="radio" name="merchant-payment-method" value="ach" checked={paymentMethod === "ach"} onChange={() => setPaymentMethod("ach")} /> Bank transfer</label>
                </fieldset>
                <p className="pch-note">No payment information is entered on this screen.</p>
              </Panel>
            </div>
            {error && <div className="pch-error" role="alert">{error}</div>}
            <div className="pch-footerbar">
              <button type="button" disabled={submitting} onClick={() => { setError(""); setStep(1); }}>Back</button>
              <button className="pch-primary" type="button" disabled={submitting || !plan} onClick={save}>{submitting ? "Saving…" : editing ? "Save Changes" : "Create Merchant"}</button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
