import { useEffect, useMemo, useRef, useState } from "react";
import { listStoreShifts, normalizeShift } from "../api/storeShifts";
import FilterDropdown from "../components/FilterDropdown";
import Pagination from "../components/Pagination";
import "../styles/store-shifts.css";

const dateLabel = (value) => !value ? "—" : new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const localIsoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
function dateBoundsForPreset(preset) {
  const today = new Date();
  const end = localIsoDate(today);
  if (preset === "today") return [end, end];
  if (preset === "week") {
    const start = new Date(today);
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return [localIsoDate(start), end];
  }
  if (preset === "month") return [localIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)), end];
  return ["", ""];
}
const timeLabel = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};
const money = (value) => value == null ? "—" : `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function StoreShifts({ merchantId, storeId, store }) {
  const [selectedShift, setSelectedShift] = useState(null);
  const [records, setRecords] = useState([]);
  const [devices, setDevices] = useState([]);
  const [deviceError, setDeviceError] = useState("");
  const [employees, setEmployees] = useState([]);
  const [employeeError, setEmployeeError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setRecords([]);
    setEmployees([]);
    setDevices([]);
    setDeviceError("");
    setEmployeeError("");
    setDraft(current => ({ ...current, startedBy: "", closedBy: "", device: "" }));
    setFilters(current => ({ ...current, startedBy: "", closedBy: "", device: "" }));
    setSelectedShift(null);
    setPage(1);
    setLoading(true);
    setError("");
    listStoreShifts(merchantId, storeId, { signal: controller.signal, onEmployees: setEmployees, onEmployeeError: setEmployeeError, onDevices: setDevices, onDeviceError: setDeviceError })
      .then((shifts) => {
        if (!controller.signal.aborted) setRecords(shifts.map(normalizeShift));
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message || "Unable to load shifts.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [merchantId, storeId, reload]);

  const [draft, setDraft] = useState({ from: "", to: "", status: "", startedBy: "", closedBy: "", device: "" });
  const [filters, setFilters] = useState(draft);
  const [datePreset, setDatePreset] = useState("any");
  const [showDateRange, setShowDateRange] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const datePresetBeforeCustom = useRef("any");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => records.filter((row) =>
    (!filters.from || row.date >= filters.from) && (!filters.to || row.date <= filters.to)
    && (!searchQuery || `${row.id} ${row.openedBy} ${row.openedCode} ${row.closedBy} ${row.closedCode} ${row.openDevice} ${row.closeDevice}`.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    && (!filters.status || row.status.toLowerCase() === filters.status)
    && (!filters.startedBy || row.openedByEmployeeId === filters.startedBy)
    && (!filters.closedBy || row.closedByEmployeeId === filters.closedBy)
    && (!filters.device || devices.find(device => device.id === filters.device)?.ids.some(id => row.deviceIds.includes(id))),
  ), [records, filters, searchQuery, devices]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const reset = () => {
    const cleared = { from: "", to: "", status: "", startedBy: "", closedBy: "", device: "" };
    setDraft(cleared); setFilters(cleared); setDatePreset("any"); setShowDateRange(false); setCustomStart(""); setCustomEnd(""); setSearchQuery(""); setPage(1);
  };
  const chooseDatePreset = (preset) => {
    setDatePreset(preset);
    if (preset === "custom") {
      datePresetBeforeCustom.current = datePreset;
      setCustomStart(draft.from);
      setCustomEnd(draft.to);
      setShowDateRange(true);
      return;
    }
    const [from, to] = dateBoundsForPreset(preset);
    setDraft((current) => ({ ...current, from, to }));
    setFilters((current) => ({ ...current, from, to }));
    setPage(1);
    setShowDateRange(false);
  };
  const applyCustomRange = () => {
    if (!customStart || !customEnd || customStart > customEnd) return;
    setDraft((current) => ({ ...current, from: customStart, to: customEnd }));
    setFilters((current) => ({ ...current, from: customStart, to: customEnd }));
    setPage(1);
    setDatePreset("custom");
    setShowDateRange(false);
  };

  if (selectedShift) return <ShiftDetails shift={selectedShift} store={store} onBack={() => setSelectedShift(null)} />;

  return <section className="sm-screen" aria-label="Store shift management">
    <header className="sm-page-heading">
      <div><h1>Shift Management</h1><p>View and manage store-level shifts. A shift remains open until it is closed.</p></div>
    </header>

    <div className="sm-filter-card">
      <label className="sm-search-control"><i className="bi bi-search" aria-hidden="true" /><span className="sr-only">Search shifts</span><input aria-label="Search shifts" placeholder="Search shifts..." value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setPage(1); }} /></label>
      <FilterDropdown aria-label="Filter by date" value={datePreset} onChange={(event) => chooseDatePreset(event.target.value)}><option value="any">Any Date</option><option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="custom">Custom Date Range</option></FilterDropdown>
      <FilterDropdown aria-label="Filter by status" value={draft.status} onChange={(event) => updateDraft("status", event.target.value)}><option value="">Status</option><option value="open">Open</option><option value="closed">Closed</option></FilterDropdown>
      <FilterDropdown aria-label="Filter by started by" value={draft.startedBy} onChange={(event) => updateDraft("startedBy", event.target.value)}><option value="">Started By</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</FilterDropdown>
      <FilterDropdown aria-label="Filter by closed by" value={draft.closedBy} onChange={(event) => updateDraft("closedBy", event.target.value)}><option value="">Closed By</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</FilterDropdown>
      <FilterDropdown aria-label="Filter by device" value={draft.device} onChange={(event) => updateDraft("device", event.target.value)}><option value="">Device</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</FilterDropdown>
      <button type="button" className="sm-reset-button" onClick={reset}><i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Reset</button>
    </div>

    {deviceError && <div role="alert">{deviceError} <button type="button" className="sm-button-outline" onClick={() => setReload(value => value + 1)}>Retry</button></div>}
    {employeeError && <div role="alert">{employeeError} <button type="button" className="sm-button-outline" onClick={() => setReload(value => value + 1)}>Retry</button></div>}
    {error && <div role="alert">{error} <button type="button" className="sm-button-outline" onClick={() => setReload((value) => value + 1)}>Retry</button></div>}
    {showDateRange ? <div className="sm-custom-range" role="group" aria-label="Custom date range">
      <label>From date<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>
      <label>To date<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label>
      <button type="button" className="sm-button-primary" disabled={!customStart || !customEnd || customStart > customEnd} onClick={applyCustomRange}>Apply date range</button>
      <button type="button" className="sm-button-outline" onClick={() => { setShowDateRange(false); setDatePreset(datePresetBeforeCustom.current); }}>Cancel</button>
      <button type="button" className="sm-text-button" onClick={() => { setCustomStart(""); setCustomEnd(""); setDraft((current) => ({ ...current, from: "", to: "" })); setFilters((current) => ({ ...current, from: "", to: "" })); setDatePreset("any"); setShowDateRange(false); }}>Clear dates</button>
    </div> : null}

      <div className="sm-table-wrap"><table className="sm-table"><thead><tr><th>#</th><th>Shift ID</th><th>Opened By</th><th>Opening Device</th><th>Open Time</th><th>Closed By</th><th>Closing Device</th><th>Close Time</th><th>Duration</th><th>Opening Balance</th><th>Closing Balance</th><th>Status</th><th>View</th></tr></thead>
        <tbody>{visible.map((shift, index) => <tr key={shift.id}><td>{(page - 1) * pageSize + index + 1}</td><td><button type="button" className="sm-link" onClick={() => setSelectedShift(shift)}>{shift.id}</button></td><td>{shift.openedBy || "—"}{shift.openedCode && <small>({shift.openedCode})</small>}</td><td>{shift.openDevice || "—"}</td><td>{timeLabel(shift.openTime)}</td><td>{shift.closedBy ? <>{shift.closedBy}{shift.closedCode && <small>({shift.closedCode})</small>}</> : "—"}</td><td>{shift.closeDevice || "—"}</td><td>{timeLabel(shift.closeTime)}</td><td>{shift.duration}</td><td>{money(shift.openingBalance)}</td><td>{money(shift.closingBalance)}</td><td><span className={`sm-status ${shift.status.toLowerCase()}`}>{shift.status}</span></td><td><button type="button" className="sm-button-outline sm-view-button" aria-label={`View shift ${shift.id}`} onClick={() => setSelectedShift(shift)}><i className="bi bi-eye" aria-hidden="true" /></button></td></tr>)}
          {!visible.length && <tr><td colSpan={13} className="sm-empty">{loading ? "Loading shifts…" : error ? "Shift records could not be loaded." : records.length ? "No shift records match these filters." : "No shifts found for this store."}</td></tr>}
        </tbody>
      </table></div>
      <Pagination
        currentPage={page}
        totalPages={Math.max(1, Math.ceil(filtered.length / pageSize))}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        itemLabel="items"
        showWhenEmpty
        pageSizeOptions={[10, 25, 50]}
      />
  </section>;
}

function ShiftDetails({ shift, store, onBack }) {
  const metrics = [
    ["Total Orders", shift.orders, "bi-file-earmark-text"],
    ["Total Sales", money(shift.sales), "bi-currency-rupee"],
    ["Payouts", money(shift.payouts), "bi-credit-card"],
    ["Cashback", money(shift.cashback), "bi-gift"],
    ["Refund", money(shift.refund), "bi-arrow-repeat"],
    ["Void Items", shift.voidItems, "bi-slash-circle"],
    ["Cancelled Orders", shift.cancelledOrders, "bi-x-circle"],
  ];
  const difference = shift.cashDifference ?? (shift.actualClosing == null || shift.expectedClosing == null ? null : shift.actualClosing - shift.expectedClosing);
  return <section className="sm-screen sm-detail-screen" aria-label="Shift details">
    <header className="sm-detail-heading"><div><h1>Shift Details</h1><p>View complete information for the selected shift.</p></div><button type="button" className="sm-button-outline store-config-back-button" onClick={onBack}><i className="bi bi-arrow-left" /> Back to Shift Management</button></header>
    <section className="sm-detail-overview">
      <span className={`sm-detail-status ${shift.status.toLowerCase()}`}><i className={`bi ${shift.status === "Closed" ? "bi-check-lg" : "bi-clock"}`} /> {shift.status}</span>
      <div className="sm-info-block"><h2><i className="bi bi-clock" /> Shift Information</h2><dl><div><dt>Shift ID</dt><dd>{shift.id}</dd></div><div><dt>Shift Date</dt><dd>{dateLabel(shift.date)} {shift.date && `(${new Date(`${shift.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long" })})`}</dd></div><div><dt>Status</dt><dd><span className={`sm-status ${shift.status.toLowerCase()}`}>{shift.status}</span></dd></div><div><dt>Duration</dt><dd>{shift.duration}</dd></div><div><dt>Store</dt><dd>{store?.name || store?.storeName || "—"}</dd></div></dl></div>
      <div className="sm-info-block"><h2><i className="bi bi-person-circle" /> Opened By</h2><dl><div><dt>Employee</dt><dd>{shift.openedBy || "—"}{shift.openedCode ? ` (${shift.openedCode})` : ""}</dd></div><div><dt>Device</dt><dd>{shift.openDevice || "—"}</dd></div><div><dt>Open Time</dt><dd>{timeLabel(shift.openTime)}</dd></div><div><dt>Opening Balance</dt><dd>{money(shift.openingBalance)}</dd></div></dl></div>
      <div className="sm-info-block"><h2><i className="bi bi-person-circle" /> Closed By</h2><dl><div><dt>Employee</dt><dd>{shift.closedBy ? `${shift.closedBy}${shift.closedCode ? ` (${shift.closedCode})` : ""}` : "—"}</dd></div><div><dt>Device</dt><dd>{shift.closeDevice || "—"}</dd></div><div><dt>Close Time</dt><dd>{timeLabel(shift.closeTime)}</dd></div><div><dt>Closing Balance</dt><dd>{money(shift.closingBalance)}</dd></div></dl></div>
    </section>
    <section className="sm-detail-data-card"><div className="sm-metric-grid">{metrics.map(([label, value, icon]) => <div className="sm-metric" key={label}><span className="sm-metric-icon"><i className={`bi ${icon}`} aria-hidden="true" /></span><span className="sm-metric-copy"><span>{label}</span><strong>{value ?? "—"}</strong></span></div>)}</div>
      <div className="sm-detail-tables"><section><h3><i className="bi bi-file-earmark-text" /> Transaction Summary</h3><table><thead><tr><th>Payment Method</th><th>Amount</th></tr></thead><tbody>{["Cash", "Card", "EBT", "Pay Later"].map((method) => <tr key={method}><td>{method}</td><td>{money(method === "Cash" ? shift.cashSales : method === "Card" ? shift.cardSales : method === "EBT" ? shift.ebtSales : shift.payLater)}</td></tr>)}<tr className="sm-total-row"><td>Total</td><td>{money(shift.paymentTotal)}</td></tr></tbody></table></section><section><h3><i className="bi bi-cash-stack" /> Cash Details</h3><table><thead><tr><th>Cash Details</th><th>Amount</th></tr></thead><tbody><tr><td>Opening Balance</td><td>{money(shift.openingBalance)}</td></tr><tr><td>Safe Drop</td><td>{money(shift.safeDrop)}</td></tr><tr><td>Closing Balance</td><td>{money(shift.closingBalance)}</td></tr><tr className="sm-difference-row"><td>Over/Short</td><td>{money(difference)}</td></tr></tbody></table></section></div>
    </section>
  </section>;
}
