import FilterDropdown from "../components/FilterDropdown";
import { useEffect, useMemo, useState } from "react";
import Pagination from "../components/Pagination";
import { customersSeed } from "../data/data";
import ViewDetailsModal from "../components/ViewDetailsModal";
import "../styles/store-customers.css";

export default function StoreCustomers({
  embedded = false,
  merchantId,
  storeId,
  store,
}) {
  // ===================s======================================
  // FILTERSs
  // =========================================================

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // =========================================================
  // PAGINATION
  // =========================================================

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // =========================================================
  // CUSTOMER DATA
  // =========================================================

  const customers = customersSeed || [];

  // =========================================================
  // CUSTOMER TYPES
  // =========================================================

  const customerTypes = useMemo(() => {
    return [
      ...new Set(
        customers
          .map((customer) => customer.type)
          .filter(Boolean)
      ),
    ];
  }, [customers]);

  // =========================================================
  // FILTER CUSTOMERS
  // =========================================================

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const searchText = `
        ${customer.name || ""}
        ${customer.firstName || ""}
        ${customer.lastName || ""}
        ${customer.email || ""}
        ${customer.phone || ""}
        ${customer.customerId || ""}
        ${customer.id || ""}
      `.toLowerCase();

      const matchesSearch =
        !search ||
        searchText.includes(search.toLowerCase());

      const matchesStatus =
        !statusFilter ||
        customer.status === statusFilter;

      const matchesType =
        !customerTypeFilter ||
        customer.type === customerTypeFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType
      );
    });
  }, [
    customers,
    search,
    statusFilter,
    customerTypeFilter,
  ]);

  // =========================================================
  // PAGINATION
  // =========================================================

  const totalItems = filteredCustomers.length;

  const totalPages = Math.ceil(
    totalItems / pageSize
  );

  const paginatedCustomers = useMemo(() => {
    const startIndex =
      (currentPage - 1) * pageSize;

    const endIndex =
      startIndex + pageSize;

    return filteredCustomers.slice(
      startIndex,
      endIndex
    );
  }, [
    filteredCustomers,
    currentPage,
    pageSize,
  ]);

  // =========================================================
  // RESET PAGE WHEN FILTERS CHANGE
  // =========================================================

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    statusFilter,
    customerTypeFilter,
  ]);

  // =========================================================
  // KEEP PAGE VALID
  // =========================================================

  useEffect(() => {
    if (
      totalPages > 0 &&
      currentPage > totalPages
    ) {
      setCurrentPage(totalPages);
    }
  }, [
    currentPage,
    totalPages,
  ]);

  // =========================================================
  // SUMMARY
  // =========================================================

  const activeCustomers = customers.filter(
    (customer) =>
      customer.status === "Active"
  ).length;

  const inactiveCustomers = customers.filter(
    (customer) =>
      customer.status === "Inactive"
  ).length;

  const totalOrders = customers.reduce(
    (total, customer) =>
      total +
      Number(customer.ordersCount || 0),
    0
  );

  // =========================================================
  // CLEAR FILTERS
  // =========================================================

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setCustomerTypeFilter("");
    setCurrentPage(1);
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="store-customers-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="store-customers-header">

        <div className="store-customers-title-area">

          <div className="store-customers-title-icon">
            <i className="bi bi-people" />
          </div>

          <div>
            <h1>Customers</h1>

            <p>
              View customers associated with this store.
            </p>
          </div>

        </div>

        {/* STORE CONTEXT */}

        {store && (
          <div className="store-customers-context">

            <i className="bi bi-shop" />

            <div>
              <span>STORE</span>

              <strong>
                {store.name}
              </strong>

              <small>
                {store.id}
              </small>
            </div>

          </div>
        )}

      </div>

      {/* =====================================================
          SUMMARY CARDS
      ===================================================== */}

      <div className="store-customers-summary">

        {/* TOTAL CUSTOMERS */}

        <div className="store-customer-summary-card">

          <div className="store-customer-summary-icon purple">
            <i className="bi bi-people" />
          </div>

          <div>
            <span>Total Customers</span>

            <strong>
              {customers.length}
            </strong>
          </div>

        </div>

        {/* ACTIVE */}

        <div className="store-customer-summary-card">

          <div className="store-customer-summary-icon green">
            <i className="bi bi-person-check" />
          </div>

          <div>
            <span>Active Customers</span>

            <strong>
              {activeCustomers}
            </strong>
          </div>

        </div>

        {/* INACTIVE */}

        <div className="store-customer-summary-card">

          <div className="store-customer-summary-icon orange">
            <i className="bi bi-person-dash" />
          </div>

          <div>
            <span>Inactive Customers</span>

            <strong>
              {inactiveCustomers}
            </strong>
          </div>

        </div>

        {/* ORDERS */}

        <div className="store-customer-summary-card">

          <div className="store-customer-summary-icon blue">
            <i className="bi bi-cart-check" />
          </div>

          <div>
            <span>Total Orders</span>

            <strong>
              {totalOrders}
            </strong>
          </div>

        </div>

      </div>

      {/* =====================================================
          MAIN CARD
      ===================================================== */}

      <div className="store-customers-card">

        {/* ===================================================
            TOOLBAR
        =================================================== */}

        <div className="store-customers-toolbar">

          {/* SEARCH */}

          <div className="store-customers-search">

            <i className="bi bi-search" />

            <input
              type="text"
              placeholder="Search customer name, email or phone..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

          </div>

          {/* CUSTOMER TYPE */}

          <FilterDropdown
            value={customerTypeFilter}
            onChange={(event) =>
              setCustomerTypeFilter(
                event.target.value
              )
            }
          >
            <option value="">
              All Customer Types
            </option>

            {customerTypes.map((type) => (
              <option
                key={type}
                value={type}
              >
                {type}
              </option>
            ))}
          </FilterDropdown>

          {/* STATUS */}

          <FilterDropdown
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >
            <option value="">
              All Status
            </option>

            <option value="Active">
              Active
            </option>

            <option value="Inactive">
              Inactive
            </option>
          </FilterDropdown>

          {/* CLEAR */}

          <button
            type="button"
            className="store-customers-clear-btn"
            onClick={clearFilters}
          >
            <i className="bi bi-arrow-counterclockwise" />
            Clear
          </button>

        </div>

        {/* ===================================================
            TABLE HEADER
        =================================================== */}

        <div className="store-customers-table-heading">

          <div>
            Customers

            <span>
              {filteredCustomers.length}
            </span>
          </div>

        </div>

        {/* ===================================================
            TABLE
        =================================================== */}

        {filteredCustomers.length > 0 ? (
          <div className="store-customers-table-wrapper">

            <table className="store-customers-table">

              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Type</th>
                  <th>Orders</th>
                  <th>Total Spent</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                </tr>
              </thead>

              <tbody>
                {paginatedCustomers.map(
                  (customer) => (
                    <CustomerRow
                      key={
                        customer.id ||
                        customer.customerId
                      }
                      customer={customer}
                      onView={() => setSelectedCustomer(customer)}
                    />
                  )
                )}
              </tbody>

            </table>

          </div>
        ) : (
          /* =================================================
             EMPTY STATE
          ================================================= */

          <div className="store-customers-empty">

            <div className="store-customers-empty-icon">
              <i className="bi bi-people" />
            </div>

            <h3>
              No customers found
            </h3>

            <p>
              Try changing your search or filters.
            </p>

            <button
              type="button"
              onClick={clearFilters}
            >
              Clear Filters
            </button>

          </div>
        )}

        {/* ===================================================
            PAGINATION
        =================================================== */}

        {filteredCustomers.length > 0 && (
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

        {/* ===================================================
            SOURCE FOOTER
        =================================================== */}

        <div className="store-customers-footer">

          <div>
            <i className="bi bi-wordpress" />

            <span>
              Customer data synced from WooCommerce
            </span>
          </div>

          <span className="store-customers-readonly">
            Read Only
          </span>

        </div>

      </div>

      <ViewDetailsModal
        open={Boolean(selectedCustomer)}
        title="Customer Details"
        subtitle={
          selectedCustomer
            ? selectedCustomer.name ||
              `${selectedCustomer.firstName || ""} ${selectedCustomer.lastName || ""}`.trim()
            : ""
        }
        data={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        fields={[
          {
            key: "customerId",
            label: "Customer ID",
            value: (customer) =>
              customer.customerId || customer.id || "",
          },
          {
            key: "name",
            label: "Customer Name",
            value: (customer) =>
              customer.name ||
              `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
          },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "type", label: "Customer Type" },
          {
            key: "status",
            label: "Status",
            render: (value) => (
              <span
                className={`detail-status ${
                  value === "Active" ? "active" : "inactive"
                }`}
              >
                {value || "—"}
              </span>
            ),
          },
          { key: "ordersCount", label: "Total Orders" },
          { key: "totalSpent", label: "Total Spent" },
          { key: "updatedAt", label: "Last Updated" },
        ]}
      />
    </div>
  );
}


// =========================================================
// CUSTOMER ROW
// =========================================================

function CustomerRow({ customer, onView }) {
  const displayName =
    customer.name ||
    `${customer.firstName || ""} ${
      customer.lastName || ""
    }`.trim() ||
    "Unnamed Customer";

  const initials = getInitials(displayName);

  const statusClass =
    customer.status === "Active"
      ? "active"
      : "inactive";

  return (
    <tr
      className="store-customer-row-clickable"
      onClick={onView}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onView?.();
        }
      }}
    >

      {/* CUSTOMER */}

      <td>

        <div className="store-customer-info">

          <div className="store-customer-avatar">
            {customer.profilePhoto ? (
              <img
                src={customer.profilePhoto}
                alt={displayName}
              />
            ) : (
              initials
            )}
          </div>

          <div>
            <strong>
              {displayName}
            </strong>

            <small>
              {customer.customerId ||
                customer.id ||
                "—"}
            </small>
          </div>

        </div>

      </td>

      {/* EMAIL */}

      <td>
        <span className="store-customer-email">
          {customer.email || "—"}
        </span>
      </td>

      {/* PHONE */}

      <td>
        <span className="store-customer-phone">
          {customer.phone || "—"}
        </span>
      </td>

      {/* TYPE */}

      <td>
        <span className="store-customer-type">
          {customer.type || "Regular"}
        </span>
      </td>

      {/* ORDERS */}

      <td>
        <span className="store-customer-orders">
          {customer.ordersCount ?? 0}
        </span>
      </td>

      {/* TOTAL SPENT */}

      <td>
        <strong className="store-customer-spent">
          {customer.totalSpent || "—"}
        </strong>
      </td>

      {/* STATUS */}

      <td>
        <span
          className={`store-customer-status ${statusClass}`}
        >
          <i className="bi bi-circle-fill" />
          {customer.status || "Inactive"}
        </span>
      </td>

      {/* UPDATED */}

      <td>
        <span className="store-customer-date">
          {customer.updatedAt || "—"}
        </span>
      </td>

    </tr>
  );
}


// =========================================================
// INITIALS
// =========================================================

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}