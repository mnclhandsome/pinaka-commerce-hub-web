import FilterDropdown from "../components/FilterDropdown";
import ListActions from "../components/ListActions";
import Pagination from "../components/Pagination";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAttendanceRecordById,
  getAttendanceRecords,
  getStoreEmployees,
} from "../api/employeeAttendanceService";
import "../styles/employee-attendance.css";

/* =========================================================
   DATE AND TIME HELPERS
========================================================= */

function parseDate(value) {
  if (!value) return null;

  // A time-only value cannot be parsed as a full date.
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(String(value))) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const localIsoDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const displayDate = (value) => {
  const date = parseDate(value);

  return date
    ? date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
};

const displayTime = (value) => {
  if (!value) return "—";

  const timeMatch = String(value).match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);

    if (hours > 23 || minutes > 59) return "—";

    return `${String(hours % 12 || 12).padStart(2, "0")}:${String(
      minutes,
    ).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
  }

  const date = parseDate(value);

  return date
    ? date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "—";
};

function dateBoundsForPreset(preset) {
  const today = new Date();
  const end = localIsoDate(today);

  if (preset === "today") return [end, end];

  if (preset === "week") {
    const start = new Date(today);
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return [localIsoDate(start), end];
  }

  if (preset === "month") {
    return [
      localIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      end,
    ];
  }

  return ["", ""];
}

function getRecordDate(record) {
  const value =
    record.date ||
    record.attendanceDate ||
    record.attendance_date ||
    record.clockIn ||
    record.clock_in ||
    record.createdAt ||
    record.created_at;

  const date = parseDate(value);
  return date ? localIsoDate(date) : "";
}

function getDuration(clockIn, clockOut) {
  if (!clockIn || !clockOut) return "—";

  const start = parseDate(clockIn);
  const end = parseDate(clockOut);

  if (!start || !end || end < start) return "—";

  const minutes = Math.floor((end.getTime() - start.getTime()) / 60000);

  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(
    2,
    "0",
  )}m`;
}

function normalizeStatus(record) {
  const status = String(record.status || "").trim().toUpperCase();

  if (status === "ABSENT") return "Absent";

  if (
    [
      "PRESENT",
      "COMPLETED",
      "CLOCKED_IN",
      "CLOCKED_OUT",
      "CLOCK_IN",
      "CLOCK_OUT",
      "OPEN",
      "INCOMPLETE",
    ].includes(status) ||
    record.clockIn ||
    record.clockOut
  ) {
    return "Present";
  }

  // A missing attendance row does not prove the employee was absent.
  return "Not Marked";
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Unable to load employee attendance. Please try again."
  );
}

/* =========================================================
   ATTENDANCE DETAILS
========================================================= */

