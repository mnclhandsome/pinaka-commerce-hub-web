import FilterDropdown from "../components/FilterDropdown";
import Pagination from "../components/Pagination";
import { useMemo, useState } from "react";
import "../styles/employee-attendance.css";

// Local UI fixtures until the attendance service is available.
const INITIAL_RECORDS = [
  { id: 1, date: "2026-10-08", code: "EMP001", name: "Ravi Kumar", clockIn: "08:05", clockOut: "16:32", total: "8h 27m", detailClockOut: "12:30", detailTotal: "4h 25m", status: "Present" },
  { id: 2, date: "2026-10-08", code: "EMP002", name: "Priya Sharma", clockIn: "09:10", clockOut: "18:05", total: "8h 55m", status: "Present" },
  { id: 3, date: "2026-10-08", code: "EMP003", name: "Suresh Reddy", clockIn: "11:30", clockOut: "20:00", total: "8h 30m", status: "Present" },
  { id: 4, date: "2026-10-07", code: "EMP001", name: "Ravi Kumar", clockIn: "08:00", clockOut: "17:15", total: "9h 15m", status: "Present" },
  { id: 5, date: "2026-10-07", code: "EMP004", name: "Anita Verma", clockIn: "08:45", clockOut: "17:30", total: "8h 45m", status: "Present" },
  { id: 6, date: "2026-10-06", code: "EMP005", name: "Venkatesh R", clockIn: "09:20", clockOut: "", total: "—", status: "Absent" },
  { id: 7, date: "2026-10-06", code: "EMP002", name: "Priya Sharma", clockIn: "09:00", clockOut: "18:00", total: "9h 00m", status: "Present" },
  { id: 8, date: "2026-10-06", code: "EMP003", name: "Suresh Reddy", clockIn: "10:00", clockOut: "19:15", total: "9h 15m", status: "Present" },
  { id: 9, date: "2026-10-05", code: "EMP005", name: "Venkatesh R", clockIn: "09:15", clockOut: "13:30", total: "4h 15m", status: "Present" },
  { id: 10, date: "2026-10-04", code: "EMP001", name: "Ravi Kumar", clockIn: "08:10", clockOut: "17:45", total: "9h 35m", status: "Present" },
];

const displayDate = (value) => value
  ? new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  : "—";
