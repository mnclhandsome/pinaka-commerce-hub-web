import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./auth/ProtectedRoute";
import GuestRoute from "./auth/GuestRoute";
import AppLayout from "./layouts/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Merchants from "./pages/Merchants";
import MerchantStores from "./pages/MerchantStores";
import { useParams } from "react-router-dom";

function MerchantStoresRedirect() {
  const { merchantId } = useParams();
  return <Navigate to={`/merchants?view=${encodeURIComponent(merchantId || "")}&tab=stores`} replace />;
}
import Subscriptions from "./pages/Subscriptions";
import Stores from "./pages/Stores";
import Users from "./pages/Users";
import PosConfiguration from "./pages/pos/PosConfiguration";
import AddMerchant from "./pages/AddMerchant";
import AddStore from "./pages/AddStore";
import StoreConfiguration from "./pages/StoreConfiguration";
import Placeholder from "./pages/Placeholder";
import Legal from "./pages/Legal";
import Employees from "./pages/Employees";
import AddEmployee from "./pages/AddEmployee";
import EditEmployee from "./pages/EditEmployee";
import EmployeeView from "./pages/EmployeeView";
import Devices from "./pages/Devices";
import AddDevice from "./pages/AddDevice";
import DeviceView from "./pages/DeviceView";
import EditDevice from "./pages/EditDevice";
import Products from "./pages/Products";
import Coupons from "./pages/Coupons";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import OrderView from "./pages/OrderView";
import VendorView from "./pages/VendorView";
import CreateStoreType from "./pages/CreateStoreType";
import CreatePlan from "./pages/CreatePlan";
import StoreTypeDetails from "./pages/StoreTypeDetails";
import StoreTypeFeatures from "./pages/StoreTypeFeatures";
import StoreTypeRoleTemplates from "./pages/StoreTypeRoleTemplates";
import Features from "./pages/Features";
import FeaturePermissions from "./pages/FeaturePermissions";
import FeaturePermissionsOverview from "./pages/FeaturePermissionsOverview";
import FeatureOverview from "./pages/FeatureOverview";
import FeatureStoreTypes from "./pages/FeatureStoreTypes";
import FeaturePermissionDetails from "./pages/FeaturePermissionDetails";
import RoleTemplates from "./pages/Roletemplates";
import Vendors from "./pages/Vendors";
import Tenders from "./pages/Tenders";
import TenderDetails from "./pages/TenderDetails";
import ViewRoleTemplateOverview from "./pages/ViewRoleTemplateDetails";
import ViewRoleTemplateStoreTypes from "./pages/ViewRoleTemplateStoreTypes";
import ViewRoleTemplateAccess from "./pages/ViewRoleTemplateAccess";
import ViewPlanOverview from "./pages/ViewPlanOverview";
import ViewPlanPricing from "./pages/ViewPlanPricing";
import ViewPlanFeaturesLimits from "./pages/ViewPlanFeaturesLimits";
import CashManagement from "./pages/CashManagement";
import AddMerchantEmployee from "./pages/AddMerchantEmployee";
import { createEmployee } from "./api/employees";

const placeholders = [
  "Cash Management",
  "Shifts",
  "Attendance",
  "Integrations",
  "Synchronization",
  "Reconciliation",
  "Notifications",
  "Reports",
  "Audit Logs",
  "Settings",
];

