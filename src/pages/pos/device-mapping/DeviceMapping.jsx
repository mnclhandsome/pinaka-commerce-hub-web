import { useEffect, useMemo, useRef, useState } from "react";
import Pagination from "../../../components/Pagination";
import FiltersBar from "../../../components/FiltersBar";
import ListActions from "../../../components/ListActions";
import { devicesApi } from "../../../api/devices";
import { createStoreDeviceMapping, deleteStoreDeviceMapping, getStoreDeviceMappings } from "../../../api/storeDeviceMappings";
import "../../../styles/merchant-vendors.css";
import { useConfigState, usePosSettings, useSaveAction } from "../shared";

async function combineMappings(rows, devices) {
  const deviceById = new Map(devices.map((device) => [String(device.id), device]));
  return Promise.all(rows.map(async (mapping) => {
    const deviceId = mapping.deviceId || mapping.device_id || mapping.device?.id || mapping.device?.device_id;
    let device = deviceById.get(String(deviceId)) || mapping.device || null;
    if (!device && deviceId) {
      try {
        device = await devicesApi.get(deviceId);
      } catch {
        // Keep mapping data visible if a device detail request fails.
      }
    }
    return {
      ...(device || {}),
      deviceIdentifier: device?.deviceId || device?.device_id || mapping.deviceIdentifier || mapping.device_identifier || mapping.device?.deviceId || "",
      deviceId,
      mappingId: mapping.mappingId || mapping.mapping_id || mapping.id,
      code: device?.code || device?.deviceCode || mapping.code || mapping.device_code || "",
      name: device?.name || mapping.name || mapping.device_name || "",
      type: device?.type || mapping.type || mapping.device_type || "",
      serial: device?.serial || mapping.serial || mapping.serial_number || "",
      status: device?.status || mapping.status || "Active",
    };
  })).then((mappings) => mappings.filter((mapping) => mapping.deviceId != null));
}

