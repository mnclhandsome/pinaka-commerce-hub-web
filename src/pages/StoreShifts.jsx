import { useMemo, useRef, useState } from "react";
import "../styles/store-shifts.css";

const SHIFT_RECORDS = [
  { id: "SHF-001", date: "2026-10-08", openedBy: "Ravi Kumar", openedCode: "EMP001", openDevice: "POS-01", openTime: "08:05", closedBy: "Sathwika", closedCode: "EMP005", closeDevice: "POS-02", closeTime: "12:30", duration: "4h 25m", openingBalance: 3200, safeDrop: 0, closingBalance: 2300, status: "Closed", orders: 28, sales: 1204.5, payouts: 0, cashback: 0, refund: 0, voidItems: 12, cancelledOrders: 0, cashSales: 1906.48, cardSales: 600, ebtSales: 0, payLater: 200, paymentCounts: { Cash: 42, Card: 12, EBT: 0, "Pay Later": 10 }, expectedClosing: 5106.48, actualClosing: 2300 },
  { id: "SHF-002", date: "2026-10-08", openedBy: "Suma Reddy", openedCode: "EMP007", openDevice: "POS-02", openTime: "13:00", closedBy: "", closedCode: "", closeDevice: "", closeTime: "", duration: "—", openingBalance: 0, safeDrop: 0, closingBalance: null, status: "Open", orders: 0, sales: 0, payouts: 0, cashback: 0, refund: 0, voidItems: 0, cancelledOrders: 0, cashSales: 0, cardSales: 0, ebtSales: 0, payLater: 0, paymentCounts: { Cash: 0, Card: 0, EBT: 0, "Pay Later": 0 }, expectedClosing: null, actualClosing: null },
  { id: "SHF-003", date: "2026-10-07", openedBy: "Kiran Das", openedCode: "EMP009", openDevice: "POS-03", openTime: "06:15", closedBy: "Praveen", closedCode: "EMP012", closeDevice: "POS-01", closeTime: "14:40", duration: "9h 25m", openingBalance: 1500, safeDrop: 0, closingBalance: 1425, status: "Closed", orders: 46, sales: 2240, payouts: 0, cashback: 15, refund: 0, voidItems: 3, cancelledOrders: 1, cashSales: 1400, cardSales: 840, ebtSales: 0, payLater: 0, paymentCounts: { Cash: 31, Card: 15, EBT: 0, "Pay Later": 0 }, expectedClosing: 2900, actualClosing: 1425 },
  { id: "SHF-004", date: "2026-10-07", openedBy: "Priya Singh", openedCode: "EMP010", openDevice: "POS-01", openTime: "15:10", closedBy: "", closedCode: "", closeDevice: "", closeTime: "", duration: "—", openingBalance: 0, safeDrop: 0, closingBalance: null, status: "Open", orders: 0, sales: 0, payouts: 0, cashback: 0, refund: 0, voidItems: 0, cancelledOrders: 0, cashSales: 0, cardSales: 0, ebtSales: 0, payLater: 0, paymentCounts: { Cash: 0, Card: 0, EBT: 0, "Pay Later": 0 }, expectedClosing: null, actualClosing: null },
];