export function AttendanceDetails({ record, store, onBack }) {
  const [detailRecord, setDetailRecord] = useState(record);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(true);

  const merchantId =
    store?.merchantId || store?.merchant_id || store?.merchant?.id || store?.merchant?.merchantId || "";
  const storeId = store?.id || store?.storeId || store?.store_id || store?.store?.id || "";

  useEffect(() => {
    let active = true;
    setDetailRecord(record);
    setDetailLoading(true);
    setDetailError("");

    getAttendanceRecordById({ id: record?.id, merchantId, storeId })
      .then((freshRecord) => {
        if (active) setDetailRecord({ ...record, ...freshRecord });
      })
      .catch((error) => {
        if (active) {
          setDetailRecord(record);
          setDetailError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [record, merchantId, storeId]);

  const selectedRecord = detailRecord || record;
  const profile = selectedRecord?.employeeProfile || {};

  const date = parseDate(selectedRecord?.date || selectedRecord?.clockIn);
  const weekday = date
    ? date.toLocaleDateString("en-GB", { weekday: "long" })
    : "—";

  const name = selectedRecord?.name || selectedRecord?.employeeName || "Employee";

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="ea-details-page">
      <header className="ea-details-heading">
        <div>
          <h2>Employee Attendance – View Details</h2>
          <p>View attendance information for the selected date.</p>
        </div>

        <button type="button" onClick={onBack}>
          <i className="bi bi-arrow-left" /> Back to Attendance
        </button>
      </header>

      <section className="ea-details-card">
        <h3>Employee Overview</h3>

        <div className="ea-profile-grid">
          <div className="ea-profile-primary">
            <span className="ea-avatar">{initials || "E"}</span>

            <dl>
              <div>
                <dt>Employee Code</dt>
                <dd>{selectedRecord?.code || selectedRecord?.employeeCode || "—"}</dd>
              </div>

              <div>
                <dt>Employee Name</dt>
                <dd>{name}</dd>
              </div>

              <div>
                <dt>Role</dt>
                <dd>{profile.role || selectedRecord?.role || "—"}</dd>
              </div>
            </dl>
          </div>

          <dl>
            <div>
              <dt>Phone</dt>
              <dd>{profile.phone || "—"}</dd>
            </div>

            <div>
              <dt>Email</dt>
              <dd>{profile.email || "—"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`ea-profile-status ${String(profile.status || "").trim().toLowerCase() === "inactive" ? "inactive" : "active"}`}>
                  {profile.status || "—"}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="ea-details-card">
        <h3>
          <i className="bi bi-calendar3" /> Attendance Record –{" "}
          {displayDate(selectedRecord?.date || selectedRecord?.clockIn)} <span>({weekday})</span>
        </h3>

        {detailLoading && <p>Loading this attendance record…</p>}
        {detailError && <p role="alert">{detailError}</p>}

        <div className="ea-table-wrap">
          <table className="ea-detail-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Login Time (Clock In)</th>
                <th>Logout Time (Clock Out)</th>
                <th>Total Hours</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>1</td>
                <td>{displayTime(selectedRecord?.clockIn)}</td>
                <td>{displayTime(selectedRecord?.clockOut)}</td>
                <td>{getDuration(selectedRecord?.clockIn, selectedRecord?.clockOut)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}

/* =========================================================
   EMPLOYEE ATTENDANCE
========================================================= */

export default function EmployeeAttendance({
  store,
  embedded = false,
  onViewRecord,
}) {
  const [records, setRecords] = useState([]);
  const [employeeDirectory, setEmployeeDirectory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

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

  const merchantId =
    store?.merchantId ||
    store?.merchant_id ||
    store?.merchant?.id ||
    store?.merchant?.merchantId ||
    "";

  const storeId =
    store?.id ||
    store?.storeId ||
    store?.store_id ||
    store?.store?.id ||
    "";

  /* ---------------------------------------------------------
     LOAD LIVE API DATA
  --------------------------------------------------------- */

  const loadAttendance = useCallback(
    async () => {
      if (!merchantId || !storeId) {
        setRecords([]);
        setEmployeeDirectory([]);
        setApiError(
          "Merchant or Store ID is missing. Select a store to load attendance.",
        );
        setLoading(false);
        return;
      }

      setLoading(true);

      setApiError("");

      try {
        const [employeeResult, attendanceResult] = await Promise.all([
          getStoreEmployees(merchantId, storeId),
          getAttendanceRecords({ merchantId, storeId, page: 1, limit: 100 }),
        ]);

        const employeeList = Array.isArray(employeeResult)
          ? employeeResult
          : [];

        const attendanceList = Array.isArray(attendanceResult)
          ? attendanceResult
          : [];

        setEmployeeDirectory(employeeList);

        const employeesByCode = new Map(
          employeeList
            .filter((item) => item.employeeCode || item.employee_code || item.code)
            .map((item) => [
              String(item.employeeCode || item.employee_code || item.code),
              item,
            ]),
        );

        const normalizedRecords = attendanceList.map((item, index) => {
          const code = String(
            item.employeeCode || item.employee_code || item.code || "",
          );
          const profile = employeesByCode.get(code) || null;
          const date = getRecordDate(item);

          const merged = {
            ...item,
            id:
              item.id ||
              `${code}-${item.clockIn || date || "attendance"}-${index}`,
            code,
            name:
              profile?.name ||
              item.employeeName ||
              item.employee_name ||
              item.name ||
              "Employee",
            role: profile?.role || profile?.roleName || item.role || "",
            date,
            clockIn: item.clockIn || null,
            clockOut: item.clockOut || null,
            employeeProfile: profile,
            remarks: Array.isArray(item.remarks) ? item.remarks : [],
            status: normalizeStatus(item),
          };

          return {
            ...merged,
            total: getDuration(merged.clockIn, merged.clockOut),
          };
        });

        normalizedRecords.sort((a, b) => {
          const dateA = parseDate(a.clockIn || a.date)?.getTime() || 0;
          const dateB = parseDate(b.clockIn || b.date)?.getTime() || 0;
          return dateB - dateA;
        });

        setRecords(normalizedRecords);
      } catch (error) {
        console.error("Failed to load employee attendance:", error);
        setApiError(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [merchantId, storeId],
  );

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  /* ---------------------------------------------------------
     EMPLOYEE FILTER OPTIONS
  --------------------------------------------------------- */

  const employees = useMemo(() => {
    const directory = new Map();

    employeeDirectory.forEach((item) => {
      if (item.code) {
        directory.set(String(item.code), item.name || item.code);
      }
    });

    records.forEach((row) => {
      if (row.code && !directory.has(row.code)) {
        directory.set(row.code, row.name || row.code);
      }
    });

    return [...directory.entries()];
  }, [employeeDirectory, records]);

  /* ---------------------------------------------------------
     FILTER AND PAGINATE
  --------------------------------------------------------- */

  const filtered = useMemo(
    () =>
      records.filter(
        (row) =>
          (!employee || row.code === employee) &&
          (!status || row.status === status) &&
          (!startDate || row.date >= startDate) &&
          (!endDate || row.date <= endDate) &&
          (!query ||
            `${row.name} ${row.code}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())),
      ),
    [records, employee, status, startDate, endDate, query],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const pageRows = filtered.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  /* ---------------------------------------------------------
     CSV EXPORT
  --------------------------------------------------------- */

  function exportCsv() {
    if (!filtered.length) return;

    const heading = [
      "Date",
      "Employee Code",
      "Employee Name",
      "Clock In",
      "Clock Out",
      "Total Hours",
      "Status",
    ];

    const rows = filtered.map((row) => [
      displayDate(row.date),
      row.code,
      row.name,
      displayTime(row.clockIn),
      displayTime(row.clockOut),
      row.total,
      row.status,
    ]);

    const csv = [heading, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\r\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = `${(store?.name || store?.storeName || "store").replace(
      /[^a-z0-9]+/gi,
      "-",
    )}-attendance.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  /* ---------------------------------------------------------
     UI
  --------------------------------------------------------- */

  return (
    <section
      className={`employee-attendance ${embedded ? "is-embedded" : ""}`}
      aria-label="Employee attendance"
    >
      <header className="ea-header">
        <div>
          <h2>Employee Attendance</h2>
          <p>View and manage employee clock-in and clock-out records.</p>
        </div>

        <div className="ea-header-actions">
          <button
            className="ea-export"
            type="button"
            onClick={exportCsv}
            disabled={loading || filtered.length === 0}
          >
            <i className="bi bi-download" aria-hidden="true" /> Export
          </button>

        </div>
      </header>

      <div className="ea-toolbar">
        <form
          className="ea-search"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
          }}
        >
          <i className="bi bi-search" aria-hidden="true" />

          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search employees..."
            aria-label="Search employee attendance"
          />
        </form>

        <label className="ea-inline-filter">
          <span className="sr-only">Employee</span>

          <FilterDropdown
            value={employee}
            onChange={(event) => {
              setEmployee(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All Employees</option>

            {employees.map(([code, name]) => (
              <option key={code} value={code}>
                {name} ({code})
              </option>
            ))}
          </FilterDropdown>
        </label>

        <label className="ea-inline-filter">
          <span className="sr-only">Status</span>

          <FilterDropdown
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
            <option value="Not Marked">Not Marked</option>
          </FilterDropdown>
        </label>

        <label className="ea-inline-filter ea-date-filter">
          <span className="sr-only">Date range</span>

          <FilterDropdown
            value={dateFilter}
            onChange={(event) => {
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
            }}
          >
            <option value="any">Any Date</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </FilterDropdown>
        </label>

        <button
          type="button"
          className="ea-reset"
          onClick={() => {
            setEmployee("");
            setStatus("");
            setQuery("");
            setStartDate("");
            setEndDate("");
            setDraftStartDate("");
            setDraftEndDate("");
            setDateFilter("any");
            setShowDateRange(false);
            setPage(1);
          }}
        >
          <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />{" "}
          Reset
        </button>
      </div>

      {showDateRange && (
        <div className="ea-date-range-panel">
          <label>
            From date
            <input
              type="date"
              value={draftStartDate}
              onChange={(event) => setDraftStartDate(event.target.value)}
            />
          </label>

          <label>
            To date
            <input
              type="date"
              value={draftEndDate}
              onChange={(event) => setDraftEndDate(event.target.value)}
            />
          </label>

          <button
            className="ea-apply-range"
            type="button"
            disabled={
              !draftStartDate ||
              !draftEndDate ||
              draftStartDate > draftEndDate
            }
            onClick={() => {
              setStartDate(draftStartDate);
              setEndDate(draftEndDate);
              setShowDateRange(false);
              setPage(1);
            }}
          >
            Apply date range
          </button>

          <button
            className="ea-cancel-range"
            type="button"
            onClick={() => {
              setShowDateRange(false);
              setDateFilter(startDate || endDate ? "custom" : "any");
            }}
          >
            Cancel
          </button>

          <button
            className="ea-clear-dates"
            type="button"
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setDraftStartDate("");
              setDraftEndDate("");
              setDateFilter("any");
              setShowDateRange(false);
              setPage(1);
            }}
          >
            Clear dates
          </button>
        </div>
      )}

      {apiError && (
        <div role="alert" className="ea-api-error">
          <span>{apiError}</span>

          <button type="button" onClick={() => loadAttendance()}>
            Retry
          </button>
        </div>
      )}

      <div className="ea-table-wrap">
        <table className="ea-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee Code</th>
              <th>Employee Name</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Total Hours</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="ea-empty">
                  Loading attendance records...
                </td>
              </tr>
            ) : (
              <>
                {pageRows.map((row) => (
                  <tr key={row.id}>
                    <td>{displayDate(row.date)}</td>
                    <td>{row.code || "—"}</td>
                    <td>{row.name || "—"}</td>
                    <td>{displayTime(row.clockIn)}</td>
                    <td>{displayTime(row.clockOut)}</td>
                    <td>{row.total || "—"}</td>

                    <td>
                      <span
                        className={`ea-status ${row.status
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {row.status}
                      </span>
                    </td>

                    <td>
                      <ListActions
                        onView={() => onViewRecord?.(row)}
                        viewLabel={`View ${row.name} attendance`}
                      />
                    </td>
                  </tr>
                ))}

                {!pageRows.length && (
                  <tr>
                    <td colSpan={8} className="ea-empty">
                      {apiError
                        ? "Attendance records could not be loaded."
                        : "No attendance records match these filters."}
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

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
