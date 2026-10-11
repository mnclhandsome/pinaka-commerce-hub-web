export const endpoints = {
  login: "/auth/login",
  refresh: "/auth/refresh",
  logout: "/auth/logout",
  me: "/auth/me",

  merchants: "/merchants",
  createMerchant: "/merchants/create-merchant",
  merchant: (id) => `/merchants/${id}`,

  stores: "/stores",
  store: (id) => `/stores/${id}`,
  storeCurrencyTax: (storeId) =>
    `/stores/${encodeURIComponent(storeId)}/pos/currency-tax`,
  storeServiceCharges: (storeId) =>
    `/stores/${encodeURIComponent(storeId)}/pos/service-charges`,
  storeCashback: (storeId) =>
    `/stores/${encodeURIComponent(storeId)}/pos/cashback`,
  storeOpeningBalance: (storeId) =>
    `/stores/${encodeURIComponent(storeId)}/pos/opening-balance`,
  storeCashDenominations: (storeId) =>
    `/stores/${encodeURIComponent(storeId)}/pos/cash-denominations`,
  storeCashRegisters: (storeId) =>
    `/stores/${encodeURIComponent(storeId)}/pos/cash-registers`,
  storeSafeDrop: (storeId) =>
    `/stores/${encodeURIComponent(storeId)}/pos/safe-drop`,
  storeCardPayments: (storeId) =>
    `/stores/${encodeURIComponent(storeId)}/pos/card-payments`,
  storeTerminalMappings: (storeId) =>
    `/stores/${encodeURIComponent(storeId)}/pos/terminal-mappings`,
  storePosConfiguration: "/store/store-pos-configuration",
  storePosConfigurationItem: (storeId, configurationName) =>
    `/store/store-pos-configuration/${encodeURIComponent(storeId)}/${encodeURIComponent(configurationName)}`,
  storePosConfigurations: (storeId) =>
    `/store/store-pos-configuration/${encodeURIComponent(storeId)}`,

  // Merchant Employees (Connector API)
  employees: "/employees",
  employee: (id) => `/employees/${encodeURIComponent(id)}`,
  merchantEmployees: (merchantId, status = "") =>
    `/connector/api/v1/merchants/${encodeURIComponent(merchantId)}/employees${
      status ? `?status=${encodeURIComponent(status)}` : ""
    }`,
  merchantEmployee: (merchantId, employeeId) =>
    `/merchants/${encodeURIComponent(merchantId)}/employees/${encodeURIComponent(employeeId)}`,
  employeeProfileImage: (employeeId) =>
    `/merchants/employees/${encodeURIComponent(employeeId)}/profile-image`,

  // Subscriptions (Connector API)
  merchantActiveSubscriptions: (merchantId) =>
    `/connector/api/v1/merchants/subscriptions/active?merchantId=${encodeURIComponent(merchantId)}`,

  // Store Types & Features
  storeTypes: "/store-types",
  storeType: (id) => `/store-types/${encodeURIComponent(id)}`,
  storeTypeFeatures: (id) => `/store-types/${encodeURIComponent(id)}/features`,
  storeTypeFeature: (storeTypeId, featureId) =>
    `/store-types/${encodeURIComponent(storeTypeId)}/features/${encodeURIComponent(featureId)}`,
  storeConnector: (id) => `/stores/${id}/connector`,
  merchantStores: (merchantId) => `/merchants/${merchantId}/stores`,
  storeEmployees: (merchantId, storeId) =>
    `/merchants/${encodeURIComponent(merchantId)}/stores/${encodeURIComponent(storeId)}/employees`,
  storeRolePermissions: (merchantId, storeId) =>
    `/merchants/${encodeURIComponent(merchantId)}/stores/${encodeURIComponent(storeId)}/role-permissions`,

  features: "/features",
  feature: (id) => `/features/${id}`,
  permissions: "/permissions",
  permission: (id) => `/permissions/${id}`,
  plans: "/plans",
  plansMerchantForm: "/plans/merchant-form",
  plan: (id) => `/plans/${encodeURIComponent(id)}`,
  planStatus: (id) => `/plans/${encodeURIComponent(id)}`,
  tendors: "/tendors",
  tendor: (id) => `/tendors/${id}`,
  devices: "/devices",
  device: (id) => `/devices/${encodeURIComponent(id)}`,
  merchantDevices: (merchantId) => `/devices/merchant/${encodeURIComponent(merchantId)}`,
  availableDevices: "/devices/available",
  storeDeviceMappings: "/store-device-mappings",
  storeVendorMappings: "/store-vendor-mappings",
  // merchant tendors
  merchantTendors: (merchantId) =>
    `/merchants/${encodeURIComponent(merchantId)}/tendors`,

  merchantTendor: (merchantId, tendorId) =>
    `/merchants/${encodeURIComponent(merchantId)}/tendors/${encodeURIComponent(tendorId)}`,

  orders: (storeId) =>
    `/orders${storeId ? `?storeId=${encodeURIComponent(storeId)}` : ""}`,
  order: (id) => `/orders/${encodeURIComponent(id)}`,
};