export function DeviceMapping({ onBack }) {
  const settings = usePosSettings();
  const [devices, setDevices] = useState([]);
  const [mappings, setMappings] = useConfigState("deviceMappings", []);
  const mappingsRef = useRef(mappings);
  mappingsRef.current = mappings;
  const [serverMappings, setServerMappings] = useState([]);
  const [view, setView] = useState("mapped");
  const [selection, setSelection] = useState([]);
  const [search, setSearch] = useState("");
  const [mappedSearch, setMappedSearch] = useState("");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("all");
  const [deviceStatusFilter, setDeviceStatusFilter] = useState("all");
  const [mappedTypeFilter, setMappedTypeFilter] = useState("all");
  const [mappedStatusFilter, setMappedStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [mappedPage, setMappedPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSelection, setSavingSelection] = useState(false);
  const [deletingMappingId, setDeletingMappingId] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      devicesApi.listByMerchantId(settings.merchantId).catch((cause) => {
        if (active) setError(cause?.message || "Unable to load merchant devices.");
        return [];
      }),
      getStoreDeviceMappings(settings.storeId).catch((cause) => {
        if (active) setError(cause?.message || "Unable to load store device mappings.");
        return null;
      }),
    ]).then(async ([items, mappingRows]) => {
      if (!active) return;
      const merchantDevices = Array.isArray(items) ? items : [];
      const activeDevices = merchantDevices.filter((device) => String(device.status).toLowerCase() !== "inactive");
      setDevices(activeDevices);
      if (!Array.isArray(mappingRows)) return;
      const hydrated = await combineMappings(mappingRows, merchantDevices);
      setServerMappings(hydrated);
      setMappings(hydrated);
      settings.session.baseline.deviceMappings = hydrated;
      settings.session.draft.deviceMappings = hydrated;
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [settings.merchantId, settings.storeId]);

  const safeMappings = Array.isArray(mappings) ? mappings : [];
  const mappedIds = useMemo(() => new Set(safeMappings.map((item) => String(item.deviceId))), [safeMappings]);
  const availableTypes = useMemo(() => [...new Set(devices.map((device) => String(device.type || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [devices]);
  const mappedTypes = useMemo(() => [...new Set(safeMappings.map((device) => String(device.type || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [safeMappings]);
  const available = useMemo(() => devices.filter((device) => !mappedIds.has(String(device.id)) && [device.name, device.type, device.serial, device.code, device.deviceCode, device.status].join(" ").toLowerCase().includes(search.trim().toLowerCase()) && (deviceTypeFilter === "all" || String(device.type || "") === deviceTypeFilter) && (deviceStatusFilter === "all" || String(device.status || "Active").toLowerCase() === deviceStatusFilter)), [devices, mappedIds, search, deviceTypeFilter, deviceStatusFilter]);
  const filteredMappings = useMemo(() => safeMappings.filter((device) => [device.name, device.type, device.serial, device.code].join(" ").toLowerCase().includes(mappedSearch.trim().toLowerCase()) && (mappedTypeFilter === "all" || String(device.type || "") === mappedTypeFilter) && (mappedStatusFilter === "all" || String(device.status || "Active").toLowerCase() === mappedStatusFilter)), [safeMappings, mappedSearch, mappedTypeFilter, mappedStatusFilter]);
  const pageCount = Math.max(1, Math.ceil(available.length / pageSize));
  const mappedPageCount = Math.max(1, Math.ceil(filteredMappings.length / pageSize));
  const pageRows = available.slice((page - 1) * pageSize, page * pageSize);
  const mappedRows = filteredMappings.slice((mappedPage - 1) * pageSize, mappedPage * pageSize);
  const changePageSize = (size) => { setPageSize(size); setPage(1); setMappedPage(1); };
  const toggleSelection = (id) => setSelection((current) => current.includes(String(id)) ? current.filter((item) => item !== String(id)) : [...current, String(id)]);
  const openPicker = () => { setSelection([]); setSearch(""); setDeviceTypeFilter("all"); setDeviceStatusFilter("all"); setPage(1); setError(""); setView("picker"); };
  const removeMapping = async (mapping) => {
    setError("");
    setDeletingMappingId(String(mapping.deviceId));
    try {
      await deleteStoreDeviceMapping(mapping.mappingId);
      const nextMappings = mappingsRef.current.filter((item) => String(item.deviceId) !== String(mapping.deviceId));
      const device = { ...mapping, id: mapping.deviceId, deviceId: mapping.deviceIdentifier || "" };
      setDevices((current) => current.some((item) => String(item.id) === String(device.id))
        ? current
        : [...current, device]);
      setMappings(nextMappings);
      setServerMappings((current) => current.filter((item) => String(item.deviceId) !== String(mapping.deviceId)));
      settings.session.baseline.deviceMappings = nextMappings;
      settings.session.draft.deviceMappings = nextMappings;
    } catch (cause) {
      setError(cause?.message || "Unable to remove the device mapping.");
    } finally {
      setDeletingMappingId("");
    }
  };
  const addSelected = async () => {
    const selected = devices.filter((device) => selection.includes(String(device.id)) && !mappedIds.has(String(device.id)));
    if (!selected.length) return;
    setSavingSelection(true);
    setError("");
    const added = [];
    try {
      for (const device of selected) {
        const created = await createStoreDeviceMapping({ storeId: settings.storeId, deviceId: device.id });
        const record = created?.mapping || created?.data?.mapping || created?.data || created || {};
        added.push({
          deviceId: device.id,
          deviceIdentifier: device.deviceId || device.device_id || "",
          name: device.name,
          code: device.code || device.deviceCode || device.device_code || "",
          type: device.type,
          serial: device.serial,
          status: device.status || "Active",
          mappingId: record.id || record.mapping_id || record.mappingId || "",
        });
      }
    } catch (cause) {
      // Preserve successful mappings if a later device in a multi-select batch fails.
      const addedIds = new Set(added.map((mapping) => String(mapping.deviceId)));
      setSelection((current) => current.filter((id) => !addedIds.has(id)));
      if (added.length) {
        const nextMappings = [...mappingsRef.current, ...added];
        setMappings(nextMappings);
        setServerMappings((current) => [...current, ...added]);
        settings.session.baseline.deviceMappings = nextMappings;
        settings.session.draft.deviceMappings = nextMappings;
        setMappedPage(1);
        setView("mapped");
      }
      setError(cause?.message || "Unable to save the selected device mappings.");
      return;
    } finally {
      setSavingSelection(false);
    }
    const nextMappings = [...mappingsRef.current, ...added];
    setMappings(nextMappings);
    setServerMappings((current) => [...current, ...added]);
    settings.session.baseline.deviceMappings = nextMappings;
    settings.session.draft.deviceMappings = nextMappings;
    setSelection([]);
    setMappedPage(1);
    setView("mapped");
  };
  useSaveAction(async () => {
    const draftMappings = Array.isArray(mappingsRef.current) ? mappingsRef.current : [];
    const savedMappings = Array.isArray(serverMappings) ? serverMappings : [];
    const serverByDevice = new Map(savedMappings.map((mapping) => [String(mapping.deviceId), mapping]));
    const draftByDevice = new Map(draftMappings.map((mapping) => [String(mapping.deviceId), mapping]));
    const additions = draftMappings.filter((mapping) => !serverByDevice.has(String(mapping.deviceId)));
    const removals = savedMappings.filter((mapping) => !draftByDevice.has(String(mapping.deviceId)));
    const persisted = draftMappings.filter((mapping) => serverByDevice.has(String(mapping.deviceId)));

    for (const mapping of additions) {
      const created = await createStoreDeviceMapping({ storeId: settings.storeId, deviceId: mapping.deviceId });
      const record = created?.mapping || created?.data?.mapping || created?.data || created || {};
      persisted.push({
        ...mapping,
        mappingId: record.id || record.mapping_id || record.mappingId || "",
      });
    }
    for (const mapping of removals) await deleteStoreDeviceMapping(mapping.mappingId);
    const savedRows = await getStoreDeviceMappings(settings.storeId);
    const hydrated = await combineMappings(savedRows, devices);
    const hydratedByDevice = new Map(hydrated.map((mapping) => [String(mapping.deviceId), mapping]));
    // Keep the saved UI state aligned with the user's intended set of mappings.
    // The immediate GET can briefly return a deleted mapping while the API catches up.
    const savedMappingsNow = persisted.map((mapping) => {
      const refreshed = hydratedByDevice.get(String(mapping.deviceId));
      return refreshed
        ? { ...mapping, ...refreshed, mappingId: refreshed.mappingId || mapping.mappingId }
        : mapping;
    });
    const removedDevices = removals.map((mapping) => ({
      ...mapping,
      id: mapping.id || mapping.deviceId,
    }));
    let refreshedDevices = [];
    try {
      refreshedDevices = await devicesApi.listByMerchantId(settings.merchantId);
    } catch {
      // A successful removal is enough to make these devices selectable locally.
    }
    const nextDevicesById = new Map();
    [...devices, ...(Array.isArray(refreshedDevices) ? refreshedDevices : []), ...removedDevices]
      .filter((device) => String(device.status).toLowerCase() !== "inactive")
      .forEach((device) => {
        const id = device.id || device.deviceId;
        if (id) nextDevicesById.set(String(id), { ...nextDevicesById.get(String(id)), ...device, id });
      });
    setDevices([...nextDevicesById.values()]);
    setServerMappings(savedMappingsNow);
    setMappings(savedMappingsNow);
    settings.session.draft.deviceMappings = savedMappingsNow;
    settings.session.baseline.deviceMappings = savedMappingsNow;
    settings.session.baseline = { ...settings.session.draft };
    setError("");
    return true;
  });
  const backToMapped = () => { setView("mapped"); setSelection([]); setError(""); };

  if (view === "picker") return <section className="merchant-vendors mv-create-page mv-existing-page mv-device-picker">
    <header className="mv-card mv-header">
      <div><h2>Add Existing Device</h2><p>Choose one or more devices to map to this store.</p></div>
      <button type="button" onClick={backToMapped}>← Back to Mapped Devices</button>
    </header>
    <div className="mv-existing-content">
      <p className="mv-device-scope">Only active devices registered to this merchant are available.</p>
      {error && <p role="alert" className="mv-error">{error}</p>}
      <FiltersBar
        searchValue={search}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
        searchPlaceholder="Search devices by name, code, type or serial…"
        filters={[
          { key: "deviceType", label: "Device type", value: deviceTypeFilter, options: [{ value: "all", label: "All Device Types" }, ...availableTypes.map((value) => ({ value, label: value }))], onChange: (value) => { setDeviceTypeFilter(value); setPage(1); } },
          { key: "status", label: "Status", value: deviceStatusFilter, options: [{ value: "all", label: "All Statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "online", label: "Online" }, { value: "offline", label: "Offline" }], onChange: (value) => { setDeviceStatusFilter(value); setPage(1); } },
        ]}
        onClear={() => { setSearch(""); setDeviceTypeFilter("all"); setDeviceStatusFilter("all"); setPage(1); setSelection([]); }}
      />
      <div className="mv-picker-summary"><span>{available.length} matching devices · {selection.length} selected</span></div>
      <div className="mv-existing-table-wrap"><table>
        <thead><tr><th>Select</th><th>Device ID</th><th>Device Code</th><th>Device Name</th><th>Device Type</th><th>Serial Number</th><th>Status</th></tr></thead>
        <tbody>
          {pageRows.map((device) => { const selected = selection.includes(String(device.id)); return <tr key={device.id} className={selected ? "mv-row-selected" : ""} aria-selected={selected} onClick={(event) => { if (!event.target.closest("input,button,a,select")) toggleSelection(device.id); }}>
            <td><input type="checkbox" aria-label={`Select ${device.name}`} checked={selected} onChange={() => toggleSelection(device.id)} /></td>
            <td>{device.deviceId || device.device_id || "—"}</td><td>{device.code || device.deviceCode || device.device_code || "—"}</td><td><strong>{device.name || "—"}</strong></td><td>{device.type || "—"}</td><td>{device.serial || "—"}</td><td>{device.status || "Active"}</td>
          </tr>; })}
          {!loading && !pageRows.length && <tr><td colSpan="7">No unassigned devices found for this merchant.</td></tr>}
          {loading && <tr><td colSpan="7" role="status">Loading merchant devices…</td></tr>}
        </tbody>
      </table></div>
      <Pagination currentPage={page} totalPages={pageCount} totalItems={available.length}
        pageSize={pageSize} onPageChange={setPage} onPageSizeChange={changePageSize}
        itemLabel="devices" showWhenEmpty pageSizeOptions={[10, 25, 50, 100]} />
    </div>
    <footer className="mv-existing-footer"><span>{selection.length} devices selected</span><div className="mv-popup-actions"><button type="button" disabled={savingSelection} onClick={backToMapped}>Cancel</button><button type="button" disabled={!selection.length || savingSelection} className="mv-primary" onClick={addSelected}>{savingSelection ? "Saving…" : "Add Selected"}</button></div></footer>
  </section>;

  return <section className="merchant-vendors mv-device-mapped-page">
    <header className="mv-card mv-header"><div><h2>Devices</h2><p>These are the devices mapped to this store.</p></div><div className="mv-device-header-actions"><button type="button" onClick={onBack}>← Back</button><button type="button" className="mv-primary" onClick={openPicker}>＋ Add Existing Device</button></div></header>
    {error && <p role="alert" className="mv-error">{error}</p>}
    <section className="mv-card mv-device-list-card">
      <h3>Mapped Device List</h3>
      <FiltersBar
        searchValue={mappedSearch}
        onSearchChange={(value) => { setMappedSearch(value); setMappedPage(1); }}
        searchPlaceholder="Search devices by name, type or serial…"
        filters={[
          { key: "deviceType", label: "Device type", value: mappedTypeFilter, options: [{ value: "all", label: "All Device Types" }, ...mappedTypes.map((value) => ({ value, label: value }))], onChange: (value) => { setMappedTypeFilter(value); setMappedPage(1); } },
          { key: "status", label: "Status", value: mappedStatusFilter, options: [{ value: "all", label: "All Statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "online", label: "Online" }, { value: "offline", label: "Offline" }], onChange: (value) => { setMappedStatusFilter(value); setMappedPage(1); } },
        ]}
        onClear={() => { setMappedSearch(""); setMappedTypeFilter("all"); setMappedStatusFilter("all"); setMappedPage(1); }}
      />
      <div className="mv-scroll"><table><thead><tr><th>Device Code</th><th>Device ID</th><th>Device Name</th><th>Serial Number</th><th>Device Type</th><th>Actions</th></tr></thead><tbody>
        {mappedRows.map((device) => <tr key={device.deviceId}><td>{device.code || "—"}</td><td>{device.deviceIdentifier || "—"}</td><td><strong>{device.name || "—"}</strong></td><td>{device.serial || "—"}</td><td>{device.type || "—"}</td><td><ListActions resource="devices" onDelete={() => removeMapping(device)} deleteLabel={`Remove ${device.name || "device"} from this store`} deleteDisabled={deletingMappingId === String(device.deviceId)} /></td></tr>)}
        {!mappedRows.length && <tr><td colSpan="7">No mapped devices match. Use Add Existing Device to select from merchant devices.</td></tr>}
      </tbody></table></div>
      <Pagination currentPage={mappedPage} totalPages={mappedPageCount} totalItems={filteredMappings.length}
        pageSize={pageSize} onPageChange={setMappedPage} onPageSizeChange={changePageSize}
        itemLabel="entries" showWhenEmpty pageSizeOptions={[10, 25, 50, 100]} />
    </section>
  </section>;
}
