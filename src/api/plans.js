import { listStoreTypes } from "./storeTypes";
import { listFeatures } from "./features";
import { api } from "./http";
import { endpoints } from "./endpoints";


const toApiBillingModel = (value) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (
    normalized === "PER STORE" ||
    normalized === "PER_STORE"
  ) {
    return "PER_STORE";
  }

  if (
    normalized === "PER TERMINAL" ||
    normalized === "PER_TERMINAL" || normalized === "PER_DEVICE" || normalized === "PER DEVICE"
  ) {
    return "PER_DEVICE";
  }

  if (
    normalized === "FLAT RATE" ||
    normalized === "FLAT"
  ) {
    return "FLAT";
  }

  return normalized;
};

/**
 * Convert billing cycle from UI format
 * to API format.
 */
const toApiBillingCycle = (value) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (normalized === "MONTHLY") {
    return "MONTHLY";
  }

  if (normalized === "QUARTERLY") {
    return "QUARTERLY";
  }

  if (
    normalized === "YEARLY" ||
    normalized === "ANNUAL"
  ) {
    return "ANNUAL";
  }

  return normalized;
};

/**
 * Convert status to API format.
 */
const toApiStatus = (value) => {
  const normalized = String(value || "ACTIVE")
    .trim()
    .toUpperCase();

  if (normalized === "INACTIVE") {
    return "INACTIVE";
  }

  return "ACTIVE";
};

/**
 * Convert value to number.
 */
const toNumberOrZero = (value) => {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
};


const toTrialDays = (value) => {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  const match = String(value || "").match(/\d+/);

  if (!match) {
    return 0;
  }

  return Number(match[0]);
};


const toEffectiveFrom = (value) => {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString();
};

/* ============================================================
 * PLAN REQUEST PAYLOAD
 * ============================================================ */


export function planPayload(
  form,
  includedFeatures = []
) {
  const selectedStoreType =
    form?.applicableStoreType ??
    form?.storeType ??
    "";

  const normalizedStoreType =
    typeof selectedStoreType === "string"
      ? selectedStoreType.trim()
      : selectedStoreType && typeof selectedStoreType === "object"
        ? (
          selectedStoreType.id ||
          selectedStoreType._id ||
          selectedStoreType.storeTypeId ||
          selectedStoreType.name ||
          selectedStoreType.storeTypeName ||
          selectedStoreType.code ||
          ""
        )
        : "";

  const payload = {
    name: String(form.name || "").trim(),
    description: String(form.description || "").trim(),
    billing_model: toApiBillingModel(form.billingModel),
    base_price: toNumberOrZero(form.basePrice),
    currency: String(form.currency || "USD").trim().toUpperCase(),
    billing_cycle: toApiBillingCycle(form.billingCycle),
    status: toApiStatus(form.status),
    store_type_id: normalizedStoreType || null,
    stores_limit: toNumberOrZero(form.includedStores),
    terminal_limit: toNumberOrZero(form.includedTerminals),
    additional_terminal_price: toNumberOrZero(form.additionalTerminalPrice),
    employees_limit: toNumberOrZero(form.includedUsers),
    additional_employee_price: toNumberOrZero(form.additionalUserPrice),
    trial_period: toTrialDays(form.trialPeriod),
    included_features: includedFeatures.map(feature => String(
      typeof feature === "object" ? feature.featureId ?? feature.id : feature
    )),
    effective_from: toEffectiveFrom(form.effectiveFrom) || null,
  };
  if (form.planEndDate !== undefined) {
    payload.plan_end_date = toEffectiveFrom(form.planEndDate) || null;
  }

  return payload;
}

/* ============================================================
 * API RESPONSE HELPERS
 * ============================================================ */

/**
 * Extract one plan from different
 * possible API response formats.
 */
const unwrapPlan = (response) => {
  if (response?.plan) {
    return response.plan;
  }

  if (response?.data?.plan) {
    return response.data.plan;
  }

  if (response?.data) {
    return response.data;
  }

  return response;
};

/**
 * Extract plan array from different
 * possible API response formats.
 */
