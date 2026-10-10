import { buildStoreSetupPayload } from "../api/storeDetails";
import { useLocationOptions } from "../data/useLocationOptions";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  listMerchantEmployees,
  listStoreEmployees,
  listStoreRolePermissions,
  saveStoreEmployees,
} from "../api/employees";
import { getMerchant, listMerchants } from "../api/merchants";
import { listFeatures } from "../api/features";
import { listPlans } from "../api/plans";
import { storeTypesApi } from "../api/storeTypes";
import {
  merchantRoleTemplatesApi,
  readAvailableRoleTemplates,
} from "../api/merchantRoleTemplatesApi";
import {
  readRoleTemplatesList,
  roleTemplatesApi,
} from "../api/roleTemplatesApi";
import {
  storeRoleTemplatesApi,
  readStoreRoleTemplates,
} from "../api/storeRoleTemplatesApi";
import { api, ApiError } from "../api/http";
import { endpoints } from "../api/endpoints";
import {
  getActiveSubscriptions,
  extractActiveSubscription,
} from "../api/subscriptions_stores";
import "../styles/add-store.css";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const COUNTRIES = {
  India: { currency: "INR", zones: ["Asia/Kolkata"] },
  "United States": {
    currency: "USD",
    zones: [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Phoenix",
      "America/Los_Angeles",
    ],
  },
  Canada: {
    currency: "CAD",
    zones: [
      "America/Toronto",
      "America/Vancouver",
      "America/Edmonton",
      "America/Winnipeg",
    ],
  },
  "United Kingdom": { currency: "GBP", zones: ["Europe/London"] },
  Australia: {
    currency: "AUD",
    zones: [
      "Australia/Sydney",
      "Australia/Melbourne",
      "Australia/Brisbane",
      "Australia/Perth",
    ],
  },
};
const PHONE_RULES = {
  India: { callingCode: "91", minDigits: 10, maxDigits: 10, trunkPrefix: "0" },
  "United States": { callingCode: "1", minDigits: 10, maxDigits: 10 },
  Canada: { callingCode: "1", minDigits: 10, maxDigits: 10 },
  "United Kingdom": { callingCode: "44", minDigits: 7, maxDigits: 10, trunkPrefix: "0" },
  Australia: { callingCode: "61", minDigits: 9, maxDigits: 9, trunkPrefix: "0" },
};
function validatePhoneForCountry(value, country) {
  const phone = String(value || "").trim();
  if (!phone) return "";
  const rule = PHONE_RULES[country];
  if (!/^\+?[\d\s().-]+$/.test(phone))
    return `Enter a valid ${country || "country"} phone number.`;

  // Countries without a local rule still accept internationally formatted numbers.
  if (!rule) {
    const digits = phone.replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15
      ? ""
      : `Enter a valid ${country || "country"} phone number.`;
  }

  const hasInternationalPrefix = phone.startsWith("+") || phone.startsWith("00");
  let digits = phone.replace(/\D/g, "");
  if (phone.startsWith("00")) digits = digits.slice(2);
  if (hasInternationalPrefix) {
    if (!digits.startsWith(rule.callingCode))
      return `The phone number country code does not match ${country}.`;
    digits = digits.slice(rule.callingCode.length);
  } else if (digits.length > rule.maxDigits && digits.startsWith(rule.callingCode)) {
    digits = digits.slice(rule.callingCode.length);
  }

  if (rule.trunkPrefix && digits.length > rule.maxDigits && digits.startsWith(rule.trunkPrefix))
    digits = digits.slice(rule.trunkPrefix.length);
  if (digits.length < rule.minDigits || digits.length > rule.maxDigits)
    return `Enter a valid ${country} phone number.`;
  return "";
}
const STEPS = [
  "Store Details",
  "Subscription",
  "Features",
  "Roles & Permissions",
  "Employees",
  "Review & Provision",
];
const STEP_HINTS = [
  "Enter basic information",
  "Review merchant subscription",
  "Enable or disable features",
  "Configure store level access",
  "Assign employees to this store",
  "Review and create store",
];
const STANDARD_ACTIONS = ["View", "Create", "Edit", "Delete"];
const listFrom = (value) => {
  if (Array.isArray(value)) return value;
  const containers = [
    value,
    value?.all,
    value?.data,
    value?.data?.all,
    value?.result,
    value?.result?.all,
  ];
  for (const container of containers) {
    if (Array.isArray(container)) return container;
    const rows =
      container?.features ??
      container?.storeTypeFeatures ??
      container?.items ??
      container?.results;
    if (Array.isArray(rows)) return rows;
  }
  return [];
};
const featureName = (item) =>
  typeof item === "string"
    ? item
    : (item?.name ??
      item?.featureName ??
      item?.feature_name ??
      item?.featureKey ??
      item?.feature_key ??
      item?.code ??
      "");
const featureActions = (item) =>
  Array.isArray(item?.actions)
    ? item.actions
        .map((action) =>
          typeof action === "string"
            ? action
            : (action?.name ?? action?.action ?? action?.code),
        )
        .filter(Boolean)
    : [];

const idOf = (value) =>
  String(
    value?.merchantId ??
      value?.id ??
      value?._id ??
      (typeof value === "string" || typeof value === "number" ? value : ""),
  );
const initials = (value) =>
  String(value || "Store")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
const blankHours = () =>
  DAYS.map((day) => ({
    day,
    status: "Closed",
    open: "",
    close: "",
    shifts: 0,
  }));
const normalizeHours = (value) => {
  const source = Array.isArray(value) ? value : [];
  return DAYS.map((day) => {
    const row =
      source.find(
        (item) => String(item?.day || "").toLowerCase() === day.toLowerCase(),
      ) || {};
    const status =
      String(row.status || "").toLowerCase() === "open" ? "Open" : "Closed";
    const shifts = Number(row.shifts);
    return {
      day,
      status,
      // Keep the values returned for closed days too; the API payload must
      // round-trip all seven schedule rows without discarding saved values.
      open: String(row.open || ""),
      close: String(row.close || ""),
      shifts: Number.isInteger(shifts) && shifts >= 0 ? shifts : 0,
    };
  });
};
const flattenRolePermissions = (value) => {
  if (!Array.isArray(value)) return [];
  if (value.some((row) => row?.permissionAction)) return value;
  const flat = [];
  for (const role of value) {
    const matrix =
      role?.permissions && typeof role.permissions === "object"
        ? role.permissions
        : {};
    for (const [featureName, actions] of Object.entries(matrix)) {
      for (const action of STANDARD_ACTIONS) {
        if (actions?.[action] === undefined) continue;
        flat.push({
          roleTemplateId: role.roleTemplateId || role.id || "",
          roleName: role.name || role.roleName || "",
          featureName,
          permissionAction: action,
          allowed: actions[action],
        });
      }
    }
  }
  return flat;
};
const blankStore = (merchantId = "") => ({
  merchantId,
  name: "",
  type: "",
  storeTypeId: "",
  storeCode: "",
  id: "",
  phone: "",
  email: "",
  url: "",
  logo: "",
  currency: "",
  status: "Active",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
  country: "",
  timezone: "",
  defaultLanguage: "",
  hours: blankHours(),
});

const unwrapMerchant = (result) => {
  const raw = result?.raw || result || {};
  const merchant = raw.merchant || raw.data?.merchant || raw.data || raw;
  const draft = merchant?._onboarding;
  const owner = {
    ...(draft?.merchant || {}),
    ...merchant,
    ...(result?.merchant || {}),
  };
  const sub =
    result?.subscription || raw.subscription || owner.subscription || {};
  const plan = sub.plan && typeof sub.plan === "object" ? sub.plan : {};
  const storeType =
    owner.storeType ??
    raw.storeType ??
    raw.data?.storeType ??
    result?.storeType;
  return {
    owner,
    subscription: sub,
    typeId: String(
      owner.storeTypeId ??
        storeType?.id ??
        storeType?.storeTypeId ??
        draft?.merchant?.storeTypeId ??
        "",
    ),
    typeName:
      owner.storeTypeName ||
      (typeof storeType === "string"
        ? storeType
        : (storeType?.name ?? storeType?.storeTypeName)) ||
      owner.type ||
      "",
    roles: result?.roles || raw.roles || owner.roles || draft?.roles || [],
    plan,
  };
};
const normalizePermissionAction = (value) => {
  const key = String(value || "").toLowerCase();
  if (!key) return "";
  if (/(view|read|list|get)/.test(key)) return "View";
  if (/(create|add|insert)/.test(key)) return "Create";
  if (/(edit|update|write|modify)/.test(key)) return "Edit";
  if (/(delete|remove|destroy)/.test(key)) return "Delete";
  return "";
};
const levelForRole = (role) => {
  const scope = String(role?.scopeType || role?.level || "").toUpperCase();
  if (scope.includes("MERCHANT") || scope.includes("FULL"))
    return "Full Access";
  if (scope.includes("OPS") || scope.includes("OPERATION")) return "Operations";
  if (scope.includes("SALE") || scope.includes("CASH")) return "Sales";
  if (scope.includes("STORE")) return "Store";
  return role?.level || scope || "Custom";
};
const readMerchantSelectedTemplates = (response) => {
  const available = readAvailableRoleTemplates(response);
  if (available.roleTemplates.length) {
    const selected = available.roleTemplates.filter((row) => row.selected);
    if (selected.length) {
      return selected.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        roleCode: row.roleCode,
        scopeType: row.scopeType,
        level: levelForRole(row),
        required: row.required,
        defaultEnabled: row.defaultEnabled,
      }));
    }
  }
  const listed = Array.isArray(response?.roleTemplates)
    ? response.roleTemplates.filter(
        (row) => row.sourceRoleTemplateId || row.roleTemplateId,
      )
    : [];
  return listed
    .map((row, index) => {
      const id = String(
        row.sourceRoleTemplateId ||
          row.roleTemplateId ||
          row.id ||
          `merchant-role-${index}`,
      );
      return {
        id,
        name: String(row.name || row.roleName || "Unnamed role").trim(),
        description: String(row.description || "").trim(),
        roleCode: String(row.roleCode || "").trim(),
        scopeType: String(row.scopeType || "STORE"),
        level: levelForRole(row),
        required: false,
        defaultEnabled: false,
      };
    })
    .filter((row) => row.id && row.name);
};
const buildRolePermissionState = (featuresPayload, enabledNames = []) => {
  const features = Array.isArray(featuresPayload?.features)
    ? featuresPayload.features
    : Array.isArray(featuresPayload)
      ? featuresPayload
      : [];
  const enabled = new Set(
    (enabledNames || []).map((name) => String(name).toLowerCase()),
  );
  const matrix = {};
  const availability = {};
  const rows = [];
  for (const item of features) {
    const feature = item?.feature || item?.featureDetails || item;
    const name = featureName(feature) || featureName(item);
    if (!name) continue;
    if (enabled.size && !enabled.has(name.toLowerCase())) continue;
    const actions = Object.fromEntries(
      STANDARD_ACTIONS.map((action) => [action, false]),
    );
    const available = Object.fromEntries(
      STANDARD_ACTIONS.map((action) => [action, true]),
    );
    for (const permission of feature.permissions || []) {
      const action =
        normalizePermissionAction(permission.name) ||
        normalizePermissionAction(permission.permissionKey) ||
        normalizePermissionAction(permission.action);
      if (!action) continue;
      if (permission.checked || permission.defaultAllowed)
        actions[action] = true;
    }
    matrix[name] = actions;
    availability[name] = available;
    rows.push({
      id: item?.featureId || item?.feature_id || feature.id || name,
      name,
      description: feature.description || "",
      category: feature.category || "More",
    });
  }
  return { matrix, availability, rows };
};
const permissionAllowed = (value) =>
  value === true || value === "true" || value === "t" || value === 1;
const roleTemplateKeys = (role) => [
  role?.id,
  role?.roleTemplateId,
  role?.sourceRoleTemplateId,
  role?.roleTemplate?.id,
  role?.template?.id,
  role?.roleCode,
  role?.code,
  role?.name,
  role?.roleName,
].filter(Boolean).map((value) => String(value).trim().toLowerCase());
const applySavedRolePermissions = (
  matrix,
  savedRows,
  roleId,
  roleName = "",
) => {
  if (!matrix || !Array.isArray(savedRows) || !savedRows.length) return matrix;
  const roleKey = String(roleId || "").toLowerCase();
  const nameKey = String(roleName || "")
    .trim()
    .toLowerCase();
  const next = Object.fromEntries(
    Object.entries(matrix).map(([feature, actions]) => [
      feature,
      { ...actions },
    ]),
  );
  for (const row of savedRows) {
    const templateId = String(row.roleTemplateId || "").toLowerCase();
    const rowName = String(row.roleName || "")
      .trim()
      .toLowerCase();
    const idMatch = Boolean(templateId) && templateId === roleKey;
    const nameMatch = Boolean(nameKey) && rowName === nameKey;
    if (!idMatch && !nameMatch) continue;
    if (!STANDARD_ACTIONS.includes(row.permissionAction)) continue;
    const featureName = String(row.featureName || "");
    const match = Object.keys(next).find(
      (name) => name.toLowerCase() === featureName.toLowerCase(),
    );
    if (!match) continue;
    next[match][row.permissionAction] = permissionAllowed(row.allowed);
  }
  return next;
};
const Field = ({
  label,
  value,
  onChange,
  type = "text",
  optional = false,
  ...props
}) => (
  <label className="sf-field">
    <span>
      {label}
      {optional && <small> (Optional)</small>}
    </span>
    <input
      type={type}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      {...props}
    />
  </label>
);

const SelectField = ({
  label,
  value,
  onChange,
  options,
  optional = false,
  ...props
}) => (
  <label className="sf-field">
    <span>
      {label}
      {optional && <small> (Optional)</small>}
    </span>
    <select
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      {...props}
    >
      {options.map((option) =>
        typeof option === "string" ? (
          <option key={option} value={option}>
            {option}
          </option>
        ) : (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ),
      )}
    </select>
  </label>
);

