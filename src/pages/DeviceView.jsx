import React, { useEffect, useState } from "react";
import DeviceNavigation from "../components/DeviceNavigation";
import {
  ArrowLeft,
  Monitor,
  Link2,
  FileText,
  AlertCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { devicesApi } from "../api/devices";
import "../styles/device-view.css";
export default function DeviceView() {
  const navigate = useNavigate();
  const { deviceId } = useParams();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  /* ========================================================= LOAD DEVICE ========================================================= */ useEffect(() => {
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
      setDevice(data);
    } catch (error) {
      console.error("Failed to load device:", error);
      setApiError(error?.message || "Failed to load device. Please try again.");
      setDevice(null);
    } finally {
      setLoading(false);
    }
  };
  /* ========================================================= LOADING STATE ========================================================= */ if (
    loading
  ) {
    return (
      <div className="device-view-page">
        {" "}
        <div className="device-view-loading"> Loading device... </div>{" "}
      </div>
    );
  }
  /* ========================================================= ERROR STATE ========================================================= */ if (
    apiError ||
    !device
  ) {
    return (
      <div className="device-view-page">
        {" "}
        <div className="device-view-error">
          {" "}
          <AlertCircle size={20} />{" "}
          <span> {apiError || "Device not found."} </span>{" "}
          <button type="button" onClick={loadDevice}>
            {" "}
            Retry{" "}
          </button>{" "}
        </div>{" "}
        <button
          type="button"
          className="device-view-back"
          onClick={() => navigate("/devices")}
        >
          {" "}
          <ArrowLeft size={15} /> Back to Devices{" "}
        </button>{" "}
      </div>
    );
  }
  /* ========================================================= NORMALIZED VALUES ========================================================= */ const deviceName =
    device.name || "-";
  const deviceCode = device.code || "-";
  const deviceType = device.type || "-";
  const serialNumber = device.serial || "-";
  const merchant = device.merchant || "-";
  const store = device.store || "-";
  const status = device.status || "-";
  const lastSeen = device.lastSeen || "-";
  const notes = device.notes || "";
  const enabled = Boolean(device.enableImmediately);
  const normalizedStatus =
    status !== "-" ? status.toLowerCase().replace(/\s+/g, "-") : "unknown";
  return (
    <div className="device-view-page">
      <DeviceNavigation title="View Device" onBack={() => navigate("/devices")} />
      {" "}
      {/* ===================================================== PAGE HEADER ===================================================== */}{" "}
      <div className="device-view-header">
        {" "}
        <div>
          {" "}
          <h1>View Device</h1>{" "}
          <p>View device information, assignments, and settings.</p>{" "}
        </div>{" "}
      </div>{" "}
      {/* ===================================================== DEVICE DETAILS ===================================================== */}{" "}
      <div className="device-view-card">
        {" "}
        <CardHeader
          icon={<Monitor size={19} />}
          title="Device Details"
          subtitle="View the device information, assignment details and settings."
        />{" "}
        <div className="device-view-grid">
          {" "}
          <Info label="Device Name" value={deviceName} />{" "}
          <Info label="Device Code" value={deviceCode} />{" "}
          <Info label="Device ID" value={device.deviceId || "—"} />{" "}
          <Info label="Device Type" value={deviceType} />{" "}
          <Info label="Serial Number" value={serialNumber} />{" "}
          <Info label="Merchant" value={merchant} />{" "}
          <Info label="Store" value={store} />{" "}
          <Info label="Status" value={status} status={normalizedStatus} />{" "}
        </div>{" "}
        {/* ================================================= ENABLED STATUS ================================================= */}{" "}
        {enabled && (
          <div className="device-view-enabled">
            {" "}
            <span className="device-view-check"> ✓ </span> Device is enabled for
            usage{" "}
          </div>
        )}{" "}
       
        {/* ================================================= ADDITIONAL INFORMATION ================================================= */}{" "}
        <div className="device-view-section">
          {" "}
          <div className="device-view-section-title">
            {" "}
            <FileText size={17} /> Additional Information{" "}
          </div>{" "}
          <div className="device-view-notes">
            {" "}
            {notes || "No notes added for this device."}{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
      {/* ===================================================== META INFORMATION ===================================================== */}{" "}
      <div className="device-view-meta-grid">
        {" "}
        <div className="device-view-meta-card">
          {" "}
          <div className="device-view-meta-icon">
            {" "}
            <Link2 size={18} />{" "}
          </div>{" "}
          <div>
            {" "}
            <span>Last Seen</span> <strong>{lastSeen}</strong>{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
}
/* ========================================================= CARD HEADER ========================================================= */ function CardHeader({
  icon,
  title,
  subtitle,
}) {
  return (
    <div className="device-card-header">
      {" "}
      <div className="device-card-icon"> {icon} </div>{" "}
      <div>
        {" "}
        <h2>{title}</h2> <p>{subtitle}</p>{" "}
      </div>{" "}
    </div>
  );
}
/* ========================================================= INFO FIELD ========================================================= */ function Info({
  label,
  value,
  status,
}) {
  return (
    <div className="device-view-field">
      {" "}
      <label>{label}</label>{" "}
      {status ? (
        <span className={`device-view-status ${status}`}> {value} </span>
      ) : (
        <div className="device-view-value"> {value || "-"} </div>
      )}{" "}
    </div>
  );
}
