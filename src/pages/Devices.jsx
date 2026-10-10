import React, { useEffect, useMemo, useState } from "react";
 
import { useNavigate } from "react-router-dom";
 
import {
  Monitor,
  AlertCircle,
} from "lucide-react";
 
import "../styles/devices.css";
 
import { devicesApi } from "../api/devices";
import Pagination from "../components/Pagination";
import ListActions from "../components/ListActions";
import FiltersBar from "../components/FiltersBar";
 
export default function Devices() {
 
  /* ========================================================= STATE ========================================================= */ const [
 
    search,
 
    setSearch,
 
  ] = useState("");
 
  const [merchant, setMerchant] = useState("All Merchants");
 
  const [deviceType, setDeviceType] = useState("All Device Types");
 
  const [status, setStatus] = useState("All Statuses");
 
  const [currentPage, setCurrentPage] = useState(1);
 
  const [rowsPerPage, setRowsPerPage] = useState(10);
 
  const [devices, setDevices] = useState([]);
 
  const [loading, setLoading] = useState(true);
 
  const [apiError, setApiError] = useState("");
 
  const [deleteDevice, setDeleteDevice] = useState(null);
 
  const [deleting, setDeleting] = useState(false);
 
  const navigate = useNavigate();
 
  /* ========================================================= LOAD DEVICES ========================================================= */ useEffect(() => {
 
    loadDevices();
 
  }, []);
 
  const loadDevices = async () => {
 
    setLoading(true);
 
    setApiError("");
 
    try {
 
      const data = await devicesApi.list();
 
      setDevices(Array.isArray(data) ? data : []);
 
    } catch (error) {
 
      console.error("Failed to load devices:", error);
 
      setApiError(
 
        error?.message || "Failed to load devices. Please try again.",
 
      );
 
      setDevices([]);
 
    } finally {
 
      setLoading(false);
 
    }
 
  };
 
  /* ========================================================= DYNAMIC FILTER OPTIONS ========================================================= */ const merchantOptions =
 
    useMemo(() => {
 
      const values = devices.map((device) => device.merchant).filter(Boolean);
 
      return ["All Merchants", ...new Set(values)];
 
    }, [devices]);
 
 
 
  const deviceTypeOptions = useMemo(() => {
 
    const values = devices.map((device) => device.type).filter(Boolean);
 
    return ["All Device Types", ...new Set(values)];
 
  }, [devices]);
 
  /* ========================================================= FILTER DEVICES ========================================================= */ const filteredDevices =
 
    useMemo(() => {
 
      const query = search.trim().toLowerCase();
 
      return devices.filter((device) => {
 
        const matchesSearch =
 
          !query ||
 
          device.name?.toLowerCase().includes(query) ||
 
          device.id?.toLowerCase().includes(query) ||
 
          device.type?.toLowerCase().includes(query) ||
 
          device.serial?.toLowerCase().includes(query) ||
 
          device.merchant?.toLowerCase().includes(query) ;
 
        const matchesMerchant =
 
          merchant === "All Merchants" || device.merchant === merchant;
 
 
 
        const matchesType =
 
          deviceType === "All Device Types" || device.type === deviceType;
 
        const matchesStatus =
 
          status === "All Statuses" || device.status === status;
 
        return (
 
          matchesSearch &&
 
          matchesMerchant &&
 
          matchesType &&
 
          matchesStatus
 
        );
 
      });
 
    }, [devices, search, merchant, deviceType, status]);
 
  /* ========================================================= PAGINATION ========================================================= */ const totalPages =
 
    Math.max(1, Math.ceil(filteredDevices.length / rowsPerPage));
 
  const safePage = Math.min(currentPage, totalPages);
 
  const startIndex = (safePage - 1) * rowsPerPage;
 
  const displayedDevices = filteredDevices.slice(
 
    startIndex,
 
    startIndex + rowsPerPage,
 
  );
 
  const handleFilterChange = (setter, value) => {
 
    setter(value);
 
    setCurrentPage(1);
 
  };
 
  /* ========================================================= STATS ========================================================= */ const totalDevices =
 
    devices.length;
 
  const onlineDevices = devices.filter(
 
    (device) => ["Active", "Online"].includes(device.status),
 
  ).length;
 
  const offlineDevices = devices.filter(
 
    (device) => device.status === "Offline",
 
  ).length;
 
  const inactiveDevices = devices.filter(
 
    (device) => device.status === "Inactive",
 
  ).length;
 
  /* ========================================================= DEACTIVATE DEVICE ========================================================= */ const handleDeactivateDevice =
 
    async () => {
 
      if (!deleteDevice?.id || deleting) {
 
        return;
 
      }
 
      setDeleting(true);
 
      setApiError("");
 
      try {
 
        await devicesApi.update(deleteDevice.id, { status: "Inactive" });
 
        setDevices((current) => current.map((item) =>
          item.id === deleteDevice.id ? { ...item, status: "Inactive" } : item,
        ));
 
        setDeleteDevice(null);
 
        setCurrentPage(1);
 
      } catch (error) {
 
        console.error("Failed to deactivate device:", error);
 
        setApiError(
 
          error?.message || "Failed to deactivate device. Please try again.",
 
        );
 
      } finally {
 
        setDeleting(false);
 
      }
 
    };
 
  /* ========================================================= RENDER ========================================================= */ return (
 
    <div className="devices-page">
 
      {" "}
 
      {/* ===================================================== PAGE HEADER ===================================================== */}{" "}
 
      <div className="devices-page-header">
 
        {" "}
 
        <div>
 
          {" "}
 
          <h1>Devices</h1>{" "}
 
          <p className="devices-subtitle">
 
            View and manage devices connected to your stores.
 
          </p>{" "}
 
        </div>{" "}
 
        <div className="devices-header-actions">
 
          {" "}
 
          <button
 
            type="button"
 
            className="devices-add-btn"
 
            onClick={() => navigate("/devices/add")}
 
          >
 
            {" "}
 
            <span>+</span> Add Device{" "}
 
          </button>{" "}
 
          <button type="button" className="devices-export-btn">
 
            {" "}
 
            <span className="export-icon">↓</span> Export {" "}
 
          </button>{" "}
 
        </div>{" "}
 
      </div>{" "}
 
      {/* ===================================================== API ERROR ===================================================== */}{" "}
 
      {apiError && (
 
        <div className="devices-api-error">
 
          {" "}
 
          <AlertCircle size={17} /> <span>{apiError}</span>{" "}
 
          <button type="button" onClick={loadDevices}>
 
            {" "}
 
            Retry{" "}
 
          </button>{" "}
 
        </div>
 
      )}{" "}
 
      {/* ===================================================== STAT CARDS ===================================================== */}{" "}
 
      <div className="devices-stats">
 
        {" "}
 
        <StatCard
 
          icon={<i className="bi bi-laptop-fill" aria-hidden="true" />}
 
          title="Total Devices"
 
          value={totalDevices}
 
          variant="purple"
 
        />{" "}
 
        <StatCard
 
          icon={<i className="bi bi-check-circle-fill" aria-hidden="true" />}
 
          title="Online Devices"
 
          value={onlineDevices}
 
          variant="green"
 
        />{" "}
 
        <StatCard
 
          icon={<i className="bi bi-pause-circle-fill" aria-hidden="true" />}
 
          title="Offline Devices"
 
          value={offlineDevices}
 
          variant="orange"
 
        />{" "}
 
        <StatCard
 
          icon={<i className="bi bi-x-circle-fill" aria-hidden="true" />}
 
          title="Inactive Devices"
 
          value={inactiveDevices}
 
          variant="red"
 
        />{" "}
 
      </div>{" "}
 
      {/* ===================================================== FILTER CARD ===================================================== */}{" "}
 
      <div className="devices-list-card">
 
        {" "}
 
        <FiltersBar
  searchValue={search}
  onSearchChange={(value) => {
    setSearch(value);
    setCurrentPage(1);
  }}
  searchPlaceholder="Search by device name or serial number..."
  filters={[
    {
      key: "merchant",
      value: merchant,
      options: [
        { label: "All Merchants", value: "All Merchants" },
        ...merchantOptions
          .filter((option) => option !== "All Merchants")
          .map((option) => ({
            label: option,
            value: option,
          })),
      ],
      onChange: (value) => {
        setMerchant(value);
        setCurrentPage(1);
      },
    },
    {
      key: "deviceType",
      value: deviceType,
      options: [
        { label: "All Device Types", value: "All Device Types" },
        ...deviceTypeOptions
          .filter((option) => option !== "All Device Types")
          .map((option) => ({
            label: option,
            value: option,
          })),
      ],
      onChange: (value) => {
        setDeviceType(value);
        setCurrentPage(1);
      },
    },
    {
      key: "status",
      value: status,
      options: [
        { label: "All Statuses", value: "All Statuses" },
        { label: "Online", value: "Online" },
        { label: "Offline", value: "Offline" },
        { label: "Inactive", value: "Inactive" },
      ],
      onChange: (value) => {
        setStatus(value);
        setCurrentPage(1);
      },
    },
  ]}
  onClear={() => {
    setSearch("");
    setMerchant("All Merchants");
    setDeviceType("All Device Types");
    setStatus("All Statuses");
    setCurrentPage(1);
  }}
/>{" "}
 
        {/* =================================================== TABLE =================================================== */}{" "}
 
        <div className="devices-table-wrap">
 
          {" "}
 
          <table className="devices-table">
 
            {" "}
 
            <thead>
 
              {" "}
 
              <tr>
 
                {" "}

 
                <th>Device ID</th> <th>Device Code</th> <th>Device Name</th> <th>Device Type</th> <th>Serial Number</th>{" "}
 
                <th>Merchant Name</th> <th>Connection Status</th>{" "}
 
                 <th>Actions</th>{" "}
 
              </tr>{" "}
 
            </thead>{" "}
 
            <tbody>
 
              {" "}
 
              {loading ? (
 
                <tr>
 
                  {" "}
 
                  <td colSpan="8" className="devices-empty">
 
                    {" "}
 
                    Loading devices...{" "}
 
                  </td>{" "}
 
                </tr>
 
              ) : displayedDevices.length > 0 ? (
 
        displayedDevices.map((device) => (
  <DeviceRow
    key={device.id}
    device={device}
    onView={() => navigate(`/devices/${device.id}`)}
    onEdit={() => navigate(`/devices/${device.id}/edit`)}
    onDelete={() => setDeleteDevice(device)}
    deleting={deleting}
  />
))
 
              ) : (
 
                <tr>
 
                  {" "}
 
                 <td
                    colSpan="8"
                    style={{
                      textAlign: "center",
                      padding: "40px",
                    }}
                  >
 
                    {" "}
 
                    No devices found{" "}
 
                  </td>{" "}
 
                </tr>
 
              )}{" "}
 
            </tbody>{" "}
 
          </table>{" "}
 
        </div>{" "}
 
        {/* =================================================== PAGINATION =================================================== */}{" "}
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          totalItems={filteredDevices.length}
          pageSize={rowsPerPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setRowsPerPage(size);
            setCurrentPage(1);
          }}
          itemLabel="devices"
           showWhenEmpty={true}
        />
      </div>{" "}
      {/* ===================================================== DELETE MODAL ===================================================== */}{" "}
 
      <DeactivateDeviceModal
 
        device={deleteDevice}
 
        deleting={deleting}
 
        onCancel={() => (deleting ? null : setDeleteDevice(null))}
 
        onConfirm={handleDeactivateDevice}
 
      />{" "}
 
    </div>
 
  );
 
}
 
