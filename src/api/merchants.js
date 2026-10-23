import { api, pendingStoreRead } from "./http";
import { endpoints } from "./endpoints";
function isUuid(val) {
  return (
    typeof val === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      val.trim(),
    )
  );
}

const DEFAULT_STORE_TYPE_ID = "a1b2c3d4-e5f6-4a1b-8c2d-000000000001";
const DEFAULT_PLAN_ID = "2a8ac621-fd00-4b7f-aa88-6e03124b22ee";
const DEFAULT_ROLE_IDS = [
  "17c14d03-b860-48be-bb11-0511cae5e387",
  "87b6c52d-0b73-490a-b7d2-ec658a88084d",
];

const COUNTRY_CODE_MAP = {
  "united states": "USA",
  usa: "USA",
  us: "USA",
  india: "IND",
  ind: "IND",
  in: "IND",
  canada: "CAN",
  can: "CAN",
  "united kingdom": "GBR",
  uk: "GBR",
  gbr: "GBR",
  australia: "AUS",
  aus: "AUS",
};

function normalizeCountryCode(value) {
  if (!value) return "USA";
  const str = String(value).trim().toLowerCase();
  return (
    COUNTRY_CODE_MAP[str] || (str.length === 3 ? str.toUpperCase() : "USA")
  );
}

function normalizePhoneNumber(phone, country) {
  let raw = String(phone || "").trim();
  if (!raw) return "+15552345678";
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  const countryCode = normalizeCountryCode(country);
  let dialCode = "+1";
  if (countryCode === "IND") dialCode = "+91";
  else if (countryCode === "GBR") dialCode = "+44";
  else if (countryCode === "AUS") dialCode = "+61";
  else if (countryCode === "CAN") dialCode = "+1";
  return `${dialCode}${digits}`;
}

