function merchantTimestamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return <span className="merchant-timestamp">
    <span>{date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
    <small>{date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}</small>
  </span>;
}
import MerchantTenders from "./MerchantTenders";
import MerchantVendors from "./MerchantVendors";
import MerchantStores from "./MerchantStores";
import MerchantRoles from "./MerchantRoles";
import AddMerchantDevice from "./AddMerchantDevice";
import EditEmployee from "./EditEmployee";
import { MerchantEmployeeForm } from "./AddMerchantEmployee";
import { formatDate, listSubscriptions } from "../api/subscriptions";
import { listPlans } from "../api/plans";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listMerchants, getMerchant, updateMerchantStatus } from "../api/merchants";
import { EmployeeToast, EmployeeDeleteDialog } from "../components/EmployeeFeedback";
import { listMerchantEmployees, getEmployee, deleteEmployee } from "../api/employees";
import { api, ApiError, pendingStoreRead } from "../api/http";
import { devicesApi } from "../api/devices";
import { storeListFromResponse, normalizeStore } from "../api/stores";
import { getStoreDeviceMappings } from "../api/storeDeviceMappings";
import Pagination from "../components/Pagination";
import ListActions from "../components/ListActions";
import FiltersBar from "../components/FiltersBar";
import DeleteConfirmationDialog from "../components/DeleteConfirmationDialog";
import "../styles/merchants.css";
import "../styles/merchant-details.css";
import "../styles/global.css";

function readValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return typeof value === 'object' ? (value.name || value.label || '—') : String(value);
}
function ViewSection({ title, children, actions }) {
  return <section className="merchant-view-section">{actions ? <div className="merchant-section-heading"><h2>{title}</h2>{actions}</div> : <h2>{title}</h2>}{children}</section>;
}
function ViewFields({ items }) {
  return <dl className="merchant-view-fields">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{readValue(value)}</dd></div>)}</dl>;
}
function ViewTable({ headings, rows }) {
  return rows.length ? <div className="table-wrapper"><table className="merchant-table"><thead><tr>{headings.map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{readValue(cell)}</td>)}</tr>)}</tbody></table></div> : <p className="merchant-view-empty">No records provided.</p>;
}
function MerchantReadOnly({ merchantId, merchant, onBack, onSaveEmployee, onSaveDevice, masterVendors, vendorAssignments, onSaveVendorAssignments, vendorsLoading, vendorsError, masterTenders, tenderAssignments, onSaveTenderAssignments, tendersLoading, tendersError }) {
 const [editingEmployee, setEditingEmployee] = useState(null);
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [editingEmployeeLoading, setEditingEmployeeLoading] = useState(false);
  const [createdEmployees, setCreatedEmployees] = useState([]);
  async function saveEmployeeAndRefresh(values) {
    if(typeof onSaveEmployee !== 'function') throw new Error('Connect onSaveEmployee to your employee creation API.');
    const result=await onSaveEmployee(values);
    if(result?.success===false)throw new Error(result.message || 'Employee creation failed.');
    const record=result?.employee || result?.data?.employee || result?.data || result;
    // Retain the requested login PIN for the merchant employee details view,
    // while keeping passwords and temporary photo URLs out of the list.
    const source=record && typeof record==='object' && !Array.isArray(record) ? record : {};
    const employee={id:source.id || source.employeeId || source.employeeCode || crypto.randomUUID(), employeeCode:source.employeeCode || '', merchantId:apiMerchantId,
      name:source.name || source.employeeName || [values.firstName,values.lastName].filter(Boolean).join(' '),
      email:source.email || values.email,phone:source.phone || source.phoneNumber || values.phone,
      gender:source.gender || values.gender,username:source.username || values.username,
      loginPin:source.loginPin || source.login_pin || source.employeeLoginPin || values.employeeLoginPin || '',
      status:source.status || 'Not provided',createdAt:source.createdAt || new Date().toISOString()};
    setCreatedEmployees(old=>[employee,...old.filter(item=>String(item.id)!==String(employee.id))]);
    setApiEmployees(old=>[employee,...(Array.isArray(old)?old:[]).filter(item=>String(item.id || item.employeeId)!==String(employee.id))]);
    return result;
  }
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [merchantToDelete, setMerchantToDelete] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [addingDevice, setAddingDevice] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [deviceToDelete, setDeviceToDelete] = useState(null);
  const [deviceDeleteBusy, setDeviceDeleteBusy] = useState(false);
  const [deviceDeleteError, setDeviceDeleteError] = useState("");
  const [createdDevices,setCreatedDevices]=useState([]);
  const [apiDevices, setApiDevices] = useState([]);
  const [apiStores, setApiStores] = useState([]);
  const [apiStoreMappings, setApiStoreMappings] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState('');
  const [vendorFlow, setVendorFlow] = useState(null);
  const vendorBackRef = useRef(null);
  const [tenderFlow, setTenderFlow] = useState(null);
  const tenderBackRef = useRef(null);
  async function saveDeviceAndRefresh(values) {
    const result=typeof onSaveDevice==='function' ? await onSaveDevice(values) : await devicesApi.create(values);
    if(result?.success===false)throw new Error(result.message || 'Device creation failed.');
    const returned=result?.device || result?.data?.device || result?.data || result;
    const record=returned && typeof returned==='object' && !Array.isArray(returned)?returned:{};
    const device={...record,id:record.id || record.uuid || record.deviceUuid || crypto.randomUUID(),deviceId:record.deviceId || record.device_id || values.deviceId || values.device_id || '',code:record.code || record.deviceCode || record.device_code || '',merchantId:record.merchantId || record.merchant_id || merchantId,name:record.name || record.deviceName || record.device_name || values.deviceName,type:record.type || record.deviceType || record.device_type || values.deviceType,serialNumber:record.serialNumber || record.serial_number || record.serial || values.serialNumber,storeId:record.storeId || record.store_id || values.storeId || values.store_id,storeName:record.storeName || record.store_name,status:record.connectionStatus || record.connection_status || record.status || values.status || 'Unknown'};
    setCreatedDevices(old=>[device,...old.filter(item=>String(item.id)!==String(device.id))]);return result;
  }
  async function updateMerchantDevice(values) {
    const deviceId = editingDevice?.id || editingDevice?.uuid || editingDevice?.deviceUuid || editingDevice?.device_id || editingDevice?.deviceId;
    const result = await devicesApi.update(deviceId, values);
    if (result?.success === false) throw new Error(result.message || "Device update failed.");
    const returned = result?.device || result?.data?.device || result?.data || result;
    const record = returned && typeof returned === "object" && !Array.isArray(returned) ? returned : {};
    const updated = {
      ...editingDevice,
      ...record,
      id: record.id || record.uuid || record.deviceUuid || deviceId,
      deviceId: record.deviceId || record.device_id || values.deviceId || "",
      code: record.code || record.deviceCode || record.device_code || editingDevice.code || "",
      name: record.name || record.deviceName || record.device_name || values.deviceName,
      type: record.type || record.deviceType || record.device_type || values.deviceType,
      serialNumber: record.serialNumber || record.serial_number || record.serial || values.serialNumber,
      status: record.status || values.status || editingDevice.status || "Active",
      notes: record.notes ?? values.notes,
    };
    setCreatedDevices((current) => [updated, ...current.filter((item) => String(item.id || item.deviceId) !== String(deviceId))]);
    setApiDevices((current) => current.map((item) => String(item.id || item.deviceId) === String(deviceId) ? updated : item));
    setEditingDevice(null);
    return result;
  }
  async function confirmDeleteMerchantDevice() {
    if (!deviceToDelete || deviceDeleteBusy) return;
    const deviceId = deviceToDelete.id || deviceToDelete.uuid || deviceToDelete.deviceUuid || deviceToDelete.device_id || deviceToDelete.deviceId;
    setDeviceDeleteBusy(true);
    setDeviceDeleteError("");
    try {
      await devicesApi.delete(deviceId);
      setCreatedDevices((current) => current.filter((item) => String(item.id || item.deviceId) !== String(deviceId)));
      setApiDevices((current) => current.filter((item) => String(item.id || item.deviceId) !== String(deviceId)));
      setDeviceToDelete(null);
    } catch (error) {
      setDeviceDeleteError(error?.message || "Unable to delete device.");
    } finally {
      setDeviceDeleteBusy(false);
    }
  }
  const navigate = useNavigate();
  const openMerchantCreation = path => navigate(path + '?merchantId=' + encodeURIComponent(merchantId), {
    state: { merchantId, merchant },
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const paramTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(paramTab || 'overview');

  useEffect(() => {
    if (paramTab && paramTab !== activeTab) {
      setActiveTab(paramTab);
    }
  }, [paramTab]);

  function changeTab(id) {
    setActiveTab(id);
    setVendorFlow(null);
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('tab', id);
      return next;
    }, { replace: true });
  }
  const tabs = [['overview', 'Overview'], ['subscription', 'Subscription & Usage'], ['stores', 'Stores'], ['employees', 'Employees'], ['devices', 'Devices'], ['vendors', 'Vendors'], ['tenders', 'Tenders'], ['roles', 'Roles & Permissions'], ['payments', 'Payment History']];
  function tabKeyDown(event, index) {
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowUp') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault(); changeTab(tabs[next][0]);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
  }
  const draft = merchant?._onboarding;
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(!draft);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [apiEmployees, setApiEmployees] = useState(null);
  const [registeredDeviceCount, setRegisteredDeviceCount] = useState(null);
  const [registeredEmployeeCount, setRegisteredEmployeeCount] = useState(null);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState('');
  const [allSubscriptions, setAllSubscriptions] = useState([]);
  const [allPlans, setAllPlans] = useState([]);

  useEffect(() => {
    if (draft) { setLoading(false); setError(''); return; }
    let active = true;
    setLoading(true); setError('');
    pendingStoreRead(`merchant:${merchantId}`, () => getMerchant(merchantId)).then(value => {
      if (active) setResult(value);
    }).catch(failure => { if (active) setError(failure.message || 'Unable to load merchant details.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [merchantId, draft, attempt]);
  const response = result?.raw || result || {};
  const raw = response.merchant || response.data?.merchant || response.data || response;
  const merchantIds = [merchant?.merchantId, result?.merchant?.merchantId, raw.merchantId, raw.id, merchantId].filter(Boolean);
  const apiMerchantId = merchantIds.find(value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value))) || merchantIds[0];
async function openEmployeeEdit(employee) {
    const employeeId = employee.employeeId || employee.employee_id || employee.id || employee.employeeCode;
    if (!employeeId) {
      setEmployeesError('This employee is missing an ID, so their details cannot be loaded.');
      return;
    }
    setEmployeesError('');
    setEditingEmployeeLoading(true);
    try {
      const response = await getEmployee(employeeId);
      const details = response?.employee || response?.data?.employee || response?.data || response;
      if (!details || typeof details !== 'object' || Array.isArray(details)) {
        throw new Error('The employee details response was empty.');
      }
      setEditingEmployee({ ...employee, ...details });
    } catch (failure) {
      setEmployeesError(failure.message || 'Unable to load employee details for editing.');
    } finally {
      setEditingEmployeeLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    if (activeTab !== 'employees' || !apiMerchantId) return;
    setEmployeesLoading(true);
    setEmployeesError('');
    setApiEmployees(null);
    pendingStoreRead(`employees:${apiMerchantId}`, () => listMerchantEmployees(apiMerchantId)).then(value => {
      if (active) setApiEmployees(value);
    }).catch(failure => {
      if (active) setEmployeesError(failure.message || 'Unable to load merchant employees.');
    }).finally(() => {
      if (active) setEmployeesLoading(false);
    });
    return () => { active = false; };
  }, [apiMerchantId, activeTab]);
  useEffect(() => {
    let active = true;
    if (activeTab !== 'devices' || !apiMerchantId) return;
    setDevicesLoading(true);
    setDevicesError('');
    setApiDevices([]);
    pendingStoreRead(`devices:${apiMerchantId}`, () => devicesApi.listAllByMerchantId(apiMerchantId)).then(value => {
      if (active) setApiDevices(Array.isArray(value) ? value : []);
    }).catch(failure => {
      if (active) setDevicesError(failure.message || 'Unable to load merchant devices.');
    }).finally(() => {
      if (active) setDevicesLoading(false);
    });
    return () => { active = false; };
  }, [apiMerchantId, activeTab]);
  useEffect(() => {
    let active = true;
    if (activeTab !== 'devices' || !apiMerchantId) return;
    pendingStoreRead(`merchant-stores:${apiMerchantId}`, () => api.get(`/merchants/${encodeURIComponent(apiMerchantId)}/stores`)).then(response => {
      const rows = storeListFromResponse(response).map(normalizeStore);
      if (!active) return;
      const merchantRows = (Array.isArray(rows) ? rows : []).filter(store => {
        const owner = store.merchantId || store.merchant_id;
        return owner != null && String(owner) === String(apiMerchantId);
      });
      setApiStores(merchantRows);
      return Promise.all(merchantRows.map(async store => {
        const storeId = store.id || store.uuid || store.storeUUID || store.storeUuid || store.store_uuid || store.storeId || store.store_id;
        if (!storeId) return [];
        try {
          const mappings = await pendingStoreRead(`store-mappings:${storeId}`, () => getStoreDeviceMappings(storeId));
          return mappings.map(mapping => ({ ...mapping, mappedStoreId: storeId }));
        } catch {
          return [];
        }
      })).then(groups => {
        if (active) setApiStoreMappings(groups.flat());
      });
    }).catch(() => {
      if (active) { setApiStores([]); setApiStoreMappings([]); }
    });
    return () => { active = false; };
  }, [apiMerchantId, activeTab]);
  const saved = draft || raw._onboarding;
  const summary = { ...(result?.merchant || {}), ...(merchant || {}) };
  const contact = saved?.merchant || raw;
  const subscription = result?.subscription || raw.subscription || response.subscription || {};
  const subPlan = subscription.plan || raw.plan || response.plan || {};
  const needsSubscriptionFallback = !subscription.id && !subscription.plan && !subscription.planName && !raw.plan;
  const needsPlanFallback = !subPlan || typeof subPlan !== 'object' || !Object.keys(subPlan).length;
  useEffect(() => {
    if (activeTab !== 'subscription' || loading || !result) return;
    let active = true;
    Promise.all([
      needsSubscriptionFallback ? pendingStoreRead('subscriptions', listSubscriptions).catch(() => []) : Promise.resolve([]),
      needsPlanFallback ? pendingStoreRead('plans', listPlans).catch(() => []) : Promise.resolve([]),
    ]).then(([subs, plans]) => {
      if (active) {
        setAllSubscriptions(Array.isArray(subs) ? subs : []);
        setAllPlans(Array.isArray(plans) ? plans : []);
      }
    });
    return () => { active = false; };
  }, [activeTab, loading, result, needsSubscriptionFallback, needsPlanFallback]);
  useEffect(() => {
    if (activeTab !== 'subscription' || loading || !apiMerchantId) return;
    let active = true;
    Promise.all([
      pendingStoreRead(`devices:${apiMerchantId}`, () => devicesApi.listAllByMerchantId(apiMerchantId)).catch(() => null),
      pendingStoreRead(`employees:${apiMerchantId}`, () => listMerchantEmployees(apiMerchantId)).catch(() => null),
    ]).then(([deviceRows, employeeRows]) => {
      if (!active) return;
      if (Array.isArray(deviceRows)) setRegisteredDeviceCount(deviceRows.length);
      if (Array.isArray(employeeRows)) setRegisteredEmployeeCount(employeeRows.length);
    });
    return () => { active = false; };
  }, [activeTab, loading, apiMerchantId]);
  const subStoreType = subscription.storeType || subscription.store_type || subPlan.storeType || subPlan.store_type || raw.storeType || {};

  const subMatch = useMemo(() => {
    if (!allSubscriptions.length) return null;
    const targetId = String(apiMerchantId || merchantId || "").toLowerCase();
    const targetName = String(raw.merchantName || summary.name || merchant?.name || contact.name || "").toLowerCase();
    const targetCode = String(raw.merchant_code || raw.merchantCode || summary.merchantId || "").toLowerCase();

    return allSubscriptions.find((s) => {
      const sMerchId = String(s.merchantId || s.merchantApiId || s.raw?.merchantId || s.raw?.merchant_id || "").toLowerCase();
      const sMerchName = String(s.merchant || s.raw?.merchantName || s.raw?.businessName || "").toLowerCase();
      const sId = String(s.id || "").toLowerCase();

      return (
        (targetId && (sMerchId === targetId || sId === targetId)) ||
        (targetCode && sMerchId === targetCode) ||
        (targetName && sMerchName === targetName)
      );
    });
  }, [allSubscriptions, apiMerchantId, merchantId, summary, merchant, raw, contact]);

  const matchedPlan = useMemo(() => {
    const targetPlanName = String(
      subMatch?.plan ||
      subscription.planName ||
      (typeof subPlan === 'object' && subPlan ? subPlan.name : subPlan) ||
      raw.planName ||
      summary.plan ||
      ""
    ).toLowerCase();

    if (!targetPlanName || !allPlans.length) return null;

    return allPlans.find((p) => {
      const pName = String(p.name || p.planName || p.planCode || p.code || "").toLowerCase();
      const pId = String(p.id || p.planId || "").toLowerCase();
      return pName === targetPlanName || (subscription?.planId && pId === String(subscription.planId).toLowerCase());
    });
  }, [allPlans, subMatch, subscription, subPlan, raw, summary]);

  const displayPlanName =
    subMatch?.plan ||
    subscription.planName ||
    subscription.plan_name ||
    (typeof subPlan === 'object' && subPlan ? subPlan.name || subPlan.planName : undefined) ||
    (typeof subPlan === 'string' ? subPlan : undefined) ||
    matchedPlan?.name ||
    matchedPlan?.planName ||
    raw.planName ||
    summary.plan ||
    "Pro Plan";

  const rawCycle =
    subMatch?.billingCycle ||
    subscription.billingCycle ||
    subscription.billing_cycle ||
    (typeof subPlan === 'object' && subPlan ? subPlan.billingCycle || subPlan.billing_cycle : undefined) ||
    saved?.cycle ||
    matchedPlan?.billingCycle ||
    "MONTHLY";

  const displayBillingCycle = rawCycle
    ? String(rawCycle).trim().toUpperCase() === "MONTHLY"
      ? "Monthly"
      : String(rawCycle).trim().toUpperCase() === "ANNUAL" || String(rawCycle).trim().toUpperCase() === "YEARLY"
      ? "Yearly"
      : String(rawCycle).charAt(0).toUpperCase() + String(rawCycle).slice(1).toLowerCase()
    : "Monthly";

  const displayStoreType =
    subMatch?.storeTypeName ||
    (typeof subStoreType === "object" && subStoreType ? subStoreType.name || subStoreType.storeTypeName || subStoreType.code : subStoreType) ||
    subscription.storeTypeName ||
    subscription.store_type_name ||
    matchedPlan?.storeTypeName ||
    raw.storeTypeName ||
    raw.storeType ||
    summary.storeType ||
    "Convenience Store";

  const displayStatus =
    subMatch?.status ||
    subscription.status ||
    saved?.subscriptionStatus ||
    raw.status ||
    "ACTIVE";

  const rawStartVal =
    subMatch?.start ||
    subMatch?.rawStart ||
    subscription.startDate ||
    subscription.start_date ||
    subscription.createdAt ||
    subscription.created_at ||
    saved?.start;

  const displayStartDate = rawStartVal ? String(rawStartVal).slice(0, 10) : undefined;

  const rawEndVal =
    subMatch?.end ||
    subMatch?.rawEnd ||
    subscription.renewalDate ||
    subscription.renewal_date ||
    subscription.nextBillingDate ||
    subscription.next_billing_date ||
    subscription.currentPeriodEnd ||
    subscription.current_period_end ||
    summary.renewal;

  const displayRenewalDate = rawEndVal ? String(rawEndVal).slice(0, 10) : undefined;

  const displayStoreAllowance =
    (subscription.includedStores || subscription.included_stores || subscription.stores_limit || subscription.maxStoresAllowed || subscription.max_stores_allowed || subscription.storeLimit) ||
    (typeof subPlan === 'object' && subPlan ? (subPlan.stores_limit || subPlan.storesLimit || subPlan.includedStores || subPlan.included_stores) : undefined) ||
    (subMatch?.includedStores || subMatch?.stores_limit) ||
    (matchedPlan?.stores_limit || matchedPlan?.storesLimit || matchedPlan?.includedStores || matchedPlan?.included_stores) ||
    summary.storeLimit ||
    1;

  const displayDeviceAllowance =
    (subscription.includedTerminals || subscription.included_terminals || subscription.terminal_limit || subscription.licensedDeviceCount || subscription.deviceLimit) ||
    (typeof subPlan === 'object' && subPlan ? (subPlan.terminal_limit || subPlan.terminalLimit || subPlan.includedTerminals || subPlan.included_terminals) : undefined) ||
    (subMatch?.includedTerminals || subMatch?.terminal_limit) ||
    (matchedPlan?.terminal_limit || matchedPlan?.terminalLimit || matchedPlan?.includedTerminals || matchedPlan?.included_terminals) ||
    summary.deviceLimit ||
    2;

  const displayEmployeeAllowance =
    (subscription.includedEmployees || subscription.included_employees || subscription.employees_limit || subscription.employeeLimit) ||
    (typeof subPlan === 'object' && subPlan ? (subPlan.employees_limit || subPlan.employeesLimit || subPlan.includedEmployees || subPlan.included_employees) : undefined) ||
    (subMatch?.includedEmployees || subMatch?.employees_limit) ||
    (matchedPlan?.employees_limit || matchedPlan?.employeesLimit || matchedPlan?.includedEmployees || matchedPlan?.included_employees) ||
    summary.employeeLimit ||
    0;

  const address = contact.address || raw.businessAddress || {};
  const list = value => Array.isArray(value) ? value : [];
  const stores = list(saved?.stores ?? response.stores ?? raw.stores);
  const employeeRecords = apiEmployees ?? saved?.employees ?? raw.employees ?? response.employees ?? response.data?.employees ?? merchant?.employees;
  const employeeRows = list(employeeRecords).filter(employee=>!createdEmployees.some(item=>String(item.id)===String(employee.id || employee.employeeId) || (item.email && item.email===employee.email)));
 const employees = (apiEmployees ??  [...createdEmployees, ...employeeRows]).filter(employee => {
    if (apiEmployees) return true;
    const ownerId = employee.merchantId ?? employee.merchant?.id;
    return ownerId == null || String(ownerId) === String(apiMerchantId);
  });
  const employeeStoreName = employee => employee.storeName || employee.store?.name || stores.find(store =>
    [store.id, store.storeId, store.code, store.storeCode].some(id => id != null && String(id) === String(employee.storeId))
  )?.name || employee.storeId;
  const devices = [...createdDevices,...apiDevices.filter(device=>!createdDevices.some(item=>String(item.id)===String(device.id || device.deviceId) || (item.serialNumber && item.serialNumber===(device.serialNumber || device.serial))))];
  const payments = list(saved?.paymentHistory ?? raw.paymentHistory);
  const subscriptionPlan = subscription.plan && typeof subscription.plan === 'object'
    ? subscription.plan
    : subscription.planDetails && typeof subscription.planDetails === 'object'
      ? subscription.planDetails
      : response.plan && typeof response.plan === 'object'
        ? response.plan
        : raw.plan && typeof raw.plan === 'object'
          ? raw.plan
          : {};
  const subscriptionStoreType = subscription.storeType && typeof subscription.storeType === 'object'
    ? subscription.storeType
    : subscriptionPlan.storeType && typeof subscriptionPlan.storeType === 'object'
      ? subscriptionPlan.storeType
      : {};
  const registeredStores = raw.storeCount ?? response.storeCount ?? summary.storeCount ?? stores.length;
  const registeredDevices = raw.deviceCount ?? response.deviceCount ?? summary.deviceCount ?? devices.length;
  const registeredEmployees = raw.employeeCount ?? response.employeeCount ?? summary.employeeCount ?? employees.length;
  const storeAllowance = subscriptionPlan.includedStores ?? subscriptionPlan.storesLimit ?? subscriptionPlan.stores_limit;
  const deviceAllowance = subscriptionPlan.includedTerminals ?? subscriptionPlan.terminalLimit ?? subscriptionPlan.terminal_limit;
  const employeeAllowance = subscriptionPlan.includedEmployees ?? subscriptionPlan.employeesLimit ?? subscriptionPlan.employees_limit;
  const startDateValue = subscription.startDate || subscription.start_date || saved?.start;
  const renewalDateValue = subscription.renewalDate || subscription.renewal_date || subscription.nextBillingDate || summary.renewal;
  const inferredBillingCycle = (() => {
    if (!startDateValue || !renewalDateValue) return undefined;
    const start = new Date(startDateValue);
    const renewal = new Date(renewalDateValue);
    if (Number.isNaN(start.getTime()) || Number.isNaN(renewal.getTime())) return undefined;
    const months = (renewal.getUTCFullYear() - start.getUTCFullYear()) * 12 + renewal.getUTCMonth() - start.getUTCMonth();
    if (months >= 11) return 'ANNUAL';
    if (months >= 3) return 'QUARTERLY';
    if (months >= 1) return 'MONTHLY';
    return undefined;
  })();
  const billingCycle = subscription.billingCycle || subscription.billing_cycle || subscription.cycle
    || subscriptionPlan.billingCycle || subscriptionPlan.billing_cycle || subscriptionPlan.cycle
    || raw.billingCycle || raw.billing_cycle || inferredBillingCycle;
  const business = contact.business || raw.legalBusinessName || raw.businessName || raw.business_display_name || raw.businessDisplayName || summary.name;
  const businessDisplayName = contact.display || raw.businessDisplayName || raw.business_display_name || raw.businessName || raw.name || summary.name;
  const firstName = raw.firstName || raw.first_name || contact.firstName || contact.first_name;
  const lastName = raw.lastName || raw.last_name || contact.lastName || contact.last_name;
  const addressLine1 = contact.addressLine1 || contact.address_line1 || raw.addressLine1 || raw.address_line1 || address.addressLine1 || address.address_line1 || address.street;
  const addressLine2 = contact.addressLine2 || contact.address_line2 || raw.addressLine2 || raw.address_line2 || address.addressLine2 || address.address_line2;
  const fullAddress = [addressLine1, addressLine2].filter(Boolean).join(', ');
  const displayMerchantCode = raw.merchant_code || raw.merchantId || summary.merchantId || contact.code || raw.code || raw.merchantCode || summary.id || merchantId;
  const merchantStores = [...stores, ...apiStores.filter(store => {
    const owner = store.merchantId || store.merchant_id;
    return owner == null || String(owner) === String(apiMerchantId);
  })];
  const storeName = device => {
    const storeValue = device.storeName || device.store_name || (typeof device.store === 'object' ? device.store.name || device.store.storeName : device.store);
    if (storeValue && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(storeValue))) return String(storeValue);
    const deviceId = device.id || device.uuid || device.deviceUuid || device.device_uuid;
    const matchingMapping = apiStoreMappings.find(mapping => {
      const mappedDeviceId = mapping.deviceId || mapping.device_id || mapping.device?.id || mapping.device?.device_id;
      return deviceId != null && mappedDeviceId != null && String(mappedDeviceId).toLowerCase() === String(deviceId).toLowerCase();
    });
    const deviceStoreId = device.storeId || device.store_id || (typeof device.store === 'object' ? device.store.id || device.store.storeId || device.store.store_id : device.store) || matchingMapping?.mappedStoreId;
    const matchedStore = merchantStores.find(store =>
      [store.id, store._id, store.uuid, store.storeUUID, store.storeUuid, store.store_uuid,
        store.storeId, store.store_id, store.code, store.storeCode, store.store_code]
        .some(id => id != null && deviceStoreId != null && String(id).toLowerCase() === String(deviceStoreId).toLowerCase())
    );
    return matchedStore?.name || matchedStore?.storeName || matchedStore?.store_name || deviceStoreId || '—';
  };
  return <div className="page-content merchant-readonly">
    <style>{`
      .merchant-readonly .merchant-detail-actions{display:flex;flex-direction:column;align-items:stretch;gap:10px;min-width:200px;}
      .merchant-readonly .merchant-detail-actions .btn{display:flex;align-items:center;justify-content:flex-start;gap:8px;margin:0;width:100%;}
      @media(max-width:650px){.merchant-readonly .page-header{flex-wrap:wrap;gap:16px;}.merchant-readonly .merchant-detail-actions{width:100%;}}
      .merchant-readonly .merchant-view-section{background:#fff;border:1px solid #e1e4eb;border-radius:10px;margin-bottom:16px;overflow:hidden;}
      .merchant-readonly .merchant-view-section h2{font-size:18px;padding:16px 20px;margin:0;border-bottom:1px solid #edf0f4;color:#17233e;}
      .merchant-readonly .merchant-view-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 28px;padding:20px;margin:0;}
      .merchant-readonly .merchant-view-fields dt{font-weight:500;color:#7c8495;font-size:13px;margin-bottom:5px;}
      .merchant-readonly .merchant-view-fields dd{margin:0;color:#17233e;font-size:15px;overflow-wrap:anywhere;}
      .merchant-readonly .merchant-view-empty{padding:16px 20px;color:#7c8495;margin:0;}
      .merchant-readonly .merchant-view-back{display:inline-flex;align-items:center;gap:7px;border:0;background:none;color:#5143bc;padding:0;font:inherit;font-weight:600;cursor:pointer;}
      .merchant-readonly .merchant-view-back:focus-visible{outline:3px solid #b9adff;outline-offset:2px;}
      .merchant-readonly .merchant-view-section details{padding:14px 20px;border-top:1px solid #edf0f4;}
      .merchant-readonly .merchant-view-section summary{cursor:pointer;color:#5143bc;}
      .merchant-readonly [role="tabpanel"][hidden]{display:none;}
      @media(max-width:650px){.merchant-readonly .merchant-view-fields{grid-template-columns:1fr;}}
    `}</style>
    <header className="merchant-view-topbar">
      {vendorFlow ? <><button type="button" className="merchant-view-back" onClick={() => vendorBackRef.current?.()}><i className="bi bi-arrow-left" /> Vendors</button><span>/</span><strong>{vendorFlow === "create" ? "Add New Vendor" : "Add Existing Vendor"}</strong></> : tenderFlow ? <><button type="button" className="merchant-view-back" onClick={() => tenderBackRef.current?.()}><i className="bi bi-arrow-left" /> Tenders</button><span>/</span><strong>Add Existing Tender</strong></> : addingEmployee ? <><button type="button" className="merchant-view-back" onClick={() => setAddingEmployee(false)}><i className="bi bi-arrow-left" /> Employees</button><span>/</span><strong>Add Employee</strong></> : addingDevice ? <><button type="button" className="merchant-view-back" onClick={() => setAddingDevice(false)}><i className="bi bi-arrow-left" /> Devices</button><span>/</span><strong>Add Device</strong></> : <button type="button" className="merchant-view-back" onClick={onBack}><i className="bi bi-arrow-left" /> Merchants</button>}
    </header>
    <div className="merchant-view-layout">
      {!loading && !error && <div className="merchant-view-tabs" role="tablist" aria-orientation="vertical" aria-label="Merchant details">
        {tabs.map(([id, label], index) => <button key={id} type="button" role="tab" id={'merchant-tab-' + id}
          aria-selected={activeTab === id} aria-controls={'merchant-panel-' + id} tabIndex={activeTab === id ? 0 : -1}
          onClick={() => changeTab(id)} onKeyDown={event => tabKeyDown(event, index)}><i className={"bi " + ({overview:"bi-grid",subscription:"bi-credit-card",stores:"bi-shop",employees:"bi-people",devices:"bi-display",vendors:"bi-truck",tenders:"bi-wallet2",roles:"bi-shield-check",payments:"bi-receipt"}[id])} aria-hidden="true" /><span>{label}</span></button>)}
      </div>}
      <div className="merchant-view-main">
    <div className="page-header"><div><h1>Merchant Details</h1><p>{readValue(business)} · {displayMerchantCode}</p></div>
    </div>
    {loading ? <p role="status">Loading merchant details…</p> : error ? <div className="alert alert-danger" role="alert">{error} <button type="button" className="btn btn-secondary" onClick={() => setAttempt(value => value + 1)}>Retry</button></div> : <>
      <div role="tabpanel" id="merchant-panel-overview" aria-labelledby="merchant-tab-overview" hidden={activeTab !== 'overview'} tabIndex={0}>
        <ViewSection title="Business Details"><ViewFields items={[
          ['Merchant Code', displayMerchantCode], ['Legal / Business Name', business],
          ['Business Display Name', businessDisplayName], ['Status', summary.status || raw.status],
          ['Joined Date', formatDate(summary.joined || raw.createdAt || raw.created_at)],
          ['Billing Cycle', billingCycle],
        ]} /></ViewSection>
        <ViewSection title="Primary Contact"><ViewFields items={[
          ['Merchant Name', contact.name || raw.merchantName || raw.ownerName || [firstName, lastName].filter(Boolean).join(' ')],
          ['Email', contact.email || raw.merchantEmail || summary.email], ['Phone', contact.phone || raw.merchantPhoneNumber || summary.phone],
          ['Country', contact.country || raw.country || address.country || summary.country], ['City', contact.city || raw.city || address.city],
          ['State / Province', contact.state || raw.state || address.state || summary.state],
          ['Address', typeof address === 'string' ? address : fullAddress],
          ['Postal Code', contact.postal || contact.postalCode || contact.postal_code || raw.postalCode || raw.postal_code || address.postalCode || address.postal_code || address.zipCode],
        ]} /></ViewSection>
      </div>
      <div role="tabpanel" id="merchant-panel-subscription" aria-labelledby="merchant-tab-subscription" hidden={activeTab !== 'subscription'} tabIndex={0}>
        <ViewSection title="Subscription & Usage"><ViewFields items={[
          ['Plan', displayPlanName], ['Billing Cycle', displayBillingCycle],
          ['Store Type', displayStoreType],
          ['Subscription Status', displayStatus], ['Start Date', displayStartDate],
          ['Renewal Date', displayRenewalDate],
          ['Registered Stores', stores.length > 0 ? stores.length : (subMatch?.stores ?? summary.stores ?? raw.storeCount ?? (Array.isArray(raw.stores) ? raw.stores.length : 0))],
          ['Store Allowance', displayStoreAllowance],
          ['Registered Devices', devices.length > 0 ? devices.length : (registeredDeviceCount ?? subMatch?.devices ?? raw.deviceCount ?? (Array.isArray(raw.devices) ? raw.devices.length : 0))],
          ['Device Allowance', displayDeviceAllowance],
          ['Registered Employees', employees.length > 0 ? employees.length : (registeredEmployeeCount ?? subMatch?.employees ?? (Array.isArray(employeeRecords) ? employees.length : saved?.employeeCount ?? raw.employeeCount ?? summary.employeeCount ?? 0))],
          ['Employee Allowance', displayEmployeeAllowance],
        ]} /></ViewSection>
      </div>
      <div role="tabpanel" id="merchant-panel-stores" aria-labelledby="merchant-tab-stores" hidden={activeTab !== 'stores'} tabIndex={0}>
        {activeTab === 'stores' && <MerchantStores merchantId={apiMerchantId || merchantId} merchantDetails={result?.merchant || merchant || raw} embedded />}
      </div>
      <div role="tabpanel" id="merchant-panel-vendors" aria-labelledby="merchant-tab-vendors" hidden={activeTab !== 'vendors'} tabIndex={0}>
        {activeTab === 'vendors' && <MerchantVendors merchantId={merchantId} masterVendors={masterVendors} assignedVendorIds={vendorAssignments?.[merchantId] ?? saved?.vendorIds ?? raw.vendorIds ?? raw.vendors ?? []} onSaveAssignments={onSaveVendorAssignments} onNavigationChange={setVendorFlow} navigationBackRef={vendorBackRef} loading={vendorsLoading} error={vendorsError}/>}
      </div>
      <div role="tabpanel" id="merchant-panel-tenders" aria-labelledby="merchant-tab-tenders" hidden={activeTab !== 'tenders'} tabIndex={0}>
        {activeTab === 'tenders' && <MerchantTenders merchantId={merchantId} masterTenders={masterTenders} assignedTenderIds={tenderAssignments?.[merchantId] ?? saved?.tenderIds ?? raw.tenderIds ?? raw.tenders ?? []} onSaveAssignments={onSaveTenderAssignments} onNavigationChange={setTenderFlow} navigationBackRef={tenderBackRef} loading={tendersLoading} error={tendersError}/>}
      </div>
      
<div
  role="tabpanel"
  id="merchant-panel-employees"
  aria-labelledby="merchant-tab-employees"
  hidden={activeTab !== "employees"}
  tabIndex={0}
>
  {employeesError && (
    <div className="alert alert-danger" role="alert">
      {employeesError}
    </div>
  )}

  {editingEmployeeLoading && (
    <p role="status">Loading employee details...</p>
  )}

  {addingEmployee ? (
    <section className="merchant-vendors mv-create-page merchant-employee-create-page">
      <header className="mv-card mv-header">
        <div>
          <h2>Add Employee</h2>
          <p>Enter the basic details of the employee.</p>
        </div>
        <button type="button" className="store-config-back-button" onClick={() => setAddingEmployee(false)}>
          <i className="bi bi-arrow-left" /> Back to Employees
        </button>
      </header>
      <div className="mv-create-content">
      <MerchantEmployeeForm
        embedded
        key={apiMerchantId}
        merchantId={apiMerchantId}
        initialMerchant={merchant}
        onSave={saveEmployeeAndRefresh}
        onBack={() => setAddingEmployee(false)}
      />
      </div>
    </section>
  ) : editingEmployee ? (
    <EditEmployee
      key={editingEmployee.id || editingEmployee.employeeId}
      employee={editingEmployee}
      onBack={() => setEditingEmployee(null)}
      onSave={async () => {
        setEditingEmployee(null);

        try {
          setApiEmployees(
            await listMerchantEmployees(apiMerchantId)
          );
          setEmployeesError("");
        } catch (failure) {
          setEmployeesError(
            failure.message ||
              "Employee was updated, but the list could not be refreshed."
          );
        }
      }}
    />
  ) : (
    <MerchantEmployeeList
      onEdit={openEmployeeEdit}
      employees={employees}
      merchantName={business}
      onAdd={() => setAddingEmployee(true)}
      onRefresh={async () =>
        setApiEmployees(
          await listMerchantEmployees(apiMerchantId)
        )
      }
    />
  )}
</div>
      <div role="tabpanel" id="merchant-panel-devices" aria-labelledby="merchant-tab-devices" hidden={activeTab !== 'devices'} tabIndex={0}>
        {addingDevice || editingDevice ? (
          <section className="merchant-vendors mv-create-page merchant-device-create-page">
            <header className="mv-card mv-header">
              <div>
                <h2>{editingDevice ? "Edit Device" : "Add New Device"}</h2>
                <p>{editingDevice ? "Update the device information and settings." : "Enter device information, assignment details and settings."}</p>
              </div>
              <button type="button" className="store-config-back-button" onClick={() => { setAddingDevice(false); setEditingDevice(null); }}>
                <i className="bi bi-arrow-left" /> Back to Devices
              </button>
            </header>
            <div className="mv-create-content">
              <AddMerchantDevice
                key={`${apiMerchantId}-${editingDevice?.id || "new"}`}
                merchantId={apiMerchantId}
                merchant={merchant}
                initialDevice={editingDevice || null}
                onSave={editingDevice ? updateMerchantDevice : saveDeviceAndRefresh}
                onBack={() => { setAddingDevice(false); setEditingDevice(null); }}
              />
            </div>
          </section>
        ) : <MerchantDeviceList devices={devices} storeName={storeName} onAdd={()=>setAddingDevice(true)} onEdit={setEditingDevice} onDelete={(device)=>{setDeviceDeleteError("");setDeviceToDelete(device);}} loading={devicesLoading} error={devicesError}/>}
        <DeleteConfirmationDialog
          isOpen={Boolean(deviceToDelete)}
          title="Delete Device"
          message={`Are you sure you want to delete ${deviceToDelete?.name || deviceToDelete?.deviceName || "this device"}? This action cannot be undone.`}
          busy={deviceDeleteBusy}
          error={deviceDeleteError}
          onCancel={()=>{if(!deviceDeleteBusy)setDeviceToDelete(null);}}
          onConfirm={confirmDeleteMerchantDevice}
        />

      </div>
      <div role="tabpanel" id="merchant-panel-roles" aria-labelledby="merchant-tab-roles" hidden={activeTab !== 'roles'} tabIndex={0}>
        {activeTab === 'roles' && <MerchantRoles merchantId={apiMerchantId || merchantId} />}
      </div>
      <div role="tabpanel" id="merchant-panel-payments" aria-labelledby="merchant-tab-payments" hidden={activeTab !== 'payments'} tabIndex={0}>
        <ViewSection title="Payment History"><ViewTable headings={['Date', 'Plan', 'Amount', 'Method', 'Status']} rows={payments.map(payment => [
          payment.createdAt, payment.plan, [payment.currency, payment.amount].filter(value => value !== undefined && value !== null).join(' '), payment.method, payment.status,
        ])} /></ViewSection>
      </div>
    </>}
      </div>
    </div>
  </div>;
}


function exportMerchants(rows) {
  if (!rows.length) {
    alert("There are no merchants to export.");
    return;
  }
  const header = [
    "Merchant",
    "Merchant ID",
    "Contact",
    "Phone",
    "Stores",
    "Subscription Plan",
    "Status",
    "Joined On",
  ];
  const data = rows.map((m) => [
    m.name,
    m.merchantId || m.id,
    m.email,
    m.phone,
    m.stores,
    m.plan,
    m.status,
    m.joined,
  ]);
  const csv = [header, ...data]
    .map((row) =>
      row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pch-merchants.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function avatarClass(index) {
  return ["purple-avatar", "blue-avatar", "green-avatar"][index % 3];
}

function monthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth()}`;
}
function parseFilterDate(value) {
  if (!value || value === '—') return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }
  const date = new Date(text); return Number.isNaN(date.getTime()) ? null : date;
}
function dateRangeMatch(merchant, value, from = '', to = '', now = new Date()) {
  if (!value) return true;
  const date = parseFilterDate(merchant.createdAt) || parseFilterDate(merchant.joined);
  if (!date) return false;
  let start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let end = new Date(start);
  if (value === 'today') end.setDate(end.getDate() + 1);
  else if (value === 'week') { start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); end = new Date(start); end.setDate(end.getDate() + 7); }
  else if (value === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 1); }
  else if (value === 'custom') { start = parseFilterDate(from); end = parseFilterDate(to); if (!start || !end || start > end) return false; end.setDate(end.getDate() + 1); }
  else return true;
  return date >= start && date < end;
}
function CalendarField({ label, value, onChange, min, max }) {
  const input = useRef(null);
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>{label}
    <span style={{ display: 'flex', gap: 6 }}><input ref={input} type="date" value={value} min={min} max={max} onChange={event => onChange(event.target.value)} style={{ minWidth: 145, padding: '8px 10px', border: '1px solid #dfe3ea', borderRadius: 6, colorScheme: 'light' }} />
      <button type="button" aria-label={'Open ' + label.toLowerCase() + ' calendar'} onClick={() => { try { if (input.current.showPicker) input.current.showPicker(); else input.current.focus(); } catch { input.current.focus(); } }} style={{ padding: '8px 10px', border: '1px solid #dfe3ea', borderRadius: 6, background: '#fff' }}>▦</button></span>
  </label>;
}
function storeLimitFor(merchant, masterPlans) {
  const plan = String(merchant.plan || "").toLowerCase();

  const masterPlan = masterPlans.find((item) =>
    String(item.planName || item.name || "")
      .toLowerCase()
      .includes(plan),
  );

  const suppliedLimit =
    masterPlan?.maxStores ??
    masterPlan?.storeLimit ??
    masterPlan?.allowedStores ??
    masterPlan?.storeCount ??
    masterPlan?.includedStores ??
    masterPlan?.stores;

  if (Number.isFinite(Number(suppliedLimit))) {
    return Number(suppliedLimit);
  }

  if (plan.includes("starter")) return 1;
  if (plan.includes("pro")) return 5;
  if (plan.includes("enterprise")) return null;

  return null;
}
export default function Merchants({ localMerchants = [], onLocalDelete, onSaveEmployee, onSaveDevice, masterVendors = [], vendorAssignments = {}, onSaveVendorAssignments, vendorsLoading = false, vendorsError = "", masterTenders = [], tenderAssignments = {}, onSaveTenderAssignments, tendersLoading = false, tendersError = "" }) {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewedId = searchParams.get('view');
  function openView(merchant) {
    setSearchParams(previous => { const next = new URLSearchParams(previous); next.set('view', String(merchant.id)); return next; });
  }
  function closeView() {
    setSearchParams(previous => { const next = new URLSearchParams(previous); next.delete('view'); next.delete('tab'); return next; });
  }
  function openEdit(merchant) {
    try { nav('/merchants/' + encodeURIComponent(merchant.id) + '/edit', { state: { merchant } }); }
    catch (error) { setError('Unable to open editor: ' + error.message); }
  }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState('');
  const deleteInFlight = useRef(false);
  const mounted = useRef(false);
  const [search, setSearch] = useState("");
const [statusFilter, setStatusFilter] = useState("");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function confirmDelete() {
    if (deleteInFlight.current || !deleteTarget) return;
    deleteInFlight.current = true; setDeleting(true); setDeleteError('');
    const target = deleteTarget;
    try {
      const targetId = target.merchantId || target.id;
      const res = await updateMerchantStatus(targetId, 'INACTIVE');
      console.log("[DEACTIVATE MERCHANT API RESPONSE]", res);
      onLocalDelete?.(target.id);
      if (!mounted.current) return;
      setMerchants(previous => previous.map(item => item.id === target.id
        ? { ...item, status: 'Inactive', isDeleted: true }
        : item));
      setNotice(target.name + ' was deactivated.'); setDeleteTarget(null);
    } catch (error) { if (mounted.current) setDeleteError(error.message || 'Unable to delete merchant. Please try again.'); }
    finally { deleteInFlight.current = false; if (mounted.current) setDeleting(false); }
  }
  async function activateMerchant(merchant) {
    setDeleteError('');
    try {
      await updateMerchantStatus(merchant.merchantId || merchant.id, 'ACTIVE');
      setMerchants(previous => previous.map(item => item.id === merchant.id
        ? { ...item, status: 'Active', isDeleted: false }
        : item));
      setNotice(merchant.name + ' was activated.');
    } catch (error) {
      setError(error.message || 'Unable to activate merchant.');
    }
  }
  const masterPlans = [];
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [location, setLocation] = useState("");
  const [joinedRange, setJoinedRange] = useState("");
  const [storeCount, setStoreCount] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setPage(1);
  };
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('');
  const [draftFrom, setDraftFrom] = useState(''); const [draftTo, setDraftTo] = useState('');
  const [dateError, setDateError] = useState('');
  function openDateRange() { setDraftFrom(dateFrom); setDraftTo(dateTo); setDateError(''); setDatePickerOpen(true); }
  function applyDateRange() {
    const start = parseFilterDate(draftFrom), end = parseFilterDate(draftTo);
    if (!start || !end) { setDateError('Select both From and To dates.'); return; }
    if (start > end) { setDateError('To date must be on or after From date.'); return; }
    setDateFrom(draftFrom); setDateTo(draftTo); setJoinedRange('custom'); setPage(1); setDatePickerOpen(false);
  }
  const [apiMerchants, setMerchants] = useState([]);
  const merchants = useMemo(() => { const combined = new Map(apiMerchants.map(row => [String(row.id), row])); localMerchants.forEach(row => combined.set(String(row.id), row)); return [...combined.values()]; }, [apiMerchants, localMerchants]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (viewedId) return;

    async function loadMerchants() {
      setLoading(true);
      setError("");
      try {
        const rows = await pendingStoreRead("merchant-list", () => listMerchants());
        if (!cancelled) setMerchants(rows);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Unable to load merchants from the API.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMerchants();
    return () => {
      cancelled = true;
    };
  }, [viewedId]);

  const rows = useMemo(
    () =>
      merchants.filter(
        (m) =>
          (!q ||
            `${m.name} ${m.id} ${m.email}`
              .toLowerCase()
              .includes(q.toLowerCase())) &&
          (!status || String(m.status || '').toLowerCase() === String(status).toLowerCase()) &&
          (!plan || m.plan === plan) && (!storeCount || (storeCount === 'none' ? Number(m.stores) === 0 : storeCount === 'one' ? Number(m.stores) === 1 : Number(m.stores) > 1)) && (!location || `${m.country || ''} ${m.state || ''}`.trim().toLowerCase() === location.toLowerCase()) && (!joinedRange || dateRangeMatch(m, joinedRange, dateFrom, dateTo)),
      ),
    [merchants, q, status, plan, joinedRange, storeCount, location, dateFrom, dateTo],
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { setPage(1); }, [q, status, plan, joinedRange, storeCount, location, dateFrom, dateTo]);
  useEffect(() => { setPage(previous => Math.min(previous, pageCount)); }, [pageCount]);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${now.getMonth()}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${lastMonthDate.getMonth()}`;
  const total = merchants.length;
  const activeCount = merchants.filter((m) => m.status === "Active").length;
  const suspendedCount = merchants.filter(
    (m) => m.status === "Suspended",
  ).length;
  const inactiveCount = merchants.filter((m) => m.status === "Inactive").length;
  const newThisMonth = merchants.filter(
    (m) => monthKey(m.createdAt) === thisMonth,
  ).length;
  const newLastMonth = merchants.filter(
    (m) => monthKey(m.createdAt) === lastMonth,
  ).length;
  const monthChange =
    newLastMonth === 0
      ? newThisMonth > 0
        ? "New this month"
        : "No new merchants"
      : `${Math.abs(Math.round(((newThisMonth - newLastMonth) / newLastMonth) * 100))}% vs last month`;
  const activePct = total
    ? `${((activeCount / total) * 100).toFixed(1)}% of total`
    : "0% of total";
  const inactivePct = total
    ? `${((inactiveCount / total) * 100).toFixed(1)}% of total`
    : "0% of total";

  const stat = [
    [
      "purple",
      "bi-people-fill",
      "Total Merchants",
      String(total),
      `${newThisMonth} this month`,
    ],
    [
      "green",
      "bi-check-circle-fill",
      "Active Merchants",
      String(activeCount),
      activePct,
    ],
    [
      "orange",
      "bi-pause-circle-fill",
      "Set up Incomplete",
      String(merchants.filter((m) => m.status === "Pending Setup").length),
      "Setup Required",
    ],
    [
      "blue",
      "bi-pause-circle-fill",
      "Suspended Merchants",
      String(suspendedCount),
      `${suspendedCount} currently`,
    ],
    [
      "red",
      "bi-x-circle-fill",
      "Inactive Merchants",
      String(inactiveCount),
      inactivePct,
    ],
  ];

  const plans = [
    ...new Set(
      merchants
        .map((item) => item.planName || item.plan)
        .filter(Boolean),
    ),
  ];
  const statuses = ["Pending Setup", "Active", "Suspended", "Inactive"];
  const locations = [...new Set(merchants.map(m => `${m.country || ''} ${m.state || ''}`.trim()).filter(Boolean))];

  if (viewedId) return <MerchantReadOnly masterTenders={masterTenders} tenderAssignments={tenderAssignments} onSaveTenderAssignments={onSaveTenderAssignments} tendersLoading={tendersLoading} tendersError={tendersError} masterVendors={masterVendors} vendorAssignments={vendorAssignments} onSaveVendorAssignments={onSaveVendorAssignments} vendorsLoading={vendorsLoading} vendorsError={vendorsError} key={viewedId} merchantId={viewedId} onSaveEmployee={onSaveEmployee} onSaveDevice={onSaveDevice}
    merchant={merchants.find(item => String(item.id) === viewedId || String(item.merchantId) === viewedId || String(item.merchantCode) === viewedId)} onBack={closeView}
    />;

  return (
    <div className="page-content">
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      <div className="page-header">
        <div>
          <h1>Merchants</h1>
           <p className="page-subtitle">
             Manage merchant accounts, subscriptions, stores, and business details. </p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            type="button" onClick={() => nav("/merchants/new")}
          >
            <i className="bi bi-plus-lg" /> Add Merchant
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => exportMerchants(rows)}
          >
            <i className="bi bi-download" /> Export
          </button>
        </div>
      </div>
      <div className="row g-3 stats-grid">
        {stat.map((x, i) => (
          <div className="col-xl col-lg-4 col-md-6" key={x[2]}>
            <div className="stat-card">
              <div className={`stat-icon ${x[0]}`}>
                <i className={`bi ${x[1]}`} />
              </div>
              <div className="stat-content">
                <span>{x[2]}</span>
                <strong>{x[3]}</strong>
                <small
                  className={
                    i === 0 || i === 4 ? "positive" : i === 2 ? "negative" : ""
                  }
                >
                  <i
                    className={`bi ${i === 2 ? "bi-arrow-down" : "bi-arrow-up"}`}
                  />{" "}
                  {x[4]}
                </small>
                {(i === 1 || i === 3) && (
                  <div className={`progress ${i === 3 ? "red-progress" : ""}`}>
                    <div
                      style={{
                        width:
                          i === 1
                            ? `${total ? (activeCount / total) * 100 : 0}%`
                            : `${total ? (inactiveCount / total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="merchant-table-card">
        <FiltersBar
    searchValue={q}
    onSearchChange={(value) => {
        setQ(value);
        setPage(1);
    }}
    searchPlaceholder="Search merchants..."
    filters={[
        {
            key: "status",
            label: "Status",
            value: status,
            options: [
                { label: "All Statuses", value: "" },
                ...statuses.map((item) => ({
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
            key: "joinedRange",
            label: "Date Range",
            value: joinedRange,
            options: [
                { label: "Any Date", value: "" },
                { label: "Today", value: "today" },
                { label: "This Week", value: "week" },
                { label: "This Month", value: "month" },
                { label: "Custom Range", value: "custom" },
            ],
            onChange: (value) => {
                if (value === "custom") {
                    openDateRange();
                } else {
                    setJoinedRange(value);
                    setDateFrom("");
                    setDateTo("");
                    setPage(1);
                }
            },
        },
        {
            key: "storeCount",
            label: "Store Count",
            value: storeCount,
            options: [
                { label: "Any Store Count", value: "" },
                { label: "No Stores", value: "none" },
                { label: "1 Store", value: "one" },
                { label: "Multiple Stores", value: "multiple" },
            ],
            onChange: (value) => {
                setStoreCount(value);
                setPage(1);
            },
        },
        {
            key: "location",
            label: "Location",
            value: location,
            options: [
                { label: "All Locations", value: "" },
                ...locations.map((item) => ({
                    label: item,
                    value: item,
                })),
            ],
            onChange: (value) => {
                setLocation(value);
                setPage(1);
            },
        },
        {
            key: "plan",
            label: "Subscription Plan",
            value: plan,
            options: [
                { label: "All Plans", value: "" },
                ...plans
                    .filter(Boolean)
                    .map((item) => ({
                        label: item,
                        value: item,
                    })),
            ],
            onChange: (value) => {
                setPlan(value);
                setPage(1);
            },
        },
    ]}
    onClear={() => {
        setQ("");
        setStatus("");
        setPlan("");
        setLocation("");
        setStoreCount("");
        setJoinedRange("");
        setDateFrom("");
        setDateTo("");
        setDatePickerOpen(false);
        setDateError("");
        setPage(1);
    }}
/>
        {datePickerOpen && <section id="merchant-date-range" aria-label="Custom date range" style={{ padding: 16, background: '#f8f7ff', borderBottom: '1px solid #e1e4eb' }}>
          <div style={{ display: 'flex', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
            <CalendarField label="From date" value={draftFrom} max={draftTo || undefined} onChange={value => { setDraftFrom(value); setDateError(''); }} />
            <CalendarField label="To date" value={draftTo} min={draftFrom || undefined} onChange={value => { setDraftTo(value); setDateError(''); }} />
            <button type="button" className="btn btn-primary" onClick={applyDateRange}>Apply date range</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setDatePickerOpen(false); setDateError(''); }}>Cancel</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setJoinedRange(''); setDateFrom(''); setDateTo(''); setDatePickerOpen(false); setDateError(''); setPage(1); }}>Clear dates</button>
          </div>{dateError && <p role="alert" style={{ color: '#b42318', margin: '10px 0 0' }}>{dateError}</p>}
        </section>}
        <div className="table-wrapper">
          <table className="merchant-table">
            <thead>
              <tr>
                <th>Merchant Name</th>
                <th>Contact Information</th><th>Location</th>
                <th>Stores</th>
                <th>Subscription Plan</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Updated At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9}>Loading merchants...</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9}>{error}</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    style={{
                      textAlign: "center",
                      padding: "40px",
                    }}
                  >
                    No merchants found.
                  </td>
                </tr>
              ) : (
                visibleRows.map((m, index) => (
                  <tr
                    key={m.id}
                    tabIndex={0}
                    aria-label={`View ${m.name} details`}
                    style={{ cursor: "pointer" }}
                    onClick={(event) => {
                      if (event.target.closest('button, a, input, select, textarea, label, [role="button"], [contenteditable="true"]')) {
                        event.stopPropagation();
                        return;
                      }
                      openView(m);
                    }}
                    onKeyDown={(event) => {
                      if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        openView(m);
                      }
                    }}
                  >
                    <td>
                      <div
                        className="merchant-name clickable"
                        role="button"
                        tabIndex={0}
                        onClick={() => openView(m)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openView(m);
                          }
                        }}
                      >
            
                        <div>
                          <strong>{m.name}</strong>
                          <small>{m.merchantId || m.id}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="contact-info">
                        <strong>{m.email || "—"}</strong>
                        <span>{m.phone || "—"}</span>
                      </div>
                    </td>
                    <td><div className="contact-info"><strong>{m.state || "—"}</strong><span>{m.country || "—"}</span></div></td>
                    <td>
                      <strong>
                        {m.stores}
                        {storeLimitFor(m, masterPlans)
                          ? ` / ${storeLimitFor(m, masterPlans)}`
                          : ""}
                      </strong>
                    </td>
                    <td>
                      <div className="plan-info">
                        <strong>{m.plan}</strong>
                        {m.renewal ? <span>Renews on {m.renewal}</span> : null}
                      </div>
                    </td>
                    <td>
                      <span className={`status ${String(m.status || '') .trim() .toLowerCase() .replace(/\s+/g, '-')}`} >
                         <i></i>
                         {m.status || 'Unknown'}
                         </span>
                    </td>
                    <td>{merchantTimestamp(m.createdAt || m.created_at || m.createdDate || m._raw?.merchant?.created_at || m.joined)}</td>
                    <td>{merchantTimestamp(m.updatedAt || m.updated_at || m.updatedDate || m._raw?.merchant?.updated_at)}</td>
                    <td>
    <ListActions
        onView={() => openView(m)}
        onEdit={() => openEdit(m)}
        onActivate={
            m.status === "Inactive"
                ? () => activateMerchant(m)
                : undefined
        }
        onDelete={
            m.status !== "Inactive"
                ? () => {
                      setDeleteError("");
                      setDeleteTarget(m);
                  }
                : undefined
        }
        viewLabel={`View ${m.name} details`}
        editLabel={`Edit ${m.name}`}
        activateLabel={`Activate ${m.name}`}
        deleteLabel={`Deactivate ${m.name}`}
    />
</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
    currentPage={currentPage}
    totalPages={pageCount}
    totalItems={rows.length}
    pageSize={pageSize}
    onPageChange={setPage}
    onPageSizeChange={handlePageSizeChange}
    itemLabel="merchants"
    showWhenEmpty={true} 
/>
      </div>
{deleteTarget && (
  <DeleteConfirmationDialog
    isOpen={!!deleteTarget}
    title="Deactivate Merchant?"
    message={`Are you sure you want to deactivate ${deleteTarget.name}?`}
    cancelLabel="Cancel"
    confirmLabel="Deactivate"
    busyLabel="Deactivating..."
    busy={deleting}
    error={deleteError}
    iconClassName="bi bi-trash3"
    onCancel={() => {
      if (!deleting) {
        setDeleteTarget(null);
        setDeleteError("");
      }
    }}
    onConfirm={confirmDelete}
  />
)}
    </div>
  );
}

function MerchantEmployeeList({employees,merchantName,onAdd,onRefresh,onEdit}) {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const deleteLock = useRef(false);
  async function confirmDelete() {
    if (!deleteTarget || deleteLock.current) return;
    deleteLock.current = true;
    setDeleteBusy(true);
    try {
      await deleteEmployee(deleteTarget.employeeId || deleteTarget.id);
      setDeleteTarget(null);
      await onRefresh?.();
      setNotice("Employee deleted successfully.");
    } catch (error) {
      setNotice(error.message || "Unable to delete employee.");
    } finally {
      deleteLock.current = false;
      setDeleteBusy(false);
    }
  }
  const blank={query:''};
  const [filters, setFilters] = useState(blank);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState(null);
  const dialog=useRef(null),lastFocus=useRef(null);
  useEffect(()=>{if(view)dialog.current?.showModal();else if(dialog.current?.open){dialog.current.close();lastFocus.current?.focus();}},[view]);
  const employeeName=e=>e.name || e.employeeName || [e.firstName,e.lastName].filter(Boolean).join(' ') || '—';
  const storeNames=e=>[e.storeName,e.store?.name,...(Array.isArray(e.stores)?e.stores.map(v=>typeof v==='string'?v:v.name || v.storeName):[])].filter(Boolean);
  const assignedStoreCount=e=>{if(Array.isArray(e?.stores)) return e.stores.length;if(e?.assignedStoreCount!==undefined&&e?.assignedStoreCount!==null)return Number(e.assignedStoreCount);if(e?.assignedStoresCount!==undefined&&e?.assignedStoresCount!==null)return Number(e.assignedStoresCount);if(e?.storeId||e?.store_id||e?.storeName||e?.store?.name)return 1;return 0;};
  const roleNames=e=>[e.roleName,typeof e.role==='string'?e.role:e.role?.name,...(Array.isArray(e.roles)?e.roles.map(v=>typeof v==='string'?v:v.name || v.roleName):[])].filter(Boolean);
  const update=(key,value)=>{setFilters(old=>({...old,[key]:value}));setPage(1);};
  const filtered=employees.filter(e=>[employeeName(e),e.id,e.employeeCode,e.username,e.phone,e.phoneNumber,e.email].join(' ').toLowerCase().includes(filters.query.trim().toLowerCase())).sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  return <div className="mel">
    <EmployeeToast message={notice} onClose={()=>setNotice("")} />

{deleteTarget && (
  <DeleteConfirmationDialog
    isOpen={!!deleteTarget}
    title="Delete Employee?"
    message={`Are you sure you want to delete ${employeeName(deleteTarget)}? This action cannot be undone.`}
    cancelLabel="Cancel"
    confirmLabel="Delete"
    busyLabel="Deleting..."
    busy={deleteBusy}
    error=""
    iconClassName="bi bi-trash3"
    onCancel={() => {
      if (!deleteBusy) {
        setDeleteTarget(null);
      }
    }}
    onConfirm={confirmDelete}
  />
)}

<section className="mel-card">
 
<div className="mel-heading">
  <div>
    <h2>Employee List</h2>
    <p>These are the employees connected to this merchant.</p>
  </div>

  <button type="button" className="mel-primary" onClick={onAdd}>
    <i className="bi bi-plus-lg" aria-hidden="true" />
    Add Employee
  </button>
</div>

<FiltersBar
  searchValue={filters.query}
  onSearchChange={(value) => {
    update("query", value);
    setPage(1);
  }}
  searchPlaceholder="Search employee, ID, username, phone or email..."
  onClear={() => {
    setFilters(blank);
    setPage(1);   
  }}
/>
   <div className="mel-scroll"><table><thead><tr>{['Employee','Email','Phone','Login PIN','Gender','Status','Actions'].map(title=><th key={title}>{title}</th>)}</tr></thead><tbody>
      {filtered.slice((current - 1) * pageSize, current * pageSize).map((e, index) => (
    <tr key={e.id || e.employeeCode || index}>
        <td>
            <strong>{employeeName(e)}</strong>
            {e.employeeCode && <small>{e.employeeCode}</small>}
        </td>

        <td>{e.email || '—'}</td>

        <td>{e.phone || e.phoneNumber || '—'}</td>

        <td>{e.loginPin || e.login_pin || e.employeeLoginPin || (e.pinSet ? 'Set' : '—')}</td>

        <td>{e.gender || '—'}</td>
        <td><span className={"employee-status " + (String(e.status || 'INACTIVE').toUpperCase() === 'ACTIVE' ? 'active' : 'inactive')}>{String(e.status || 'INACTIVE').toUpperCase() === 'ACTIVE' ? 'Active' : 'Inactive'}</span></td>

        <td>
            <ListActions
                onView={(event) => {
                    lastFocus.current = event.currentTarget;
                    setView(e);
                }}
                viewLabel={`View ${employeeName(e)}`}
                onEdit={() => onEdit(e)}
                editLabel={`Edit ${employeeName(e)}`}
                onDelete={() => setDeleteTarget(e)}
                deleteLabel={`Delete ${employeeName(e)}`}
                deleteDisabled={deleteBusy}
            />
        </td>
    </tr>
))}
{!filtered.length&&<tr><td colSpan={7}>No employees found for this merchant.</td></tr>}</tbody></table></div>
<Pagination
  currentPage={current}
  totalPages={pages}
  totalItems={filtered.length}
  pageSize={pageSize}
  onPageChange={setPage}
  onPageSizeChange={(size) => {
    setPageSize(size);
    setPage(1);
  }}
  itemLabel="employees"
  showWhenEmpty={true}
/>
    </section>
    <dialog ref={dialog} className="mel-dialog" aria-labelledby="mel-title" onCancel={event=>{event.preventDefault();setView(null);}}><header className="mel-heading"><h2 id="mel-title">Employee Details</h2><button onClick={()=>setView(null)} aria-label="Close employee details">×</button></header>{view&&<dl>{Object.entries({Name:employeeName(view),Email:view.email,Phone:view.phone || view.phoneNumber,Username:view.username,Gender:view.gender,'Login PIN':view.loginPin || view.login_pin || view.employeeLoginPin || (view.pinSet ? 'Set' : ''),Status:view.status,'Employee Code':view.employeeCode || view.employee_code}).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value || '—'}</dd></div>)}</dl>}</dialog>
  </div>;
}

function MerchantDeviceList({devices,storeName,onAdd,onEdit,onDelete,loading=false,error=''}) {
  const [query, setQuery] = useState("");
const [statusFilter, setStatusFilter] = useState("");
const [page, setPage] = useState(1);
const [sort, setSort] = useState({ key: "name", direction: 1 });
const [view, setView] = useState(null);
const [pageSize, setPageSize] = useState(10);
  const dialog=useRef(null),lastFocus=useRef(null);
  useEffect(()=>{if(view)dialog.current?.showModal();else if(dialog.current?.open){dialog.current.close();lastFocus.current?.focus();}},[view]);
const rows = devices
  .map((d) => ({
    ...d,
    deviceIdentifier: d.deviceId || d.device_id || "—",
    deviceCode: d.code || d.deviceCode || d.device_code || "—",
    name: d.name || d.deviceName || "—",
    type: d.type || d.deviceType || "—",
    storeLabel: storeName(d),
    serial: d.serial || d.serialNumber || "—",
    status: d.connectionStatus || d.status || "Unknown",
  }))
  .filter((d) => {
    const searchText = [
      d.deviceIdentifier,
      d.deviceCode,
      d.name,
      d.type,
      d.serial,
      d.storeLabel,
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = searchText.includes(query.trim().toLowerCase());

    const matchesStatus =
      !statusFilter ||
      String(d.status).toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  })
  .sort(
    (a, b) =>
      String(a[sort.key]).localeCompare(String(b[sort.key])) *
      sort.direction
  );

const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
const currentPage = Math.min(page, totalPages);

const paginatedRows = rows.slice(
  (currentPage - 1) * pageSize,
  currentPage * pageSize
);

useEffect(() => {
  setPage(1);
}, [query, statusFilter]);

useEffect(() => {
  setPage((previous) => Math.min(previous, totalPages));
}, [totalPages]); 
return (
  <div className="mdl">
    <section className="mdl-card">
  <header className="mdl-header">
    <div>
      <h3>Device List</h3>
      <p>These are the devices connected to this merchant.</p>
    </div>

    <button className="mdl-primary" onClick={onAdd}>
      ＋ Add Device
    </button>
  </header>

  {error && (
    <p role="alert" className="alert alert-danger">
      {error}
    </p>
  )}

  {/* Keep your existing search, table, and pagination code here */}

     
<FiltersBar
  searchValue={query}
  onSearchChange={setQuery}
  searchPlaceholder="Search devices..."
  filters={[
    {
      key: "status",
      label: "Status",
      value: statusFilter,
      options: [
        { label: "All Statuses", value: "" },
        { label: "Online", value: "Online" },
        { label: "Offline", value: "Offline" },
        { label: "Active", value: "Active" },
        { label: "Inactive", value: "Inactive" },
        { label: "Unknown", value: "Unknown" },
      ],
      onChange: setStatusFilter,
    },
  ]}
  onClear={() => {
    setQuery("");
    setStatusFilter("");
    setPage(1);
  }}
/>


      <div className="mdl-scroll">
        <table>
          <thead>
            <tr>
              {[
                ['deviceIdentifier', 'Device ID'],
                ['deviceCode', 'Device Code'],
                ['name', 'Device Name'],
                ['type', 'Type'],
                ['storeLabel', 'Store'],
                ['serial', 'Serial No.'],
                ['status', 'Status'],
              ].map(([key, title]) => (
                <th
                  key={key}
                  aria-sort={
                    sort.key === key
                      ? sort.direction === 1
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    className="mdl-sort"
                    onClick={() =>
                      setSort((old) => ({
                        key,
                        direction:
                          old.key === key ? -old.direction : 1,
                      }))
                    }
                  >
                    {title}
                  </button>
                </th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} role="status">
                  Loading merchant devices…
                </td>
              </tr>
            )}

            {!loading &&
              paginatedRows.map((d, index) => (
                  <tr key={d.id || d.deviceId || index}>
                    <td>{d.deviceIdentifier}</td>
                    <td>{d.deviceCode}</td>
                    <td>
                      <span className="mdl-name">
                        <strong>{d.name}</strong>
                      </span>
                    </td>
                    <td>{d.type}</td>
                    <td>{d.storeLabel}</td>
                    <td>{d.serial}</td>
                    <td>
                      <span className={'mdl-badge ' + (['active', 'online'].includes(String(d.status || '').toLowerCase()) ? 'mdl-active' : 'mdl-inactive')}>
                        ● {d.status}
                      </span>
                    </td>
                    <td>
                      <ListActions
                        viewLabel={'View ' + d.name}
                        onView={(e) => {
                          lastFocus.current = e.currentTarget;
                          setView(d);
                        }}
                        onEdit={() => onEdit?.(d)}
                        editLabel={'Edit ' + d.name}
                        onDelete={() => onDelete?.(d)}
                        deleteLabel={'Delete ' + d.name}
                      />
                    </td>
                  </tr>
                ))}

            {!loading && !rows.length && (
              <tr>
                <td colSpan={8}>No devices found for this merchant.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  totalItems={rows.length}
  pageSize={pageSize}
  onPageChange={setPage}
  onPageSizeChange={(size) => {
    setPageSize(size);
    setPage(1);
  }}
  itemLabel="devices"
  showWhenEmpty={true}
/>
    </section>

    <dialog
      className="mdl-dialog"
      ref={dialog}
      aria-labelledby="mdl-title"
      onCancel={(e) => {
        e.preventDefault();
        setView(null);
      }}
    >
      <header className="mdl-header">
        <h2 id="mdl-title">Device Details</h2>
        <button
          aria-label="Close device details"
          onClick={() => setView(null)}
        >
          ×
        </button>
      </header>

      {view && (
        <dl>
          {Object.entries({
            Device: view.name,
            Type: view.type,
            Store: view.storeLabel,
            'Serial No.': view.serial,
            Status: view.status,
            'Device ID': view.deviceIdentifier,
            'Device Code': view.deviceCode,
          }).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value || '—'}</dd>
            </div>
          ))}
        </dl>
      )}
    </dialog>
  </div>
);

}