const extractPlans = (response) => {
  if (!response) return [];

  // API returned an array directly.
  if (Array.isArray(response)) {
    return response;
  }

  // API returned planGroups (e.g. GET /plans/merchant-form or GET /connector/api/v1/plans/merchant-form)
  const planGroups =
    response?.planGroups ||
    response?.data?.planGroups ||
    response?.result?.planGroups;

  if (Array.isArray(planGroups)) {
    const list = [];
    planGroups.forEach((group) => {
      const groupStoreType =
        group.storeType || group.store_type || group.storeTypeId || "";
      const groupPlans = Array.isArray(group.plans)
        ? group.plans
        : Array.isArray(group.items)
        ? group.items
        : [];

      groupPlans.forEach((plan) => {
        list.push({
          ...plan,
          storeType: plan.storeType || plan.store_type || groupStoreType,
          storeTypeId:
            plan.storeTypeId ||
            plan.store_type_id ||
            group.storeTypeId ||
            (typeof groupStoreType === "object" ? groupStoreType?.id : groupStoreType) ||
            "",
        });
      });
    });

    if (list.length > 0) {
      return list;
    }
  }

  // API returned: { plans: [...] }
  if (Array.isArray(response?.plans)) {
    return response.plans;
  }

  // API returned: { data: [...] }
  if (Array.isArray(response?.data)) {
    return response.data;
  }

  // API returned: { data: { plans: [...] } }
  if (Array.isArray(response?.data?.plans)) {
    return response.data.plans;
  }

  // API returned one plan.
  if (response?.plan) {
    return [response.plan];
  }

  return [];
};


const displayBillingModel = (value) => {
  const normalized =
    String(value || "")
      .trim()
      .toUpperCase();

  if (
    normalized === "PER_STORE" ||
    normalized === "PER STORE"
  ) {
    return "Per store";
  }

  if (
    normalized === "PER_DEVICE" ||
    normalized === "PER_TERMINAL" ||
    normalized === "PER TERMINAL"
  ) {
    return "Per terminal";
  }

  if (
    normalized === "FLAT" ||
    normalized === "FLAT_RATE"
  ) {
    return "Flat rate";
  }

  if (normalized === "CUSTOM") return "Custom";
  return value || "";
};

/**
 * Convert API billing cycle
 * back to UI value.
 */
const displayBillingCycle = (value) => {
  const normalized =
    String(value || "")
      .trim()
      .toUpperCase();

  if (normalized === "MONTHLY") {
    return "Monthly";
  }

  if (normalized === "QUARTERLY") {
    return "Quarterly";
  }

  if (
    normalized === "YEARLY" ||
    normalized === "ANNUAL"
  ) {
    return "Yearly";
  }

  return value || "";
};

/**
 * Convert API status to UI status.
 */
const displayStatus = (value) => {
  const normalized =
    String(value || "")
      .trim()
      .toUpperCase();

  if (normalized === "INACTIVE") {
    return "Inactive";
  }

  return "Active";
};

/**
 * Convert trial period to UI format.
 */
const displayTrialPeriod = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  const number = Number(value);

  if (Number.isFinite(number)) {
    return `${number} days`;
  }

  return String(value);
};

/* ============================================================
 * NORMALIZE API PLAN
 * ============================================================ */

/**
 * Convert API plan data into the structure
 * already used by CreatePlan.jsx.
 *
 * This means the existing UI does not need
 * to be rewritten to understand API field names.
 */