function computeRenewalDate(startDateStr, billingCycleStr) {
  if (!startDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
    startDateStr = new Date().toISOString().slice(0, 10);
  }
  const date = new Date(`${startDateStr}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setMonth(fallback.getMonth() + 1);
    return fallback.toISOString().slice(0, 10);
  }
  const day = date.getUTCDate();
  date.setUTCDate(1);
  const cycle = String(billingCycleStr || "").toUpperCase();
  const months =
    cycle.includes("ANNUAL") || cycle.includes("YEAR")
      ? 12
      : cycle.includes("QUARTER")
        ? 3
        : 1;
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}

export function toNestedMerchantPayload(data) {
  if (!data) return {};
  const m = data.merchant || data;
  const s = data.subscription || data;
  const primaryStore = (Array.isArray(data.stores) && data.stores[0]) || {};

  const businessName =
    m.business ||
    m.businessName ||
    m.legalBusinessName ||
    data.businessName ||
    "Business";
  const businessDisplayName =
    m.display || m.businessDisplayName || m.businessName || businessName;
  const merchantName =
    m.name ||
    m.merchantName ||
    m.ownerName ||
    [m.firstName, m.lastName].filter(Boolean).join(" ") ||
    businessDisplayName;
  const merchantEmail = m.email || m.merchantEmail || data.email || "";
  const merchantPhoneNumber =
    m.phone || m.merchantPhoneNumber || data.phone || "";
  const addressLine1 =
    m.addressLine1 ||
    data.addressLine1 ||
    data.businessAddress ||
    primaryStore.address ||
    "100 Main St";
  const addressLine2 = m.addressLine2 || data.addressLine2 || "";
  const city = m.city || data.city || primaryStore.city || "City";
  const state = m.state || data.state || primaryStore.state || "State";
  const pinCode =
    m.postal ||
    m.pinCode ||
    m.postalCode ||
    data.postalCode ||
    primaryStore.zip ||
    "85001";
  const country = m.country || data.country || "United States";

  let storeTypeId = m.storeTypeId || data.storeTypeId || m.type;
  if (!isUuid(storeTypeId)) storeTypeId = DEFAULT_STORE_TYPE_ID;

  let planId =
    s.planId ||
    data.planId ||
    data.planDetails?.id ||
    data.planDetails?.planId ||
    data.planDetails?._id;
  if (!isUuid(planId)) planId = DEFAULT_PLAN_ID;

  const billingCycle = String(
    s.billingCycle || s.billing_cycle || data.cycle || data.billingCycle || data.billing_cycle || m.billingCycle || m.billing_cycle || "MONTHLY",
  ).toUpperCase();
  const startDate =
    s.startDate ||
    s.start ||
    data.start ||
    data.startDate ||
    new Date().toISOString().slice(0, 10);
  const renewalDate =
    s.renewalDate ||
    data.renewalDate ||
    computeRenewalDate(startDate, billingCycle);

  const rawRoleIds =
    Array.isArray(data.roleIds) && data.roleIds.length > 0
      ? data.roleIds
      : Array.isArray(m.roleIds) && m.roleIds.length > 0
        ? m.roleIds
        : Array.isArray(data.roles)
          ? data.roles
              .map((r) => r.id || r.roleTemplateId || r._id || r.roleId)
              .filter(Boolean)
          : [];

  let roleIds = rawRoleIds.filter(isUuid);
  if (!roleIds.length) roleIds = DEFAULT_ROLE_IDS;

  return {
    merchant: {
      ein: m.ein || m.EIN || "",
      firstName: m.firstName || m.first_name || "",
      lastName: m.lastName || m.last_name || "",
      business: businessName,
      display: businessDisplayName,
      name: merchantName,
      email: merchantEmail,
      phone: merchantPhoneNumber,
      country,
      city,
      state,
      addressLine1,
      addressLine2,
      postal: pinCode,
      storeTypeId,
    },
    subscription: {
      planId,
      billingCycle,
      startDate,
      renewalDate,
    },
    stores: (data.stores || []).map((store) => ({
      name: store.name,
      id: store.id,
      type: store.type,
      phone: store.phone || "",
      url: store.url,
      currency: store.currency,
      status: store.status,
      address: store.address,
      timezone: store.timezone,
      city: store.city,
      state: store.state,
      zip: store.zip,
    })),
    roleIds,
  };
}

export function toFlatMerchantPayload(data) {
  if (!data) return {};
  const m = data.merchant || data;
  const s = data.subscription || data;
  const planDetails = data.planDetails || {};
  const primaryStore = (Array.isArray(data.stores) && data.stores[0]) || {};

  const businessName =
    m.business ||
    m.businessName ||
    m.legalBusinessName ||
    data.businessName ||
    "";
  const businessDisplayName =
    m.display || m.businessDisplayName || m.businessName || businessName;
  const merchantName =
    m.name ||
    m.merchantName ||
    m.ownerName ||
    [m.firstName, m.lastName].filter(Boolean).join(" ") ||
    businessDisplayName;
  const merchantEmail = m.email || m.merchantEmail || data.email || "";

  let rawPhone = m.phone || m.merchantPhoneNumber || data.phone || "";
  let rawCountry = m.country || data.country || "USA";

  const country = normalizeCountryCode(rawCountry);
  const merchantPhoneNumber = normalizePhoneNumber(rawPhone, rawCountry);

  const addressLine1 =
    m.addressLine1 ||
    m.address_line1 ||
    m.address_line_1 ||
    data.addressLine1 ||
    primaryStore.addressLine1 ||
    primaryStore.address ||
    "";
  const addressLine2 =
    m.addressLine2 ||
    m.address_line2 ||
    m.address_line_2 ||
    data.addressLine2 ||
    primaryStore.addressLine2 ||
    "";
  const city = m.city || data.city || primaryStore.city || "";
  const state = m.state || data.state || primaryStore.state || "";
  const pinCode =
    m.postal ||
    m.postalCode ||
    m.postal_code ||
    m.pinCode ||
    m.pin_code ||
    data.postalCode ||
    primaryStore.postal ||
    primaryStore.zip ||
    "";

  let planId =
    s.planId ||
    data.planId ||
    planDetails.id ||
    planDetails.planId ||
    planDetails._id;
  if (!isUuid(planId)) planId = DEFAULT_PLAN_ID;

  const rawCycle = String(
    s.billingCycle || s.billing_cycle || data.cycle || data.billingCycle || data.billing_cycle || m.billingCycle || m.billing_cycle || "MONTHLY",
  ).toUpperCase();
  const billingCycle =
    rawCycle.includes("ANNUAL") || rawCycle.includes("YEAR")
      ? "ANNUAL"
      : rawCycle.includes("QUARTER")
        ? "QUARTERLY"
        : "MONTHLY";

  const startDate =
    s.startDate ||
    s.start ||
    data.start ||
    data.startDate ||
    new Date().toISOString().slice(0, 10);
  const renewalDate =
    s.renewalDate ||
    data.renewalDate ||
    computeRenewalDate(startDate, billingCycle);

  const rawPrice =
    s.agreementPrice !== undefined
      ? Number(s.agreementPrice)
      : data.agreementPrice !== undefined
        ? Number(data.agreementPrice)
        : (planDetails.price ?? 99);
  const agreementPrice = Number(rawPrice) || 99;

  const tax =
    s.tax !== undefined
      ? Number(s.tax)
      : data.tax !== undefined
        ? Number(data.tax)
        : Math.round(agreementPrice * 0.0825 * 100) / 100;
  const totalDueToday =
    s.totalDueToday !== undefined
      ? Number(s.totalDueToday)
      : data.totalDueToday !== undefined
        ? Number(data.totalDueToday)
        : Math.round((agreementPrice + tax) * 100) / 100;

  const paymentMethod = String(
    data.paymentMethod || data.paymentPreview || m.paymentMethod || "CARD",
  )
    .toUpperCase()
    .includes("ACH")
    ? "ACH"
    : "CARD";

  return {
    ein: m.ein || m.EIN || "",
      firstName: m.firstName || "",
      lastName: m.lastName || "",
    merchantName,
    merchantEmail,
    merchantPhoneNumber,
    businessName,
    businessDisplayName,
    addressLine1,
    addressLine2,
    city,
    state,
    pinCode,
    country,
    planId,
    billingCycle,
    startDate,
    renewalDate,
    agreementPrice,
    tax,
    totalDueToday,
    paymentMethod,
  };
}

export function toMerchantPayload(data) {
  return toFlatMerchantPayload(data);
}

export async function listMerchants() {
  const data = await api.get(endpoints.merchants);
  const items = findMerchantList(data);

  return items.map(mapMerchantToRow).filter(Boolean);
}

function findMerchantList(data) {
  if (Array.isArray(data)) return data;
  for (const key of ["merchants", "items", "results", "data"]) {
    const value = data?.[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const nested = findMerchantList(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

function titleCase(value) {
  if (!value) return "—";
  return String(value)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toInitials(name) {
  return (
    String(name || "M")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "M"
  );
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const minutes = Math.max(
    0,
    Math.round((Date.now() - date.getTime()) / 60000),
  );
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(value);
}

function merchantApiId(merchant) {
  const values = [merchant?.id, merchant?.merchantId, merchant?._id].filter(
    Boolean,
  );
  return (
    values.find((value) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        String(value),
      ),
    ) ||
    values[0] ||
    ""
  );
}

export function mapMerchantToRow(item) {
  if (!item) return null;
  const merchant = item.merchant || item.data?.merchant || item.data || item;
  const subscription = item.subscription || merchant.subscription || {};
  const plan = item.plan || merchant.plan || subscription.plan || {};

  const name =
    merchant.businessDisplayName ||
    merchant.business_display_name ||
    merchant.businessName ||
    merchant.business_name ||
    merchant.legalBusinessName ||
    merchant.merchantName ||
    merchant.ownerName ||
    [merchant.firstName || merchant.first_name, merchant.lastName || merchant.last_name].filter(Boolean).join(" ") ||
    merchant.name ||
    "Merchant";

    const uuid = [
    item.uuid,
    item.id,
    item.data?.uuid,
    item.data?.id,
    item.data?.merchantUuid,
    item.data?.merchant_uuid,
    item.merchantUuid,
    item.merchant_uuid,
    item.merchant?.uuid,
    item.merchant?.id,
    item.merchant?.merchantUuid,
    item.merchant?.merchant_uuid,
    merchant.uuid,
    merchant.id,
    merchant.merchantUuid,
    merchant.merchant_uuid,
    merchant._id,
  ].find((value) =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  ) || "";
  const id = uuid || merchant.id || merchant.merchantId || merchant.merchant_id || merchant.merchantCode || merchant.merchant_code || "";
  const email = merchant.merchantEmail || merchant.email || "";
  const phone = merchant.merchantPhoneNumber || merchant.phone || "";
  const stores = Array.isArray(merchant.stores || item.stores)
    ? (merchant.stores || item.stores).length
    : (item.storeCount ??
      item.store_count ??
      subscription.storeCount ??
      subscription.store_count ??
      merchant.storeCount ??
      merchant.store_count ??
      merchant.storesCount ??
      0);

  const planName =
    subscription.planName ||
    subscription.plan_name ||
    plan.name ||
    plan.planName ||
    subscription.planCode ||
    subscription.plan_code ||
    plan.code ||
    plan.plan_code ||
    merchant.plan ||
    merchant.subscriptionPlan ||
    "—";

  const renewal =
    subscription.renewalDate ||
    subscription.renewal_date ||
    subscription.renewalDate ||
    merchant.renewal ||
    merchant.renewsOn ||
    "";

  const status =
    merchant.initialStatus ||
    merchant.status ||
    merchant.onboardingStatus ||
    "ACTIVE";

  const createdAt =
    merchant.createdAt || merchant.created_at || merchant.createdDate ||
    merchant.created_date || merchant.joined || "";
  const updatedAt =
    merchant.updatedAt || merchant.updated_at || merchant.updatedDate ||
    merchant.updated_date || createdAt;

  const address = merchant.businessAddress || merchant.address || {};
  const firstName = merchant.firstName || merchant.first_name || "";
  const lastName = merchant.lastName || merchant.last_name || "";
  const addressLine1 =
    merchant.addressLine1 ||
    merchant.address_line1 ||
    merchant.address_line_1 ||
    (typeof address === "string" ? address : address.addressLine1 || address.address_line1 || address.address_line_1 || address.street || "") ||
    "";
  const addressLine2 =
    merchant.addressLine2 ||
    merchant.address_line2 ||
    merchant.address_line_2 ||
    (typeof address === "object" ? address.addressLine2 || address.address_line2 || address.address_line_2 || address.unit || "" : "") ||
    "";
  const postal =
    merchant.postal ||
    merchant.postalCode ||
    merchant.postal_code ||
    merchant.pinCode ||
    merchant.pin_code ||
    (typeof address === "object" ? address.zipCode || address.postalCode || address.postal_code || address.pinCode || "" : "") ||
    "";

  return {
    id,
    uuid,
    merchantId: merchant.merchantId || merchant.merchant_id || merchant.merchantCode || merchant.merchant_code || id,
    name,
    email,
    phone,
    stores,
    plan: planName,
    renewal: renewal ? formatDate(renewal) : "—",
    status: titleCase(status),
    joined: formatDate(createdAt),
    active: formatRelative(updatedAt),
    initials: toInitials(name),
    createdAt,
    updatedAt,
    country: merchant.country || (typeof address === "object" ? address.country : "") || "",
    state: merchant.state || (typeof address === "object" ? address.state || address.province : "") || "",
    city: merchant.city || (typeof address === "object" ? address.city : "") || "",
    firstName,
    lastName,
    addressLine1,
    addressLine2,
    postal,
    postalCode: postal,
    pinCode: postal,
    business: merchant.legalBusinessName || merchant.businessName || merchant.business_name || name,
    display: merchant.businessDisplayName || merchant.business_display_name || merchant.businessName || name,
    ein: merchant.ein || merchant.EIN || merchant.taxId || merchant.tax_id || "",
    _raw: item,
  };
}

export async function getMerchant(id) {
  const data = await pendingStoreRead(`merchant-detail:${id}`, () => api.get(endpoints.merchant(id)));
  const merchant = data?.merchant || data?.data?.merchant || data?.data || data;
  const stores = Array.isArray(data?.stores)
    ? data.stores
    : Array.isArray(merchant?.stores)
      ? merchant.stores
      : [];
  const subscription = data?.subscription || merchant?.subscription || null;
  const mapped = mapMerchantToRow(merchant) || {};

  return {
    merchant: {
      ...mapped,
      plan:
        subscription?.planName ||
        subscription?.planCode ||
        mapped.plan,
      phone: merchant?.merchantPhoneNumber || merchant?.phone || mapped.phone || "",
      city: merchant?.city || mapped.city || "",
      state: merchant?.state || mapped.state || "",
      country: merchant?.country || mapped.country || "",
      firstName: merchant?.firstName || merchant?.first_name || mapped.firstName || "",
      lastName: merchant?.lastName || merchant?.last_name || mapped.lastName || "",
      addressLine1: merchant?.addressLine1 || merchant?.address_line1 || merchant?.address_line_1 || mapped.addressLine1 || "",
      addressLine2: merchant?.addressLine2 || merchant?.address_line2 || merchant?.address_line_2 || mapped.addressLine2 || "",
      postalCode: merchant?.postalCode || merchant?.postal_code || merchant?.pinCode || merchant?.pin_code || mapped.postal || "",
      postal: merchant?.postal || merchant?.postalCode || merchant?.postal_code || merchant?.pinCode || merchant?.pin_code || mapped.postal || "",
      pinCode: merchant?.pinCode || merchant?.pin_code || merchant?.postalCode || merchant?.postal_code || mapped.postal || "",
    },
    stores: stores.map(mapStoreToRow),
    subscription,
    raw: data,
  };
}

function mapStoreToRow(store) {
  const address = store.address || {};
  const storeCode = store.storeCode || store.store_code || store.code ||
    ([store.storeId, store.storeID].find(value => value && !isUuid(String(value))) || "");
  const location = [
    address.street || store.address,
    address.city || store.city,
    address.state || store.state,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    id: store.id || store.storeCode || store.storeId,
    storeCode,
    name: store.storeName || store.name || "Store",
    type: titleCase(store.storeType || store.type),
    location: location || "—",
    status: titleCase(store.status || store.operationalStatus),
    currency: store.currency || "",
    timezone: store.timezone || "",
    url: store.baseUrl || store.url || store.storeUrl || "",
    merchantId: store.merchantId || "",
  };
}

export async function createMerchant(data) {
  const flatPayload = toFlatMerchantPayload(data);
  console.log("[CREATE MERCHANT PAYLOAD]", flatPayload);
  const result = await api.post(endpoints.merchants, flatPayload);

  if (result && result.success === false) {
    throw new Error(result.message || "Unable to create merchant.");
  }

  console.log("[CREATE MERCHANT API RESPONSE]", result);
  return result;
}

export async function updateMerchant(id, data) {
  const flatPayload = toFlatMerchantPayload(data);
  const result = await api.put(endpoints.merchant(id), flatPayload);

  if (result && result.success === false) {
    throw new Error(result.message || "Unable to update merchant.");
  }

  console.log("[UPDATE MERCHANT API RESPONSE]", result);
  return result;
}

export async function deleteMerchant(id) {
  const result = await api.delete(endpoints.merchant(id));

  if (result && result.success === false) {
    throw new Error(result.message || "Unable to delete merchant.");
  }

  console.log("[DELETE MERCHANT API RESPONSE]", result);
  return result;
}

export async function updateMerchantStatus(id, status) {
  const normalizedStatus = String(status || "").trim().toUpperCase();
  if (!["ACTIVE", "INACTIVE"].includes(normalizedStatus)) {
    throw new Error("Merchant status must be ACTIVE or INACTIVE.");
  }
  const result = await api.patch(`${endpoints.merchant(id)}/status`, {
    status: normalizedStatus,
  });
  if (result && result.success === false) {
    throw new Error(result.message || "Unable to update merchant status.");
  }
  return result;
}

export async function getMerchantForm(id) {
  const { raw } = await getMerchant(id);
  const merchant = raw.merchant || raw;
  const subscription = raw.subscription;
  return {
    ...merchant,
    merchantId: merchant.merchantId || merchant.id,
    businessType: titleCase(merchant.businessType || "Retail"),
    retailType: titleCase(merchant.retailSubCategory || "Grocery"),
    firstName:
      merchant.firstName ||
      merchant.ownerName?.split(" ")[0] ||
      merchant.merchantName?.split(" ")[0] ||
      "",
    lastName:
      merchant.lastName ||
      merchant.ownerName?.split(" ").slice(1).join(" ") ||
      merchant.merchantName?.split(" ").slice(1).join(" ") ||
      "",
    plan: subscription?.planCode || subscription?.plan_id || "",
    billingCycle:
      subscription?.billingCycle ||
      subscription?.billing_cycle ||
      raw.billingCycle ||
      raw.billing_cycle ||
      raw.cycle ||
      merchant.billingCycle ||
      merchant.billing_cycle ||
      "MONTHLY",
    trialPeriod: String(subscription?.trialDays ?? 0),
    stores: (raw.stores || []).map((store) => ({
      persisted: true,
      id: store.id,
      name: store.storeName,
      type: titleCase(store.storeType),
      phone: store.phone || "",
      url: store.baseUrl || "",
      currency: store.currency,
      status: titleCase(store.status),
      timezone: store.timezone,
      address: store.address?.street || "",
      city: store.address?.city || "",
      state: store.address?.state || "",
      zip: store.address?.zipCode || "",
    })),
  };
}