/* ========================================================= DEACTIVATION CONFIRMATION MODAL ========================================================= */ 
function DeactivateDeviceModal({
  device,
  deleting,
  onCancel,
  onConfirm,
}) {
  if (!device) {
    return null;
  }

  return (
    <div
      className="device-deactivate-overlay"
      role="presentation"
      onMouseDown={onCancel}
    >
      <div
        className="device-deactivate-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deactivate-device-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="device-deactivate-icon">
          <i className="bi bi-trash" aria-hidden="true" />
        </div>

        <h2 id="deactivate-device-title">
          Deactivate Device
        </h2>

        <p className="device-deactivate-message">
          Are you sure you want to deactivate{" "}
          <strong>{device.name || "this device"}</strong>?
        </p>

        <p className="device-deactivate-warning">
          This device will no longer be active.
        </p>

        <div className="device-deactivate-actions">
          <button
            type="button"
            className="device-deactivate-cancel"
            onClick={onCancel}
            disabled={deleting}
          >
            Cancel
          </button>

          <button
            type="button"
            className="device-deactivate-confirm"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Deactivating..." : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}
 
/* ========================================================= STAT CARD ========================================================= */ function StatCard({
 
  icon,
 
  title,
 
  value,
 
  variant,
 
}) {
 
  return (
 
    <div className="device-stat-card">
 
      {" "}
 
      <div className={`device-stat-icon ${variant}`}> {icon} </div>{" "}
 
      <div className="device-stat-content">
 
        {" "}
 
        <div className="device-stat-title"> {title} </div>{" "}
 
        <div className="device-stat-value"> {value} </div>{" "}
 
      </div>{" "}
 
    </div>
 
  );
 
}
 
/* ========================================================= FILTER SELECT ========================================================= */ function FilterSelect({
 
  value,
 
  onChange,
 
  options,
 
}) {
 
  return (
 
    <div className="device-filter-select">
 
      {" "}
 
      <select value={value} onChange={(e) => onChange(e.target.value)}>
 
        {" "}
 
        {options.map((option) => (
 
          <option key={option} value={option}>
 
            {" "}
 
            {option}{" "}
 
          </option>
 
        ))}{" "}
 
      </select>{" "}
 
      <ChevronDown size={15} className="device-filter-arrow" />{" "}
 
    </div>
 
  );
 
}
 
/* =========================================================
   TABLE ROW
========================================================= */
function DeviceRow({
  device,
  onView,
  onEdit,
  onDelete,
  deleting,
}) {
  const normalizedStatus =
    device.status?.toLowerCase().replace(/\s+/g, "-") || "unknown";

  return (
    <tr>
      {/* DEVICE ID */}
      <td>{device.deviceId || device.device_id || "-"}</td>

      {/* DEVICE CODE */}
      <td>{device.code || device.deviceCode || "-"}</td>
  
     {/* DEVICE NAME */}
      <td>
        <div className="device-name-cell">
          <div>
            <div className="device-name">
              {device.name || "-"}
            </div>

          </div>
        </div>
      </td>

      {/* DEVICE TYPE */}
      <td>
        {device.type || "-"}
      </td>

      {/* SERIAL NUMBER */}
      <td>
        {device.serial || "-"}
      </td>

      {/* MERCHANT NAME */}
      <td>
        {device.merchant || "-"}
      </td>

      {/* CONNECTION STATUS */}
      <td>
        <span className={`device-status ${normalizedStatus}`}>
          {device.status || "-"}
        </span>
      </td>

      {/* ACTIONS */}
      <td>
        <ListActions
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          viewLabel={`View ${device.name || "device"}`}
          editLabel={`Edit ${device.name || "device"}`}
          deleteLabel={`Deactivate ${device.name || "device"}`}
          deleteDisabled={deleting}
        />
      </td>
    </tr>
  );
}