const dateLabel = (value) => new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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
  const [hour, minute] = value.split(":").map(Number);
  return `${String(hour % 12 || 12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
};
const money = (value) => value == null ? "—" : `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function StoreShifts({ store }) {
  const [selectedShift, setSelectedShift] = useState(null);
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

  const employees = useMemo(() => [...new Set(SHIFT_RECORDS.flatMap((row) => [row.openedBy, row.closedBy]).filter(Boolean))].sort(), []);
  const devices = useMemo(() => [...new Set(SHIFT_RECORDS.flatMap((row) => [row.openDevice, row.closeDevice]).filter(Boolean))].sort(), []);
  const filtered = useMemo(() => SHIFT_RECORDS.filter((row) =>
    (!filters.from || row.date >= filters.from) && (!filters.to || row.date <= filters.to)
    && (!searchQuery || `${row.id} ${row.openedBy} ${row.openedCode} ${row.closedBy} ${row.closedCode} ${row.openDevice} ${row.closeDevice}`.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    && (!filters.status || row.status.toLowerCase() === filters.status)
    && (!filters.startedBy || row.openedBy === filters.startedBy)
    && (!filters.closedBy || row.closedBy === filters.closedBy)
    && (!filters.device || row.openDevice === filters.device || row.closeDevice === filters.device),
  ), [filters, searchQuery]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const rangeLabel = filters.from && filters.to
    ? `${dateLabel(filters.from)} - ${dateLabel(filters.to)}`
    : filters.from ? `From ${dateLabel(filters.from)}` : filters.to ? `Through ${dateLabel(filters.to)}` : "All dates";

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
    <nav className="sm-breadcrumb" aria-label="Shift navigation"><span>Shift Management</span></nav>
    <header className="sm-page-heading">
      <div><h1>Shift Management</h1><p>View and manage store-level shifts. A shift remains open until it is closed.</p></div>
      <div className="sm-store-chip"><span className="sm-store-icon"><i className="bi bi-shop" /></span><span><strong>{store?.name || store?.storeName || "Store"}</strong><small>{store?.storeCode || store?.store_code || store?.id || "Store ID unavailable"}</small></span><span className="sm-store-status">{String(store?.status || "Active").toUpperCase()}</span></div>
    </header>

    <div className="sm-filter-card">
      <label className="sm-search-control"><i className="bi bi-search" aria-hidden="true" /><span className="sr-only">Search shifts</span><input aria-label="Search shifts" placeholder="Search shifts..." value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setPage(1); }} /></label>
      <select aria-label="Filter by date" value={datePreset} onChange={(event) => chooseDatePreset(event.target.value)}><option value="any">Any Date</option><option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="custom">Custom Date Range</option></select>
      <select aria-label="Filter by shift status" value={draft.status} onChange={(event) => updateDraft("status", event.target.value)}><option value="">All Shift Statuses</option><option value="open">Open</option><option value="closed">Closed</option></select>
      <select aria-label="Filter by started by" value={draft.startedBy} onChange={(event) => updateDraft("startedBy", event.target.value)}><option value="">All Started By</option>{employees.map((employee) => <option key={employee}>{employee}</option>)}</select>
      <select aria-label="Filter by closed by" value={draft.closedBy} onChange={(event) => updateDraft("closedBy", event.target.value)}><option value="">All Closed By</option>{employees.map((employee) => <option key={employee}>{employee}</option>)}</select>
      <select aria-label="Filter by device" value={draft.device} onChange={(event) => updateDraft("device", event.target.value)}><option value="">All Devices</option>{devices.map((device) => <option key={device}>{device}</option>)}</select>
      <button type="button" className="sm-reset-button" onClick={reset}><i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Reset</button>
    </div>

    {showDateRange ? <div className="sm-custom-range" role="group" aria-label="Custom date range">
      <label>From date<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>
      <label>To date<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label>
      <button type="button" className="sm-button-primary" disabled={!customStart || !customEnd || customStart > customEnd} onClick={applyCustomRange}>Apply date range</button>
      <button type="button" className="sm-button-outline" onClick={() => { setShowDateRange(false); setDatePreset(datePresetBeforeCustom.current); }}>Cancel</button>
      <button type="button" className="sm-text-button" onClick={() => { setCustomStart(""); setCustomEnd(""); setDraft((current) => ({ ...current, from: "", to: "" })); setFilters((current) => ({ ...current, from: "", to: "" })); setDatePreset("any"); setShowDateRange(false); }}>Clear dates</button>
    </div> : null}

    <section className="sm-records-card">
      <h2><i className="bi bi-calendar3" /> Shift Records <span>— {rangeLabel}</span></h2>
      <div className="sm-table-wrap"><table className="sm-table"><thead><tr><th>#</th><th>Shift ID</th><th>Shift Date</th><th>Opened By</th><th>Opening Device</th><th>Open Time</th><th>Closed By</th><th>Closing Device</th><th>Close Time</th><th>Duration</th><th>Opening Balance</th><th>Closing Balance</th><th>Status</th><th>View</th></tr></thead>
        <tbody>{visible.map((shift, index) => <tr key={shift.id}><td>{(page - 1) * pageSize + index + 1}</td><td><button type="button" className="sm-link" onClick={() => setSelectedShift(shift)}>{shift.id}</button></td><td>{dateLabel(shift.date)}</td><td>{shift.openedBy}<small>({shift.openedCode})</small></td><td>{shift.openDevice}</td><td>{timeLabel(shift.openTime)}</td><td>{shift.closedBy ? <>{shift.closedBy}<small>({shift.closedCode})</small></> : "—"}</td><td>{shift.closeDevice || "—"}</td><td>{timeLabel(shift.closeTime)}</td><td>{shift.duration}</td><td>{money(shift.openingBalance)}</td><td>{money(shift.closingBalance)}</td><td><span className={`sm-status ${shift.status.toLowerCase()}`}>{shift.status}</span></td><td><button type="button" className="sm-button-outline sm-view-button" onClick={() => setSelectedShift(shift)}>View</button></td></tr>)}
          {!visible.length && <tr><td colSpan={14} className="sm-empty">No shift records match these filters.</td></tr>}
        </tbody>
      </table></div>
      <footer className="sm-pagination"><span>Items per page</span><select aria-label="Items per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select><span>{filtered.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} of ${filtered.length}` : "0 of 0"}</span><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>‹</button><button type="button" className="sm-page-current">{page}</button><button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>›</button></footer>
    </section>
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
  const difference = shift.actualClosing == null ? null : shift.actualClosing - shift.expectedClosing;
  return <section className="sm-screen sm-detail-screen" aria-label="Shift details">
    <nav className="sm-breadcrumb" aria-label="Shift navigation"><button type="button" onClick={onBack}>Shift Management</button><b>/</b><strong>Shift Details</strong></nav>
    <header className="sm-detail-heading"><div><h1>Shift Details</h1><p>View complete information for the selected shift.</p></div><button type="button" className="sm-button-outline" onClick={onBack}><i className="bi bi-arrow-left" /> Back to Shift Management</button></header>
    <section className="sm-detail-overview">
      <span className={`sm-detail-status ${shift.status.toLowerCase()}`}><i className={`bi ${shift.status === "Closed" ? "bi-check-lg" : "bi-clock"}`} /> {shift.status}</span>
      <div className="sm-info-block"><h2><i className="bi bi-clock" /> Shift Information</h2><dl><div><dt>Shift ID</dt><dd>{shift.id}</dd></div><div><dt>Shift Date</dt><dd>{dateLabel(shift.date)} ({new Date(`${shift.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long" })})</dd></div><div><dt>Status</dt><dd><span className={`sm-status ${shift.status.toLowerCase()}`}>{shift.status}</span></dd></div><div><dt>Duration</dt><dd>{shift.duration}</dd></div><div><dt>Store</dt><dd>{store?.name || store?.storeName || "—"}</dd></div></dl></div>
      <div className="sm-info-block"><h2><i className="bi bi-person-circle" /> Opened By</h2><dl><div><dt>Employee</dt><dd>{shift.openedBy} ({shift.openedCode})</dd></div><div><dt>Device</dt><dd>{shift.openDevice}</dd></div><div><dt>Open Time</dt><dd>{timeLabel(shift.openTime)}</dd></div><div><dt>Opening Balance</dt><dd>{money(shift.openingBalance)}</dd></div></dl></div>
      <div className="sm-info-block"><h2><i className="bi bi-person-circle" /> Closed By</h2><dl><div><dt>Employee</dt><dd>{shift.closedBy ? `${shift.closedBy} (${shift.closedCode})` : "—"}</dd></div><div><dt>Device</dt><dd>{shift.closeDevice || "—"}</dd></div><div><dt>Close Time</dt><dd>{timeLabel(shift.closeTime)}</dd></div><div><dt>Closing Balance</dt><dd>{money(shift.closingBalance)}</dd></div></dl></div>
    </section>
    <section className="sm-detail-data-card"><div className="sm-metric-grid">{metrics.map(([label, value, icon]) => <div className="sm-metric" key={label}><span className="sm-metric-icon"><i className={`bi ${icon}`} aria-hidden="true" /></span><span className="sm-metric-copy"><span>{label}</span><strong>{value}</strong></span></div>)}</div>
      <div className="sm-detail-tables"><section><h3><i className="bi bi-file-earmark-text" /> Transaction Summary</h3><table><thead><tr><th>Payment Method</th><th>Amount</th><th>Count</th></tr></thead><tbody>{["Cash", "Card", "EBT", "Pay Later"].map((method) => <tr key={method}><td>{method}</td><td>{money(shift.paymentCounts[method] ? method === "Cash" ? shift.cashSales : method === "Card" ? shift.cardSales : method === "EBT" ? shift.ebtSales : shift.payLater : 0)}</td><td>{shift.paymentCounts[method]}</td></tr>)}<tr className="sm-total-row"><td>Total</td><td>{money(shift.cashSales + shift.cardSales + shift.ebtSales + shift.payLater)}</td><td>{Object.values(shift.paymentCounts).reduce((sum, value) => sum + value, 0)}</td></tr></tbody></table></section><section><h3><i className="bi bi-cash-stack" /> Cash Details</h3><table><thead><tr><th>Cash Details</th><th>Amount</th></tr></thead><tbody><tr><td>Opening Balance</td><td>{money(shift.openingBalance)}</td></tr><tr><td>Safe Drop</td><td>{money(shift.safeDrop)}</td></tr><tr><td>Closing Balance</td><td>{money(shift.closingBalance)}</td></tr><tr className="sm-difference-row"><td>Over/Short</td><td>{money(difference)}</td></tr></tbody></table></section></div>
    </section>
  </section>;
}
