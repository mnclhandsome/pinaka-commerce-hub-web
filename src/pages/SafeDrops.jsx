import { useMemo, useState } from "react";
import FiltersBar from "../components/FiltersBar";
import Pagination from "../components/Pagination";
import "../styles/safe-drops.css";

const RECORDS = [
  { id: "SD-017393", shift: "17393", employee: "Manager 1", denominations: [{ count: 1, amount: 100 }], total: 100, created: "2026-10-15T03:07:00" },
  { id: "SD-017203", shift: "17203", employee: "Aa’s Corner", denominations: [{ count: 1, amount: 100 }, { count: 2, amount: 50 }, { count: 1, amount: 20 }], total: 220, created: "2026-09-23T22:09:00" },
  { id: "SD-017204", shift: "17203", employee: "Aa’s Corner", denominations: [{ count: 1, amount: 100 }], total: 100, created: "2026-09-23T22:09:00" },
  { id: "SD-017067", shift: "17067", employee: "Sandhya", denominations: [{ count: 2, amount: 100 }], total: 200, created: "2026-09-23T04:46:00" },
];

const currency = (value) => `$${Number(value).toFixed(2)}`;
const dateParts = (value) => {
  const date = new Date(value);
  return { date: date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }), time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) };
};

export default function SafeDrops({ store }) {
  const [search, setSearch] = useState("");
  const [employee, setEmployee] = useState("");
  const [datePreset, setDatePreset] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [dateError, setDateError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState(null);
  const employees = useMemo(() => [...new Set(RECORDS.map((row) => row.employee))], []);
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekStartIso = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
  const monthStartIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const rows = useMemo(() => RECORDS.filter((row) =>
    (!employee || row.employee === employee)
    && (datePreset !== "today" || row.created.slice(0, 10) === todayIso)
    && (datePreset !== "week" || (row.created.slice(0, 10) >= weekStartIso && row.created.slice(0, 10) <= todayIso))
    && (datePreset !== "month" || (row.created.slice(0, 10) >= monthStartIso && row.created.slice(0, 10) <= todayIso))
    && (datePreset !== "custom" || ((!dateFrom || row.created.slice(0, 10) >= dateFrom) && (!dateTo || row.created.slice(0, 10) <= dateTo)))
    && (!search || `${row.id} ${row.shift} ${row.employee}`.toLowerCase().includes(search.trim().toLowerCase())),
  ), [employee, datePreset, dateFrom, dateTo, search, todayIso, weekStartIso, monthStartIso]);
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const reset = () => { setSearch(""); setEmployee(""); setDatePreset(""); setDateFrom(""); setDateTo(""); setDraftFrom(""); setDraftTo(""); setShowCustomDate(false); setDateError(""); setPage(1); };
  const changeDatePreset = (value) => {
    setDateError("");
    if (value === "custom") {
      setDraftFrom(dateFrom); setDraftTo(dateTo); setShowCustomDate(true); setDatePreset("custom");
    } else {
      setDatePreset(value); setDateFrom(""); setDateTo(""); setShowCustomDate(false); setPage(1);
    }
  };
  const applyCustomDate = () => {
    if (!draftFrom || !draftTo || draftFrom > draftTo) { setDateError("Select a valid from and to date."); return; }
    setDateFrom(draftFrom); setDateTo(draftTo); setDatePreset("custom"); setShowCustomDate(false); setDateError(""); setPage(1);
  };
  return <main className="sd-screen">
    <header className="sd-heading"><div><h1>Safe Drops</h1><p>View and manage store safe drop records.</p></div></header>
    <section className="sd-card merchant-table-card" aria-label="Safe drop records">
      <FiltersBar searchValue={search} onSearchChange={(value) => { setSearch(value); setPage(1); }} searchPlaceholder="Search safe drop, shift or employee..." filters={[
        { key: "employee", label: "Employee", value: employee, options: [{ label: "All Employees", value: "" }, ...employees.map((name) => ({ label: name, value: name }))], onChange: (value) => { setEmployee(value); setPage(1); } },
        { key: "date", label: "Date Range", value: datePreset, options: [{ label: "Any Date", value: "" }, { label: "Today", value: "today" }, { label: "This Week", value: "week" }, { label: "This Month", value: "month" }, { label: "Custom Date", value: "custom" }], onChange: changeDatePreset },
      ]} onClear={reset} />
      {showCustomDate && <div className="sd-custom-date"><label>From<input type="date" value={draftFrom} max={draftTo || undefined} onChange={(event) => { setDraftFrom(event.target.value); setDateError(""); }} /></label><label>To<input type="date" value={draftTo} min={draftFrom || undefined} onChange={(event) => { setDraftTo(event.target.value); setDateError(""); }} /></label><button type="button" onClick={applyCustomDate}>Apply date range</button><button className="sd-cancel-date" type="button" onClick={() => { setShowCustomDate(false); setDateError(""); }}>Cancel</button>{dateError && <p role="alert">{dateError}</p>}</div>}
      <div className="sd-table-wrap"><table className="sd-table"><thead><tr><th>Safe Drop / Shift</th><th>Employee</th><th>Denominations</th><th>Total Amount</th><th>Created At</th><th>Updated At</th><th>Actions</th></tr></thead>
        <tbody>{visibleRows.map((row) => { const stamp = dateParts(row.created); return <tr key={row.id}>
          <td><strong className="sd-record-name">Safe Drop – Shift {row.shift}</strong></td>
          <td>{row.employee}</td>
          <td>{row.denominations.map((item) => <span className="sd-denomination" key={`${item.count}-${item.amount}`}>{item.count} × {currency(item.amount)} = {currency(item.count * item.amount)}</span>)}</td>
          <td className="sd-total">{currency(row.total)}</td><td>{stamp.date}<small>{stamp.time}</small></td><td>{stamp.date}<small>{stamp.time}</small></td>
          <td><button className="sd-view" type="button" aria-label={`View safe drop ${row.id}`} onClick={() => setSelected(row)}><i className="bi bi-eye" aria-hidden="true" /></button></td>
        </tr>; })}{!rows.length && <tr><td className="sd-empty" colSpan="7">No safe drop records match your filters.</td></tr>}</tbody>
      </table></div>
      <Pagination currentPage={page} totalPages={Math.max(1, Math.ceil(rows.length / pageSize))} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} itemLabel="items" showWhenEmpty pageSizeOptions={[10, 25, 50]} />
    </section>
    {selected && <div className="sd-modal-backdrop" role="presentation" onClick={() => setSelected(null)}><section className="sd-modal" role="dialog" aria-modal="true" aria-labelledby="sd-modal-title" onClick={(event) => event.stopPropagation()}><button className="sd-modal-close" type="button" aria-label="Close" onClick={() => setSelected(null)}>×</button><h2 id="sd-modal-title">Safe Drop – Shift {selected.shift}</h2><p>{selected.id} · {selected.employee}</p><h3>Denominations</h3>{selected.denominations.map((item) => <div className="sd-modal-line" key={`${item.count}-${item.amount}`}><span>{item.count} × {currency(item.amount)}</span><strong>{currency(item.count * item.amount)}</strong></div>)}<div className="sd-modal-line sd-modal-total"><span>Total Amount</span><strong>{currency(selected.total)}</strong></div></section></div>}
  </main>;
}
