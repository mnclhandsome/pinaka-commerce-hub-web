import { EmployeeToast } from "../components/EmployeeFeedback";
import React, { useEffect, useMemo, useState } from "react";
import { listEmployees } from "../api/employees";
import Pagination from "../components/Pagination";
import FiltersBar from "../components/FiltersBar";
import DeleteConfirmationDialog from "../components/DeleteConfirmationDialog";
import { useNavigate, useLocation } from "react-router-dom";
import { getEmployeeList, deleteEmployee } from "../api/employees";

import {
  Search,
  ChevronDown,
  Plus,
  Download,
  CalendarDays,
  Filter,
} from "lucide-react";
import ListActions from "../components/ListActions";
import "../styles/Employees.css";
/* =========================================================
   AVATAR COMPONENT WITH SAFE FALLBACK
========================================================= */
function EmployeeAvatar({ src, name, initials, colorClass }) {
  const [imgError, setImgError] = useState(false);
  useEffect(() => {
    setImgError(false);
  }, [src]);
  
}
/* =========================================================
   EMPLOYEE DATA
========================================================= */
const employees = [
  {
    initials: "SK",
    name: "Santhosh Kumar",
    id: "EMP001",
    email: "santhosh.kumar@pinaka.com",
    phone: "+91 98765 43210",
    role: "Store Manager",
    merchant: "FreshMart",
    store: "Banjara Hills",
    status: "Active",
    joined: "Jan 12, 2024",
    active: "2 mins ago",
    avatar: "purple",
  },
  {
    initials: "PD",
    name: "Priya Desai",
    id: "EMP002",
    email: "priya.desai@pinaka.com",
    phone: "+91 98765 43211",
    role: "Cashier",
    merchant: "FreshMart",
    store: "Jubilee Hills",
    status: "Active",
    joined: "Feb 5, 2024",
    active: "10 mins ago",
    avatar: "pink",
  },
  {
    initials: "AR",
    name: "Arjun Reddy",
    id: "EMP003",
    email: "arjun.reddy@pinaka.com",
    phone: "+91 98765 43212",
    role: "Sales Associate",
    merchant: "TechWorld",
    store: "Madhapur",
    status: "Active",
    joined: "Mar 1, 2024",
    active: "1 hour ago",
    avatar: "green",
  },
  {
    initials: "NS",
    name: "Neha Singh",
    id: "EMP004",
    email: "neha.singh@pinaka.com",
    phone: " +91 98765 43213",
    role: "Store Manager",
    merchant: "FashionHub",
    store: "Hitech City",
    status: "Inactive",
    joined: "Jan 18, 2024",
    active: "5 days ago",
    avatar: "orange",
  },
  {
    initials: "RK",
    name: "Rahul Khanna",
    id: "EMP005",
    email: "rahul.khanna@pinaka.com",
    phone: "+91 98765 43214",
    role: "Admin",
    merchant: "ElectroPlus",
    store: "Gachibowli",
    status: "Active",
    joined: "Feb 20, 2024",
    active: "30 mins ago",
    avatar: "blue",
  },
  /* Extra data to test search + pagination */
  {
    initials: "VK",
    name: "Vikram Kumar",
    id: "EMP006",
    email: "vikram.kumar@pinaka.com",
    phone: "+91 98765 43215",
    role: "Cashier",
    merchant: "FreshMart",
    store: "Banjara Hills",
    status: "Active",
    joined: "Mar 12, 2024",
    active: "15 mins ago",
    avatar: "purple",
  },
  {
    initials: "AM",
    name: "Anjali Mehta",
    id: "EMP007",
    email: "anjali.mehta@pinaka.com",
    phone: "+91 98765 43216",
    role: "Admin",
    merchant: "TechWorld",
    store: "Madhapur",
    status: "Inactive",
    joined: "Mar 15, 2024",
    active: "2 days ago",
    avatar: "pink",
  },
  {
    initials: "RS",
    name: "Ravi Sharma",
    id: "EMP008",
    email: "ravi.sharma@pinaka.com",
    phone: "+91 98765 43217",
    role: "Sales Associate",
    merchant: "FashionHub",
    store: "Hitech City",
    status: "Active",
    joined: "Mar 20, 2024",
    active: "20 mins ago",
    avatar: "green",
  },
  {
    initials: "DP",
    name: "Deepak Prasad",
    id: "EMP009",
    email: "deepak.prasad@pinaka.com",
    phone: "+91 98765 43218",
    role: "Store Manager",
    merchant: "ElectroPlus",
    store: "Gachibowli",
    status: "Active",
    joined: "Apr 2, 2024",
    active: "1 hour ago",
    avatar: "orange",
  },
  {
    initials: "SN",
    name: "Sneha Nair",
    id: "EMP010",
    email: "sneha.nair@pinaka.com",
    phone: "+91 98765 43219",
    role: "Cashier",
    merchant: "FreshMart",
    store: "Jubilee Hills",
    status: "Active",
    joined: "Apr 5, 2024",
    active: "5 mins ago",
    avatar: "blue",
  },
];
export async function listMerchants() {
  const data = await api.get(endpoints.merchants);
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.merchants)
      ? data.merchants
      : Array.isArray(data?.data)
        ? data.data
        : [];
  return items;
}
/* =========================================================
   STAT CARD
========================================================= */