const displayTime = (value) => {
  if (!value) return "—";
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${String(hours % 12 || 12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${suffix}`;
};
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

const EMPLOYEE_PROFILES = {
  EMP001: { phone: "+91 98765 43210", email: "ravi.kumar@pinaka.com", role: "Cashier", employmentType: "Full Time", joiningDate: "2025-08-15" },
  EMP002: { phone: "+91 98765 43211", email: "priya.sharma@pinaka.com", role: "Store Associate", employmentType: "Full Time", joiningDate: "2025-09-02" },
  EMP003: { phone: "+91 98765 43212", email: "suresh.reddy@pinaka.com", role: "Store Associate", employmentType: "Full Time", joiningDate: "2025-06-18" },
  EMP004: { phone: "+91 98765 43213", email: "anita.verma@pinaka.com", role: "Supervisor", employmentType: "Full Time", joiningDate: "2025-07-10" },
  EMP005: { phone: "+91 98765 43214", email: "venkatesh.r@pinaka.com", role: "Store Associate", employmentType: "Part Time", joiningDate: "2025-10-01" },
};

export function AttendanceDetails({ record, store, onBack }) {
  const profile = EMPLOYEE_PROFILES[record.code] || {};
  const date = new Date(`${record.date}T12:00:00`);
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  const initials = record.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const remarks = record.id === 1 ? [
    { text: "Left for personal work (Approved).", addedOn: "08 Oct 2026, 12:40 PM" },
    { text: "Early leave approved due to urgent work.", addedOn: "08 Oct 2026, 01:10 PM" },
  ] : [];
  return <div className="ea-details-page">
    <header className="ea-details-heading"><div><h2>Employee Attendance – View Details</h2><p>View attendance information for the selected date.</p></div><button type="button" onClick={onBack}><i className="bi bi-arrow-left" /> Back to Attendance</button></header>
    <section className="ea-details-card"><h3>Employee Overview</h3><div className="ea-profile-grid">
      <div className="ea-profile-primary"><span className="ea-avatar">{initials}</span><dl><div><dt>Employee Code</dt><dd>{record.code}</dd></div><div><dt>Employee Name</dt><dd>{record.name}</dd></div><div><dt>Role</dt><dd>{profile.role || "—"}</dd></div></dl></div>
      <dl><div><dt>Phone</dt><dd>{profile.phone || "—"}</dd></div><div><dt>Email</dt><dd>{profile.email || "—"}</dd></div><div><dt>Employment Type</dt><dd>{profile.employmentType || "—"}</dd></div></dl>
      <dl><div><dt>Joining Date</dt><dd>{displayDate(profile.joiningDate)}</dd></div><div><dt>Default Store</dt><dd>{store?.name || "—"}</dd></div><div><dt>Status</dt><dd><span className="ea-profile-status">Active</span></dd></div></dl>
    </div></section>
    <section className="ea-details-card"><h3><i className="bi bi-calendar3" /> Attendance Record – {displayDate(record.date)} <span>({weekday})</span></h3><div className="ea-table-wrap"><table className="ea-detail-table"><thead><tr><th>#</th><th>Login Time (Clock In)</th><th>Logout Time (Clock Out)</th><th>Total Hours</th></tr></thead><tbody><tr><td>1</td><td>{displayTime(record.clockIn)}</td><td>{displayTime(record.detailClockOut || record.clockOut)}</td><td>{record.detailTotal || record.total}</td></tr></tbody></table></div></section>
    <section className="ea-details-card"><h3>Remarks – {displayDate(record.date)} <span>({weekday})</span></h3><div className="ea-table-wrap"><table className="ea-detail-table ea-remarks-table"><thead><tr><th>#</th><th>Remark</th><th>Added On</th></tr></thead><tbody>{remarks.length ? remarks.map((remark, index) => <tr key={remark.text}><td>{index + 1}</td><td>{remark.text}</td><td>{remark.addedOn}</td></tr>) : <tr><td colSpan={3} className="ea-no-remarks">No remarks available for this attendance record.</td></tr>}</tbody></table></div></section>
  </div>;
}

export default function EmployeeAttendance({ store, embedded = false, onViewRecord }) {
  const records = INITIAL_RECORDS;
  const [employee, setEmployee] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");
  const [dateFilter, setDateFilter] = useState("any");
  const [showDateRange, setShowDateRange] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const employees = useMemo(() => [...new Map(records.map((row) => [row.code, row.name])).entries()], [records]);
  const filtered = useMemo(() => records.filter((row) =>
    (!employee || row.code === employee)
    && (!status || row.status === status)
    && (!startDate || row.date >= startDate)
    && (!endDate || row.date <= endDate)
    && (!query || `${row.name} ${row.code}`.toLowerCase().includes(query.trim().toLowerCase())),
  ), [records, employee, status, startDate, endDate, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  function exportCsv() {
    const heading = ["Date", "Employee Code", "Employee Name", "Clock In", "Clock Out", "Total Hours", "Status"];
    const rows = filtered.map((row) => [displayDate(row.date), row.code, row.name, displayTime(row.clockIn), displayTime(row.clockOut), row.total, row.status]);
    const csv = [heading, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(store?.name || "store").replace(/[^a-z0-9]+/gi, "-")}-attendance.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className={`employee-attendance ${embedded ? "is-embedded" : ""}`} aria-label="Employee attendance">
      <header className="ea-header">
        <div><h2>Employee Attendance</h2><p>View and manage employee clock-in and clock-out records.</p></div>
        <div className="ea-header-actions">
          <button className="ea-export" type="button" onClick={exportCsv}><i className="bi bi-download" aria-hidden="true" /> Export</button>
        </div>
      </header>

      <div className="ea-toolbar">
        <form className="ea-search" onSubmit={(event) => { event.preventDefault(); setPage(1); }}><i className="bi bi-search" aria-hidden="true" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search employees..." aria-label="Search employee attendance" /></form>
        <label className="ea-inline-filter"><span className="sr-only">Employee</span><FilterDropdown value={employee} onChange={(event) => { setEmployee(event.target.value); setPage(1); }}><option value="">All Employees</option>{employees.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}</FilterDropdown></label>
        <label className="ea-inline-filter"><span className="sr-only">Status</span><FilterDropdown value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All Statuses</option><option>Present</option><option>Absent</option></FilterDropdown></label>
        <label className="ea-inline-filter ea-date-filter"><span className="sr-only">Date range</span><FilterDropdown value={dateFilter} onChange={(event) => {
          const next = event.target.value;
          setDateFilter(next);
          setPage(1);
          if (next === "custom") {
            setDraftStartDate(startDate);
            setDraftEndDate(endDate);
            setShowDateRange(true);
          } else {
            const [from, to] = dateBoundsForPreset(next);
            setStartDate(from);
            setEndDate(to);
            setShowDateRange(false);
          }
        }}><option value="any">Any Date</option><option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="custom">Custom Range</option></FilterDropdown></label>
        <button type="button" className="ea-reset" onClick={() => { setEmployee(""); setStatus(""); setQuery(""); setStartDate(""); setEndDate(""); setDraftStartDate(""); setDraftEndDate(""); setDateFilter("any"); setShowDateRange(false); setPage(1); }}><i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Reset</button>
      </div>

      {showDateRange && <div className="ea-date-range-panel">
        <label>From date<input type="date" value={draftStartDate} onChange={(event) => setDraftStartDate(event.target.value)} /></label>
        <label>To date<input type="date" value={draftEndDate} onChange={(event) => setDraftEndDate(event.target.value)} /></label>
        <button className="ea-apply-range" type="button" disabled={!draftStartDate || !draftEndDate || draftStartDate > draftEndDate} onClick={() => { setStartDate(draftStartDate); setEndDate(draftEndDate); setShowDateRange(false); setPage(1); }}>Apply date range</button>
        <button className="ea-cancel-range" type="button" onClick={() => { setShowDateRange(false); setDateFilter(startDate || endDate ? "custom" : "any"); }}>Cancel</button>
        <button className="ea-clear-dates" type="button" onClick={() => { setStartDate(""); setEndDate(""); setDraftStartDate(""); setDraftEndDate(""); setDateFilter("any"); setShowDateRange(false); setPage(1); }}>Clear dates</button>
      </div>}

      <div className="ea-table-wrap"><table className="ea-table"><thead><tr><th>Date</th><th>Employee Code</th><th>Employee Name</th><th>Clock In</th><th>Clock Out</th><th>Total Hours</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{pageRows.map((row) => <tr key={row.id}><td>{displayDate(row.date)}</td><td>{row.code}</td><td>{row.name}</td><td>{displayTime(row.clockIn)}</td><td>{displayTime(row.clockOut)}</td><td>{row.total}</td><td><span className={`ea-status ${row.status.toLowerCase()}`}>{row.status}</span></td><td><div className="ea-row-actions"><button type="button" title={`View ${row.name} attendance`} aria-label={`View ${row.name} attendance`} onClick={() => onViewRecord?.(row)}><i className="bi bi-eye" /></button></div></td></tr>)}
          {!pageRows.length && <tr><td colSpan={8} className="ea-empty">No attendance records match these filters.</td></tr>}
        </tbody></table></div>
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        itemLabel="records"
        showWhenEmpty
      />

    </section>
  );
}