export function normalizePlan(item) {
  if (!item) {
    return null;
  }

  /* ----------------------------------------------------------
   * Plan ID
   * ---------------------------------------------------------- */
  const id =
    item.id ||
    item._id ||
    item.planId;

  /* ----------------------------------------------------------
   * Plan code
   * ---------------------------------------------------------- */
  const code =
    item.plan_code ||
    item.planCode ||
    item.code ||
    "";

  /* ----------------------------------------------------------
   * Included features
   * ---------------------------------------------------------- */
  const rawFeatures =
    item.included_features ??
    item.includedFeatures ??
    item.features ??
    item.entitlements ??
    [];

  const includedFeatures = Array.isArray(rawFeatures)
    ? rawFeatures.map((entry, index) => {
      // Feature returned as a string
      if (typeof entry === "string") {
        return {
          id: `${entry}-${index}`,
          featureId: entry,
          name: entry,
          category: "",
        };
      }

      if (!entry || typeof entry !== "object") {
        return null;
      }

      // API may return:
      // { feature: { ... } }
      // or directly { ... }
      const feature =
        entry.feature && typeof entry.feature === "object"
          ? entry.feature
          : entry;
      return {
        ...entry,
        ...feature,

        id: String(
          feature.id ??
          feature._id ??
          entry.id ??
          entry._id ??
          index + 1,
        ),

        featureId: String(
          feature.featureId ??
          feature.feature_id ??
          entry.featureId ??
          entry.feature_id ??
          feature.featureID ??
          entry.featureID ??
          feature.id ??
          feature._id ??
          entry.id ??
          entry._id ??
          "",
        ),

        name:
          feature.name ??
          feature.featureName ??
          feature.feature_name ??
          feature.featureKey ??
          feature.feature_key ??
          feature.code ??
          "",

        category:
          feature.category ??
          feature.categoryName ??
          feature.category_name ??
          feature.featureCategory ??
          feature.feature_category ??
          feature.feature_type ??
          feature.featureType ??
          "",
      };
    }).filter(Boolean)
    : [];


  /* ----------------------------------------------------------
   * Created date
   * ---------------------------------------------------------- */
  const createdAt =
    item.createdAt ||
    item.created_at ||
    item.createdOn;

  const updatedAt =
    item.updatedAt ||
    item.updated_at ||
    item.updatedOn;

  /* ----------------------------------------------------------
   * Return normalized plan
   * ---------------------------------------------------------- */
  return {
    /**
     * Keep original API properties.
     */
    ...item,

    /**
     * Existing CreatePlan UI properties.
     */
    id,

    code,

    name:
      item.name || "",

    description:
      item.description || "",

    /* Store type */
    storeType:
      item.store_type_id ||
      item.store_type ||
      item.storeType ||
      item.applicableStoreType ||
      "",

    applicableStoreType:
      item.store_type_id ||
      item.store_type ||
      item.storeType ||
      item.applicableStoreType ||
      "",

    /* Billing model */
    billingModel:
      displayBillingModel(
        item.billingModel ||
        item.billing_model
      ),

    /* Currency */
    currency:
      item.currency || "",

    /* Price */
    price:
      item.basePrice ??
      item.base_price ??
      item.price ??
      0,

    basePrice:
      item.basePrice ??
      item.base_price ??
      item.price ??
      0,

    /* Billing cycle */
    cycle:
      displayBillingCycle(
        item.billingCycle ||
        item.billing_cycle ||
        item.cycle
      ),

    billingCycle:
      displayBillingCycle(
        item.billingCycle ||
        item.billing_cycle ||
        item.cycle
      ),

    /* Status */
    status:
      displayStatus(
        item.status
      ),

    /* Included stores */
    includedStores:
      item.includedStores ??
      item.included_stores ??
      item.stores_limit ??
      0,

    /* Included terminals */
    includedTerminals:
      item.includedTerminals ??
      item.included_terminals ??
      item.terminal_limit ??
      0,

    /* Additional terminal price */
    additionalTerminalPrice:
      item.additional_terminal_price ??
      item.additionalTerminalPrice ??
      0,

    /* Included employees/users */
    includedEmployees:
      item.includedEmployees ??
      item.included_employees ??
      item.employees_limit ??
      item.includedUsers ??
      0,

    includedUsers:
      item.includedEmployees ??
      item.included_employees ??
      item.employees_limit ??
      item.includedUsers ??
      0,

    /* Additional employee price */
    additionalUserPrice:
      item.additionalEmployeePrice ??
      item.additional_employee_price ??
      item.additionalUserPrice ??
      0,

    /* Trial period */
    trialPeriod:
      displayTrialPeriod(
        item.trial_period ??
        item.trialPeriod
      ),

    /* Effective date */
    effectiveFrom:
      item.effective_from ||
      item.effectiveFrom ||
      "",

    planEndDate: item.plan_end_date ?? item.planEndDate ?? "",

    /* Features */
    includedFeatures,

    /* Dates */
    createdOn: createdAt
      ? new Date(
        createdAt
      ).toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "2-digit",
          year: "numeric",
        }
      )
      : "—",

    updatedOn: updatedAt
      ? new Date(
        updatedAt
      ).toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "2-digit",
          year: "numeric",
        }
      )
      : "—",
  };
}