function StatCard({ icon, title, value, description, type, progress }) {
  return (
    <div className="employees-stat-card">
      <div className={`employees-stat-icon ${type}`}>
        <i className={`bi ${icon}`} aria-hidden="true" />
      </div>
      <div className="employees-stat-content">
        <div className="employees-stat-title">{title}</div>
        <div className="employees-stat-value">{value}</div>
        <div className={`employees-stat-change ${type}`}>{description}</div>
        {progress !== undefined && (
          <div className="employees-progress-track">
            <div
              className={`employees-progress-bar ${type}`}
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
/* =========================================================
   FILTER DROPDOWN
========================================================= */
function FilterSelect({ value, options, onChange }) {
  return (
    <div className="employees-select">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown size={15} className="employees-select-icon" />
    </div>
  );
}
/* =========================================================
   EMPLOYEES PAGE
========================================================= */
export default function Employees() {
  /* SEARCH */
  const navigate = useNavigate();
  const openView = (employee) => navigate(`/employees/${encodeURIComponent(employee.employeeId || employee.id)}`);
  const location = useLocation();
  const [notice, setNotice] = useState(location.state?.employeeMessage || "");
  const [deleteTarget, setDeleteTarget] = useState(null);
  useEffect(() => {
    if (location.state?.employeeMessage) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);
  const [employeeRows, setEmployeeRows] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
const [roleFilter, setRoleFilter] = useState("");
const [statusFilter, setStatusFilter] = useState("");
const [storeFilter, setStoreFilter] = useState("");

 
async function handleDelete(employee) {
  if (deletingId) return;

  if (
    employee.id === undefined ||
    employee.id === null ||
    String(employee.id).trim() === ""
  ) {
    setDeleteError("Employee ID is missing. Cannot delete employee.");
    return;
  }

  setDeletingId(employee.id);
  setDeleteError("");

  try {
    await deleteEmployee(employee.id);

    const result = await getEmployeeList();
    setEmployeeRows(result.employees);
    setStatistics(result.statistics);

    setDeleteTarget(null);
    setNotice("Employee deleted successfully.");
  } catch (error) {
    setDeleteError(
      error?.response?.data?.message ||
      error?.message ||
      "Unable to delete employee."
    );
  } finally {
    setDeletingId(null);
  }
}


  function displayTimestamp(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : (
      <span className="employee-timestamp">
        <strong>{date.toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        })}</strong>
        <span>{date.toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit",
        })}</span>
      </span>
    );
  }

  useEffect(() => {
    let active = true;
    getEmployeeList()
      .then((result) => {
        if (active) { setEmployeeRows(result.employees); setStatistics(result.statistics); }
      })
      .catch((error) => {
        if (active) setLoadError(error.message || "Unable to load employees.");
      });
    return () => {
      active = false;
    };
  }, []);

  /* PAGINATION */
  const [page, setPage] = useState(1);
const [rowsPerPage, setRowsPerPage] = useState(10);

const handlePageSizeChange = (size) => {
  setRowsPerPage(size);
  setPage(1);
};
  /* =====================================================
     FILTER EMPLOYEES
  ===================================================== */
  const filteredEmployees = useMemo(() => {
  return employeeRows.filter((employee) => {
    const searchValue = searchTerm.trim().toLowerCase();

    const matchesSearch =
      !searchValue ||
      employee.name?.toLowerCase().includes(searchValue) ||
      employee.email?.toLowerCase().includes(searchValue) ||
      employee.phone?.toLowerCase().includes(searchValue) ||
      employee.role?.toLowerCase().includes(searchValue) ||
      employee.merchant?.toLowerCase().includes(searchValue) ||
      employee.store?.toLowerCase().includes(searchValue);

    const matchesRole =
      !roleFilter || employee.role === roleFilter;

    const matchesStatus =
      !statusFilter || employee.status === statusFilter;

    const matchesStore =
      !storeFilter || employee.store === storeFilter;

    return (
      matchesSearch &&
      matchesRole &&
      matchesStatus &&
      matchesStore
    );
  });
}, [
  employeeRows,
  searchTerm,
  roleFilter,
  statusFilter,
  storeFilter,
]);

  /* =====================================================
     PAGINATION CALCULATIONS
  ===================================================== */
  const totalPages = Math.max(
    1,
    Math.ceil(filteredEmployees.length / rowsPerPage),
  );
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const visibleEmployees = filteredEmployees.slice(startIndex, endIndex);

  /* =====================================================
     PAGINATION
  ===================================================== */
  useEffect(() => {
  setPage((currentPage) =>
    Math.min(currentPage, totalPages)
  );
}, [totalPages]);
  /* =====================================================
     RESET FILTERS
  ===================================================== */
  const resetFilters = () => {
    setSearch("");
    setMerchant("All Merchants");
    setRole("All Roles");
    setPage(1);
  };
  /* =====================================================
     RETURN
  ===================================================== */
  return (
    <div className="employees-page">
      {/* =================================================
          PAGE HEADER
      ================================================= */}
      <div className="employees-page-header">
        <div>
          <h1>Employees</h1>
          <p className="employees-subtitle">
            View and manage employees across your stores.
          </p>
        </div>
        <div className="employees-header-actions">
          <button
            className="employees-add-btn"
            onClick={() => navigate("/employees/add")}
          >
            <Plus size={18} />
            Add Employee
          </button>
          <button
            className="employees-export-btn"
            onClick={() => console.log("Export clicked")}
          >
            <Download size={18} />
            Export
          </button>
        </div>
      </div>
      {/* =================================================
          STATISTICS
      ================================================= */}
      <div className="employees-stats">
        <StatCard
          icon="bi-people-fill"
          title="Total Employees"
          value={statistics?.total_employees ?? "—"}
          description={statistics ? `${statistics.current_month_added_employees} this month` : ""}
          type="purple"
        />
        <StatCard
          icon="bi-check-circle-fill"
          title="Active Employees"
          value={statistics?.active_employees ?? "—"}
          description={statistics ? `${statistics.active_employees_percentage}% of total` : ""}
          type="green"
          progress={statistics?.active_employees_percentage ?? 0}
        />
        <StatCard
          icon="bi-x-circle-fill"
          title="Inactive Employees"
          value={statistics?.inactive_employees ?? "—"}
          description={statistics ? `${statistics.inactive_employees_percentage}% of total` : ""}
          type="red"
          progress={statistics?.inactive_employees_percentage ?? 0}
        />
        <StatCard
          icon="bi-person-plus-fill"
          title="New This Month"
          value={statistics?.current_month_added_employees ?? "—"}
          description={statistics ? `${statistics.monthly_growth_direction === "INCREASE" ? "↑" : statistics.monthly_growth_direction === "DECREASE" ? "↓" : "→"} ${Math.abs(statistics.monthly_growth_percentage)}% vs last month` : ""}
          type="blue"
        />
      </div>
      {/* =================================================
          EMPLOYEE LIST
      ================================================= */}
      <div className="employees-list-card">
        {/* FILTER BAR */}
       <FiltersBar
    searchValue={searchTerm}
    onSearchChange={(value) => {
        setSearchTerm(value);
        setPage(1);
    }}
    searchPlaceholder="Search employee name, email, or phone..."
    filters={[
        {
            key: "role",
            label: "Role",
            value: roleFilter,
            options: [
                { label: "All Roles", value: "" },
                ...[
                    ...new Set(
                        employees
                            .map((employee) => employee.role)
                            .filter(Boolean)
                    ),
                ].map((role) => ({
                    label: role,
                    value: role,
                })),
            ],
            onChange: (value) => {
                setRoleFilter(value);
                setPage(1);
            },
        },
        {
            key: "status",
            label: "Status",
            value: statusFilter,
            options: [
                { label: "All Status", value: "" },
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
            ],
            onChange: (value) => {
                setStatusFilter(value);
                setPage(1);
            },
        },
        {
            key: "store",
            label: "Store",
            value: storeFilter,
            options: [
                { label: "All Stores", value: "" },
                ...[
                    ...new Set(
                        employees
                            .map((employee) => employee.store)
                            .filter(Boolean)
                    ),
                ].map((store) => ({
                    label: store,
                    value: store,
                })),
            ],
            onChange: (value) => {
                setStoreFilter(value);
                setPage(1);
            },
        },
    ]}
    onClear={() => {
        setSearchTerm("");
        setRoleFilter("");
        setStatusFilter("");
        setStoreFilter("");
        setPage(1);
    }}
/>
        {/* =================================================
            TABLE
        ================================================= */}

        <EmployeeToast message={deleteError || notice} onClose={() => { setDeleteError(""); setNotice(""); }} />
        
<DeleteConfirmationDialog
  isOpen={Boolean(deleteTarget)}
  title="Delete Employee?"
  message={
    deleteTarget
      ? `Are you sure you want to delete "${deleteTarget.name}"?`
      : ""
  }
  cancelLabel="Cancel"
  confirmLabel="Delete"
  busyLabel="Deleting..."
  busy={Boolean(deletingId)}
  error={deleteError}
  iconClassName="bi bi-trash3"
  onCancel={() => {
    if (deletingId) return;
    setDeleteTarget(null);
    setDeleteError("");
  }}
  onConfirm={() => {
    if (deleteTarget) {
      handleDelete(deleteTarget);
    }
  }}
/>

        <div className="employees-table-wrap">
          <table className="employees-table">
            <thead>
              <tr>
                <th>Employee</th>

                <th>Contact</th>

                <th>Login PIN</th>

                <th>Merchant</th>

                <th>Status</th>

                <th>Created At</th>

                <th>Updated At</th>

                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadError ? (
                <tr>
                  <td colSpan="8" className="employees-no-results">
                    {loadError}
                  </td>
                </tr>
              ) : visibleEmployees.length > 0 ? (
                visibleEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    tabIndex={0}
                    aria-label={`View ${employee.name}`}
                    style={{ cursor: "pointer" }}
                    onClick={(event) => {
                      if (event.target.closest('button, a, input, select, textarea, label, [role="button"], [contenteditable="true"]')) {
                        event.stopPropagation();
                        return;
                      }
                      openView(employee);
                    }}
                    onKeyDown={(event) => {
                      if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        openView(employee);
                      }
                    }}
                  >
                    {/* EMPLOYEE */}
                    {/* EMPLOYEE COLUMN */}
                    {/* EMPLOYEE COLUMN */}
                    <td>
                      <div className="employee-person">
                        <div>
                          <div className="employee-name">{employee.name}</div>
                          <div className="employee-id">{employee.employeeCode || employee.employee_code || employee.id}</div>
                        </div>
                      </div>
                    </td>
                    {/* CONTACT */}
                    <td>
                      <div className="employee-contact">
                        <div>{employee.email}</div>
                        <div>{employee.phone}</div>
                      </div>
                    </td>
                    <td>{employee.loginPin || "—"}</td>
                    {/* ROLE */}

                    {/* MERCHANT */}
                    <td className="employee-merchant-cell"><span className="employee-merchant-name">{employee.merchant}</span></td>
                    {/* STORE */}

                    {/* STATUS */}
                    <td>
                      <span
                        className={`employee-status ${employee.status.toLowerCase()}`}
                      >
                        {employee.status}
                      </span>
                    </td>
                    {/* JOINED */}

                    <td>{displayTimestamp(employee.createdAt)}</td>

                    {/* LAST ACTIVE */}

                    <td>
                      {Date.parse(employee.updatedAt || "") > Date.parse(employee.createdAt || "")
                        ? displayTimestamp(employee.updatedAt)
                        : "—"}
                    </td>

                    {/* ACTIONS */}
                    <td>
                      <ListActions
                          onView={() => openView(employee)}
                          viewLabel={`View ${employee.name}`}
                          onEdit={() =>
                          navigate("/employees/edit", {
                          state: { employee }, }) }
                          onDelete={() => {
                            setDeleteError("");
                            setDeleteTarget(employee); }}
                            editLabel={`Edit ${employee.name}`}
                            deleteLabel={`Delete ${employee.name}`}
                            deleteDisabled={Boolean(deletingId)}
                               />
                   </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="employees-no-results">
                    No employees found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
       {/* ================================================= 
    PAGINATION 
================================================= */}

<Pagination
  currentPage={safePage}
  totalPages={totalPages}
  totalItems={filteredEmployees.length}
  pageSize={rowsPerPage}
  onPageChange={setPage}
  onPageSizeChange={handlePageSizeChange}
  itemLabel="employees"
  showWhenEmpty={true}
/>
      </div>
    </div>
  );
}
