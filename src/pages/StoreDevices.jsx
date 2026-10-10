import FilterDropdown from "../components/FilterDropdown";
import { useEffect, useMemo, useState } from "react";
import Pagination from "../components/Pagination";
import { storeDevicesSeed } from "../data/data";
import "../styles/store-devices.css";

export default function StoreDevices({
  embedded = false,
  merchantId,
  storeId,
  store,
}) {
  // =========================================================
  // FILTERS
  // =========================================================

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // =========================================================
  // PAGINATION
  // =========================================================

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // =========================================================
  // FORM
  // =========================================================

  const [showForm, setShowForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [viewingDevice, setViewingDevice] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    deviceId: "",
    serialNumber: "",
    type: "",
    quantity: 1,
    status: "Active",
  });

  const [formErrors, setFormErrors] = useState({});

  // =========================================================
  // DEVICES
  // =========================================================

  const [devices, setDevices] = useState(storeDevicesSeed || []);

  // =========================================================
  // DEVICE TYPES
  // =========================================================

  const deviceTypes = useMemo(() => {
    return [...new Set(devices.map((device) => device.type).filter(Boolean))];
  }, [devices]);

  // =========================================================
  // FILTER DEVICES
  // =========================================================

  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      const searchText = `
                ${device.name || ""}
                ${device.deviceId || ""}
                ${device.type || ""}
                ${device.status || ""}
            `.toLowerCase();

      const matchesSearch =
        !search || searchText.includes(search.toLowerCase());

      const matchesType = !typeFilter || device.type === typeFilter;

      const matchesStatus = !statusFilter || device.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [devices, search, typeFilter, statusFilter]);

  // =========================================================
  // PAGINATION
  // =========================================================

  const totalItems = filteredDevices.length;

  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedDevices = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;

    const endIndex = startIndex + pageSize;

    return filteredDevices.slice(startIndex, endIndex);
  }, [filteredDevices, currentPage, pageSize]);

  // =========================================================
  // RESET PAGE WHEN FILTERS CHANGE
  // =========================================================

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, statusFilter]);

  // =========================================================
  // KEEP PAGE VALID
  // =========================================================

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // =========================================================
  // SUMMARY
  // =========================================================

  const activeCount = devices.filter(
    (device) => device.status === "Active",
  ).length;

  const inactiveCount = devices.filter(
    (device) => device.status === "Inactive",
  ).length;

  // =========================================================
  // CLEAR FILTERS
  // =========================================================

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
    setCurrentPage(1);
  };

  // =========================================================
  // OPEN ADD FORM
  // =========================================================

  const handleAddDevice = () => {
    setEditingDevice(null);

    setFormData({
      name: "",
      deviceId: "",
      serialNumber: "",
      type: "",
      quantity: 1,
      status: "Active",
    });

    setFormErrors({});
    setShowForm(true);
  };

  // =========================================================
  // OPEN EDIT FORM
  // =========================================================

  const handleEditDevice = (device) => {
    setEditingDevice(device);

    setFormData({
      name: device.name || "",
      deviceId: device.deviceId || "",
      serialNumber: device.serialNumber || "",
      type: device.type || "",
      quantity: Math.max(1, Number(device.quantity) || 1),
      status: device.status || "Active",
    });

    setFormErrors({});
    setShowForm(true);
  };

  // =========================================================
  // CLOSE FORM
  // =========================================================

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingDevice(null);
    setFormErrors({});
  };

  // =========================================================
  // FORM CHANGE
  // =========================================================

  const handleFormChange = (field, value) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));

    setFormErrors((previous) => ({
      ...previous,
      [field]: "",
    }));
  };

  // =========================================================
  // VALIDATION
  // =========================================================

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = "Device name is required.";
    }

    if (!formData.type) {
      errors.type = "Device type is required.";
    }

    if (!formData.status) {
      errors.status = "Device status is required.";
    }

    setFormErrors(errors);

    return Object.keys(errors).length === 0;
  };

  // =========================================================
  // SAVE DEVICE
  // =========================================================

  const handleSaveDevice = (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    const now = new Date();

    const formattedDate = now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    // =====================================================
    // EDIT
    // =====================================================

    if (editingDevice) {
      setDevices((previous) =>
        previous.map((device) =>
          device.id === editingDevice.id
            ? {
                ...device,
                name: formData.name.trim(),
                deviceId: formData.deviceId.trim(),
                serialNumber: formData.serialNumber.trim(),
                type: formData.type,
                quantity: Math.max(1, Number(formData.quantity) || 1),
                status: formData.status,
                updatedAt: formattedDate,
              }
            : device,
        ),
      );

      /*
       * API WILL BE CONNECTED HERE
       *
       * Example:
       *
       * await updateStoreDevice({
       *     merchantId,
       *     storeId,
       *     deviceId: editingDevice.id,
       *     ...formData,
       * });
       */

      handleCloseForm();
      return;
    }

    // =====================================================
    // ADD
    // =====================================================

    const newDevice = {
      id: `DEV-${Date.now()}`,
      name: formData.name.trim(),
      deviceId: formData.deviceId.trim(),
      serialNumber: formData.serialNumber.trim(),
      type: formData.type,
      quantity: Math.max(1, Number(formData.quantity) || 1),
      status: formData.status,
      updatedAt: formattedDate,
    };

    setDevices((previous) => [newDevice, ...previous]);

    /*
     * API WILL BE CONNECTED HERE
     *
     * Example:
     *
     * await createStoreDevice({
     *     merchantId,
     *     storeId,
     *     ...formData,
     * });
     */

    handleCloseForm();
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="store-devices-page">
      {/* =================================================
                HEADER
            ================================================= */}

      <div className="store-devices-header">
        <div className="store-devices-title-area">
          <div className="store-devices-title-icon">
            <i className="bi bi-pc-display" />
          </div>

          <div>
            <h1>Devices</h1>

            <p>Manage devices connected to this store.</p>
          </div>
        </div>

        <div className="store-devices-header-actions">
          {store && (
            <div className="store-devices-context">
              <i className="bi bi-shop" />

              <div>
                <span>STORE</span>

                <strong>{store.name}</strong>

                <small>{store.id}</small>
              </div>
            </div>
          )}

          <button
            type="button"
            className="store-device-add-btn"
            onClick={handleAddDevice}
          >
            <i className="bi bi-plus-lg" />
            Add Device
          </button>
        </div>
      </div>

      {/* =================================================
                SUMMARY
            ================================================= */}

      <div className="store-devices-summary">
        {/* TOTAL */}

        <div className="store-device-summary-card">
          <div className="store-device-summary-icon purple">
            <i className="bi bi-pc-display" />
          </div>

          <div>
            <span>Total Devices</span>

            <strong>{devices.length}</strong>
          </div>
        </div>

        {/* ACTIVE */}

        <div className="store-device-summary-card">
          <div className="store-device-summary-icon green">
            <i className="bi bi-check-circle" />
          </div>

          <div>
            <span>Active</span>

            <strong>{activeCount}</strong>
          </div>
        </div>

        {/* INACTIVE */}

        <div className="store-device-summary-card">
          <div className="store-device-summary-icon orange">
            <i className="bi bi-pause-circle" />
          </div>

          <div>
            <span>Inactive</span>

            <strong>{inactiveCount}</strong>
          </div>
        </div>
      </div>

      {/* =================================================
                MAIN CARD
            ================================================= */}

      <div className="store-devices-card">
        {/* =================================================
                    TOOLBAR
                ================================================= */}

        <div className="store-devices-toolbar">
          {/* SEARCH */}

          <div className="store-devices-search">
            <i className="bi bi-search" />

            <input
              type="text"
              placeholder="Search device name or device ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* DEVICE TYPE */}

          <FilterDropdown
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Device Types</option>

            {deviceTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </FilterDropdown>

          {/* STATUS */}

          <FilterDropdown
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>

            <option value="Active">Active</option>

            <option value="Inactive">Inactive</option>
          </FilterDropdown>

          {/* CLEAR */}

          <button
            type="button"
            className="store-devices-clear-btn"
            onClick={clearFilters}
          >
            <i className="bi bi-arrow-counterclockwise" />
            Clear
          </button>
        </div>

        {/* =================================================
                    TABLE HEADING
                ================================================= */}

        <div className="store-devices-table-heading">
          <div>
            Devices
            <span>{filteredDevices.length}</span>
          </div>
        </div>

        {/* =================================================
                    TABLE
                ================================================= */}

        <div className="store-devices-table-wrapper">
          <table className="store-devices-table">
            <thead>
              <tr>
                <th>Device ID</th>
                <th>Device Code</th>
                <th>Device Name</th>
                <th>Device Type</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {paginatedDevices.map((device) => (
                <DeviceRow
                  key={device.id}
                  device={device}
                  onView={setViewingDevice}
                  onEdit={handleEditDevice}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* =================================================
                    EMPTY STATE
                ================================================= */}

        {filteredDevices.length === 0 && (
          <div className="store-devices-empty">
            <div className="store-devices-empty-icon">
              <i className="bi bi-pc-display" />
            </div>

            <h3>No devices found</h3>

            <p>Try changing your search or filters.</p>

            <button type="button" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
        )}

        {/* =================================================
                    PAGINATION
                ================================================= */}

        {filteredDevices.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </div>

      {/* =====================================================
                ADD / EDIT DEVICE MODAL
            ===================================================== */}

      {showForm && (
        <div
          className="store-device-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseForm();
            }
          }}
        >
          <div className="store-device-modal">
            {/* MODAL HEADER */}

            <div className="store-device-modal-header">
              <div>
                <h2>{editingDevice ? "Edit Device" : "Add Device"}</h2>

                <p>
                  {editingDevice
                    ? "Update device information."
                    : "Add a device to this store."}
                </p>
              </div>

              <button
                type="button"
                className="store-device-modal-close"
                onClick={handleCloseForm}
                aria-label="Close"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {/* FORM */}

            <form onSubmit={handleSaveDevice}>
              <div className="store-device-form-body">
                {/* DEVICE NAME */}

                <div className="store-device-form-group">
                  <label>
                    Device Name
                    <span>*</span>
                  </label>

                  <input
                    type="text"
                    value={formData.name}
                    placeholder="Enter device name"
                    onChange={(e) => handleFormChange("name", e.target.value)}
                  />

                  {formErrors.name && (
                    <small className="store-device-form-error">
                      {formErrors.name}
                    </small>
                  )}
                </div>

                {/* DEVICE TYPE */}

                <div className="store-device-form-group">
                  <label>
                    Device Type
                    <span>*</span>
                  </label>

                  <select
                    value={formData.type}
                    onChange={(e) => handleFormChange("type", e.target.value)}
                  >
                    <option value="">Select device type</option>

                    <option value="POS Terminal">POS Terminal</option>

                    <option value="Kiosk">Kiosk</option>

                    <option value="Printer">Printer</option>

                    <option value="Scanner">Scanner</option>

                    <option value="Display">Display</option>

                    <option value="Other">Other</option>
                  </select>

                  {formErrors.type && (
                    <small className="store-device-form-error">
                      {formErrors.type}
                    </small>
                  )}
                </div>

                {/* DEVICE IDENTIFIERS - MAPPED AFTER DEVICE TYPE IS SELECTED */}

                {formData.type && (
                  <>
                    <div className="store-device-form-group">
                      <label>Device ID</label>
                      <input
                        className="store-device-mapped-field"
                        type="text"
                        value={formData.deviceId}
                        placeholder="Mapped"
                        readOnly
                        aria-label="Mapped"
                      />
                      <small className="store-device-mapped-hint">
                        Mapped from the selected device type.
                      </small>
                    </div>

                    <div className="store-device-form-group">
                      <label>Device Serial Number</label>
                      <input
                        className="store-device-mapped-field"
                        type="text"
                        value={formData.serialNumber}
                        placeholder="Mapped"
                        readOnly
                        aria-label="Mapped "
                      />
                      <small className="store-device-mapped-hint">
                        Mapped from the selected device type.
                      </small>
                    </div>
                  </>
                )}

                {/* QUANTITY */}
                <div className="store-device-form-group">
                  <label>
                    Quantity
                    <span>*</span>
                  </label>

                  <div className="store-device-quantity-control">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() =>
                        handleFormChange(
                          "quantity",
                          Math.max(1, Number(formData.quantity || 1) - 1),
                        )
                      }
                    >
                      <i className="bi bi-dash-lg" />
                    </button>

                    <input
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) =>
                        handleFormChange(
                          "quantity",
                          Math.max(1, Number(e.target.value) || 1),
                        )
                      }
                    />

                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() =>
                        handleFormChange(
                          "quantity",
                          Number(formData.quantity || 1) + 1,
                        )
                      }
                    >
                      <i className="bi bi-plus-lg" />
                    </button>
                  </div>
                </div>

                {/* STATUS */}

                <div className="store-device-form-group">
                  <label>
                    Status
                    <span>*</span>
                  </label>

                  <select
                    value={formData.status}
                    onChange={(e) => handleFormChange("status", e.target.value)}
                  >
                    <option value="Active">Active</option>

                    <option value="Inactive">Inactive</option>
                  </select>

                  {formErrors.status && (
                    <small className="store-device-form-error">
                      {formErrors.status}
                    </small>
                  )}
                </div>
              </div>

              {/* FORM FOOTER */}

              <div className="store-device-modal-footer">
                <button
                  type="button"
                  className="store-device-cancel-btn"
                  onClick={handleCloseForm}
                >
                  Cancel
                </button>

                <button type="submit" className="store-device-save-btn">
                  <i
                    className={
                      editingDevice ? "bi bi-check-lg" : "bi bi-plus-lg"
                    }
                  />

                  {editingDevice ? "Update Device" : "Save Device"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingDevice && (
        <div
          className="store-device-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setViewingDevice(null);
            }
          }}
        >
          <div
            className="store-device-modal store-device-view-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="store-device-modal-header">
              <div>
                <h2>Device Details</h2>
                <p>
                  View device information for{" "}
                  <strong>{viewingDevice.name}</strong>.
                </p>
              </div>

              <button
                type="button"
                className="store-device-modal-close"
                onClick={() => setViewingDevice(null)}
                aria-label="Close"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="store-device-view-body">
              <div className="store-device-view-identity">
                <div className="store-device-view-icon">
                  <i className="bi bi-pc-display" />
                </div>

                <div>
                  <strong>{viewingDevice.name}</strong>
                  <span>{viewingDevice.deviceId || viewingDevice.id}</span>
                </div>
              </div>

              <div className="store-device-view-grid">
                <div className="store-device-view-field">
                  <span>Device Name</span>
                  <strong>{viewingDevice.name || "—"}</strong>
                </div>

                <div className="store-device-view-field">
                  <span>Device ID</span>
                  <strong>{viewingDevice.deviceId || "—"}</strong>
                </div>

                <div className="store-device-view-field">
                  <span>Device Type</span>
                  <strong>{viewingDevice.type || "—"}</strong>
                </div>

                <div className="store-device-view-field">
                  <span>Status</span>
                  <strong
                    className={`store-device-view-status ${
                      viewingDevice.status === "Active" ? "active" : "inactive"
                    }`}
                  >
                    {viewingDevice.status || "—"}
                  </strong>
                </div>

                <div className="store-device-view-field full">
                  <span>Last Updated</span>
                  <strong>{viewingDevice.updatedAt || "Recently"}</strong>
                </div>
              </div>
            </div>

            <div className="store-device-modal-footer">
              <button
                type="button"
                className="store-device-cancel-btn"
                onClick={() => setViewingDevice(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================
// DEVICE ROW
// =========================================================

function DeviceRow({ device, onView, onEdit }) {
  const statusClass = device.status === "Active" ? "active" : "inactive";

  return (
    <tr>
      {/* DEVICE ID */}
      <td>
        <span className="store-device-id">{device.deviceId || device.device_id || "—"}</span>
      </td>

      {/* DEVICE CODE */}
      <td>{device.code || device.deviceCode || "—"}</td>

      {/* DEVICE NAME */}

      <td>
        <div className="store-device-info">
          <div className="store-device-icon">
            <i className="bi bi-pc-display" />
          </div>

          <div>
            <strong>{device.name}</strong>

            {device.model && <small>{device.model}</small>}
          </div>
        </div>
      </td>

      {/* DEVICE TYPE */}

      <td>
        <span className="store-device-type">{device.type || "—"}</span>
      </td>

      {/* STATUS */}

      <td>
        <span className={`store-device-status ${statusClass}`}>
          <i className="bi bi-circle-fill" />

          {device.status}
        </span>
      </td>

      {/* UPDATED */}

      <td>
        <span className="store-device-date">
          {device.updatedAt || "Recently"}
        </span>
      </td>

      {/* ACTIONS */}

      <td>
        <div className="store-device-actions">
          <button
            type="button"
            className="store-device-action-btn"
            title="View"
            aria-label={`View ${device.name}`}
            onClick={() => onView(device)}
          >
            <i className="bi bi-eye" />
          </button>

          <button
            type="button"
            className="store-device-action-btn edit"
            title="Edit"
            aria-label={`Edit ${device.name}`}
            onClick={() => onEdit(device)}
          >
            <i className="bi bi-pencil" />
          </button>
        </div>
      </td>
    </tr>
  );
}
