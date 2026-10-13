import React, { useEffect, useState } from "react";
import DeviceNavigation from "../components/DeviceNavigation";
import { useNavigate } from "react-router-dom";
import { Settings, ChevronDown } from "lucide-react";

import "../styles/add-device.css";
import { devicesApi } from "../api/devices";
import { listMerchants } from "../api/merchants";

const deviceTypes = ["POS Terminal", "Kitchen Display", "Barcode Scanner", "Receipt Printer", "Customer Display"]
  .map((label) => ({ value: label, label }));
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AddDevice({ merchantId: scopedMerchantId = "", merchant: scopedMerchant = null, embedded = false, onSave, onCancel } = {}) {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    deviceName: "",
    deviceId: "",
    deviceType: "",
    serialNumber: "",
    merchantId: "",
    merchantName: "",
    status: "Active",
    notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [merchants, setMerchants] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    if (scopedMerchantId && UUID_PATTERN.test(String(scopedMerchantId))) {
      const label = scopedMerchant?.businessDisplayName || scopedMerchant?.name || scopedMerchant?.businessName || String(scopedMerchantId);
      setMerchants([{ value: scopedMerchantId, label }]);
      setFormData((current) => ({ ...current, merchantId: scopedMerchantId, merchantName: label }));
      setLoadingOptions(false);
      return undefined;
    }
    let active = true;
    listMerchants()
      .then((merchantList) => {
        if (!active) return;
        const options = merchantList
          .map((merchant) => ({
            value: UUID_PATTERN.test(String(merchant.id || "")) ? merchant.id : merchant.uuid,
            label: merchant.businessDisplayName || merchant.name,
          }))
          .filter((item) => UUID_PATTERN.test(String(item.value || "")) && item.label);
        setMerchants(options);
        if (!options.length) {
          setApiError("No merchant UUIDs were returned. The merchant list must include each database UUID to create a device.");
        }
      })
      .catch((error) => { if (active) setApiError(error?.message || "Failed to load merchants."); })
      .finally(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, [scopedMerchantId, scopedMerchant]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setValidationErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const handleMerchantChange = async (e) => {
    const merchantId = e.target.value;
    const merchantName = merchants.find((merchant) => merchant.value === merchantId)?.label || "";
    setFormData((prev) => ({ ...prev, merchantId, merchantName }));
    setValidationErrors((current) => {
      if (!current.merchantId) return current;
      const next = { ...current };
      delete next.merchantId;
      return next;
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (saving) return;

    setApiError("");

    const nextValidationErrors = {
      ...(!formData.deviceName.trim() && { deviceName: true }),
      ...(!formData.deviceType && { deviceType: true }),
      ...(!formData.serialNumber.trim() && { serialNumber: true }),
      ...(!formData.merchantId && { merchantId: true }),
    };
    setValidationErrors(nextValidationErrors);
    if (Object.keys(nextValidationErrors).length) {
      requestAnimationFrame(() => {
        const firstInvalid = document.querySelector(".device-field-invalid input, .device-field-invalid select");
        firstInvalid?.focus?.();
        firstInvalid?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      });
      return;
    }


    setSaving(true);

    try {
      const response = typeof onSave === "function"
        ? await onSave({ ...formData, merchantId: scopedMerchantId || formData.merchantId })
        : await devicesApi.create({ ...formData, merchantId: formData.merchantId });
      if (response?.success === false) throw new Error(response.message || "Failed to create device.");

      if (typeof onCancel === "function") onCancel();
      else navigate("/devices");
    } catch (error) {
      console.error("Create device failed:", error);

      setApiError(
        error?.message ||
          error?.response?.message ||
          "Failed to create device. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`add-device-page${embedded ? "" : " add-device-standalone"}`}>
      {!embedded && <DeviceNavigation title="Add Device" onBack={() => (onCancel ? onCancel() : navigate("/devices"))} />}
      {/* HEADER */}
      {!embedded && <div className="add-device-header">
        <div>
          <h1>Add Device</h1>

          <p>Enter device information, assignments, and settings.</p>
        </div>
      </div>}

      {/* ERROR */}
      {apiError && <div className="device-api-error">{apiError}</div>}

      {/* FORM */}
      <form
        id="add-device-form"
        className="add-device-form"
        onSubmit={handleSave}
        noValidate
      >
        <section className="device-card">
          <CardHeader
            icon={<Settings size={19} />}
            title="Device Details"
            subtitle="Enter the device information, assignment details and settings."
          />

          <div className="device-form-grid">
            {/* DEVICE NAME */}
            <FormField label="Device Name" required invalid={validationErrors.deviceName}>
              <input
                name="deviceName"
                value={formData.deviceName}
                onChange={handleChange}
                placeholder="Enter device name (e.g. POS Terminal 01)"
                required
                aria-invalid={Boolean(validationErrors.deviceName)}
              />
            </FormField>

            {/* DEVICE ID */}
            <FormField label="Device ID">
              <input
                name="deviceId"
                value={formData.deviceId}
                onChange={handleChange}
                placeholder="Enter device ID "
              />
            </FormField>

            {/* GENERATED DEVICE CODE */}
            <FormField label="Device Code">
              <input
                value=""
                readOnly
                aria-readonly="true"
                placeholder="Auto-generated (e.g. DVC_00001)"
                className="device-code-readonly"
              />
            </FormField>

            {/* SERIAL NUMBER */}
            <FormField label="Device Serial Number" required invalid={validationErrors.serialNumber}>
              <input
                name="serialNumber"
                value={formData.serialNumber}
                onChange={handleChange}
                placeholder="Enter device serial number"
                required
                aria-invalid={Boolean(validationErrors.serialNumber)}
              />
            </FormField>

            {/* DEVICE TYPE */}
            <FormField label="Device Type" required invalid={validationErrors.deviceType}>
              <SelectField
                name="deviceType"
                value={formData.deviceType}
                onChange={handleChange}
                placeholder="Select device type"
                options={deviceTypes}
                disabled={!deviceTypes.length}
                required
                invalid={validationErrors.deviceType}
              />
            </FormField>

            {/* MERCHANT */}
            <FormField label="Merchant" required invalid={validationErrors.merchantId}>
              <SelectField
                name="merchantId"
                value={formData.merchantId}
                onChange={handleMerchantChange}
                placeholder="Select merchant"
                options={merchants}
                disabled={loadingOptions || !merchants.length}
                required
                invalid={validationErrors.merchantId}
              />
            </FormField>

            {/* STATUS */}
            <FormField label="Status" required>
              <SelectField
                name="status"
                value={formData.status}
                onChange={handleChange}
                options={[{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]}
                required
              />
            </FormField>
          </div>

          <div className="device-additional-information">
            <FormField label="Notes">
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Enter notes (optional)"
                maxLength={500}
                rows={4}
              />
              <div className="notes-counter">{formData.notes.length}/500</div>
            </FormField>
          </div>

        </section>
      </form>

      {/* ACTIONS */}
      <div className="add-device-actions">
        <button
          type="button"
          className="device-cancel-btn"
          onClick={() => (onCancel ? onCancel() : navigate("/devices"))}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="submit"
          form="add-device-form"
          className="device-save-btn"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Device"}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   CARD HEADER
========================================================= */

function CardHeader({ icon, title, subtitle }) {
  return (
    <div className="device-card-header">
      <div className="device-card-icon">{icon}</div>

      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

/* =========================================================
   FORM FIELD
========================================================= */

function FormField({ label, required, invalid, children }) {
  return (
    <div className={`device-field${invalid ? " device-field-invalid" : ""}`}>
      <label>
        {label}

        {required && <span className="required-star">*</span>}
      </label>

      {children}
    </div>
  );
}

/* =========================================================
   SELECT
========================================================= */

function SelectField({
  name,
  value,
  onChange,
  placeholder,
  options,
  required,
  disabled,
  invalid,
}) {
  return (
    <div className="device-select-wrapper">
      <select name={name} value={value} onChange={onChange} required={required} disabled={disabled} aria-invalid={Boolean(invalid)}>
        {placeholder && <option value="">{placeholder}</option>}

        {options.map((option) => {
          const item = typeof option === "string" ? { value: option, label: option } : option;
          return <option key={item.value} value={item.value}>
            {item.label}
          </option>
        })}
      </select>

      <ChevronDown size={16} className="device-select-arrow" />
    </div>
  );
}