export default function App() {
  const [localMerchants, setLocalMerchants] = useState([]);

  useEffect(() => {
    const messageFor = (input) => {
      const validity = input.validity;
      const labelNode = input.labels?.[0]?.cloneNode(true);
      labelNode?.querySelectorAll(".inline-validation-error").forEach((node) => node.remove());
      const label = labelNode?.textContent
        ?.replace(/\s+/g, " ")
        .replace(/\*|required/gi, "")
        .trim();
      const field = label || String(input.name || input.id || "This field")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/^./, (character) => character.toUpperCase());
      if (validity.valueMissing) return `${field} is required.`;
      if (validity.typeMismatch && input.type === "email") return "Enter a valid email address.";
      if (validity.typeMismatch && input.type === "url") return "Enter a valid URL.";
      if (validity.rangeUnderflow) return `Enter a value of at least ${input.min}.`;
      if (validity.rangeOverflow) return `Enter a value no greater than ${input.max}.`;
      if (validity.stepMismatch) return "Enter a valid value.";
      if (validity.tooShort) return `Enter at least ${input.minLength} characters.`;
      if (validity.tooLong) return `Enter no more than ${input.maxLength} characters.`;
      return input.validationMessage || "Check this field.";
    };
    const onInvalid = (event) => {
      const input = event.target;
      if (!(input instanceof HTMLElement) || input.dataset.noInlineValidation === "true") return;
      event.preventDefault();
      const field = input.closest("label") || input.closest(".form-group, .field, .form-field, .coupon-form-field") || input.parentElement;
      if (!field) return;
      field.classList.add("has-inline-validation-error");
      input.setAttribute("aria-invalid", "true");
      let message = field.querySelector(":scope > .inline-validation-error");
      if (!message) {
        message = document.createElement("small");
        message.className = "inline-validation-error";
        message.setAttribute("role", "alert");
        field.append(message);
      }
      message.textContent = messageFor(input);
      if (!input.id) input.id = `inline-validation-${Math.random().toString(36).slice(2)}`;
      const describedBy = new Set((input.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
      describedBy.add(message.id || (message.id = `${input.id}-error`));
      input.setAttribute("aria-describedby", [...describedBy].join(" "));
    };
    const onInput = (event) => {
      const input = event.target;
      if (!(input instanceof HTMLElement) || !input.checkValidity()) return;
      const field = input.closest("label") || input.closest(".form-group, .field, .form-field, .coupon-form-field") || input.parentElement;
      field?.classList.remove("has-inline-validation-error");
      const message = field?.querySelector(":scope > .inline-validation-error");
      if (message?.id) {
        const describedBy = new Set((input.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
        describedBy.delete(message.id);
        if (describedBy.size) input.setAttribute("aria-describedby", [...describedBy].join(" "));
        else input.removeAttribute("aria-describedby");
      }
      message?.remove();
      input.removeAttribute("aria-invalid");
    };
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
    };
  }, []);

  function saveLocalMerchant(merchant) {
    if (!merchant?.id) {
      throw new Error("Merchant ID is required before saving.");
    }

    setLocalMerchants((previous) => {
      const exists = previous.some(
        (item) => String(item.id) === String(merchant.id),
      );

      if (exists) {
        return previous.map((item) =>
          String(item.id) === String(merchant.id)
            ? { ...item, ...merchant }
            : item,
        );
      }

      return [merchant, ...previous];
    });
  }

  function removeLocalMerchant(merchantId) {
    setLocalMerchants((previous) =>
      previous.filter((item) => String(item.id) !== String(merchantId)),
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestRoute>
            <Login />
          </GuestRoute>
        }
      />

      <Route path="/privacy" element={<Legal privacy />} />
      <Route path="/terms" element={<Legal />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Merchant list, creation, and editing */}
        <Route
          path="/merchants"
          element={
            <Merchants
              onSaveEmployee={createEmployee}
              localMerchants={localMerchants}
              onLocalDelete={removeLocalMerchant}
            />
          }
        />
        <Route
          path="/merchants/new"
          element={
            <AddMerchant
              localMerchants={localMerchants}
              onSave={saveLocalMerchant}
            />
          }
        />
        <Route
          path="/merchants/:merchantId/edit"
          element={
            <AddMerchant
              localMerchants={localMerchants}
              onSave={saveLocalMerchant}
            />
          }
        />
        {/* Merchant stores */}
        <Route
          path="/merchants/:merchantId/stores"
          element={<MerchantStores />}
        />
        <Route
          path="/merchants/:merchantId/stores/new"
          element={<AddStore />}
        />
        <Route
          path="/merchants/:merchantId/stores/edit/:storeId"
          element={<AddStore />}
        />
        <Route path="/merchants/:merchantId/users" element={<Users />} />
        <Route
          path="/merchants/:merchantId/stores/:storeId/configuration"
          element={<StoreConfiguration />}
        />
        <Route
          path="/merchants/:merchantId/stores/:storeId/configuration/:section"
          element={<StoreConfiguration />}
        />
        <Route path="/cash-management" element={<CashManagement />} />
        {/* Subscriptions */}
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/merchant-subscriptions" element={<Subscriptions />} />
        <Route
          path="/merchants/:merchantId/employees/new"
          element={<AddMerchantEmployee />}
        />
        {/* Stores */}
        <Route path="/stores" element={<Stores />} />
        <Route path="/stores/new" element={<AddStore />} />
        <Route path="/stores/:storeId" element={<StoreConfiguration />} />
        <Route path="/merchants/:merchantId/stores/:storeId" element={<StoreConfiguration />} />
        <Route path="/stores/:storeId/edit" element={<AddStore />} />
        <Route
          path="/stores/:storeId/configuration"
          element={<StoreConfiguration />}
        />
        <Route
          path="/stores/:storeId/configuration/:section"
          element={<StoreConfiguration />}
        />
        {/* Products and orders */}
        <Route path="/products" element={<Products />} />
        <Route path="/coupons" element={<Coupons />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:orderId" element={<OrderDetail />} />
        {/* Users and POS */}
        <Route path="/users" element={<Users />} />
        <Route path="/pos-configuration" element={<PosConfiguration />} />
        {/* Employees */}
        <Route path="/employees" element={<Employees />} />
        <Route path="/employees/add" element={<AddEmployee />} />
        <Route path="/employees/edit" element={<EditEmployee />} />
        <Route path="/employees/:employeeId" element={<EmployeeView />} />
        <Route path="/editemployee" element={<EditEmployee />} />
        {/* Devices */}
        <Route path="/devices" element={<Devices />} />
        <Route path="/devices/add" element={<AddDevice />} />
        <Route path="/devices/:deviceId/edit" element={<EditDevice />} />
        <Route path="/devices/:deviceId" element={<DeviceView />} />
        {/* Remaining sections */}
        {placeholders.map((title) => (
          <Route
            key={title}
            path={`/${title.toLowerCase().replaceAll(" ", "-")}`}
            element={<Placeholder title={title} />}
          />
        ))}
        {/* Features */}
        <Route path="/features" element={<Features />} />
        <Route
          path="/features/:featureId/overview"
          element={<FeatureOverview />}
        />
        <Route
          path="/features/:featureId/store-types"
          element={<FeatureStoreTypes />}
        />
        <Route
          path="/features/:featureId/permissions"
          element={<FeaturePermissionDetails />}
        />
      
        
      
        {/* Master Setup */}
        <Route path="/vendors/add" element={<Vendors formOnly />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/vendors/:vendorId" element={<VendorView />} />
        <Route path="/tenders" element={<Tenders />} />
        <Route path="/tenders/:tenderId" element={<TenderDetails />} />
        <Route path="/role-templates" element={<RoleTemplates />} />
        <Route path="/plans/new" element={<CreatePlan />} />
        <Route path="/store-types" element={<CreateStoreType />} />
        <Route path="/store-types/new" element={<CreateStoreType />} />
        <Route path="/store-types/:storeTypeId"  element={<StoreTypeDetails />} />
        <Route path="/store-types/:storeTypeId/features"element={<StoreTypeFeatures />} />
        <Route path="/store-types/:storeTypeId/role-templates" element={<StoreTypeRoleTemplates />} />
        <Route path="/feature-permissions" element={<FeaturePermissions />} />
        <Route path="/features/:featureId/permissions/:permissionId"element={<FeaturePermissionsOverview />}/>
        <Route path="/role-templates/:roleId" element={<ViewRoleTemplateOverview />} />
        <Route path="/role-templates/:roleId/store-types"element={<ViewRoleTemplateStoreTypes />}/>
        <Route path="/role-templates/:roleId/access" element={<ViewRoleTemplateAccess />} />
        <Route path="/plans/:planId" element={<ViewPlanOverview />} />
        <Route path="/plans/:planId/pricing" element={<ViewPlanPricing />} />
        <Route path="/plans/:planId/features-limits" element={<ViewPlanFeaturesLimits />} />
        </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
