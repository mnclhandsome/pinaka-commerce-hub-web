import FilterDropdown from "../components/FilterDropdown";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Pagination from "../components/Pagination";
import { storeTypesApi } from "../api/storeTypes";
import { createPlan, deletePlan, listPlans, updatePlan } from "../api/plans";

const emptyForm = {
  code: "",
  name: "",
  description: "",
  applicableStoreType: "",
  status: "Select Status",
  billingModel: "",
  currency: "",
  billingCycle: "",
  basePrice: "",
  includedStores: "0",
  includedTerminals: "0",
  additionalTerminalPrice: "",
  includedUsers: "0",
  additionalUserPrice: "",
  trialPeriod: "",
  effectiveFrom: "",
};
function normalizeStoreTypeFeatures(response) {
  const source =
    response?.features ??
    response?.storeTypeFeatures ??
    response?.items ??
    response?.data ??
    response;

  return (Array.isArray(source) ? source : [])
    .map((assignment, index) => {
      const feature =
        assignment?.feature ??
        assignment?.featureDetails ??
        assignment?.featureDefinition ??
        assignment;

      const featureId = String(
        feature?.featureId ??
          assignment?.featureId ??
          feature?.feature_id ??
          assignment?.feature_id ??
          feature?.id ??
          feature?._id ??
          assignment?.id ??
          assignment?._id ??
          "",
      ).trim();

      return {
        id: featureId,
        featureId,
        name: String(
          feature?.name ??
            feature?.featureName ??
            feature?.feature_name ??
            feature?.featureKey ??
            feature?.code ??
            `Feature ${index + 1}`,
        ).trim(),

        category: String(
          feature?.category ??
            feature?.categoryName ??
            feature?.category_name ??
            "—",
        ).trim(),

        description: String(
          feature?.description ?? feature?.category ?? "Store type feature",
        ).trim(),

        icon: feature?.icon || "bi-grid",

        active:
          String(
            feature?.featureStatus ?? feature?.status ?? "ACTIVE",
          ).toUpperCase() !== "INACTIVE",

        defaultEnabled: assignment?.defaultEnabled === true,
      };
    })
    .filter((feature) => feature.featureId && feature.name && feature.active);
}

function storeTypeDisplayName(value, storeTypes) {
  const candidates =
    value && typeof value === "object"
      ? [
          value.id,
          value._id,
          value.storeTypeId,
          value.storeTypeCode,
          value.code,
          value.name,
          value.storeTypeName,
        ]
      : [value];

  const match = storeTypes.find((storeType) => {
    const identifiers = [
      storeType.id,
      storeType._id,
      storeType.storeTypeId,
      storeType.storeTypeCode,
      storeType.code,
      storeType.name,
      storeType.storeTypeName,
    ]
      .filter(Boolean)
      .map((item) => String(item).trim().toLowerCase());

    return candidates.some(
      (candidate) =>
        candidate !== undefined &&
        candidate !== null &&
        identifiers.includes(String(candidate).trim().toLowerCase()),
    );
  });

  if (match) {
    return (
      match.name ??
      match.storeTypeName ??
      match.code ??
      match.storeTypeCode ??
      String(value ?? "")
    );
  }

  return typeof value === "object"
    ? (value.name ?? value.storeTypeName ?? value.code ?? "")
    : String(value ?? "");
}

const planRowStyle = {
  display: "grid",
  gridTemplateColumns:
    "100px 100px minmax(100px, 1fr) 130px 120px 100px 90px 110px 110px 80px",
  gap: "10px",
  alignItems: "center",
  minWidth: "1150px",
};