/* ============================================================
 * GET ALL PLANS
 * ============================================================ */

/**
 * GET /plans
 */
export async function getMerchantFormPlans() {
  let response = null;
  try {
    response = await api.get(endpoints.plansMerchantForm || "/plans/merchant-form");
  } catch {
    try {
      response = await api.get("/connector/api/v1/plans/merchant-form");
    } catch {
      response = await api.get(endpoints.plans);
    }
  }

  const plans = extractPlans(response);
  return plans.map(normalizePlan).filter(Boolean);
}

/**
 * GET /plans
 */
export async function listPlans() {
  const response = await api.get(endpoints.plans);
  return extractPlans(response).map(normalizePlan).filter(Boolean);
}

/* ============================================================
 * GET SINGLE PLAN
 * ============================================================ */

/**
 * GET /plans/:id
 */
const pendingPlanRequests = new Map();
export function getPlan(id) {
  if (!pendingPlanRequests.has(id)) {
    pendingPlanRequests.set(id, loadPlan(id).finally(() => pendingPlanRequests.delete(id)));
  }
  return pendingPlanRequests.get(id);
}

async function loadPlan(id) {
  const response =
    await api.get(
      endpoints.plan(id)
    );

  const plan = normalizePlan(unwrapPlan(response));
  if (!plan) return plan;
  const raw = unwrapPlan(response);
  const storeType = raw.storeType || raw.store_type;
  const storeTypeName = raw.storeTypeName || raw.store_type_name ||
    (typeof storeType === "object" ? storeType?.name : "");
  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));
  plan.storeTypeName = storeTypeName || plan.storeType;
  const needsStoreType = !storeTypeName && isUuid(plan.storeType);
  const needsFeatures = plan.includedFeatures.some(entry => !entry.name || isUuid(entry.name) || !entry.category);
  const [types, features] = await Promise.allSettled([
    needsStoreType ? listStoreTypes() : Promise.resolve([]),
    needsFeatures ? listFeatures() : Promise.resolve([]),
  ]);
  if (needsStoreType && types.status === "fulfilled") {
    plan.storeTypeName = types.value.find(type => String(type.id) === String(plan.storeType))?.name || plan.storeType;
  }
  if (needsFeatures && features.status === "fulfilled") {
    plan.includedFeatures = plan.includedFeatures.map(entry => {
            const same = (a, b) => Boolean(a && b) && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
      const feature = features.value.find(feature => same(feature.id, entry.featureId)) ||
        features.value.find(feature => same(feature.name, entry.name) || same(feature.code, entry.featureId));
      return feature ? { ...entry, name: feature.name || entry.name, category: entry.category || feature.category } : entry;
    });
  }
  return plan;
}

/* ============================================================
 * CREATE PLAN
 * ============================================================ */

/**
 * POST /plans
 */
export async function createPlan(
  form,
  includedFeatures = []
) {
  const payload =
    planPayload(
      form,
      includedFeatures
    );

  const response =
    await api.post(
      endpoints.plans,
      payload
    );

  return normalizePlan(
    unwrapPlan(response)
  );
}

/* ============================================================
 * UPDATE PLAN
 * ============================================================ */

/**
 * PUT /plans/:id
 */
export async function updatePlan(
  id,
  form,
  includedFeatures = []
) {
  const payload =
    planPayload(
      form,
      includedFeatures
    );

  const response =
    await api.put(
      endpoints.plan(id),
      payload
    );

  return normalizePlan(
    unwrapPlan(response)
  );
}

/* ============================================================
 * UPDATE PLAN STATUS
 * ============================================================ */

/**
 * PATCH /plans/:id/status
 */
export async function updatePlanStatus(
  id,
  status
) {
  return api.patch(
    endpoints.planStatus(id),
    {
      status: toApiStatus(
        status
      ),
    }
  );
}

/* ============================================================
 * DELETE PLAN
 * ============================================================ */

/**
 * DELETE /plans/:id
 */
export async function deletePlan(id) {
  return api.delete(
    endpoints.plan(id)
  );
}
