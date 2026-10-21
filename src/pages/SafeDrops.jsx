import { useEffect, useMemo, useState } from "react"; 
import FiltersBar from "../components/FiltersBar";
import Pagination from "../components/Pagination";
import { listStoreSafeDrops } from "../api/storeSafeDrops";
import { listStoreEmployees } from "../api/employees";
import { isUuid } from "../api/storeDetails";
import BentoDetailModal from "../components/BentoDetailModal";
import "../styles/safe-drops.css";

const currency = (value) => `$${Number(value || 0).toFixed(2)}`;
const dateParts = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return { date: "-", time: "" };
  return { date: date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }), time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) };
};
const dayKey = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
// "SHIFT-e2326bba-d5f3-..." -> "E2326BBA"
const shortShift = (shiftId) => String(shiftId || "").replace(/^SHIFT-/i, "").split("-")[0].toUpperCase() || "-";

// Title is "Safe Drop - Shift <shift_id> - <employee name or user id>"
const nameFromTitle = (title) => {
  const name = String(title || "").split(" - ").pop().trim();
  return name && !isUuid(name) && !/^Safe Drop/i.test(name) ? name : "";
};

function mapSafeDrop(record, employeeNames) {
  const safeData = record.safe_data || {};
  const shiftId = record.shift_id || safeData.shift_id || "";
  const denominations = (Array.isArray(safeData.safe_drop_denom) ? safeData.safe_drop_denom : []).map((item) => ({
    count: Number(item.denom_count) || 0,
    amount: Number(item.denom) || 0,
    total: Number(item.total ?? (Number(item.denom_count) || 0) * (Number(item.denom) || 0)) || 0,
  })).filter((item) => item.count > 0);
  return {
    id: record.safe_drop_id || "",
    shiftId,
    shift: shortShift(shiftId),
    employee: employeeNames[String(record.created_by || "").toLowerCase()] || nameFromTitle(record.title) || "Unknown employee",
    createdBy: record.created_by || "",
    denominations,
    totalNotes: Number(safeData.total_notes) || denominations.reduce((sum, item) => sum + item.count, 0),
    total: Number(safeData.total_cash ?? denominations.reduce((sum, item) => sum + item.total, 0)) || 0,
    created: record.created_at,
    updated: record.updated_at || record.created_at,
    createdDay: dayKey(record.created_at),
  };
}