export default function CreatePlan() {
  const navigate = useNavigate();

  const [storeTypes, setStoreTypes] = useState([]);
  const storeTypesRequest = useRef(false);
  const [storeTypesLoading, setStoreTypesLoading] = useState(false);
  const [storeTypesError, setStoreTypesError] = useState("");

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [planStep, setPlanStep] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [includedFeatures, setIncludedFeatures] = useState([]);

  const [pendingIncludedFeatureNames, setPendingIncludedFeatureNames] =
    useState([]);

  const [storeTypeFeatures, setStoreTypeFeatures] = useState([]);
  const [storeTypeFeaturesLoading, setStoreTypeFeaturesLoading] =
    useState(false);
  const [storeTypeFeaturesError, setStoreTypeFeaturesError] = useState("");

  const [search, setSearch] = useState("");
  const [billingFilter, setBillingFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [message, setMessage] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // FIELD VALIDATIONS
  // FIELD VALIDATIONS
  const codeError = useMemo(() => {
    if (!form.code) return "";
    // Allows letters, numbers, underscores (_), and hyphens (-)
    if (!/^[a-zA-Z0-9_-]+$/.test(form.code)) {
      return "Plan Code can only contain letters, numbers, underscores (_), and hyphens (-).";
    }
    return "";
  }, [form.code]);

  const nameError = useMemo(() => {
    if (!form.name) return "";
    // Allows letters, numbers, underscores (_), hyphens (-), and spaces
    if (!/^[a-zA-Z0-9_\- ]+$/.test(form.name)) {
      return "Plan Name can only contain letters, numbers, underscores (_), hyphens (-), and spaces.";
    }
    return "";
  }, [form.name]);

  async function fetchStoreTypes() {
    if (storeTypesRequest.current) return;
    storeTypesRequest.current = true;
    try {
      setStoreTypesLoading(true);
      setStoreTypesError("");
      const response = await storeTypesApi.getAll();
      const normalized = Array.isArray(response?.storeTypes)
        ? response.storeTypes
        : Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response)
              ? response
              : [];
      setStoreTypes(normalized);
    } catch (error) {
      setStoreTypesError(error?.message || "Failed to load store types.");
    } finally {
      storeTypesRequest.current = false;
      setStoreTypesLoading(false);
    }
  }
  function formatDateParts(value) {
    if (!value) return { date: "—", time: "" };

    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) {
      return { date: String(value), time: "" };
    }

    return {
      date: dateValue.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      time: dateValue.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    };
  }
  async function fetchPlans() {
    try {
      setPlansLoading(true);
      setPlansError("");
      const data = await listPlans();
      const nextPlans = Array.isArray(data) ? data : [];
      setPlans(nextPlans);
    } catch (error) {
      setPlansError(error?.message || "Failed to load plans.");
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  }

  useEffect(() => {
    fetchStoreTypes();
    fetchPlans();
  }, []);

  useEffect(() => {
    const selectedStoreType = storeTypes.find(
      (storeType) =>
        String(
          storeType.id ??
            storeType._id ??
            storeType.storeTypeId ??
            storeType.code,
        ) === String(form.applicableStoreType) ||
        String(
          storeType.name ?? storeType.storeTypeName ?? storeType.code,
        ).toLowerCase() === String(form.applicableStoreType).toLowerCase(),
    );

    if (!selectedStoreType) {
      setStoreTypeFeatures([]);
      setStoreTypeFeaturesError("");
      setStoreTypeFeaturesLoading(false);
      return undefined;
    }

    let active = true;
    const storeTypeId =
      selectedStoreType.id ??
      selectedStoreType._id ??
      selectedStoreType.storeTypeId ??
      selectedStoreType.code;

    setStoreTypeFeaturesLoading(true);
    setStoreTypeFeaturesError("");

    storeTypesApi
      .getFeatures(storeTypeId)
      .then((response) => {
        if (!active) return;
        const features = normalizeStoreTypeFeatures(response);
        setStoreTypeFeatures(features);

        // Keep any existing feature IDs that still belong to this store type.
        setIncludedFeatures((current) => {
          if (!Array.isArray(current) || current.length === 0) return [];

          return current
            .map((selectedFeature) => {
              const byId = features.find(
                (feature) =>
                  String(feature.featureId) === String(selectedFeature),
              );

              if (byId) return byId.featureId;

              const byName = features.find(
                (feature) =>
                  String(feature.name).trim().toLowerCase() ===
                  String(selectedFeature).trim().toLowerCase(),
              );

              return byName?.featureId;
            })
            .filter(Boolean);
        });
      })
      .catch((error) => {
        if (!active) return;
        setStoreTypeFeatures([]);
        setStoreTypeFeaturesError(
          error?.message || "Failed to load store type features.",
        );
      })
      .finally(() => {
        if (active) setStoreTypeFeaturesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form.applicableStoreType, storeTypes]);

  // The plan API returns includedFeatures as names, while the checkbox UI
  // uses feature IDs. Convert saved names to IDs after features are loaded.
  useEffect(() => {
    if (
      pendingIncludedFeatureNames.length === 0 ||
      storeTypeFeatures.length === 0
    ) {
      return;
    }

    const selectedFeatureIds = pendingIncludedFeatureNames
      .map((savedFeature) => {
        const savedValue =
          typeof savedFeature === "string"
            ? savedFeature
            : (savedFeature?.featureId ??
              savedFeature?.name ??
              savedFeature?.featureName ??
              "");

        const byId = storeTypeFeatures.find(
          (feature) =>
            String(feature.featureId).trim() === String(savedValue).trim(),
        );

        if (byId) return byId.featureId;

        const byName = storeTypeFeatures.find(
          (feature) =>
            String(feature.name).trim().toLowerCase() ===
            String(savedValue).trim().toLowerCase(),
        );

        return byName?.featureId || savedValue;
      })
      .filter(Boolean);

    console.log("Saved feature names from API:", pendingIncludedFeatureNames);
    console.log("Converted saved feature IDs:", selectedFeatureIds);

    setIncludedFeatures(selectedFeatureIds);
    setPendingIncludedFeatureNames([]);
  }, [pendingIncludedFeatureNames, storeTypeFeatures]);

  const textInputProps = {
    autoComplete: "off",
    spellCheck: false,
  };

  const filteredPlans = useMemo(() => {
    const query = search.trim().toLowerCase();

    return plans.filter((plan) => {
      const matchesSearch = `${plan.code} ${plan.name} ${plan.description}`
        .toLowerCase()
        .includes(query);

      const matchesBilling =
        !billingFilter || plan.billingModel === billingFilter;

      const matchesStatus = !statusFilter || plan.status === statusFilter;

      return matchesSearch && matchesBilling && matchesStatus;
    });
  }, [plans, search, billingFilter, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, billingFilter, statusFilter]);

 const totalPlans = filteredPlans.length;
const totalPages = Math.max(1, Math.ceil(totalPlans / itemsPerPage));

const paginatedPlans = useMemo(() => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  return filteredPlans.slice(startIndex, startIndex + itemsPerPage);
}, [filteredPlans, currentPage, itemsPerPage]);

useEffect(() => {
  if (currentPage > totalPages) {
    setCurrentPage(totalPages);
  }
}, [currentPage, totalPages]);

 const canContinueStepOne =
  form.name.trim() &&
  form.applicableStoreType &&
  form.status &&
  !codeError &&
  !nameError;

  const canContinuePricing =
    form.billingModel &&
    form.currency &&
    form.billingCycle &&
    form.basePrice !== "";

  const canContinueFeatures = includedFeatures.length > 0;

  function canMoveToStep(targetStep) {
    if (targetStep <= planStep) return true;
    if (targetStep >= 2 && !canContinueStepOne) return false;
    if (targetStep >= 3 && !canContinuePricing) return false;
    if (targetStep >= 4 && !canContinueFeatures) return false;
    return true;
  }

  function handleStepClick(step) {
    if (step < planStep) {
      setPlanStep(step);
      return;
    }
    if (step === planStep) return;
    if (canMoveToStep(step)) {
      setPlanStep(step);
    }
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === "code" ? value.toUpperCase() : value,
    }));
  }
  function getFeatureDisplayName(id) {
    const match = storeTypeFeatures.find(
      (f) =>
        String(f.featureId) === String(id) ||
        String(f.id) === String(id) ||
        String(f.name).toLowerCase() === String(id).toLowerCase(),
    );
    return match?.name || id;
  }

  function toggleIncludedFeature(featureId) {
    setIncludedFeatures((current) =>
      current.includes(featureId)
        ? current.filter((id) => id !== featureId)
        : [...current, featureId],
    );
  }

  function resetCreationForm() {
    setForm(emptyForm);
    setPlanStep(1);
    setEditingId(null);
    setIncludedFeatures([]);
    setPendingIncludedFeatureNames([]);
  }

  function resetFilters() {
    setSearch("");
    setBillingFilter("");
    setStatusFilter("");
    setCurrentPage(1);
  }

  async function createOrUpdatePlan() {
    const planData = {
      ...form,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim(),
    };

    try {
      setSavingPlan(true);
      setMessage("");

      let savedPlan;

      // Keep feature IDs for the API payload.
      // The checkbox state already contains the selected feature IDs,
      // so do not convert them to feature names before create/update.
      const selectedFeatureIds = includedFeatures.filter(Boolean);

      console.log("Selected Feature IDs:", selectedFeatureIds);
      console.log("Feature IDs sent to API:", selectedFeatureIds);

      if (editingId) {
        savedPlan = await updatePlan(editingId, planData, selectedFeatureIds);

        setMessage("Plan updated successfully.");
      } else {
        savedPlan = await createPlan(planData, selectedFeatureIds);

        setMessage("Plan created successfully.");
      }

      const refreshedPlans = await listPlans();
      setPlans(Array.isArray(refreshedPlans) ? refreshedPlans : []);
      resetCreationForm();
    } catch (error) {
      setMessage(error?.message || "Failed to save plan.");
    } finally {
      setSavingPlan(false);
    }
  }

  function editPlan(plan) {
    setEditingId(plan.id);

    setForm({
      ...emptyForm,
      code: plan.code || "",
      name: plan.name || "",
      description: plan.description || "",
      applicableStoreType: plan.applicableStoreType || plan.storeType || "",
      billingModel: plan.billingModel || "",
      currency: plan.currency || "",
      billingCycle: plan.billingCycle || plan.cycle || "",
      basePrice: String(plan.basePrice ?? plan.price ?? ""),
      includedStores: String(plan.includedStores ?? 0),
      includedTerminals: String(plan.includedTerminals ?? 0),
      additionalTerminalPrice: String(plan.additionalTerminalPrice ?? ""),
      includedUsers: String(plan.includedUsers ?? 0),
      additionalUserPrice: String(plan.additionalUserPrice ?? ""),
      trialPeriod: plan.trialPeriod || "",
      planEndDate: plan.planEndDate,
      effectiveFrom: plan.effectiveFrom
        ? String(plan.effectiveFrom).slice(0, 10)
        : "",
      status: plan.status || "Active",
    });

    const savedFeatureNames = Array.isArray(plan.includedFeatures)
      ? plan.includedFeatures
      : [];

    // The store-type features may load after the plan data. Keep the saved
    // names temporarily and convert them to checkbox IDs in the effect above.
    setIncludedFeatures([]);
    setPendingIncludedFeatureNames(savedFeatureNames);
    setPlanStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function confirmDelete() {
    if (!deleteTarget?.id || deletingPlan) return;

    try {
      setDeletingPlan(true);
      setMessage("");

      await deletePlan(deleteTarget.id);

      const refreshedPlans = await listPlans();
      setPlans(Array.isArray(refreshedPlans) ? refreshedPlans : []);
      setMessage(`${deleteTarget.name} deleted successfully.`);
      setDeleteTarget(null);
    } catch (error) {
      setMessage(error?.message || "Failed to delete plan.");
    } finally {
      setDeletingPlan(false);
    }
  }

  return (
    <section className="plans-page">
      <div className="plans-page-heading">
        <h1>Plan Details</h1>
        <p>
          Create a commercial package. Entitlements and limits are configured
          after saving.
        </p>
      </div>

      <div className="plan-stepper">
        {[
          ["Plan Details", 1],
          ["Pricing & Limits", 2],
          ["Included Features", 3],
          ["Review & Confirm", 4],
        ].map(([label, step], index) => (
          <div className="plan-stepper-item" key={step}>
            <button
              type="button"
              className={`plan-step ${planStep === step ? "active" : ""} ${
                planStep > step ? "complete" : ""
              }`}
              onClick={() => handleStepClick(step)}
            >
              <span>{step}</span>
              <strong>{label}</strong>
            </button>

            {index < 3 && <div className="plan-step-line" />}
          </div>
        ))}
      </div>

      {planStep === 1 && (
        <section className="plan-form-card plan-information-card">
          <div className="plan-card-heading plan-information-heading">
            <div className="plan-heading-icon">
              <i className="bi bi-file-earmark-text" />
            </div>
            <div>
              <h2>{editingId ? "Edit Plan" : "Create Plan"}</h2>
              <p>Enter the subscription plan details.</p>
            </div>
          </div>

          <div className="plan-create-grid three-columns plan-information-grid">
            <label className="plan-field ">
              <span>
                Plan Code
              </span>
              <input
                {...textInputProps}
                name="code"
                value={form.code}
                onChange={updateField}
                placeholder="Auto Generated"
                readOnly
                disabled
                className={codeError ? "input-error" : "plan-placeholder" }
              />
            
            </label>

            <label className="plan-field">
              <span>
                Plan Name <b>*</b>
              </span>
              <input
                {...textInputProps}
                name="name"
                value={form.name}
                onChange={updateField}
                placeholder="e.g. Enter plan name"
                className={nameError ? "input-error" : ""}
              />
            </label>

            <label className="plan-field">
              <span>
                Applicable Store Type <b>*</b>
              </span>
              <select
                name="applicableStoreType"
                value={form.applicableStoreType}
                onChange={updateField}
                onPointerDown={fetchStoreTypes}
                onKeyDown={(event) => {
                  if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
                    fetchStoreTypes();
                  }
                }}
                aria-busy={storeTypesLoading}
              >
                <option value="">
                  {storeTypesLoading
                    ? "Loading store types..."
                    : "Select a store type"}
                </option>
                {storeTypes.map((storeType) => (
                  <option
                    key={storeType.id ?? storeType._id ?? storeType.code}
                    value={
                      storeType.id ?? storeType._id ?? storeType.storeTypeId
                    }
                  >
                    {storeType.name ??
                      storeType.storeTypeName ??
                      storeType.code}
                  </option>
                ))}
              </select>
            </label>

            <label className="plan-field plan-description-field">
              <span>Description</span>
              <textarea
                name="description"
                value={form.description}
                onChange={updateField}
                maxLength={500}
                placeholder="Describe the plan, features & audience"
              />
              <div className="plan-description-meta">
                <small />
                <small>{form.description.length}/500</small>
              </div>
            </label>

            <label className="plan-field plan-information-status-field">
  <span>
    Status <b>*</b>
  </span>

  <select
  name="status"
  value={form.status}
  onChange={updateField}
  className={`plan-status-select ${
    form.status === "Active"
      ? "active"
      : form.status === "Inactive"
      ? "inactive"
      : ""
  }`}
>
  <option value="">Select Status</option>
  <option value="Active">Active</option>
  <option value="Inactive">Inactive</option>
</select>
</label>
          </div>

          <div className="plan-actions plan-information-actions">
            <button
              type="button"
              className="plan-cancel-button"
              onClick={resetCreationForm}
            >
              Cancel
            </button>
            <button
              type="button"
              className="plan-submit-button"
              disabled={!canContinueStepOne}
              onClick={() => setPlanStep(2)}
            >
              Save and Continue
            </button>
          </div>
        </section>
      )}

      {planStep === 2 && (
        <section className="plan-form-card">
          <div className="plan-card-heading">
            <div className="plan-heading-icon">
              <i className="bi bi-currency-rupee" />
            </div>
            <div>
              <h2>Pricing & Limits</h2>
              <p>Set pricing, included limits, and the trial period.</p>
            </div>
          </div>

          <div className="plan-pricing-grid three-columns">
            <label className="plan-field">
              <span>
                Pricing Basis <b>*</b>
              </span>
              <select
                autoComplete="off"
                name="billingModel"
                value={form.billingModel}
                onChange={updateField}
              >
                <option value="">Select billing model</option>
                <option value="Per store">Per Store</option>
                <option value="Per terminal">Per Terminal</option>
                <option value="Flat rate">Flat Rate</option>
                <option value="Custom">Custom</option>
              </select>
            </label>

            <label className="plan-field">
              <span>
                Currency <b>*</b>
              </span>
              <select
                autoComplete="off"
                name="currency"
                value={form.currency}
                onChange={updateField}
              >
                <option value="">Select currency</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="INR">Indian Rupee (INR)</option>
                <option value="AED">UAE Dirham (AED)</option>
              </select>
            </label>

            <label className="plan-field">
              <span>
                Billing Frequency <b>*</b>
              </span>
              <select
                autoComplete="off"
                name="billingCycle"
                value={form.billingCycle}
                onChange={updateField}
              >
                <option value="">Select Billing Frequency</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </label>
          </div>

          <div className="plan-pricing-grid three-columns">
            <label className="plan-field">
              <span>
                Base Subscription Price <b>*</b>
              </span>
              <div className="plan-price-input">
                <input
                  {...textInputProps}
                  name="basePrice"
                  type="number"
                  min="0"
                  value={form.basePrice}
                  onChange={updateField}
                  placeholder="0.00"
                />
                <span>{form.currency || "Currency"}</span>
              </div>
            </label>

            <label className="plan-field">
              <span>
                Stores Included <b>*</b>
              </span>
              <input
                {...textInputProps}
                name="includedStores"
                type="number"
                min="0"
                value={form.includedStores}
                onChange={updateField}
              />
            </label>

            <label className="plan-field">
              <span>
                POS Terminals Included <b>*</b>
              </span>
              <input
                {...textInputProps}
                name="includedTerminals"
                type="number"
                min="0"
                value={form.includedTerminals}
                onChange={updateField}
              />
            </label>
          </div>

          <div className="plan-pricing-grid three-columns">
            <label className="plan-field">
              <span>Price per Additional POS Terminal</span>
              <div className="plan-price-input">
                <input
                  {...textInputProps}
                  name="additionalTerminalPrice"
                  type="number"
                  min="0"
                  value={form.additionalTerminalPrice}
                  onChange={updateField}
                  placeholder="0.00"
                />
                <span>{form.currency || "Currency"}</span>
              </div>
            </label>

            <label className="plan-field">
              <span>Price per Additional Employee License</span>
              <div className="plan-price-input">
                <input
                  {...textInputProps}
                  name="additionalUserPrice"
                  type="number"
                  min="0"
                  value={form.additionalUserPrice}
                  onChange={updateField}
                  placeholder="0.00"
                />
                <span>{form.currency || "Currency"}</span>
              </div>
            </label>

            <label className="plan-field">
              <span>
                Employee Licenses Included <b>*</b>
              </span>
              <input
                {...textInputProps}
                name="includedUsers"
                type="number"
                min="0"
                value={form.includedUsers}
                onChange={updateField}
              />
            </label>
          </div>

          <div className="plan-pricing-grid three-columns">
            <label className="plan-field">
              <span>Trial Period</span>
              <select
                autoComplete="off"
                name="trialPeriod"
                value={form.trialPeriod}
                onChange={updateField}
              >
                <option value="">Select trial period</option>
                <option value="No trial">No Trial</option>
                <option value="7 days">7 Days</option>
                <option value="14 days">14 Days</option>
                <option value="30 days">30 Days</option>
              </select>
            </label>

            <label className="plan-field">
              <span>Effective Date</span>
              <input
                {...textInputProps}
                name="effectiveFrom"
                type="date"
                value={form.effectiveFrom}
                onChange={updateField}
              />
            </label>

            <div />
          </div>

          <div className="plan-actions">
            <button
              type="button"
              className="plan-cancel-button"
              onClick={() => setPlanStep(1)}
            >
              Back
            </button>

            <button
              type="button"
              className="plan-submit-button"
              disabled={!canContinuePricing}
              onClick={() => setPlanStep(3)}
            >
              Save and Continue
            </button>
          </div>
        </section>
      )}

      {planStep === 3 && (
        <section className="plan-form-card">
          <div className="plan-card-heading">
            <div className="plan-heading-icon">
              <i className="bi bi-boxes" />
            </div>
            <div>
              <h2>Included Features</h2>
              <p>Select the features included in this plan.</p>
            </div>
          </div>

          <div className="plan-features-limits-grid">
            <section className="plan-feature-panel">
              <h3>
                Available Features <b>*</b>
              </h3>

              {storeTypeFeaturesLoading && (
                <p className="plan-review-empty">
                  Loading features for the selected store type...
                </p>
              )}

              {storeTypeFeaturesError && (
                <p className="plan-field-error">{storeTypeFeaturesError}</p>
              )}

              {!storeTypeFeaturesLoading &&
                !storeTypeFeaturesError &&
                !form.applicableStoreType && (
                  <p className="plan-review-empty">
                    Select a store type to view its features.
                  </p>
                )}

              {!storeTypeFeaturesLoading &&
                !storeTypeFeaturesError &&
                form.applicableStoreType &&
                storeTypeFeatures.length === 0 && (
                  <p className="plan-review-empty">
                    No active features are available for the selected store type.
                  </p>
                )}

              {!storeTypeFeaturesLoading &&
                storeTypeFeatures.map(
                  ({ featureId, name, category, description, icon }) => (
                    <label className="plan-feature-check" key={featureId}>
                      <input
                        type="checkbox"
                        checked={includedFeatures.includes(featureId)}
                        onChange={() => toggleIncludedFeature(featureId)}
                      />

                      <span className="plan-feature-icon">
                        <i className={`bi ${icon}`} />
                      </span>

                      <span>
                        <strong>{name}</strong>
                        <small>
                          {category || description || "Store type feature"}
                        </small>
                      </span>
                    </label>
                  ),
                )}

              <div className="plan-feature-summary">
                <span className="plan-feature-summary-label">
                  Selected Features
                </span>
                <div className="plan-review-feature-list">
                  {includedFeatures.length > 0 ? (
                    includedFeatures.map((feature) => (
                      <span className="plan-review-feature-pill" key={feature}>
                        {getFeatureDisplayName(feature)}
                      </span>
                    ))
                  ) : (
                    <span className="plan-review-empty">
                      No features selected
                    </span>
                  )}
                </div>
              </div>
            </section>
          </div>

          <div className="plan-actions">
            <button
              type="button"
              className="plan-cancel-button"
              onClick={() => setPlanStep(2)}
            >
              Back
            </button>

            <button
              type="button"
              className="plan-submit-button"
              disabled={includedFeatures.length === 0}
              onClick={() => setPlanStep(4)}
            >
              Save and Continue
            </button>
          </div>
        </section>
      )}

      {planStep === 4 && (
        <section className="plan-form-card plan-review-card">
          <div className="plan-card-heading">
            <div className="plan-heading-icon">
              <i className="bi bi-check2-circle" />
            </div>

            <div>
              <h2>Review & Confirm</h2>
              <p>Review the plan details before saving.</p>
            </div>
          </div>

          <div className="plan-review-grid">
            <section className="plan-review-section">
              <h3>
                <i className="bi bi-file-earmark-text" />
                Plan Details
              </h3>

              <dl>
                <div>
                  <dt>Plan Code</dt>
                  <dd>{form.code || "Generated when saved"}</dd>
                </div>
                <div>
                  <dt>Plan Name</dt>
                  <dd>{form.name}</dd>
                </div>
                <div>
                  <dt>Description</dt>
                  <dd>{form.description}</dd>
                </div>
                <div>
                  <dt>Applicable Store Type</dt>
                  <dd>{form.applicableStoreType}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd className="plan-review-active">
                    <i className="bi bi-circle-fill" />
                    {form.status}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="plan-review-section">
              <h3>
                <i className="bi bi-currency-rupee" />
                Pricing
              </h3>

              <dl className="two-column-list">
                <div>
                  <dt>Billing Model</dt>
                  <dd>{form.billingModel}</dd>
                </div>
                <div>
                  <dt>Currency</dt>
                  <dd>{form.currency}</dd>
                </div>
                <div>
                  <dt>Billing Cycle</dt>
                  <dd>{form.billingCycle}</dd>
                </div>
                <div>
                  <dt>Base Subscription Price</dt>
                  <dd>
                    {form.currency} {form.basePrice}
                  </dd>
                </div>
                <div>
                  <dt>Stores Included</dt>
                  <dd>{form.includedStores}</dd>
                </div>
                <div>
                  <dt>POS Terminals Included</dt>
                  <dd>{form.includedTerminals}</dd>
                </div>
                <div>
                  <dt>Price per Additional POS Terminal</dt>
                  <dd>
                    {form.currency} {form.additionalTerminalPrice}
                  </dd>
                </div>
                <div>
                  <dt>Included Users</dt>
                  <dd>{form.includedUsers}</dd>
                </div>
                <div>
                  <dt>Price per Additional Employee License</dt>
                  <dd>
                    {form.currency} {form.additionalUserPrice}
                  </dd>
                </div>
                <div>
                  <dt>Trial Period</dt>
                  <dd>{form.trialPeriod}</dd>
                </div>
                <div>
                  <dt>Effective Date</dt>
                  <dd>{form.effectiveFrom}</dd>
                </div>
              </dl>
            </section>

            <section className="plan-review-section">
              <h3>
                <i className="bi bi-boxes" />
                Included Features
              </h3>

              <dl>
                <div>
                  <dt>Included Features</dt>
                  <dd className="plan-review-feature-container">
                    <div className="plan-review-feature-list">
                      {includedFeatures.length > 0 ? (
                        includedFeatures.map((feature) => (
                          <span
                            className="plan-review-feature-pill"
                            key={feature}
                          >
                            {getFeatureDisplayName(feature)}
                          </span>
                        ))
                      ) : (
                        <span className="plan-review-empty">None</span>
                      )}
                    </div>
                  </dd>
                </div>
              </dl>
            </section>

            <aside className="plan-review-note">
              <i className="bi bi-info-circle-fill" />
              Once saved, the plan will be available for assignment
               to merchants and stores.
            </aside>
          </div>

          <div className="plan-actions">
            <button
              type="button"
              className="plan-cancel-button"
              onClick={() => setPlanStep(3)}
            >
              Back
            </button>

            <button
              type="button"
              className="plan-submit-button"
              disabled={savingPlan}
              onClick={createOrUpdatePlan}
            >
              {savingPlan
                ? editingId
                  ? "Updating..."
                  : "Creating..."
                : editingId
                  ? "Save Changes"
                  : "Create Plan"}
            </button>
          </div>
        </section>
      )}

      {/* PLANS LIST CARD */}
      <section className="plans-list-card">
        <div className="plans-list-header">
          <div>
            <h2>Plans List</h2>
            {plansLoading && <small>Loading plans...</small>}
            {plansError && (
              <small className="plan-field-error">{plansError}</small>
            )}
          </div>

          <div className="plans-filters pch-master-toolbar pch-master-control">
            <label className="plan-search pch-master-search pch-master-control">
              <i className="bi bi-search" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search plans..."
              />
            </label>

            <FilterDropdown preserveToolbarLayout
              value={billingFilter}
              onChange={(event) => setBillingFilter(event.target.value)}
            >
              <option value="">All Billing Models</option>
              <option value="Per store">Per Store</option>
              <option value="Per terminal">Per Terminal</option>
              <option value="Flat rate">Flat Rate</option>
                <option value="Custom">Custom</option>
            </FilterDropdown>

            <FilterDropdown preserveToolbarLayout
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </FilterDropdown>

            <button
              type="button"
              className="plan-reset-button pch-master-reset pch-master-control"
              onClick={resetFilters}
            >
              <i className="bi bi-arrow-counterclockwise" />
            </button>
          </div>
        </div>

        <div
          className="plans-table-wrap"
          style={{ overflowX: "auto", width: "100%" }}
        >
          <div className="plans-table" style={{ minWidth: "1150px" }}>
            {/* HEADER ROW */}
            <div className="plans-row plans-row-head" style={planRowStyle}>
              <div>Plan Code</div>
              <div>Name</div>
              <div>Description</div>
              <div>Applicable Type</div>
              <div>Billing Model</div>
              <div>Price</div>
              <div>Status</div>
              <div>Created At</div>
              <div>Updated At</div>
              <div>Actions</div>
            </div>

            {/* DATA ROWS */}
            {/* DATA ROWS */}
            {paginatedPlans.map((plan) => {
              const planId = plan.id ?? plan._id;
              // FIXED ORDER: Check createdAt / updatedAt first
              const createdAt =
                plan.createdAt || plan.created_at || plan.createdOn;
              const updatedAt =
                plan.updatedAt || plan.updated_at || plan.updatedOn;
              return (
                <div
                  className="plans-row"
                  key={planId}
                  style={{ ...planRowStyle, cursor: "pointer" }}
                  onClick={() =>
                    navigate(`/plans/${planId}`, {
                      state: { plan },
                    })
                  }
                >
                  <div className="plan-code-cell">
                    <strong>{plan.code || "—"}</strong>
                  </div>

                  <div className="plan-name-cell">
                    <strong>{plan.name || "—"}</strong>
                  </div>

<div className="plan-description-cell">
  <span className="plan-description-text">
    {plan.description || "—"}
  </span>
</div>



                  <div>
                    <span className="plan-type-badge">
                      {storeTypeDisplayName(plan.storeType, storeTypes) || "—"}
                    </span>
                  </div>

                  <div>{plan.billingModel || "—"}</div>

                  <div className="plan-price-cell">
                    {plan.currency} {plan.price}
                    <small>/{plan.cycle ? plan.cycle.toLowerCase() : ""}</small>
                  </div>

                  <div>
                    <span
                      className={`plan-status ${
                        plan.status === "Inactive" ? "inactive" : ""
                      }`}
                    >
                      <i className="bi bi-circle-fill" />
                      {plan.status || "Active"}
                    </span>
                  </div>

                  {(() => {
                    const parts = formatDateParts(createdAt);
                    return (
                      <div className="plan-date-cell">
                        <strong>{parts.date}</strong>
                        {parts.time && <span>{parts.time}</span>}
                      </div>
                    );
                  })()}

                  {(() => {
                    const parts = formatDateParts(updatedAt);
                    return (
                      <div className="plan-date-cell">
                        <strong>{parts.date}</strong>
                        {parts.time && <span>{parts.time}</span>}
                      </div>
                    );
                  })()}

                  <div className="plan-table-actions">
                    <button
                      type="button"
                      title="Edit plan"
                      onClick={(e) => {
                        e.stopPropagation();
                        editPlan(plan);
                      }}
                    >
                      <i className="bi bi-pencil" />
                    </button>

                    <button
                      type="button"
                      className="plan-delete-icon"
                      title="Delete plan"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(plan);
                      }}
                    >
                      <i className="bi bi-trash3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PAGINATION UI (5 PER PAGE) */}
        <div className="plans-pagination">
  <Pagination
    currentPage={currentPage}
    totalPages={totalPages}
    totalItems={totalPlans}
    pageSize={itemsPerPage}
    onPageChange={setCurrentPage}
    onPageSizeChange={() => {}}
    itemLabel="plans"
  />
</div>
      </section>

      {deleteTarget && (
        <div
          className="delete-plan-overlay"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="delete-plan-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="delete-plan-icon">
              <i className="bi bi-trash3" />
            </div>

            <h2>Delete Plan?</h2>

            <p>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget.name}</strong>? This action cannot be
              undone.
            </p>

            <div className="delete-plan-actions">
              <button
                type="button"
                className="delete-plan-keep-button"
                onClick={() => setDeleteTarget(null)}
              >
                No, Keep It
              </button>

              <button
                type="button"
                className="delete-plan-confirm-button"
                disabled={deletingPlan}
                onClick={confirmDelete}
              >
                {deletingPlan ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="plan-toast">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
    </section>
  );
}