const Panel = ({ title, subtitle, action, children, className = "" }) => (
  <section className={`sf-panel ${className}`}>
    {(title || action) && (
      <div className="sf-panel-head">
        <div>
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
);

const Detail = ({ label, children }) => (
  <div className="sf-detail">
    <span>{label}</span>
    <strong>{children || "—"}</strong>
  </div>
);

export default function AddStore({ embeddedStep = null, readOnly = false, onEdit, onDone } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { merchantId: routeMerchantId, storeId } = useParams();
  const editing = Boolean(storeId);
  const [store, setStore] = useState(() => blankStore(routeMerchantId || ""));
  const locationOptions = useLocationOptions(store);
  const [merchants, setMerchants] = useState([]);
  const [merchantInfo, setMerchantInfo] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [merchantStores, setMerchantStores] = useState([]);
  const [storeTypes, setStoreTypes] = useState([]);
  const [storeTypesLoading, setStoreTypesLoading] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [masterPlans, setMasterPlans] = useState([]);
  const [typeFeatures, setTypeFeatures] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [merchantError, setMerchantError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const saveLock = useRef(false);
  const hoursRef = useRef(blankHours());
  const permissionsRef = useRef({});
  const editedPermissionRoles = useRef(new Set());
  const featureDefaultsScope = useRef("");
  const loadedFeatureType = useRef("");
  const imageReads = useRef(0);
  const imageGeneration = useRef(0);
  const [enabledFeatures, setEnabledFeatures] = useState([]);
  const [roleDefinitions, setRoleDefinitions] = useState([]);
  const [storeTypeRoleIds, setStoreTypeRoleIds] = useState(null);
  const [storeTypeRolesLoading, setStoreTypeRolesLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState("");
  const [roles, setRoles] = useState([]);
  const [savedRoleKeys, setSavedRoleKeys] = useState([]);
  const appliedRoleSnapshot = useRef("");
  const [activeRole, setActiveRole] = useState("");
  const [copyFromRole, setCopyFromRole] = useState("");
  const [permissions, setPermissions] = useState({});
  const [savedRolePermissions, setSavedRolePermissions] = useState([]);
  useEffect(() => {
    permissionsRef.current = permissions;
  }, [permissions]);
  const [permissionAvailability, setPermissionAvailability] = useState({});
  const [roleFeatureRows, setRoleFeatureRows] = useState({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const loadedRolePermissions = useRef(new Set());
  const [employeeAssignments, setEmployeeAssignments] = useState([]);
  const [pinEditorId, setPinEditorId] = useState("");
  const [pinDraft, setPinDraft] = useState("");
  const [pinError, setPinError] = useState("");
  const [step, setStep] = useState(embeddedStep ?? 0);
  const [loading, setLoading] = useState(true);
  const [mastersLoading, setMastersLoading] = useState(true);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("All");
  const [employeePage, setEmployeePage] = useState(1);
  const [featureSearch, setFeatureSearch] = useState("");
  const [featureCategory, setFeatureCategory] = useState("All Features");

  const merchantLookupId = routeMerchantId || store.merchantId;
  const merchantRecord = merchants.find(
    (item) =>
      String(item.id) === String(merchantLookupId) ||
      String(item.merchantId) === String(merchantLookupId),
  );

  const merchantId = idOf(routeMerchantId || store.merchantId);
  const merchantOptionValue = (item) =>
    String(item?.id || item?.merchantId || "");
  const merchantMatches = (item, value) => Boolean(value) &&
    [item?.id, item?.merchantId, item?.merchantCode].some(
      (candidate) => candidate && String(candidate) === String(value),
    );
  const selectedMerchant = merchants.find((item) =>
    merchantMatches(item, routeMerchantId || store.merchantId || merchantId),
  );
  const merchantSelectValue = selectedMerchant
    ? merchantOptionValue(selectedMerchant)
    : String(routeMerchantId || "");
  const merchant =
    merchantInfo?.owner ||
    selectedMerchant ||
    merchants.find((item) => merchantMatches(item, merchantId)) ||
    null;
  const merchantName =
    merchant?.name ||
    merchant?.merchantName ||
    merchant?.businessDisplayName ||
    "Selected merchant";
  const rawMerchantRecord =
    merchant?._raw?.merchant ||
    merchant?._raw?.data?.merchant ||
    merchant?._raw?.data ||
    merchant?._raw ||
    merchantRecord?._raw?.merchant ||
    merchantRecord?._raw?.data?.merchant ||
    merchantRecord?._raw?.data ||
    merchantRecord?._raw ||
    {};
  const merchantCode = [
    merchant?.merchantCode,
    merchant?.merchant_code,
    merchant?.code,
    merchant?.merchantId,
    merchant?.merchant_id,
    merchantRecord?.merchantCode,
    merchantRecord?.merchant_code,
    merchantRecord?.code,
    merchantRecord?.merchantId,
    rawMerchantRecord.merchantCode,
    rawMerchantRecord.merchant_code,
    rawMerchantRecord.code,
  ]
    .map((value) => String(value || "").trim())
    .find(
      (value) =>
        value &&
        !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value),
    ) || "";

  useEffect(() => {
    if (!routeMerchantId && !storeId) {
      setStore((current) => current.merchantId ? blankStore() : current);
    }
  }, [routeMerchantId, storeId]);
  const activeStoreTypeId =
    store.storeTypeId ||
    merchantInfo?.typeId ||
    subscription?.storeTypeId ||
    "";
  const selectedType =
    storeTypes.find((item) => String(item.id) === String(activeStoreTypeId)) ||
    storeTypes.find(
      (item) =>
        String(item.name).toLowerCase() === String(store.type).toLowerCase(),
    );
  const typeName =
    selectedType?.name || store.type || merchantInfo?.typeName || "";
  const plan =
    subscription?.plan && typeof subscription.plan === "object"
      ? subscription.plan
      : null;
  const planName =
    subscription?.planName ||
    subscription?.planCode ||
    plan?.name ||
    plan?.planName ||
    merchant?.plan ||
    "No active plan";
  const billing =
    subscription?.billingCycle ||
    subscription?.billingType ||
    plan?.billingCycle ||
    "—";
  const planPrice =
    subscription?.price ??
    subscription?.agreementPrice ??
    plan?.price ??
    plan?.amount;
  const storeLimit = Number(
    subscription?.maxStoresAllowed ??
      subscription?.licensedStoreCount ??
      subscription?.storeLimit ??
      subscription?.maxStores ??
      subscription?.locationLimit ??
      plan?.includedStores ??
      plan?.included_stores ??
      NaN,
  );

  const matchedPlan = useMemo(() => {
    const target = String(
      subscription?.planId ||
        subscription?.planCode ||
        subscription?.planName ||
        plan?.id ||
        plan?.code ||
        plan?.name ||
        merchant?.planId ||
        merchant?.plan ||
        "",
    )
      .trim()
      .toLowerCase();
    if (!target) return null;
    return (
      masterPlans.find(
        (p) =>
          String(p.id).toLowerCase() === target ||
          String(p.code || "").toLowerCase() === target ||
          String(p.name || "").toLowerCase() === target,
      ) || null
    );
  }, [masterPlans, subscription, plan, merchant]);

  const planFeatureList =
    subscription?.includedFeatures ??
    subscription?.included_features ??
    plan?.includedFeatures ??
    plan?.included_features ??
    plan?.features ??
    matchedPlan?.includedFeatures;

  const includedFeatures = useMemo(() => {
    const raw = [
      ...listFrom(subscription?.entitlements),
      ...listFrom(
        subscription?.includedFeatures ?? subscription?.included_features,
      ),
      ...listFrom(
        plan?.included_features ?? plan?.includedFeatures ?? plan?.features,
      ),
      ...listFrom(
        matchedPlan?.included_features ??
          matchedPlan?.includedFeatures ??
          matchedPlan?.features,
      ),
    ];
    const knownFeatures = [...catalog, ...typeFeatures]
      .map(
        (item) =>
          item?.feature ||
          item?.featureDetails ||
          item?.featureDefinition ||
          item?.storeTypeFeature?.feature ||
          item?.data?.feature ||
          item,
      )
      .filter((item) => featureName(item));
    const identityValues = (item) => {
      const feature =
        typeof item === "object" && item
          ? item.feature ||
            item.featureDetails ||
            item.featureDefinition ||
            item
          : item;
      return [
        featureName(feature),
        feature?.id,
        feature?._id,
        feature?.featureId,
        feature?.feature_id,
        feature?.featureKey,
        feature?.feature_key,
        feature?.code,
        feature?.featureCode,
      ]
        .filter((value) => value != null && value !== "")
        .map((value) => String(value).trim().toLowerCase());
    };
    const unique = [];
    const seen = new Set();
    for (const entry of raw) {
      const identities = new Set(identityValues(entry));
      const match = knownFeatures.find(feature =>
        identityValues(feature).some(value => identities.has(value)),
      );
      if (!match) continue;
      const name = featureName(match);
      const lower = name.toLowerCase();
      if (name && !seen.has(lower)) {
        seen.add(lower);
        unique.push(name);
      }
    }
    return unique;
  }, [subscription, plan, catalog, typeFeatures]);

  const featureRows = useMemo(() => {
    const source = activeStoreTypeId ? typeFeatures : catalog;
    const unique = new Map();
    source.forEach((row) => {
      const nested =
        row.feature ||
        row.featureDetails ||
        row.featureDefinition ||
        row.storeTypeFeature?.feature ||
        row.data?.feature ||
        row;
      const name = featureName(nested);
      if (name && !unique.has(name))
        unique.set(name, {
          ...nested,
          name,
          actions: featureActions(nested),
          category:
            nested.category || nested.categoryName || row.category || "More",
          description: nested.description || nested.featureDescription || "",
          included: nested.included ?? row.included,
          planAccess: nested.planAccess ?? row.planAccess,
          enabledForStore: nested.enabledForStore ?? row.enabledForStore,
          defaultEnabled: row.defaultEnabled !== false,
        });
    });
    return [...unique.values()];
  }, [typeFeatures, catalog, activeStoreTypeId]);
  const roleById = useMemo(
    () => Object.fromEntries(roleDefinitions.map((role) => [role.id, role])),
    [roleDefinitions],
  );
  const roleIsSelected = (role) => {
    const keys = roleTemplateKeys(role);
    return roles.some(
      (roleId) =>
        roleId === role.id || keys.includes(String(roleId).toLowerCase()),
    );
  };
  const roleName = (id) => roleById[id]?.name || id;
  const categories = [
    "All Features",
    ...new Set(featureRows.map((row) => row.category)),
  ];
  const entitled = (name) => {
    const target = String(name || "")
      .trim()
      .toLowerCase();
    if (
      includedFeatures.some(
        (item) =>
          String(item || "")
            .trim()
            .toLowerCase() === target,
      )
    )
      return true;
    const feature = featureRows.find(
      (row) =>
        String(row.name || "")
          .trim()
          .toLowerCase() === target,
    );
    if (
      feature?.id &&
      includedFeatures.some(
        (item) =>
          String(item || "")
            .trim()
            .toLowerCase() === String(feature.id).toLowerCase(),
      )
    )
      return true;
    if (
      feature?.code &&
      includedFeatures.some(
        (item) =>
          String(item || "")
            .trim()
            .toLowerCase() === String(feature.code).toLowerCase(),
      )
    )
      return true;
    if (
      feature?.featureKey &&
      includedFeatures.some(
        (item) =>
          String(item || "")
            .trim()
            .toLowerCase() === String(feature.featureKey).toLowerCase(),
      )
    )
      return true;
    if (feature && typeof feature.included === "boolean" && feature.included)
      return true;
    if (
      feature?.planAccess &&
      String(feature.planAccess).toUpperCase() === "INCLUDED"
    )
      return true;
    if (includedFeatures.length > 0) return false;
    if (
      planFeatureList != null &&
      Array.isArray(planFeatureList) &&
      planFeatureList.length > 0
    )
      return false;
    return Boolean(activeStoreTypeId) && Boolean(feature);
  };
  const filteredFeatures = featureRows.filter((row) => {
    const matchesCategory =
      featureCategory === "All Features" || row.category === featureCategory;
    return (
      matchesCategory &&
      `${row.name} ${row.description}`
        .toLowerCase()
        .includes(featureSearch.toLowerCase())
    );
  });
  const selectableFeatureNames = filteredFeatures.filter((row) => entitled(row.name)).map((row) => row.name);
  const allVisibleFeaturesSelected = selectableFeatureNames.length > 0 && selectableFeatureNames.every((name) => enabledFeatures.includes(name));
  const roleAvailableForStoreType = (role) => storeTypeRoleIds === null || roleTemplateKeys(role).some((key) => storeTypeRoleIds.has(key));
  const selectableRoleDefinitions = roleDefinitions.filter(roleAvailableForStoreType);
  const activeEmployees = employees.filter(
    (employee) =>
      String(employee.status || "").toUpperCase() === "ACTIVE" ||
      employee.status === "Active",
  );
  const employeeRows = activeEmployees.filter((employee) => {
    const query = employeeSearch.toLowerCase();
    const matchText =
      `${employee.name} ${employee.id} ${employee.phone} ${employee.email} ${employee.role}`
        .toLowerCase()
        .includes(query);
    const assigned = employeeAssignments.some(
      (item) => item.employeeId === String(employee.id ?? employee.employeeId),
    );
    return (
      matchText &&
      (employeeFilter === "All" ||
        (employeeFilter === "Assigned" ? assigned : !assigned))
    );
  });

  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(employeeRows.length / pageSize));
  const currentEmployeePage = Math.min(employeePage, pageCount);
  const pagedEmployees = employeeRows.slice(
    (currentEmployeePage - 1) * pageSize,
    currentEmployeePage * pageSize,
  );
  const allActiveEmployeesSelected =
    activeEmployees.length > 0 &&
    activeEmployees.every((employee) => {
      const employeeId = String(employee.id ?? employee.employeeId ?? "");
      return employeeAssignments.some((item) => item.employeeId === employeeId);
    });

  const currencyCode =
    store.currency ||
    COUNTRIES[store.country]?.currency ||
    subscription?.currency ||
    "";
  const countrySettings = COUNTRIES[store.country];
  const enabledCount = enabledFeatures.length;
  const permissionCount = (role) =>
    Object.values(permissions[role] || {}).reduce(
      (sum, actions) =>
        sum + Object.values(actions || {}).filter(Boolean).length,
      0,
    );

  // Initial Load: Merchants, Global Feature Catalog, and Existing Store if editing
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setMastersLoading(true);
      setLoadError("");
      try {
        const [result, featuresResult, plansResult] = await Promise.all([
          listMerchants().catch(() => []),
          listFeatures().catch(() => []),
          listPlans().catch(() => []),
        ]);
        if (!cancelled) {
          setMerchants(
            Array.isArray(result)
              ? result
              : result?.merchants || result?.data?.merchants || [],
          );
          setCatalog(
            Array.isArray(featuresResult)
              ? featuresResult.filter(
                  (item) =>
                    String(item.status || "Active").toUpperCase() !==
                    "INACTIVE",
                )
              : [],
          );
          setMasterPlans(Array.isArray(plansResult) ? plansResult : []);
        }
        if (storeId) {
          const response = await api.get(
            endpoints.store(encodeURIComponent(storeId)),
          );
          const saved = response?.store || response;
          if (!cancelled) {
            const address =
              saved.address && typeof saved.address === "object"
                ? saved.address
                : {};
            const savedStore = {
              ...blankStore(
                routeMerchantId || saved.merchantId || saved.merchant,
              ),
              ...saved,
              merchantId:
                routeMerchantId || idOf(saved.merchantId || saved.merchant),
              id: saved.storeID || saved.storeId || saved.id || "",
              name: saved.storeName || saved.name || "",
              type:
                saved.storeType?.storeTypeCode || saved.storeType?.code ||
                saved.storeTypeCode || saved.storeTypeName ||
                (typeof saved.storeType === "string" ? saved.storeType : "") || saved.type || "",
              storeTypeId: String(
                saved.storeTypeId || saved.storeType?.id || "",
              ),
              storeCode: saved.storeCode || saved.code || "",
              phone: saved.phone || "",
              email: saved.email || saved.storeEmail || "",
              url: saved.baseUrl || saved.url || saved.websiteUrl || "",
              logo: saved.logoUrl || saved.logo || "",
              addressLine1:
                saved.addressLine1 ||
                address.addressLine1 ||
                address.street ||
                (typeof saved.address === "string" ? saved.address : ""),
              addressLine2: saved.addressLine2 || address.addressLine2 || "",
              city: saved.city || address.city || "",
              state: saved.state || address.state || "",
              zip: saved.zip || saved.postalCode || address.zipCode || "",
              country: saved.country || address.country || "",
              timezone: saved.timezone || "",
              currency: saved.currency || "",
              defaultLanguage: saved.defaultLanguage || "",
              status: String(saved.status || "ACTIVE").toUpperCase() === "INACTIVE"
                ? "Inactive"
                : "Active",
              hours: normalizeHours(
                saved.hours || saved.onboardingSetup?.hours,
              ),
            };
            hoursRef.current = savedStore.hours;
            setStore(savedStore);
            setEnabledFeatures(
              (
                saved.features ||
                saved.enabledFeatures ||
                saved.onboardingSetup?.features ||
                []
              )
                .map(featureName)
                .filter(Boolean),
            );
            setSavedRolePermissions(
              flattenRolePermissions(
                saved.rolePermissions || saved.onboardingSetup?.rolePermissions,
              ),
            );
          }
        }
      } catch (err) {
        if (!cancelled)
          setLoadError(err?.message || "Unable to load the store setup.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setMastersLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [routeMerchantId, storeId, reload]);

  useEffect(() => {
    let cancelled = false;
    setStoreTypesLoading(true);

    async function loadStoreTypes() {
      try {
        const masterRes = await storeTypesApi
          .getAll()
          .catch(() => ({ storeTypes: [] }));
        const masterTypes = (
          masterRes?.storeTypes ||
          masterRes?.data?.storeTypes ||
          masterRes?.data ||
          (Array.isArray(masterRes) ? masterRes : [])
        ).filter(
          (item) =>
            String(item.status || "ACTIVE").toUpperCase() !== "INACTIVE",
        );

        if (merchantId) {
          try {
            const merchantRes = await storeTypesApi.getForMerchant(merchantId);
            const merchantTypes = (
              merchantRes?.storeTypes ||
              merchantRes?.data?.storeTypes ||
              merchantRes?.data ||
              (Array.isArray(merchantRes) ? merchantRes : [])
            ).filter(
              (item) =>
                String(item.status || "ACTIVE").toUpperCase() !== "INACTIVE",
            );
            if (!cancelled)
              setStoreTypes(merchantTypes.length ? merchantTypes : masterTypes);
            return;
          } catch {
            // Fall back to the master store-type list.
          }
        }
        if (!cancelled) setStoreTypes(masterTypes);
      } catch (err) {
        if (!cancelled) {
          setStoreTypes([]);
          setLoadError(err?.message || "Unable to load store types.");
        }
      } finally {
        if (!cancelled) setStoreTypesLoading(false);
      }
    }

    loadStoreTypes();
    return () => {
      cancelled = true;
    };
  }, [merchantId, reload]);

  useEffect(() => {
    if (!storeTypes.length) return;
    const wanted = [
      store.storeTypeId,
      store.type,
      merchantInfo?.typeId,
      merchantInfo?.typeName,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
    if (!wanted.length) return;
    const match = storeTypes.find((item) =>
      [
        item.id,
        item.storeTypeId,
        item.code,
        item.storeTypeCode,
        item.name,
        item.storeTypeName,
      ]
        .filter(Boolean)
        .some((value) => wanted.includes(String(value).toLowerCase())),
    );
    if (!match) return;
    const value = String(
      match.id ?? match.storeTypeId ?? match.code ?? match.name,
    );
    if (store.storeTypeId === value) return;
    setStore((current) => ({
      ...current,
      storeTypeId: value,
      type: match.name || match.storeTypeName || current.type,
    }));
  }, [storeTypes, store.storeTypeId, store.type, merchantInfo]);

  // Load merchant context
  useEffect(() => {
    let cancelled = false;
    setMerchantInfo(null);
    setSubscription(null);
    setMerchantStores([]);
    setEmployees([]);
    setMerchantError("");
    setRoleDefinitions([]);
    setRolesError("");
    setMerchantLoading(Boolean(merchantId));
    if (!merchantId) return;

    async function loadMerchantContext() {
      try {
        const [result, employeeResult, storesResult] = await Promise.all([
          getMerchant(merchantId),
          listMerchantEmployees(merchantId),
          api.get(endpoints.merchantStores(merchantId)).catch(() => null),
        ]);
        if (cancelled) return;

        const info = unwrapMerchant(result);
        if (!idOf(info.owner))
          throw new Error("Merchant details were not returned.");
        setMerchantInfo(info);
        setSubscription(info.subscription);
        const listed = storesResult?.stores ?? storesResult?.data?.stores ?? [];
        const response = result?.raw || result || {};
        const fallback =
          result?.stores ??
          response.stores ??
          response.data?.stores ??
          info.owner.stores ??
          [];
        const rows = Array.isArray(listed) && listed.length ? listed : fallback;
        setMerchantStores(Array.isArray(rows) ? rows : []);
        const employeeRows = Array.isArray(employeeResult)
          ? employeeResult
          : (employeeResult?.employees ?? employeeResult?.data?.employees);
        if (!Array.isArray(employeeRows))
          throw new Error("The merchant employee list could not be read.");
        setEmployees(
          employeeRows
            .map((employee) => ({
              ...employee,
              id: employee.id || employee.employeeId,
              name:
                employee.name ||
                employee.employeeName ||
                [employee.firstName, employee.lastName]
                  .filter(Boolean)
                  .join(" "),
              phone: employee.phone || employee.phoneNumber || "",
              role:
                typeof employee.role === "string"
                  ? employee.role
                  : employee.roleName || employee.role?.name || "",
            }))
            .filter((employee) => employee.id),
        );
        let roleResult = await merchantRoleTemplatesApi
          .getAvailable(merchantId)
          .catch(() => null);
        let templates = roleResult
          ? readMerchantSelectedTemplates(roleResult)
          : [];
        if (!templates.length) {
          roleResult = await merchantRoleTemplatesApi.list(
            merchantId,
            "ACTIVE",
          );
          templates = readMerchantSelectedTemplates(roleResult);
        }
        setRoleDefinitions(templates);
        // A new store starts with no role assignments; the user selects them explicitly.
        if (!editing) {
          const country =
            info.owner.country || info.owner.address?.country || "";
          setStore((current) => ({
            ...current,
            merchantId,
            type: info.typeName,
            storeTypeId: info.typeId,
            country,
            currency:
              info.owner.currency ||
              info.subscription?.currency ||
              COUNTRIES[country]?.currency ||
              "",
            timezone: info.owner.timezone || "",
            defaultLanguage: info.owner.defaultLanguage || "",
          }));
          setRoles([]);
          setActiveRole("");
          loadedRolePermissions.current = new Set();
          setPermissions({});
          setPermissionAvailability({});
          setRoleFeatureRows({});
        }
      } catch (err) {
        if (!cancelled)
          setMerchantError(
            err?.message || "Unable to load the selected merchant.",
          );
      } finally {
        if (!cancelled) setMerchantLoading(false);
      }
    }
    loadMerchantContext();
    return () => {
      cancelled = true;
    };
  }, [merchantId, editing, reload]);
  // Only offer role templates mapped to this store's selected store type.
  useEffect(() => {
    let cancelled = false;
    setStoreTypeRoleIds(null);
    setRolesError("");
    if (!activeStoreTypeId) {
      setStoreTypeRoleIds(new Set());
      setStoreTypeRolesLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setStoreTypeRolesLoading(true);
    roleTemplatesApi
      .getForStoreType(activeStoreTypeId)
      .then((response) => {
        if (cancelled) return;
        const ids = readRoleTemplatesList(response)
          .filter((row) => {
            const status = String(
              row.status || row.roleTemplate?.status || "ACTIVE",
            ).toUpperCase();
            return (
              row.enabled !== false &&
              row.active !== false &&
              status === "ACTIVE"
            );
          })
          .flatMap((row) => roleTemplateKeys(row));
        setStoreTypeRoleIds(new Set(ids));
      })
      .catch((err) => {
        if (!cancelled) {
          setStoreTypeRoleIds(new Set());
          setRolesError(
            err?.message ||
              "Unable to load role templates for this store type.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setStoreTypeRolesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeStoreTypeId, reload]);

  useEffect(() => {
    if (storeTypeRoleIds === null || storeTypeRolesLoading || !activeStoreTypeId) return;
    setRoles((current) => {
      const allowed = current.flatMap((roleId) => {
        const role = roleDefinitions.find(
          (item) =>
            item.id === roleId ||
            roleTemplateKeys(item).includes(String(roleId).toLowerCase()),
        );
        if (!role) return [roleId];
        const keys = roleTemplateKeys(role);
        const saved = keys.some((key) => savedRoleKeys.includes(key));
        const allowedForType = keys.some((key) => storeTypeRoleIds.has(key));
        if (!allowedForType && !saved) return [];
        return [role.id];
      });
      const unique = [...new Set(allowed)];
      if (
        unique.length === current.length &&
        unique.every((id, index) => id === current[index])
      ) {
        return current;
      }
      return unique;
    });
  }, [storeTypeRoleIds, storeTypeRolesLoading, activeStoreTypeId, roleDefinitions, savedRoleKeys]);

  // Load Store-Type Features
  useEffect(() => {
    let cancelled = false;
    if (!editing || !merchantId || !storeId) return;
    listStoreEmployees(merchantId, storeId)
      .then((response) => {
        if (cancelled) return;
        const rows = Array.isArray(response) ? response : response?.employees ?? response?.data?.employees ?? [];
        setEmployeeAssignments(
          rows
            .map((item) => ({
              employeeId: String(item.employeeId || item.employee_id || item.id || ""),
              role: item.roleTemplateId || item.role_template_id || item.role || "",
              pin: "",
              savedPin: [item.loginPin, item.login_pin, item.employeeLoginPin, item.employee_login_pin, item.pin]
                .map(value => String(value ?? ""))
                .find(value => /^\d{6}$/.test(value)) || "",
              pinSet: [item.pinSet, item.pin_set, item.hasLoginPin].some(
                (value) => value === true || value === "t" || value === "true" || value === 1,
              ) || Boolean(item.loginPinHash || item.loginPin || item.login_pin || item.employeeLoginPin || item.employee_login_pin || item.pin),
            }))
            .filter((item) => item.employeeId),
        );
      })
      .catch(() => {
        if (!cancelled) setEmployeeAssignments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [editing, merchantId, storeId, reload]);

  useEffect(() => {
    let cancelled = false;
    if (!editing || !merchantId || !storeId) {
      setSavedRolePermissions([]);
      return;
    }
    listStoreRolePermissions(merchantId, storeId)
      .then((response) => {
        if (cancelled) return;
        const rows =
          response?.rolePermissions ?? response?.data?.rolePermissions ?? [];
        setSavedRolePermissions(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setSavedRolePermissions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [editing, merchantId, storeId, reload]);

  useEffect(() => {
    let cancelled = false;
    if (!editing || !merchantId || !storeId) return;
    setRolesLoading(true);
    setRolesError("");
    storeRoleTemplatesApi
      .list(merchantId, storeId)
      .then((response) => {
        if (cancelled) return;
        const rows = readStoreRoleTemplates(response);
        const keys = [...new Set(rows.flatMap((row) => roleTemplateKeys(row)))];
        appliedRoleSnapshot.current = "";
        setSavedRoleKeys(keys);
        const assigned = rows
          .map((row) => row.roleTemplateId || row.id)
          .filter(Boolean);
        setRoles(assigned);
        setActiveRole(assigned[0] || "");
        loadedRolePermissions.current = new Set();
      })
      .catch((err) => {
        if (!cancelled)
          setRolesError(err?.message || "Unable to load store role templates.");
      })
      .finally(() => {
        if (!cancelled) setRolesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editing, merchantId, storeId, reload]);

  useEffect(() => {
    if (!editing) return;
    if (rolesLoading || merchantLoading || storeTypeRolesLoading || storeTypeRoleIds === null) return;
    if (!roleDefinitions.length) return;
    const snapshot = savedRoleKeys.join("|");
    if (appliedRoleSnapshot.current === snapshot) return;
    const selected = roleDefinitions
      .filter((role) => roleTemplateKeys(role).some((key) => savedRoleKeys.includes(key)))
      .map((role) => role.id);
    appliedRoleSnapshot.current = snapshot;
    if (savedRoleKeys.length && !selected.length) return;
    setRoles(selected);
    setActiveRole((current) => (selected.includes(current) ? current : selected[0] || ""));
  }, [
    editing,
    rolesLoading,
    merchantLoading,
    storeTypeRolesLoading,
    storeTypeRoleIds,
    roleDefinitions,
    savedRoleKeys,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!activeRole || !roles.includes(activeRole)) return;
    if (editedPermissionRoles.current.has(activeRole)) return;
    setPermissionsLoading(true);
    roleTemplatesApi
      .getFeatures(activeRole, store.storeTypeId ? [store.storeTypeId] : [])
      .then((response) => {
        if (cancelled) return;
        const built = buildRolePermissionState(response, enabledFeatures);
        const roleName =
          roleDefinitions.find((role) => role.id === activeRole)?.name || "";
        const matrix = applySavedRolePermissions(
          built.matrix,
          savedRolePermissions,
          activeRole,
          roleName,
        );
        loadedRolePermissions.current.add(activeRole);
        setPermissions((current) => {
          if (current[activeRole]) return current;
          return { ...current, [activeRole]: matrix };
        });
        setPermissionAvailability((current) => ({
          ...current,
          [activeRole]: built.availability,
        }));
        setRoleFeatureRows((current) => ({
          ...current,
          [activeRole]: built.rows,
        }));
      })
      .catch((err) => {
        if (!cancelled)
          setRolesError(
            err?.message || "Unable to load role template permissions.",
          );
      })
      .finally(() => {
        if (!cancelled) setPermissionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeRole,
    roles,
    store.storeTypeId,
    enabledFeatures,
    savedRolePermissions,
    roleDefinitions,
  ]);

  useEffect(() => {
    let cancelled = false;
    loadedFeatureType.current = "";
    setTypeFeatures([]);
    if (!merchantId || !activeStoreTypeId) {
      setFeaturesLoading(false);
      return;
    }
    setFeaturesLoading(true);
    const featureScope = JSON.stringify([merchantId, activeStoreTypeId]);
    storeTypesApi
      .getMerchantFeatures(merchantId, activeStoreTypeId)
      .catch(() => storeTypesApi.getFeatures(activeStoreTypeId))
      .then((data) => {
        if (!cancelled) {
          loadedFeatureType.current = featureScope;
          const rows = listFrom(data);
          setTypeFeatures(rows.length ? rows : listFrom(data?.all));
        }
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(err?.message || "Unable to load store-type features.");
      })
      .finally(() => {
        if (!cancelled) setFeaturesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [merchantId, activeStoreTypeId, reload]);

  // Default Enable Entitled Features
  useEffect(() => {
    if (
      editing ||
      loading ||
      merchantLoading ||
      featuresLoading ||
      !merchantInfo ||
      !activeStoreTypeId ||
      loadedFeatureType.current !==
        JSON.stringify([merchantId, activeStoreTypeId])
    )
      return;
    const scope = JSON.stringify([merchantId, activeStoreTypeId]);
    if (featureDefaultsScope.current === scope) return;
    featureDefaultsScope.current = scope;
    setEnabledFeatures(
      featureRows.filter((row) => entitled(row.name)).map((row) => row.name),
    );
  }, [
    editing,
    loading,
    merchantLoading,
    featuresLoading,
    merchantInfo,
    merchantId,
    activeStoreTypeId,
    featureRows,
  ]);

  const changeMerchant = (id) => {
    if (saveLock.current) return;
    featureDefaultsScope.current = "";
    imageGeneration.current += 1;
    loadedRolePermissions.current = new Set();
    setStore(blankStore(id));
    hoursRef.current = blankHours();
    permissionsRef.current = {};
    editedPermissionRoles.current = new Set();
    setMerchantInfo(null);
    setSubscription(null);
    setEmployees([]);
    setTypeFeatures([]);
    setEnabledFeatures([]);
    setRoleDefinitions([]);
    setRoles([]);
    setActiveRole("");
    setPermissions({});
    setPermissionAvailability({});
    setRoleFeatureRows({});
    setRolesError("");
    setEmployeeAssignments([]);
    setPinEditorId("");
    setPinDraft("");
    setPinError("");
    setEmployeeSearch("");
    setEmployeeFilter("All");
    setEmployeePage(1);
    setFeatureSearch("");
    setFeatureCategory("All Features");
    setCopyFromRole("");
    setError("");
    setStep(0);
  };

  useEffect(() => {
    if (!editing) changeMerchant(routeMerchantId || "");
  }, [routeMerchantId, storeId]);

  const updateStore = (key, value) =>
    setStore((current) => ({ ...current, [key]: value }));
  const updateHours = (index, key, value) => {
    const hours = hoursRef.current.map((row, i) =>
      i === index ? { ...row, [key]: value } : row,
    );
    hoursRef.current = hours;
    setStore((current) => ({ ...current, hours }));
  };
  const changeCountry = (country) =>
    setStore((current) => ({
      ...current,
      country,
      state: "",
      currency: COUNTRIES[country]?.currency || "",
      timezone: COUNTRIES[country]?.zones[0] || "",
    }));
  const copyScheduleToAll = () => {
    const base = hoursRef.current[0] || blankHours()[0];
    const hours = DAYS.map((day) => ({ ...base, day }));
    hoursRef.current = hours;
    setStore((current) => ({ ...current, hours }));
  };
  const setLogoFile = (key, file) => {
    if (!file) return;
    const limit = key === "logo" ? 2 : 5;
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size > limit * 1024 * 1024
    ) {
      setError("Choose a PNG or JPG file no larger than " + limit + " MB.");
      return;
    }
    const generation = imageGeneration.current;
    const reader = new FileReader();
    imageReads.current += 1;
    reader.onload = () => {
      if (generation === imageGeneration.current)
        updateStore(key, String(reader.result || ""));
    };
    reader.onerror = () =>
      setError("The image could not be read. Please try again.");
    reader.onloadend = () => {
      imageReads.current -= 1;
    };
    reader.readAsDataURL(file);
  };
  const toggleFeature = (name) =>
    entitled(name) &&
    setEnabledFeatures((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    );
  const toggleRole = (roleId) => {
    const keys = new Set(
      roleTemplateKeys(roleById[roleId] || { id: roleId }),
    );
    setRoles((current) => {
      const selected = current.some(
        (item) => item === roleId || keys.has(String(item).toLowerCase()),
      );
      const next = selected
        ? current.filter(
            (item) => item !== roleId && !keys.has(String(item).toLowerCase()),
          )
        : [...current, roleId];
      setActiveRole((active) =>
        next.includes(active) ? active : next[0] || "",
      );
      return next;
    });
  };
  const togglePermission = (roleId, feature, action) => {
    editedPermissionRoles.current.add(roleId);
    setPermissions((current) => {
      const next = {
        ...current,
        [roleId]: {
          ...current[roleId],
          [feature]: {
            ...current[roleId]?.[feature],
            [action]: !current[roleId]?.[feature]?.[action],
          },
        },
      };
      permissionsRef.current = next;
      return next;
    });
  };
  const setEmployeeSelected = (employee, checked) => {
    const employeeId = String(employee.id ?? employee.employeeId ?? "");
    setEmployeeAssignments((current) =>
      checked
        ? current.some((item) => item.employeeId === employeeId)
          ? current
          : [...current, { employeeId, role: roles[0] || "", pin: "" }]
        : current.filter((item) => item.employeeId !== employeeId),
    );
    if (!checked && pinEditorId === employeeId) {
      setPinEditorId("");
      setPinDraft("");
      setPinError("");
    }
  };
  const setAllEmployeesSelected = (checked) => {
    const activeEmployeeIds = new Set(
      activeEmployees.map((employee) =>
        String(employee.id ?? employee.employeeId ?? ""),
      ),
    );

    setEmployeeAssignments((current) => {
      if (!checked) {
        return current.filter((item) => !activeEmployeeIds.has(item.employeeId));
      }

      const assignedIds = new Set(current.map((item) => item.employeeId));
      const newAssignments = activeEmployees
        .map((employee) =>
          String(employee.id ?? employee.employeeId ?? ""),
        )
        .filter((employeeId) => employeeId && !assignedIds.has(employeeId))
        .map((employeeId) => ({
          employeeId,
          role: roles[0] || "",
          pin: "",
        }));
      return [...current, ...newAssignments];
    });

    if (!checked && activeEmployeeIds.has(pinEditorId)) {
      setPinEditorId("");
      setPinDraft("");
      setPinError("");
    }
  };
  const setEmployeeRole = (employeeId, role) =>
    setEmployeeAssignments((current) =>
      current.map((item) =>
        item.employeeId === employeeId ? { ...item, role } : item,
      ),
    );
  const assignedEmployeePin = (assignment) => {
    const employee = employees.find((item) =>
      String(item.id ?? item.employeeId ?? "") === assignment.employeeId,
    );
    return String(
      assignment.pin || assignment.savedPin || employee?.loginPin ||
      employee?.employeeLoginPin || employee?.login_pin || employee?.pin || "",
    );
  };
  const openPinEditor = (employee) => {
    const employeeId = String(employee.id ?? employee.employeeId ?? "");
    setEmployeeAssignments((current) =>
      current.some((item) => item.employeeId === employeeId)
        ? current
        : [...current, { employeeId, role: roles[0] || "", pin: "" }],
    );
    setPinEditorId(employeeId);
    const assignment = employeeAssignments.find(item => item.employeeId === employeeId);
    setPinDraft(assignment?.pin || assignment?.savedPin || "");
    setPinError("");
  };
  const saveEmployeePin = async (employeeId) => {
    if (!/^[1-9]\d{5}$/.test(pinDraft)) {
      setPinError("Enter a 6-digit PIN that does not start with 0.");
      return;
    }
    const duplicatePin = employeeAssignments.find((item) =>
      item.employeeId !== employeeId &&
      assignedEmployeePin(item) === pinDraft,
    );
    if (duplicatePin) {
      setPinError("This PIN is already assigned to another employee in this store.");
      return;
    }
    const updated = employeeAssignments.map((item) =>
      item.employeeId === employeeId ? { ...item, pin: pinDraft } : item,
    );
    if (editing && merchantId && storeId) {
      const orderedForSave = [
        ...updated.filter((item) => item.employeeId === employeeId),
        ...updated.filter((item) => item.employeeId !== employeeId),
      ];
      setSaving(true);
      try {
        await saveStoreEmployees(merchantId, storeId, orderedForSave.map((item) => ({
          employeeId: item.employeeId,
          ...(item.role ? { roleTemplateId: item.role } : {}),
          ...(item.pin || item.savedPin ? { loginPin: item.pin || item.savedPin } : {}),
        })));
      } catch (failure) {
        setPinError(failure.message || "Unable to save the employee PIN.");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    setEmployeeAssignments(updated);
    setPinEditorId("");
    setPinDraft("");
    setPinError("");
  };

  const fetchActiveSubscription = async (targetMerchantId = merchantId) => {
    if (!targetMerchantId) return null;
    setSubscriptionLoading(true);
    setError("");
    try {
      const res = await getActiveSubscriptions(targetMerchantId);
      const activeSub = extractActiveSubscription(res);
      setSubscription(activeSub);
      return activeSub;
    } catch (err) {
      const msg =
        err?.message || "Failed to load active subscription for this merchant.";
      setError(msg);
      throw err;
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const validateStep = (index, draftOnly = false, subOverride = null) => {
    if (!merchantId) return "Select a merchant first.";
    if (
      loading ||
      mastersLoading ||
      merchantLoading ||
      featuresLoading ||
      subscriptionLoading
    )
      return "Wait for the merchant setup to finish loading.";
    if (loadError || merchantError || !merchantInfo)
      return (
        loadError ||
        merchantError ||
        "Merchant details are unavailable. Reload and try again."
      );
    if (imageReads.current > 0) return "Wait for the images to finish loading.";
    if (index === 0) {
      if (!store.name.trim()) return "Enter the store name.";
      if (store.name.trim().length > 150)
        return "Store name must be 150 characters or fewer.";
      if (!draftOnly && !store.storeTypeId) return "Select a store type.";
      if (
        store.storeTypeId &&
        !storeTypes.some(
          (type) =>
            String(type.id) === String(store.storeTypeId) ||
            String(type.storeTypeId) === String(store.storeTypeId) ||
            String(type.code) === String(store.storeTypeId) ||
            String(type.name).toLowerCase() ===
              String(store.storeTypeId).toLowerCase(),
        )
      )
        return "Select an available store type.";
      if (!draftOnly) {
        for (const [key, label] of [
          ["addressLine1", "address"],
          ["city", "city"],
          ["state", "state or province"],
          ["zip", "postal code"],
          ["country", "country"],
          ["timezone", "time zone"],
          ["currency", "currency"],
          ["phone", "phone number"],
          ["url", "website URL"],
        ]) {
          if (!String(store[key] || "").trim())
            return "Enter the store " + label + ".";
        }
      }
      const phoneError = validatePhoneForCountry(store.phone, store.country);
      if (phoneError) return phoneError;
      if (store.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(store.email.trim()))
        return "Enter a valid email address.";
      if (store.url) {
        try {
          const url = new URL(store.url.trim());
          if (
            !["https:", "http:"].includes(url.protocol) ||
            !url.hostname ||
            url.username ||
            url.password
          )
            return "Enter an HTTP or HTTPS website URL without embedded credentials.";
        } catch {
          return "Enter a valid website URL, including https://.";
        }
      }
      if (store.timezone) {
        try {
          new Intl.DateTimeFormat("en", { timeZone: store.timezone });
        } catch {
          return "Select a valid time zone.";
        }
      }
      if (store.currency && !/^[A-Z]{3}$/.test(store.currency))
        return "Select a valid three-letter currency code.";
      // if (!["Active","Inactive","Draft"].includes(store.status)) return "Select a valid store status.";
      for (const row of store.hours) {
        if (!["Open", "Closed"].includes(row.status))
          return "Select Open or Closed for " + row.day + ".";
        if (row.status === "Open" && (row.open || row.close)) {
          if (
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.open) ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.close) ||
            row.open === row.close
          )
            return (
              "Enter different opening and closing times for " +
              row.day +
              ". Overnight hours are supported."
            );
        }
        const shifts = Number(row.shifts);
        if (!Number.isInteger(shifts) || shifts < 0 || shifts > 100)
          return "Enter a shift count from 0 to 100 for " + row.day + ".";
      }
    }
    if (index === 1 && !draftOnly) {
      const activeSub = subOverride !== null ? subOverride : subscription;
      if (!activeSub || !Object.keys(activeSub).length)
        return "This merchant has no active subscription details. Configure its subscription before creating a store.";
      if (
        ["inactive", "expired", "cancelled", "canceled", "suspended"].includes(
          String(activeSub.status || "").toLowerCase(),
        )
      )
        return "The merchant subscription is not active.";
      const expiry = Date.parse(
        activeSub.endDate ||
          activeSub.renewalDate ||
          activeSub.current_period_end ||
          activeSub.validUntil ||
          "",
      );
      if (Number.isFinite(expiry) && expiry < Date.now())
        return "The merchant subscription has expired.";

      const subStoreLimit = Number(
        activeSub?.maxStoresAllowed ??
          activeSub?.max_stores_allowed ??
          activeSub?.storeLimit ??
          activeSub?.maxStores ??
          activeSub?.locationLimit ??
          activeSub?.licensedStoreCount ??
          activeSub?.licensed_store_count ??
          activeSub?.plan?.included_stores ??
          activeSub?.plan?.includedStores ??
          NaN,
      );
      if (
        !editing &&
        Number.isFinite(subStoreLimit) &&
        subStoreLimit >= 0 &&
        merchantStores.length >= subStoreLimit
      )
        return "This merchant has reached its store limit.";
    }
    if (
      index === 2 &&
      enabledFeatures.some(
        (name) =>
          !featureRows.some((row) => row.name === name) || !entitled(name),
      )
    )
      return "Remove features that are unavailable or not included in the merchant plan.";
    if (index === 3 && !draftOnly && !roles.length)
      return "Choose or create at least one store role.";
    if (index === 4) {
      if (pinEditorId)
        return "Save or cancel the open PIN editor before continuing.";
      for (const assignment of employeeAssignments) {
        if (
          !activeEmployees.some(
            (employee) =>
              String(employee.id ?? employee.employeeId) ===
              assignment.employeeId,
          )
        )
          return "An assigned employee is unavailable or inactive for this merchant. Remove that assignment.";
        if (!roles.includes(assignment.role))
          return "Select a valid store role for every assigned employee.";
        if (assignment.pin && !/^[1-9]\d{5}$/.test(assignment.pin))
          return "Employee PINs must be six digits and cannot start with zero.";
      }
      const storePins = employeeAssignments
        .map((assignment) => assignedEmployeePin(assignment))
        .filter(Boolean);
      if (new Set(storePins).size !== storePins.length)
        return "Each employee in this store must have a unique login PIN. Update one of the duplicate PINs.";
      if (
        new Set(employeeAssignments.map((item) => item.employeeId)).size !==
        employeeAssignments.length
      )
        return "An employee can be assigned only once.";
    }
    return "";
  };

  const goTo = async (index) => {
    if (saving || subscriptionLoading) return;
    const next = Math.max(0, Math.min(STEPS.length - 1, index));
    if (next > step) {
      let currentSub = subscription;

      if (step === 0 && next >= 1) {
        const step0Problem = validateStep(0);
        if (step0Problem) {
          setError(step0Problem);
          setStep(0);
          return;
        }

        try {
          currentSub = await fetchActiveSubscription(merchantId);
          if (!currentSub) {
            setError(
              "No active subscription found for this merchant. Please configure a subscription before proceeding.",
            );
            return;
          }
        } catch {
          return;
        }
      }

      for (let current = 0; current < next; current += 1) {
        const problem = validateStep(current, false, currentSub);
        if (problem) {
          setError(problem);
          setStep(current);
          return;
        }
      }
    }
    setError("");
    setStep(next);
  };

  const backToStores = () => {
    if (saveLock.current) return;
    const merchantReturn = routeMerchantId
      ? "/merchants?" +
        new URLSearchParams({
          view: String(routeMerchantId),
          tab: "stores",
        }).toString()
      : "/stores";
    const returnTo = location.state?.returnTo;
    const expectedStandalone = routeMerchantId
      ? "/merchants/" + encodeURIComponent(routeMerchantId) + "/stores"
      : "/stores";
    const query =
      typeof returnTo === "string" && returnTo.startsWith("/merchants?")
        ? new URLSearchParams(returnTo.slice("/merchants?".length))
        : null;
    const validMerchantReturn =
      Boolean(routeMerchantId) &&
      query?.get("view") === String(routeMerchantId) &&
      query?.get("tab") === "stores";
    navigate(
      returnTo === expectedStandalone || validMerchantReturn
        ? returnTo
        : merchantReturn,
      { replace: true },
    );
  };

  const readDataUrl = (file) =>
    new Promise((resolve) => {
      if (!file || file.startsWith?.("data:") || typeof file !== "string")
        return resolve(file || "");
      resolve(file);
    });

  async function submit(event, saveDraft = false) {
    event.preventDefault();
    if (!saveDraft && step < STEPS.length - 1) {
      goTo(step + 1);
      return;
    }
    if (saveLock.current) return;
    const steps = saveDraft ? [0, 2, 4] : [0, 1, 2, 3, 4];
    for (const index of steps) {
      const problem = validateStep(index, saveDraft);
      if (problem) {
        setError(problem);
        setStep(index);
        return;
      }
    }
    saveLock.current = true;
    setSaving(true);
    setError("");
    try {
      const generatedStoreId =
        `STR-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`.slice(
          0,
          50,
        );
      // The onboarding store API keys updates by the immutable store code in
      // the request body/path. The router parameter is the UI/database UUID.
      const storeCode =
        (editing
          ? String(store.storeCode || store.id || storeId || "")
          : String(store.storeCode || "")
        )
          .trim()
          .slice(0, 50) || generatedStoreId;
      const hours = normalizeHours(hoursRef.current).map((row) => ({
        day: row.day,
        status: row.status,
        open: row.open,
        close: row.close,
        shifts: row.shifts,
      }));
      const permissionState = Object.keys(permissionsRef.current).length
        ? permissionsRef.current
        : permissions;
      const storePayload = buildStoreSetupPayload(store, {
        merchantId,
        storeId: storeCode,
        type: String(selectedType?.storeTypeCode || selectedType?.code || store.type || typeName || "Retail").slice(0, 50),
        currency: currencyCode,
        status: saveDraft ? "PENDING" : String(store.status || "Active").toUpperCase(),
        hours,
        logo: await readDataUrl(store.logo),
        features: enabledFeatures,
        rolePermissions: roles.map(roleId => ({
          roleTemplateId: roleId,
          name: roleName(roleId),
          permissions: permissionState[roleId] || {},
        })),
      });
      const path = editing
        ? endpoints.store(encodeURIComponent(storeCode))
        : merchantId
          ? endpoints.merchantStores(merchantId)
          : endpoints.stores;
      const saved = editing
        ? await api.put(path, storePayload)
        : await api.post(path, storePayload);
      const createdStore =
        saved?.store || saved?.data?.store || saved?.data || saved;
      const persistedStoreId = editing
        ? storeId
        : createdStore?.id ||
          createdStore?.storeId ||
          createdStore?.storeID ||
          store.storeCode;
      if (merchantId && persistedStoreId && !saveDraft) {
        await storeRoleTemplatesApi.save(merchantId, persistedStoreId, roles);
      }
      if (merchantId && persistedStoreId) {
        await saveStoreEmployees(
          merchantId,
          persistedStoreId,
          employeeAssignments.map((item) => ({
            employeeId: item.employeeId,
            ...(item.role ? { roleTemplateId: item.role } : {}),
            ...(item.pin || item.savedPin ? { loginPin: item.pin || item.savedPin } : {}),
          })),
        );
      }
      if (editing) {
        // Confirm persistence from the canonical GET response before reporting
        // a successful update or leaving the edit flow.
        const verified = await api.get(
          endpoints.store(encodeURIComponent(storeCode)),
        );
        const current =
          verified?.store ||
          verified?.data?.store ||
          verified?.data ||
          verified;
        const actualName = current?.name || current?.storeName;
        if (actualName != null && String(actualName) !== storePayload.name) {
          throw new Error(
            "The store update could not be verified. The API returned a different store name.",
          );
        }
        const refreshedAddress =
          current?.address && typeof current.address === "object"
            ? current.address
            : {};
        setStore((previous) => ({
          ...previous,
          merchantId: current?.merchantId || previous.merchantId,
          id: current?.id || current?.storeId || previous.id,
          name: actualName || storePayload.name,
          type:
            current?.storeType?.storeTypeCode ||
            current?.storeTypeCode ||
            current?.type ||
            previous.type,
          phone: current?.phone ?? previous.phone,
          email: current?.email ?? previous.email,
          url: current?.url || current?.baseUrl || previous.url,
          currency: current?.currency || previous.currency,
          status: current?.status || previous.status,
          addressLine1:
            current?.addressLine1 ||
            refreshedAddress.addressLine1 ||
            refreshedAddress.street ||
            (typeof current?.address === "string"
              ? current.address
              : previous.addressLine1),
          addressLine2:
            current?.addressLine2 ||
            refreshedAddress.addressLine2 ||
            previous.addressLine2,
          city: current?.city || refreshedAddress.city || previous.city,
          state: current?.state || refreshedAddress.state || previous.state,
          zip:
            current?.zip ||
            current?.postalCode ||
            refreshedAddress.zipCode ||
            previous.zip,
          country:
            current?.country || refreshedAddress.country || previous.country,
          timezone: current?.timezone || previous.timezone,
          defaultLanguage: current?.defaultLanguage || previous.defaultLanguage,
          hours: normalizeHours(current?.hours || previous.hours),
        }));
        const refreshedFeatures = current?.features || current?.enabledFeatures;
        if (Array.isArray(refreshedFeatures))
          setEnabledFeatures(
            refreshedFeatures.map(featureName).filter(Boolean),
          );
      }
      if (editing) {
        // Confirm persistence from the canonical GET response before reporting
        // a successful update or leaving the edit flow.
        const verified = await api.get(endpoints.store(encodeURIComponent(storeCode)));
        const current = verified?.store || verified?.data?.store || verified?.data || verified;
        const actualName = current?.name || current?.storeName;
        if (actualName != null && String(actualName) !== storePayload.name) {
          throw new Error("The store update could not be verified. The API returned a different store name.");
        }
        const refreshedAddress = current?.address && typeof current.address === "object" ? current.address : {};
        setStore(previous => ({
          ...previous,
          merchantId: current?.merchantId || previous.merchantId,
          id: current?.id || current?.storeId || previous.id,
          name: actualName || storePayload.name,
          type: current?.storeType?.storeTypeCode || current?.storeTypeCode || current?.type || previous.type,
          phone: current?.phone ?? previous.phone,
          email: current?.email ?? previous.email,
          url: current?.url || current?.baseUrl || previous.url,
          currency: current?.currency || previous.currency,
          status: current?.status || previous.status,
          addressLine1: current?.addressLine1 || refreshedAddress.addressLine1 || refreshedAddress.street || (typeof current?.address === "string" ? current.address : previous.addressLine1),
          addressLine2: current?.addressLine2 || refreshedAddress.addressLine2 || previous.addressLine2,
          city: current?.city || refreshedAddress.city || previous.city,
          state: current?.state || refreshedAddress.state || previous.state,
          zip: current?.zip || current?.postalCode || refreshedAddress.zipCode || previous.zip,
          country: current?.country || refreshedAddress.country || previous.country,
          timezone: current?.timezone || previous.timezone,
          defaultLanguage: current?.defaultLanguage || previous.defaultLanguage,
          hours: normalizeHours(current?.hours || previous.hours),
        }));
        const refreshedFeatures = current?.features || current?.enabledFeatures;
        if (Array.isArray(refreshedFeatures)) setEnabledFeatures(refreshedFeatures.map(featureName).filter(Boolean));
      }
      saveLock.current = false;
      backToStores();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err?.message ||
              `Unable to ${editing ? "update" : "create"} this store.`,
      );
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  const subscriptionScreen = () => {
    const used = merchantStores.length;
    const limit = Number.isFinite(storeLimit) ? storeLimit : "Not provided";
    const validity =
      subscription?.endDate ||
      subscription?.renewalDate ||
      plan?.validUntil ||
      "Not provided";
    return (
      <>
        <div className="sf-info-banner">
          <span className="bi bi-info-circle-fill" /> Subscription and billing
          are managed on the merchant. This store uses the plan assigned to{" "}
          {merchantName}.
        </div>
        <Panel title="Selected Store" className="sf-selected-store">
          <div className="sf-store-identity">
            <span className="sf-icon-square bi bi-shop-window" />
            <div>
              <strong>{store.name || "New store"}</strong>
              <small>
                {store.storeCode || "Store code pending"} <i />{" "}
                {typeName || "Store type pending"}
              </small>
            </div>
          </div>
          <button type="button" className="sf-outline" onClick={() => goTo(0)}>
            Edit Store Details
          </button>
        </Panel>
        <Panel
          title="1. Choose Subscription Option"
          subtitle="Subscription and plan changes are managed at merchant level."
        >
          <div className="sf-sub-options">
            <div className="sf-sub-option selected">
              <span className="sf-option-icon bi bi-file-earmark-check" />
              <span>
                <strong>Use Existing Subscription</strong>
                <small>Use the plan assigned to this merchant.</small>
              </span>
              <i className="bi bi-check-circle-fill" />
            </div>
          </div>
        </Panel>
        <Panel
          title="2. Select a Plan"
          subtitle="Plan details from the selected merchant subscription."
        >
          <div className="sf-plan-table-wrap">
            <table className="sf-plan-table">
              <thead>
                <tr>
                  <th>Selected Plan</th>
                  <th>Plan Name</th>
                  <th>Billing Type</th>
                  <th>Price</th>
                  <th>Validity</th>
                  <th>Stores Used</th>
                  <th>Stores Limit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span className="sf-radio-dot" />
                  </td>
                  <td>
                    <strong>{planName}</strong>
                    <small>
                      {plan?.description || "Merchant subscription plan"}
                    </small>
                  </td>
                  <td>{billing}</td>
                  <td>
                    {planPrice == null
                      ? "—"
                      : `${subscription?.currency || currencyCode} ${planPrice}`}
                  </td>
                  <td>{validity}</td>
                  <td>{used}</td>
                  <td>{limit}</td>
                  <td>
                    <span className="sf-status-pill">
                      {subscription?.status || "Not provided"}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Plan Details">
          <div className="sf-plan-details">
            <div className="sf-plan-title">
              <span className="sf-icon-square bi bi-file-earmark-text" />
              <div>
                <strong>{planName}</strong>
                <small>{billing} billing</small>
              </div>
            </div>
            <div className="sf-plan-metrics">
              <div>
                <strong>
                  {planPrice == null
                    ? "—"
                    : `${subscription?.currency || currencyCode} ${planPrice}`}
                </strong>
                <small>Price</small>
              </div>
              <div>
                <strong>{billing}</strong>
                <small>Billing Type</small>
              </div>
              <div>
                <strong>
                  {used} / {limit}
                </strong>
                <small>Stores Used</small>
              </div>
              <div>
                <strong>
                  {Number.isFinite(storeLimit)
                    ? Math.max(0, storeLimit - used)
                    : "—"}
                </strong>
                <small>Remaining to map</small>
              </div>
              <div>
                <strong>{subscription?.status || "Not provided"}</strong>
                <small>Status</small>
              </div>
            </div>
            <div className="sf-key-features">
              <strong>Key Features</strong>
              <div>
                {includedFeatures.slice(0, 8).map((item) => (
                  <span key={item}>
                    <i className="bi bi-check-circle-fill" />
                    {item}
                  </span>
                ))}
                {!includedFeatures.length && (
                  <small>
                    Included features are not available in the merchant
                    subscription record.
                  </small>
                )}
              </div>
            </div>
          </div>
        </Panel>
        <Panel
          title="Existing stores mapped to this merchant"
          subtitle={
            Number.isFinite(storeLimit)
              ? `${Math.max(0, storeLimit - used)} remaining store${Math.max(0, storeLimit - used) === 1 ? "" : "s"} allowed to map (${used} of ${limit} used).`
              : "Store allowance was not returned with this subscription."
          }
        >
          <div className="sf-table-wrap">
            <table className="sf-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Store Name</th>
                  <th>Store Code</th>
                  <th>Store Type</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {merchantStores.map((item, index) => {
                  const cityState = [item.city || item.address?.city, item.state || item.address?.state].filter(Boolean);
                  const locationParts = [...new Map(cityState.map((value) => [String(value).trim().toLowerCase(), String(value).trim()])).values()];
                  const locationText = locationParts.length ? locationParts.join(", ") : item.address?.street || (typeof item.address === "string" ? item.address : "—");
                  return <tr key={item.storeCode || item.id || item.storeId || index}>
                    <td>{index + 1}</td>
                    <td>{item.storeName || item.name || "Unnamed store"}</td>
                    <td>{item.storeCode || item.code || "—"}</td>
                    <td>
                      {(typeof item.storeType === "string"
                        ? item.storeType
                        : item.storeType?.name) ||
                        item.type ||
                        "—"}
                    </td>
                    <td>{locationText}</td>
                    <td>{item.status || "—"}</td>
                  </tr>;
                })}
                {!used && (
                  <tr>
                    <td colSpan="6" className="sf-empty">
                      No existing stores are mapped to this merchant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </>
    );
  };

  const storeDetailsScreen = () => (
    <>
      <div className="sf-details-layout">
        <div className="sf-details-main">
          <Panel
            title="Basic Information"
            subtitle="Provide the general information for this store."
          >
            <div className="sf-form-grid sf-basic-grid">
              <div className="sf-field sf-merchant-field">
                <label htmlFor="sf-merchant">Merchant *</label>
                <select
                  id="sf-merchant"
                  required
                  value={merchantSelectValue}
                  disabled={Boolean(routeMerchantId) || editing || saving}
                  onChange={(event) => changeMerchant(event.target.value)}
                >
                  <option value="">Select merchant</option>
                  {(merchant &&
                  !merchants.some((item) =>
                    merchantMatches(item, merchantSelectValue),
                  )
                    ? [{ ...merchant, id: merchantSelectValue }, ...merchants]
                    : merchants
                  ).map((item) => (
                    <option
                      key={merchantOptionValue(item) || idOf(item)}
                      value={merchantOptionValue(item)}
                    >
                      {item.name ||
                        item.merchantName ||
                        item.businessDisplayName ||
                        idOf(item)}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="Store Name *"
                value={store.name}
                onChange={(value) => updateStore("name", value)}
                placeholder="Enter store name"
              />
              <SelectField
                label="Store Type *"
                value={store.storeTypeId}
                disabled={storeTypesLoading}
                onChange={(value) => {
                  const type = storeTypes.find(
                    (item) =>
                      String(item.id) === value ||
                      String(item.storeTypeId) === value ||
                      String(item.code) === value ||
                      String(item.name).toLowerCase() === value.toLowerCase(),
                  );
                  featureDefaultsScope.current = "";
                  setStore((current) => ({
                    ...current,
                    storeTypeId: value,
                    type: type?.name || type?.storeTypeName || value,
                  }));
                  setEnabledFeatures([]);
                  setPermissions({});
                  permissionsRef.current = {};
                  editedPermissionRoles.current = new Set();
                  setLoadError("");
                }}
                options={[
                  {
                    value: "",
                    label: storeTypesLoading
                      ? "Loading store types..."
                      : storeTypes.length === 0
                        ? "No store types available"
                        : "Select store type",
                  },
                  ...storeTypes.map((item) => ({
                    value: String(
                      item.id ??
                        item.storeTypeId ??
                        item._id ??
                        item.code ??
                        item.name,
                    ),
                    label:
                      item.name ||
                      item.storeTypeName ||
                      item.code ||
                      String(item.id),
                  })),
                ]}
              />
              <div className="sf-code-field">
                <Field
                  label="Store Code"
                  value={store.storeCode}
                  disabled
                  placeholder={
                    editing ? "Not available" : "Generated after saving"
                  }
                  aria-describedby="sf-code-help"
                />
                <small id="sf-code-help">
                  {editing
                    ? "Automatically generated and cannot be changed."
                    : "Automatically generated after saving the store."}
                </small>
              </div>
            </div>
          </Panel>
          <Panel
            title="Address Information"
            subtitle="Enter the complete address of the store."
          >
            <div className="sf-form-grid sf-address-grid">
              <Field
                label="Address Line 1 *"
                value={store.addressLine1}
                onChange={(value) => updateStore("addressLine1", value)}
                placeholder="Street address"
              />
              <Field
                label="Address Line 2"
                optional
                value={store.addressLine2}
                onChange={(value) => updateStore("addressLine2", value)}
                placeholder="Apartment, suite, etc."
              />
              <Field
                label="City *"
                value={store.city}
                onChange={(value) => updateStore("city", value)}
                placeholder="City"
              />
              <SelectField
                label="State / Province *"
                value={store.state}
                onChange={(value) => updateStore("state", value)}
                options={[
                  { value: "", label: store.country ? "Select state or province" : "Select country first" },
                  ...locationOptions.states.map((value) => ({ value, label: value })),
                ]}
              />
              <Field
                label="Zip / Postal Code *"
                value={store.zip}
                onChange={(value) => updateStore("zip", value)}
                placeholder="Postal code"
              />
              <SelectField
                label="Country *"
                value={store.country}
                onChange={changeCountry}
                options={[
                  { value: "", label: "Select country" },
                  ...locationOptions.countries.map((value) => ({
                    value,
                    label: value,
                  })),
                ]}
              />
            </div>
          </Panel>
          <Panel
            title="Operational Settings"
            subtitle="Configure time zone, currency and other settings."
          >
            <div className="sf-form-grid sf-three-cols">
              <SelectField
                label="Time Zone *"
                value={store.timezone}
                onChange={(value) => updateStore("timezone", value)}
                options={[
                  { value: "", label: "Select time zone" },
                  ...[
                    ...new Set(
                      [
                        store.timezone,
                        ...(countrySettings?.zones || []),
                      ].filter(Boolean),
                    ),
                  ].map((value) => ({
                    value,
                    label: value.replaceAll("_", " "),
                  })),
                ]}
              />
              <SelectField
                label="Currency *"
                value={currencyCode}
                onChange={(value) => updateStore("currency", value)}
                options={[
                  { value: "", label: "Select currency" },
                  ...Object.values(COUNTRIES)
                    .map((item) => item.currency)
                    .filter(
                      (value, index, array) => array.indexOf(value) === index,
                    )
                    .map((value) => ({ value, label: value })),
                ]}
              />
              <SelectField
                label="Status"
                value={store.status}
                onChange={(value) => updateStore("status", value)}
                options={["Active", "Inactive"]}
              />
            </div>
          </Panel>
          <Panel
            title="Operating Schedule"
            subtitle="Configure the opening and closing time for each day."
            action={
              <button
                type="button"
                className="sf-outline"
                onClick={copyScheduleToAll}
              >
                <i className="bi bi-copy" /> Copy to All
              </button>
            }
          >
            <div className="sf-table-wrap">
              <table className="sf-table sf-hours-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Status</th>
                    <th>Opens</th>
                    <th>Closes</th>
                    <th>Shifts</th>
                  </tr>
                </thead>
                <tbody>
                  {store.hours.map((row, index) => (
                    <tr key={row.day}>
                      <td>{row.day}</td>
                      <td>
                        <select
                          value={row.status}
                          onChange={(event) =>
                            updateHours(index, "status", event.target.value)
                          }
                        >
                          <option>Open</option>
                          <option>Closed</option>
                        </select>
                      </td>
                      <td>
                        <input
                          aria-label={`${row.day} opens`}
                          type="time"
                          value={row.open}
                          disabled={row.status === "Closed"}
                          onChange={(event) =>
                            updateHours(index, "open", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`${row.day} closes`}
                          type="time"
                          value={row.close}
                          disabled={row.status === "Closed"}
                          onChange={(event) =>
                            updateHours(index, "close", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`${row.day} shifts`}
                          type="number"
                          min="0"
                          value={row.shifts}
                          onChange={(event) =>
                            updateHours(index, "shifts", event.target.value)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
        <div className="sf-details-side">
          <Panel title="Store Logo" subtitle="Upload a logo for this store.">
            <div className="sf-upload-card">
              <div className="sf-image-preview">
                {store.logo ? (
                  <img src={store.logo} alt="Store logo preview" />
                ) : (
                  <i className="bi bi-shop-window" />
                )}
              </div>
              <label className="sf-upload-control">
                <span>Upload Logo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(event) =>
                    setLogoFile("logo", event.target.files?.[0])
                  }
                />
              </label>
              <small>
                PNG, JPG (Max 2MB)
                <br />
                Recommended size: 512 × 512
              </small>
            </div>
          </Panel>
          <Panel
            title="Contact Information"
            subtitle="Provide the primary contact details for this store."
          >
            <Field
              label="Store Phone *"
              value={store.phone}
              onChange={(value) => updateStore("phone", value)}
              type="tel"
              placeholder="Enter phone number"
            />
            <Field
              label="Store Email"
              optional
              value={store.email}
              onChange={(value) => updateStore("email", value)}
              type="email"
              placeholder="store@example.com"
            />
            <Field
              label="Website URL *"
              value={store.url}
              onChange={(value) => updateStore("url", value)}
              type="url"
              placeholder="https://example.com"
            />
          </Panel>
        </div>
      </div>
    </>
  );

  const featuresScreen = () => {
    const includedCount = featureRows.filter((row) =>
      entitled(row.name),
    ).length;
    return (
      <>
        <Panel className="sf-plan-summary">
          <div>
            <span className="sf-icon-square bi bi-shop-window" />
            <div>
              <small>Selected Plan</small>
              <strong>{planName}</strong>
              <small>{billing} billing</small>
            </div>
          </div>
          <div>
            <small>Total Features</small>
            <strong>{featureRows.length}</strong>
          </div>
          <div>
            <small>Included</small>
            <strong className="sf-green">{includedCount}</strong>
          </div>
          <div>
            <small>Not Included</small>
            <strong className="sf-amber">
              {Math.max(0, featureRows.length - includedCount)}
            </strong>
          </div>
        </Panel>
        <Panel
          title="Features"
          subtitle={readOnly ? "Features available to this store and their saved selection status." : "Select the features you want to enable for this store."}
          action={<label className="sf-select-all-label sf-panel-select-all"><input type="checkbox" disabled={readOnly || mastersLoading || !selectableFeatureNames.length} checked={allVisibleFeaturesSelected} onChange={(event) => setEnabledFeatures((current) => event.target.checked ? [...new Set([...current, ...selectableFeatureNames])] : current.filter((name) => !selectableFeatureNames.includes(name)))} />Select all eligible</label>}
        >
          <div className="sf-feature-tools">
            <div className="sf-tabs">
              {categories.map((category) => {
                const count =
                  category === "All Features"
                    ? featureRows.length
                    : featureRows.filter((row) => row.category === category)
                        .length;
                return (
                  <button
                    key={category}
                    type="button"
                    className={featureCategory === category ? "active" : ""}
                    onClick={() => setFeatureCategory(category)}
                  >
                    {category} ({count})
                  </button>
                );
              })}
            </div>
            <label className="sf-search">
              <i className="bi bi-search" />
              <input
                placeholder="Search features..."
                value={featureSearch}
                onChange={(event) => setFeatureSearch(event.target.value)}
              />
            </label>
          </div>
          <div className="sf-table-wrap">
            <table className="sf-table sf-feature-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Feature</th>
                  <th>Description</th>
                  <th>Plan Access</th>
                  <th>Enable For This Store</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeatures.map((feature, index) => {
                  const hasPlan = entitled(feature.name);
                  const checked = enabledFeatures.includes(feature.name);
                  return (
                    <tr key={feature.id || feature.name}>
                      <td>{index + 1}</td>
                      <td>{feature.name}</td>
                      <td>{feature.description || "—"}</td>
                      <td>
                        <span
                          className={
                            hasPlan
                              ? "sf-access-included"
                              : "sf-access-excluded"
                          }
                        >
                          {hasPlan ? "Included" : "Not included"}
                        </span>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Enable ${feature.name} for this store`}
                          checked={checked}
                          disabled={readOnly || !hasPlan || mastersLoading}
                          onChange={() => toggleFeature(feature.name)}
                        />
                      </td>
                    </tr>
                  );
                })}
                {!filteredFeatures.length && (
                  <tr>
                    <td colSpan="5" className="sf-empty">
                      No features match this search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </>
    );
  };

  const rolesScreen = () => {
    const active = roles.includes(activeRole) ? activeRole : roles[0] || "";
    const activeName = roleName(active) || "Selected Role";
    const matrixRows = roleFeatureRows[active]?.length
      ? roleFeatureRows[active]
      : featureRows
          .filter((feature) => enabledFeatures.includes(feature.name))
          .map((feature) => ({
            name: feature.name,
            id: feature.id || feature.name,
          }));
    const availability = permissionAvailability[active] || {};
    return (
      <>
        <Panel
          title="Role Templates"
          subtitle={readOnly ? "Role templates assigned to this store." : "Choose from merchant-selected role templates for this store."}
          action={<label className="sf-select-all-label sf-panel-select-all"><input type="checkbox" disabled={readOnly || !selectableRoleDefinitions.length || storeTypeRolesLoading} checked={selectableRoleDefinitions.length > 0 && selectableRoleDefinitions.every((role) => roleIsSelected(role))} onChange={(event) => {
            const ids = selectableRoleDefinitions.map((role) => role.id);
            const next = event.target.checked ? [...new Set([...roles, ...ids])] : roles.filter((roleId) => !ids.includes(roleId));
            setRoles(next);
            setActiveRole((current) => next.includes(current) ? current : next[0] || "");
          }} />Select all roles</label>}
        >
          {rolesError && (
            <p className="sf-empty" role="alert">
              {rolesError}
            </p>
          )}
          {(rolesLoading || merchantLoading) && (
            <p className="sf-empty">Loading merchant role templates…</p>
          )}
          {!rolesLoading && !roleDefinitions.length && (
            <p className="sf-empty">
              No role templates are selected on this merchant. Save roles on the
              merchant Roles tab first.
            </p>
          )}
          {!rolesLoading && roleDefinitions.length > 0 && !selectableRoleDefinitions.length && !storeTypeRolesLoading && (
            <p className="sf-empty">No merchant roles are mapped to this store type yet.</p>
          )}
          <div className="sf-template-grid">
            {selectableRoleDefinitions.map((role, index) => (
              <label
                className={`sf-template ${roleIsSelected(role) ? "selected" : ""}`}
                key={role.id}
              >
                <input
                  type="checkbox" disabled={readOnly}
                  checked={roleIsSelected(role)}
                  onChange={() => toggleRole(role.id)}
                />
                <span className={`sf-template-icon icon-${index % 5}`}>
                  <i className="bi bi-person-badge" />
                </span>
                <span>
                  <strong>{role.name}</strong>
                  <small>
                    {role.description ||
                      role.roleCode ||
                      "Merchant role template"}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </Panel>
        <div className="sf-permissions-layout">
          <Panel
            title="Roles for This Store"
            subtitle={readOnly ? "Select a role to view its saved permissions." : "Configure permissions for each selected role."}
          >
            <div className="sf-role-list">
              {roles.map((roleId) => (
                <button
                  type="button"
                  key={roleId}
                  className={active === roleId ? "active" : ""}
                  onClick={() => setActiveRole(roleId)}
                >
                  <i className="bi bi-grip-vertical" />
                  <span>{roleName(roleId)}</span>
                  <small>{roleById[roleId]?.level || "Custom"}</small>
                  <i
                    className="bi bi-trash3"
                    onClick={(event) => {
                      event.stopPropagation();
                      setRoles((current) =>
                        current.filter((item) => item !== roleId),
                      );
                      setActiveRole((current) =>
                        current === roleId
                          ? roles.find((item) => item !== roleId) || ""
                          : current,
                      );
                    }}
                  />
                </button>
              ))}
              {!roles.length && (
                <p className="sf-empty">Select a merchant role above.</p>
              )}
            </div>
          </Panel>
          <Panel
            title={`Permissions for ${activeName}`}
            subtitle={readOnly ? "Saved access for the selected role." : "Set what this role can view, create, edit or delete."}
            action={
              <div className="sf-copy-permissions">
                <label className="sf-select-all-label">
                  <input type="checkbox" disabled={readOnly || !active || !matrixRows.length} checked={Boolean(active && matrixRows.length && matrixRows.every((item) => STANDARD_ACTIONS.every((action) => Boolean(permissions[active]?.[item.name]?.[action]))))} onChange={(event) => {
                    if (!active) return;
                    const checked = event.target.checked;
                    setPermissions((current) => {
                      const rolePermissions = { ...(current[active] || {}) };
                      matrixRows.forEach((item) => { rolePermissions[item.name] = { ...(rolePermissions[item.name] || {}), ...Object.fromEntries(STANDARD_ACTIONS.map((action) => [action, checked])) }; });
                      const next = { ...current, [active]: rolePermissions };
                      permissionsRef.current = next;
                      editedPermissionRoles.current.add(active);
                      return next;
                    });
                  }} />
                  Select all permissions
                </label>
                <label>
                  Copy from
                  <select
                    value={copyFromRole}
                    onChange={(event) => setCopyFromRole(event.target.value)}
                  >
                    <option value="">Select a role</option>
                    {roles
                      .filter((roleId) => roleId !== active)
                      .map((roleId) => (
                        <option key={roleId} value={roleId}>
                          {roleName(roleId)}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="sf-outline"
                  disabled={readOnly || !active || !copyFromRole}
                  onClick={() => {
                    setPermissions((current) => ({
                      ...current,
                      [active]: { ...(current[copyFromRole] || {}) },
                    }));
                    setPermissionAvailability((current) => ({
                      ...current,
                      [active]: { ...(current[copyFromRole] || {}) },
                    }));
                    setRoleFeatureRows((current) => ({
                      ...current,
                      [active]: [...(current[copyFromRole] || [])],
                    }));
                  }}
                >
                  Apply
                </button>
              </div>
            }
          >
            {permissionsLoading && active && (
              <p className="sf-empty">Loading permissions for {activeName}…</p>
            )}
            {active && !permissionsLoading && (
              <div className="sf-table-wrap">
                <table className="sf-table sf-permission-table">
                  <thead>
                    <tr>
                      <th>Module / Feature</th>
                      {STANDARD_ACTIONS.map((action) => (
                        <th key={action}>{action}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRows.map((item) => {
                      const name = item.name;
                      const values = permissions[active]?.[name] || {};
                      const available = availability[name] || {};
                      return (
                        <tr key={item.id || name}>
                          <td>
                            <i className="bi bi-grid-3x3-gap" /> {name}
                          </td>
                          {STANDARD_ACTIONS.map((action) => (
                            <td key={action}>
                              <input
                                type="checkbox" disabled={readOnly}
                                checked={Boolean(values[action])}
                                onChange={() =>
                                  togglePermission(active, name, action)
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    {!matrixRows.length && (
                      <tr>
                        <td
                          colSpan={STANDARD_ACTIONS.length + 1}
                          className="sf-empty"
                        >
                          Enable store features first, or this role template has
                          no feature permissions.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {!active && (
              <p className="sf-empty">
                Select a role to configure permissions.
              </p>
            )}
          </Panel>
        </div>
      </>
    );
  };

  const employeesScreen = () => {
    const assigned = employeeAssignments.length;
    const pinOwners = new Map();
    employeeAssignments.forEach((assignment) => {
      const pin = assignedEmployeePin(assignment);
      if (pin) pinOwners.set(pin, [...(pinOwners.get(pin) || []), assignment.employeeId]);
    });
    const duplicatePinNames = [...pinOwners.values()]
      .filter((employeeIds) => employeeIds.length > 1)
      .flatMap((employeeIds) => employeeIds.map((employeeId) => {
        const employee = employees.find((item) => String(item.id ?? item.employeeId ?? "") === employeeId);
        return employee?.name || [employee?.firstName, employee?.lastName].filter(Boolean).join(" ") || employeeId;
      }));
    return (
      <>
        <Panel className="sf-employee-summary">
          <div>
            <small>Selected Merchant</small>
            <strong>
              <span className="sf-avatar">{initials(merchantName)}</span>
              {merchantName}
            </strong>
            <small>
              {merchantCode || "Merchant code unavailable"} &nbsp;|&nbsp; {typeName || "Merchant"}
            </small>
          </div>
          <div>
            <small>Total Employees</small>
            <strong>{employees.length}</strong>
          </div>
          <div>
            <small>Already Assigned</small>
            <strong>{assigned}</strong>
          </div>
          <div>
            <small>Available to Assign</small>
            <strong className="sf-green">
              {Math.max(0, activeEmployees.length - assigned)}
            </strong>
          </div>
        </Panel>
        <Panel
          title="Assign employees to this store"
        >
          <div className="sf-employee-tools">
            <label className="sf-select-all-employees">
              <input
                type="checkbox"
                checked={allActiveEmployeesSelected}
                disabled={readOnly || activeEmployees.length === 0}
                onChange={(event) =>
                  setAllEmployeesSelected(event.target.checked)
                }
              />
              <span>Select all active employees</span>
            </label>
            <label className="sf-search">
              <i className="bi bi-search" />
              <input
                placeholder="Search employees..."
                value={employeeSearch}
                onChange={(event) => {
                  setEmployeeSearch(event.target.value);
                  setEmployeePage(1);
                }}
              />
            </label>
            <SelectField
              label="Filter"
              value={employeeFilter}
              onChange={(value) => {
                setEmployeeFilter(value);
                setEmployeePage(1);
              }}
              options={["All", "Assigned", "Available"]}
            />
          </div>
          {duplicatePinNames.length > 0 && (
            <div className="alert alert-danger" role="alert">
              Duplicate login PINs are assigned to {duplicatePinNames.join(", ")}. Change one PIN for this store before continuing.
            </div>
          )}
          <div className="sf-table-wrap">
            <table className="sf-table sf-employees-table">
              <thead>
                <tr>
                  <th>
                    <span className="sr-only">Select</span>
                  </th>
                  <th>#</th>
                  <th>Employee Name</th>
                  <th>Employee ID</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Store Role</th>
                  <th>Login PIN</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pagedEmployees.map((employee, index) => {
                  const employeeId = String(
                    employee.id ?? employee.employeeId ?? "",
                  );
                  const assignment = employeeAssignments.find(
                    (item) => item.employeeId === employeeId,
                  );
                  const isAssigned = Boolean(assignment);
                  const editingPin = pinEditorId === employeeId;
                  const employeePin = employee.loginPin || employee.employeeLoginPin || employee.login_pin || employee.pin || "";
                  const visiblePin = assignment?.pin || assignment?.savedPin || employeePin;
                  const hasLoginPin = Boolean(visiblePin || assignment?.pinSet || employee.pinSet);
                  return (
                    <tr key={employeeId}>
                      <td>
                        <input
                          type="checkbox" disabled={readOnly}
                          checked={isAssigned}
                          onChange={(event) =>
                            setEmployeeSelected(employee, event.target.checked)
                          }
                          aria-label={`Assign ${employee.name}`}
                        />
                      </td>
                      <td>{(employeePage - 1) * pageSize + index + 1}</td>
                      <td>
                        {employee.name ||
                          `${employee.firstName || ""} ${employee.lastName || ""}`.trim()}
                      </td>
                      <td>{employee.employeeCode || employeeId}</td>
                      <td>{employee.phone || "—"}</td>
                      <td>{employee.email || "—"}</td>
                      <td>
                        <select
                          value={assignment?.role || ""}
                          disabled={readOnly || !isAssigned}
                          onChange={(event) =>
                            setEmployeeRole(employeeId, event.target.value)
                          }
                        >
                          <option value="">{isAssigned ? "Select role" : "Select employee first"}</option>
                          {roles.map((roleId) => (
                            <option key={roleId} value={roleId}>
                              {roleName(roleId)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="sf-pin-cell">
                        {editingPin ? (
                          <div className="sf-pin-editor">
                            <input
                              autoFocus
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              maxLength={6}
                              aria-label={`Six-digit login PIN for ${employee.name}`}
                              placeholder="6-digit PIN"
                              value={pinDraft}
                              onChange={(event) => {
                                setPinDraft(
                                  event.target.value
                                    .replace(/\D/g, "")
                                    .slice(0, 6),
                                );
                                setPinError("");
                              }}
                            />
                            <div>
                              <button
                                type="button"
                                className="sf-pin-save"
                                onClick={() => saveEmployeePin(employeeId)}
                              >
                                {saving ? "Saving…" : "Save PIN"}
                              </button>
                              <button
                                type="button"
                                className="sf-pin-cancel"
                                onClick={() => {
                                  setPinEditorId("");
                                  setPinDraft("");
                                  setPinError("");
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                            {pinError && <small role="alert">{pinError}</small>}
                          </div>
                        ) : (
                          <div className="sf-pin-action">
                            {hasLoginPin && (
                              <span className="sf-pin-set" title={!visiblePin ? "PIN is stored securely and is not returned by the API." : undefined}>
                                {visiblePin || "PIN set"}
                              </span>
                            )}
                            <button
                              type="button"
                              className="sf-link"
                              disabled={readOnly}
                              onClick={() => openPinEditor(employee)}
                            >
                              {hasLoginPin
                                ? "Change PIN"
                                : "Assign PIN"}
                            </button>
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className={
                            isAssigned
                              ? "sf-status-assigned"
                              : "sf-status-available"
                          }
                        >
                          {isAssigned ? "Assigned" : "Available"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!pagedEmployees.length && (
                  <tr>
                    <td colSpan="9" className="sf-empty">
                      {employees.length
                        ? "No active employees match this search."
                        : "No employees were returned for this merchant."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="sf-pagination">
            <span>
              Showing{" "}
              {employeeRows.length ? (employeePage - 1) * pageSize + 1 : 0}–
              {Math.min(employeePage * pageSize, employeeRows.length)} of{" "}
              {employeeRows.length} employees
            </span>
            <div>
              <button
                type="button"
                disabled={employeePage <= 1}
                onClick={() => setEmployeePage((page) => Math.max(1, page - 1))}
              >
                ‹
              </button>
              {Array.from({ length: pageCount }, (_, index) => index + 1)
                .slice(0, 5)
                .map((page) => (
                  <button
                    type="button"
                    key={page}
                    className={employeePage === page ? "active" : ""}
                    onClick={() => setEmployeePage(page)}
                  >
                    {page}
                  </button>
                ))}
              <button
                type="button"
                disabled={employeePage >= pageCount}
                onClick={() =>
                  setEmployeePage((page) => Math.min(pageCount, page + 1))
                }
              >
                ›
              </button>
            </div>
          </div>
        </Panel>
      </>
    );
  };

  const reviewScreen = () => (
    <>
      <div className="sf-review-grid">
        <Panel
          title={
            <>
              <i className="bi bi-person-vcard" /> Merchant & Subscription
            </>
          }
          action={
            <button className="sf-link" type="button" onClick={() => goTo(1)}>
              ✎ Edit
            </button>
          }
        >
          <Detail label="Merchant">{merchantName}</Detail>
          <Detail label="Subscription Plan">{planName}</Detail>
          <Detail label="Plan Billing">{billing}</Detail>
          <Detail label="Store Entitlement">
            {merchantStores.length} /{" "}
            {Number.isFinite(storeLimit) ? storeLimit : "Unlimited"} stores used
            {Number.isFinite(storeLimit)
              ? `, ${Math.max(0, storeLimit - merchantStores.length)} remaining`
              : ""}
          </Detail>
        </Panel>
        <Panel
          title={
            <>
              <i className="bi bi-shop" /> Store Details
            </>
          }
          action={
            <button className="sf-link" type="button" onClick={() => goTo(0)}>
              ✎ Edit
            </button>
          }
        >
          <Detail label="Store Name">{store.name}</Detail>
          <Detail label="Store Code">
            {store.storeCode || (editing ? "—" : "Generated after saving")}
          </Detail>
          <Detail label="Address">
            {[
              store.addressLine1,
              store.addressLine2,
              store.city,
              store.state,
              store.zip,
            ]
              .filter(Boolean)
              .join(", ")}
          </Detail>
          <Detail label="Country / State">
            {[store.country, store.state].filter(Boolean).join(" / ")}
          </Detail>
          <Detail label="Time Zone">{store.timezone}</Detail>
          <Detail label="Currency">{currencyCode}</Detail>
          <Detail label="Status">{store.status}</Detail>
        </Panel>
        <Panel
          title={
            <>
              <i className="bi bi-grid" /> Features ({enabledCount} enabled)
            </>
          }
          action={
            <button className="sf-link" type="button" onClick={() => goTo(2)}>
              ✎ Edit
            </button>
          }
        >
          <div className="sf-review-feature-list">
            {featureRows.map((feature) => (
              <span
                className={
                  enabledFeatures.includes(feature.name)
                    ? "enabled"
                    : "disabled"
                }
                key={feature.name}
              >
                <i
                  className={`bi ${enabledFeatures.includes(feature.name) ? "bi-check-circle-fill" : "bi-dash-circle-fill"}`}
                />
                {feature.name}
              </span>
            ))}
          </div>
        </Panel>
        <Panel
          title={
            <>
              <i className="bi bi-shield-lock" /> Roles & Permissions (
              {roles.length} roles)
            </>
          }
          action={
            <button className="sf-link" type="button" onClick={() => goTo(3)}>
              ✎ Edit
            </button>
          }
        >
          <div className="sf-table-wrap">
            <table className="sf-table sf-review-table">
              <thead>
                <tr>
                  <th>Role Name</th>
                  <th>Access Level</th>
                  <th>No. Of Permissions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((roleId) => (
                  <tr key={roleId}>
                    <td>{roleName(roleId)}</td>
                    <td>{roleById[roleId]?.level || "Custom"}</td>
                    <td>{permissionCount(roleId)}</td>
                  </tr>
                ))}
                {!roles.length && (
                  <tr>
                    <td colSpan="3">No roles selected</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel
          title={
            <>
              <i className="bi bi-people" /> Employees (
              {employeeAssignments.length} assigned)
            </>
          }
          action={
            <button className="sf-link" type="button" onClick={() => goTo(4)}>
              ✎ Edit
            </button>
          }
        >
          <div className="sf-table-wrap">
            <table className="sf-table sf-review-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Employee Name</th>
                  <th>Employee ID</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {employeeAssignments.map((item, index) => {
                  const employee = employees.find(
                    (row) =>
                      String(row.id ?? row.employeeId) === item.employeeId,
                  );
                  return (
                    <tr key={item.employeeId}>
                      <td>{index + 1}</td>
                      <td>{employee?.name || "Employee"}</td>
                      <td>{employee?.employeeCode || item.employeeId}</td>
                      <td>{roleName(item.role) || item.role}</td>
                    </tr>
                  );
                })}
                {!employeeAssignments.length && (
                  <tr>
                    <td colSpan="4">No employees assigned</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel
          title={
            <>
              <i className="bi bi-link-45deg" /> Store Base URL & Contact
            </>
          }
          action={
            <button className="sf-link" type="button" onClick={() => goTo(0)}>
              ✎ Edit
            </button>
          }
        >
          <Detail label="Store Base URL">{store.url}</Detail>
          <Detail label="Store Phone">{store.phone}</Detail>
          <Detail label="Store Email">{store.email}</Detail>
        </Panel>
      </div>
      <div className="sf-info-banner">
        <i className="bi bi-info-circle-fill" /> Once the store is created, you
        can manage these settings from the Store Details page.
      </div>
    </>
  );

  const screens = [
    storeDetailsScreen,
    subscriptionScreen,
    featuresScreen,
    rolesScreen,
    employeesScreen,
    reviewScreen,
  ];
  async function saveSection(event) {
    event.preventDefault();
    if (readOnly || saveLock.current) return;
    const problem = validateStep(step);
    if (problem) { setError(problem); return; }
    saveLock.current = true; setSaving(true); setError("");
    try {
      if (step === 4) {
        await saveStoreEmployees(merchantId, storeId, employeeAssignments.map(item => ({employeeId:item.employeeId,...(item.role ? {roleTemplateId:item.role} : {}),...(item.pin || item.savedPin ? {loginPin:item.pin || item.savedPin} : {})})));
      } else {
        const response = await api.get(endpoints.store(encodeURIComponent(storeId)));
        const saved = response?.store || response?.data?.store || response?.data || response;
        const code = store.storeCode || store.id || storeId;
        const changes = step === 2 ? {features:enabledFeatures} : {rolePermissions:roles.map(roleId => ({roleTemplateId:roleId,name:roleName(roleId),permissions:permissionsRef.current[roleId] || {}}))};
        const payload = buildStoreSetupPayload(saved, {merchantId, storeId:code, ...changes});
        await api.put(endpoints.store(encodeURIComponent(code)), payload);
        if (step === 3) await storeRoleTemplatesApi.save(merchantId,storeId,roles);
      }
      onDone?.();
    } catch (err) { setError(err.message || "Unable to save changes."); }
    finally { saveLock.current = false; setSaving(false); }
  }
  if (loading) return <div className="sf-loading">Loading store setup…</div>;
  if (embeddedStep !== null) {
    const pending = saving || mastersLoading || merchantLoading || featuresLoading || subscriptionLoading || rolesLoading || storeTypeRolesLoading || permissionsLoading;
    const failure = loadError || merchantError || rolesError;
    return <div className={"sf-root store-section-editor" + (readOnly ? " store-section-readonly" : "")}>
      <div className="store-panel-heading"><div><h2>{STEPS[step]}</h2><p>{readOnly ? "View saved store information." : STEP_HINTS[step]}</p></div>{readOnly && onEdit && <button type="button" className="store-config-btn" onClick={onEdit}><i className="bi bi-pencil" aria-hidden="true" /> Edit</button>}</div>
      {(error || failure) && <div className="alert alert-danger" role="alert">{error || failure}<button type="button" onClick={() => setReload(v => v + 1)}>Retry</button></div>}
      {pending && <p role="status">Loading store selections…</p>}
      <form onSubmit={saveSection}><fieldset disabled={pending || Boolean(failure) || (readOnly && step < 2)} style={{border:0,padding:0,minWidth:0}}>{screens[step]()} {!readOnly && <div className="sf-footer"><button type="button" className="sf-outline" onClick={onDone}>Cancel</button><button type="submit" className="sf-primary">{saving ? "Saving…" : "Save Changes"}</button></div>}</fieldset></form>
    </div>;
  }

  return (
    <div className="sf-root">
      <header className="sf-topbar">
        <button type="button" className="sf-back-link" onClick={backToStores}>
          <i className="bi bi-arrow-left" /> Stores
        </button>
        <span>/</span>
        <strong>{editing ? "Edit store" : "Add store"}</strong>
        <span className="sf-topbar-spacer" />
      
      </header>
      <div className="sf-shell">
        <aside className="sf-sidebar">
          <div className="sf-sidebar-caption">PROVISION A STORE</div>
          <nav>
            {STEPS.map((name, index) => (
              <button
                type="button"
                key={name}
                className={
                  step === index ? "active" : step > index ? "complete" : ""
                }
                onClick={() => goTo(index)}
              >
                <span className="sf-step-number">
                  {step > index ? <i className="bi bi-check-lg" /> : index + 1}
                </span>
                <span>
                  <strong>{name}</strong>
                  <small>{STEP_HINTS[index]}</small>
                </span>
              </button>
            ))}
          </nav>
          <div className="sf-sidebar-foot">
            Store setup · {step + 1} of {STEPS.length}
          </div>
        </aside>
        <main className="sf-main">
          <div className="sf-heading-row">
            <div>
              <div className="sf-eyebrow">
                STEP {step + 1} OF {STEPS.length}
              </div>
              <h1>{STEPS[step]}</h1>
              <p>
                {step === 0
                  ? "Enter the basic information and settings for this store. You can save and continue later."
                  : step === 5
                    ? "Review all the information below and create the store. You can go back to any step to make changes."
                    : STEP_HINTS[step]}
              </p>
            </div>
            {step === 3 && (
              <div className="sf-role-context">
                <span className="sf-icon-square bi bi-shop" />
                <div>
                  <small>Selected Store</small>
                  <strong>{store.name || "New Store"}</strong>
                  <small>
                    {typeName || "Store type"} | {planName}
                  </small>
                </div>
              </div>
            )}
          </div>
          {error && (
            <div className="sf-error" role="alert">
              {error}
              <button type="button" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {(loadError || merchantError) && (
            <div className="sf-error" role="alert">
              {loadError || merchantError}
              <button
                type="button"
                onClick={() => setReload((value) => value + 1)}
              >
                Retry
              </button>
            </div>
          )}
          {(mastersLoading ||
            merchantLoading ||
            featuresLoading ||
            subscriptionLoading) && (
            <div className="sf-loading-note" role="status">
              {subscriptionLoading
                ? "Fetching active subscription…"
                : "Loading merchant setup…"}
            </div>
          )}
          <form onSubmit={submit} noValidate>
            <fieldset
              disabled={
                saving ||
                mastersLoading ||
                merchantLoading ||
                featuresLoading ||
                subscriptionLoading
              }
              style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            >
              <div className="sf-screen">{screens[step]()}</div>
              <div className="sf-footer">
  <div className="sf-footer-right">
    <button
      type="button"
      className="sf-outline"
      disabled={saving || subscriptionLoading}
      onClick={() => {
        if (step > 0) {
          goTo(step - 1);
        } else {
          backToStores();
        }
      }}
    >
      Back
    </button>

    {step < STEPS.length - 1 ? (
      <button
        type="button"
        className="sf-primary"
        disabled={saving || subscriptionLoading}
        onClick={(event) => {
          event.preventDefault();
          goTo(step + 1);
        }}
      >
        {step === 0 && subscriptionLoading
          ? "Checking Subscription…"
          : "Save & Continue"}
      </button>
    ) : (
      <button
        type="submit"
        className="sf-primary"
        disabled={saving || subscriptionLoading}
      >
        <i className="bi bi-shop" />{" "}
        {saving
          ? "Creating…"
          : editing
            ? "Save Changes"
            : "Create Store"}
      </button>
    )}
  </div>
</div>
            </fieldset>
          </form>
        </main>
      </div>
    </div>
  );
}
