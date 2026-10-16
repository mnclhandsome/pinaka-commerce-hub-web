import React, { useEffect, useState } from "react";
import DeviceNavigation from "../components/DeviceNavigation";
import {
  ArrowLeft,
  Save,
  Settings,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { devicesApi } from "../api/devices";
import "../styles/device-view.css";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditDevice() {
  const navigate = useNavigate();
  const { deviceId } = useParams();

  const [form, setForm] = useState({
    deviceName: "",
    deviceCode: "",
    deviceId: "",
    deviceType: "",
    serialNumber: "",
    merchantId: "",
    merchantName: "",
    status: "Active",
    notes: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});

  /* =========================================================
     LOAD DEVICE
  ========================================================= */

  useEffect(() => {
    if (!deviceId) {
      setApiError("Device ID is missing.");
      setLoading(false);
      return;
    }

    loadDevice();
  }, [deviceId]);

  const loadDevice = async () => {
    setLoading(true);
    setApiError("");

    try {
      const data = await devicesApi.get(deviceId);
      if (!data) {
        throw new Error("Device not found.");
      }

      setForm({
        deviceName: data.name || "",
        deviceCode: data.code || "",
        deviceId: data.deviceId || "",
        deviceType: data.type || "",
        serialNumber: data.serial || "",
        merchantId: data.merchantId || "",
        merchantName: data.merchantName || (typeof data.merchant === "string" ? data.merchant : data.merchant?.name) || "",
        status: String(data.status || "ACTIVE").toUpperCase() === "INACTIVE" ? "Inactive" : "Active",
        notes: data.notes || "",
      });
    } catch (error) {
      console.error("Failed to load device:", error);

      setApiError(error?.message || "Failed to load device. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     FORM CHANGE
  ========================================================= */

  const update = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setValidationErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const errors = {};
    if (!form.deviceName.trim()) errors.deviceName = "Device Name is required.";
    if (!form.deviceType) errors.deviceType = "Device Type is required.";
    if (!form.serialNumber.trim()) errors.serialNumber = "Serial Number is required.";
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* =========================================================
     SAVE
  ========================================================= */

  const save = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (!deviceId) {
      setApiError("Device ID is missing.");
      return;
    }

    setSaving(true);
    setApiError("");

    try {
      const response = await devicesApi.update(deviceId, {
        ...form,
        merchantId: form.merchantId,
      });
      if (response?.success === false) {
        throw new Error(response.message || "Failed to update device.");
      }

      navigate(`/devices/${deviceId}`);
    } catch (error) {
      console.error("Update device failed:", error);

      setApiError(
        error?.message || "Failed to update device. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     SELECT
  ========================================================= */

  const select = (name, value, options, placeholder) => (
    <div className={`device-edit-select${validationErrors[name] ? " field-invalid" : ""}`}>
      <select name={name} value={value} onChange={update} required aria-invalid={Boolean(validationErrors[name])}>
        <option value="">{placeholder}</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <ChevronDown size={15} />
      {validationErrors[name] && <small className="device-field-error" role="alert">{validationErrors[name]}</small>}
    </div>
  );

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="device-view-page">
        <div className="device-view-loading">Loading device...</div>
      </div>
    );
  }

  /* =========================================================
     ERROR
  ========================================================= */

  if (apiError && !form.deviceName) {
    return (
      <div className="device-view-page">
        <div className="device-view-error">
          <AlertCircle size={20} />

          <span>{apiError}</span>

          <button type="button" onClick={loadDevice}>
            Retry
          </button>
        </div>

        <button
          type="button"
          className="device-view-back"
          onClick={() => navigate("/devices")}
        >
          <ArrowLeft size={15} />
          Back to Devices
        </button>
      </div>
    );
  }

  /* =========================================================
     PAGE
  ========================================================= */

  return (
    <div className="device-view-page">
      <DeviceNavigation title="Edit Device" onBack={() => navigate("/devices")} />
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="device-view-header">
        <div>
          <h1>Edit Device</h1>

          <p>Update device information, assignments, and settings.</p>
        </div>
      </div>

      {/* =====================================================
          ERROR MESSAGE
      ===================================================== */}

      {apiError && (
        <div className="device-edit-api-error">
          <AlertCircle size={18} />
          <span>{apiError}</span>
        </div>
      )}

      {/* =====================================================
          FORM
      ===================================================== */}

      <form id="edit-device-form" onSubmit={save} className="device-view-card" noValidate>
        {/* CARD HEADER */}

        <div className="device-card-header">
          <div className="device-card-icon">
            <Settings size={19} />
          </div>

          <div>
            <h2>Device Details</h2>

            <p>
              Update the device information, assignment details and settings.
            </p>
          </div>
        </div>

        {/* =================================================
            FIELDS
        ================================================= */}

        <div className="device-view-grid">
          {/* DEVICE NAME */}

          <EditField label="Device Name" required error={validationErrors.deviceName}>
            <input
              name="deviceName"
              value={form.deviceName}
              onChange={update}
              placeholder="Enter device name"
              required
              aria-invalid={Boolean(validationErrors.deviceName)}
            />
          </EditField>

          {/* DEVICE CODE */}

          <EditField label="Device Code">
            <input
              name="deviceCode"
              value={form.deviceCode}
              readOnly
              placeholder="Generated after saving"
            />
          </EditField>

          <EditField label="Device ID">
            <input
              name="deviceId"
              value={form.deviceId}
              onChange={update}
              placeholder="Enter device ID (optional)"
            />
          </EditField>

          {/* DEVICE TYPE */}

          <EditField label="Device Type" required error={validationErrors.deviceType}>
            {select(
              "deviceType",
              form.deviceType,
              [
                "POS Terminal",
                "Kitchen Display",
                "Barcode Scanner",
                "Receipt Printer",
                "Customer Display",
              ],
              "Select device type",
            )}
          </EditField>

          {/* SERIAL NUMBER */}

          <EditField label="Serial Number" required error={validationErrors.serialNumber}>
            <input
              name="serialNumber"
              value={form.serialNumber}
              readOnly
              placeholder="Enter serial number"
              required
              aria-invalid={Boolean(validationErrors.serialNumber)}
            />
          </EditField>

          {/* MERCHANT */}

          <EditField label="Merchant" required>
            <input value={form.merchantName || "—"} readOnly aria-readonly="true" />
          </EditField>

          {/* STATUS */}

          <EditField label="Status" required>
            {select(
              "status",
              form.status,
              ["Active", "Inactive"],
              "Select status",
            )}
          </EditField>
        </div>

        {/* =================================================
            NOTES
        ================================================= */}

        <div className="device-view-section edit-notes">
          <div className="device-view-section-title">
            Additional Information
          </div>

          <div className="device-edit-notes-wrap">
            <textarea
              name="notes"
              value={form.notes}
              onChange={update}
              maxLength={500}
              placeholder="Enter notes (optional)"
              rows={4}
            />

            <span>{form.notes.length}/500</span>
          </div>
        </div>

      </form>

      {/* =================================================
          ACTIONS
      ================================================= */}

      <div className="device-view-actions">
        <button
          type="button"
          className="device-view-cancel"
          onClick={() => navigate("/devices")}
          disabled={saving}
        >
          Cancel
        </button>

        <button type="submit" form="edit-device-form" className="device-view-save" disabled={saving}>
          <Save size={15} />

          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   EDIT FIELD
========================================================= */

function EditField({ label, required, error, children }) {
  return (
    <div className={`device-view-field edit-field${error ? " field-invalid" : ""}`}>
      <label>
        {label}

        {required && <span className="required-star">*</span>}
      </label>

      {children}
      {error && <small className="device-field-error" role="alert">{error}</small>}
    </div>
  );
}