export default function SafeDrops({ store, storeId: storeIdProp, merchantId }) {
  const storeId = [store?.uuid, store?.storeUUID, store?.storeUuid, store?.store_uuid, store?.id, storeIdProp, store?.storeId, store?.storeID].find(isUuid);
  const [records, setRecords] = useState([]);
  const [employeeNames, setEmployeeNames] = useState({});
  const [loading, setLoading] = useState(Boolean(storeId));
  const [error, setError] = useState("");
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
  useEffect(() => {
    let cancelled = false;
    if (!merchantId || !storeId) { setEmployeeNames({}); return undefined; }
    listStoreEmployees(merchantId, storeId)
      .then((response) => {
        if (cancelled) return;
        const list = Array.isArray(response) ? response : response?.employees ?? response?.data?.employees ?? response?.data ?? [];
        const names = {};
        for (const item of Array.isArray(list) ? list : []) {
          const name = item.name || item.fullName || [item.firstName ?? item.first_name, item.lastName ?? item.last_name].filter(Boolean).join(" ");
          if (!name) continue;
          for (const id of [item.id, item.employeeId, item.employeeCode, item.userId, item.user_id]) {
            if (id !== undefined && id !== null && id !== "") names[String(id).toLowerCase()] = name;
          }
        }
        setEmployeeNames(names);
      })
      .catch(() => { if (!cancelled) setEmployeeNames({}); });
    return () => { cancelled = true; };
  }, [merchantId, storeId]);

  useEffect(() => {
    if (!storeId) {
      setRecords([]); setLoading(false);
      setError("This store's database ID is unavailable, so safe drops cannot be loaded.");
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true); setError("");
    listStoreSafeDrops(storeId, { signal: controller.signal })
      .then(setRecords)
      .catch((requestError) => {
        if (requestError?.name !== "AbortError") { setError(requestError?.message || "Could not load safe drops."); setRecords([]); }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [storeId]);

  const safeDrops = useMemo(() => records.map((record) => mapSafeDrop(record, employeeNames)).sort((a, b) => (new Date(b.created).getTime() || 0) - (new Date(a.created).getTime() || 0)), [records, employeeNames]);
  const employees = useMemo(() => [...new Set(safeDrops.map((row) => row.employee).filter((name) => name && name !== "Unknown employee"))], [safeDrops]);
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekStartIso = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
  const monthStartIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const rows = useMemo(() => safeDrops.filter((row) =>
    (!employee || row.employee === employee)
    && (datePreset !== "today" || row.createdDay === todayIso)
    && (datePreset !== "week" || (row.createdDay >= weekStartIso && row.createdDay <= todayIso))
    && (datePreset !== "month" || (row.createdDay >= monthStartIso && row.createdDay <= todayIso))
    && (datePreset !== "custom" || ((!dateFrom || row.createdDay >= dateFrom) && (!dateTo || row.createdDay <= dateTo)))
    && (!search || `${row.id} ${row.shiftId} ${row.employee}`.toLowerCase().includes(search.trim().toLowerCase())),
  ), [safeDrops, employee, datePreset, dateFrom, dateTo, search, todayIso, weekStartIso, monthStartIso]);
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
        <tbody>{!loading && !error && visibleRows.map((row, index) => { const created = dateParts(row.created); const updated = dateParts(row.updated); return <tr key={row.id || index} style={{ cursor: "pointer" }} onClick={(event) => { if (event.target.closest('button, a, input, select, textarea, label, [role="button"], [contenteditable="true"]')) return; setSelected(row); }}>
          <td><strong className="sd-record-name" title={row.shiftId}>Safe Drop – Shift {row.shift}</strong></td>
          <td title={row.employee === "Unknown employee" ? row.createdBy : undefined}>{row.employee}</td>
          <td>{row.denominations.length ? row.denominations.map((item, itemIndex) => <span className="sd-denomination" key={`${item.count}-${item.amount}-${itemIndex}`}>{item.count} × {currency(item.amount)} = {currency(item.total)}</span>) : "-"}</td>
          <td className="sd-total">{currency(row.total)}</td><td>{created.date}<small>{created.time}</small></td><td>{updated.date}<small>{updated.time}</small></td>
          <td><button className="sd-view" type="button" aria-label={`View safe drop ${row.id}`} onClick={(e) => { e.stopPropagation(); setSelected(row); }}><i className="bi bi-eye" aria-hidden="true" /></button></td>
        </tr>; })}
          {loading && <tr><td className="sd-empty" colSpan="7">Loading safe drops...</td></tr>}
          {!loading && error && <tr><td className="sd-empty" colSpan="7" role="alert">{error}</td></tr>}
          {!loading && !error && !rows.length && <tr><td className="sd-empty" colSpan="7">{safeDrops.length ? "No safe drop records match your filters." : "No safe drops recorded for this store yet."}</td></tr>}</tbody>
      </table></div>
      <Pagination currentPage={page} totalPages={Math.max(1, Math.ceil(rows.length / pageSize))} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} itemLabel="items" showWhenEmpty pageSizeOptions={[10, 25, 50]} />
    </section>
    <BentoDetailModal
      open={Boolean(selected)}
      onClose={() => setSelected(null)}
      headerIcon="bi-safe"
      title="Safe Drop Details"
      code={selected?.shiftId ? `Shift ID: ${selected.shiftId}` : (selected?.id ? `Drop ID: ${selected.id}` : "")}
      maxWidth="max-w-3xl"
      size="medium"
    >
      {selected && (
        <div className="sd-modal-content">
          {/* Hero Highlight Card */}
          <div className="sd-modal-hero">
            <div className="sd-modal-hero-left">
              <div className="sd-modal-icon-box">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                </svg>
              </div>
              <div className="sd-modal-hero-info">
                <div className="sd-modal-hero-title-row">
                  <h3 className="sd-modal-hero-title">
                    Safe Drop — Shift {selected.shift}
                  </h3>
                  <span className="sd-modal-hero-pill">
                    Completed
                  </span>
                </div>
                <p className="sd-modal-hero-sub">
                  {selected.employee || "Staff"} • {dateParts(selected.created).date} {dateParts(selected.created).time}
                </p>
              </div>
            </div>

            <div className="sd-modal-hero-metric">
              <span className="sd-modal-metric-label">
                TOTAL DROP VALUE
              </span>
              <p className="sd-modal-metric-val">
                {currency(selected.total || 0)}
              </p>
            </div>
          </div>

          {/* Two Columns Grid */}
          <div className="sd-modal-grid">
            {/* Left Card: SHIFT & AUDIT SPECS */}
            <div className="sd-modal-card">
              <div>
                <h4 className="sd-modal-card-title">
                  SHIFT & AUDIT SPECS
                </h4>
                <div className="sd-modal-specs">
                  <div className="sd-spec-item">
                    <span className="sd-spec-label">
                      SHIFT REFERENCE
                    </span>
                    <p className="sd-spec-val mono">
                      {selected.shiftId || "—"}
                    </p>
                  </div>
                  <div className="sd-spec-item">
                    <span className="sd-spec-label">
                      AUTHORIZED CASHIER
                    </span>
                    <p className="sd-spec-val bold">
                      {selected.employee || "Staff"}
                    </p>
                  </div>
                  <div className="sd-spec-item">
                    <span className="sd-spec-label">
                      DROPPED AT
                    </span>
                    <p className="sd-spec-val">
                      {dateParts(selected.created).date} {dateParts(selected.created).time}
                    </p>
                  </div>
                  <div className="sd-spec-item">
                    <span className="sd-spec-label">
                      STATUS
                    </span>
                    <div>
                      <span className="sd-spec-pill">
                        Completed
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Card: DENOMINATIONS BREAKDOWN */}
            <div className="sd-modal-card">
              <div>
                <h4 className="sd-modal-card-title">
                  DENOMINATIONS BREAKDOWN
                </h4>
                {/* Table Header */}
                <div className="sd-denom-table-head">
                  <span>DENOMINATION</span>
                  <span className="text-center">COUNT</span>
                  <span className="text-right">AMOUNT</span>
                </div>

                {/* Rows */}
                <div className="sd-denom-table-body">
                  {selected.denominations.map((item, idx) => (
                    <div key={idx} className="sd-denom-row">
                      <span>{currency(item.amount)}</span>
                      <span className="text-center">{item.count}</span>
                      <span className="text-right">{currency(item.total)}</span>
                    </div>
                  ))}
                  {!selected.denominations.length && (
                    <div className="sd-denom-empty">
                      No denominations recorded
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Totals */}
              <div className="sd-denom-summary">
                <div className="sd-summary-line">
                  <span>Total Notes:</span>
                  <strong>{selected.totalNotes || 0}</strong>
                </div>
                <div className="sd-summary-line">
                  <span>Total Amount:</span>
                  <strong>{currency(selected.total || 0)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </BentoDetailModal>
  </main>;
}