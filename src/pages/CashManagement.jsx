import React, { useEffect, useMemo, useState } from "react";
import { merchants } from "../data/data";
import ViewDetailsModal from "../components/ViewDetailsModal";
import Pagination from "../components/Pagination";
import FiltersBar from "../components/FiltersBar";
import "../styles/cash-management.css";

export default function CashManagement() {
  const [selectedMerchant, setSelectedMerchant] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("All Dates");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const handlePageSizeChange = (size) => {
  setPageSize(size);
  setCurrentPage(1);
  };

  const cashPayments = [
    {
      id: 64303,
      title: "Cash Payment for Order 64303",
      orderId: "64303",
      merchant: "Westside Market LLC",
      store: "Westside Market",
      orderTotal: "$63.78",
      tenderAmount: "$63.78",
      balanceAmount: "$0.00",
      changeAmount: "$0.00",
      transactionId: "64304",
      acceptedBy: "Sathwika D",
      date: "Aug 10, 2026",
      time: "07:43 PM",
    },
    {
      id: 64287,
      title: "Cash Payment for Order 64287",
      orderId: "64287",
      merchant: "Westside Market LLC",
      store: "Main Street Store",
      orderTotal: "$0.00",
      tenderAmount: "$20.00",
      balanceAmount: "$0.00",
      changeAmount: "$20.00",
      transactionId: "64288",
      acceptedBy: "Kumar D",
      date: "Aug 10, 2026",
      time: "05:45 AM",
    },
    {
      id: 64285,
      title: "Cash Payment for Order 64285",
      orderId: "64285",
      merchant: "Westside Market LLC",
      store: "Westside Market",
      orderTotal: "$0.00",
      tenderAmount: "$20.00",
      balanceAmount: "$0.00",
      changeAmount: "$20.00",
      transactionId: "64286",
      acceptedBy: "Kumar D",
      date: "Aug 10, 2026",
      time: "03:46 AM",
    },
    {
      id: 64283,
      title: "Cash Payment for Order 64283",
      orderId: "64283",
      merchant: "Westside Market LLC",
      store: "Downtown Store",
      orderTotal: "$2.00",
      tenderAmount: "$20.00",
      balanceAmount: "$0.00",
      changeAmount: "$18.00",
      transactionId: "64284",
      acceptedBy: "Kumar D",
      date: "Aug 10, 2026",
      time: "03:45 AM",
    },
    {
      id: 64281,
      title: "Cash Payment for Order 64281",
      orderId: "64281",
      merchant: "Westside Market LLC",
      store: "Main Street Store",
      orderTotal: "$2.00",
      tenderAmount: "$20.00",
      balanceAmount: "$0.00",
      changeAmount: "$18.00",
      transactionId: "64282",
      acceptedBy: "Kumar D",
      date: "Aug 10, 2026",
      time: "03:18 AM",
    },
  ];

  /* =========================================================
     STORE OPTIONS
  ========================================================= */

  const stores = [
    "Westside Market",
    "Downtown Store",
    "Main Street Store",
  ];

  /* =========================================================
     FILTERED PAYMENTS
  ========================================================= */

  const filteredPayments = useMemo(() => {
    return cashPayments.filter((payment) => {
      const merchantName = merchants.find(
        (merchant) => merchant.id === selectedMerchant
      )?.name;

      const merchantMatch =
        !selectedMerchant || payment.merchant === merchantName;

      const storeMatch =
        !selectedStore || payment.store === selectedStore;

      const search = searchTerm.toLowerCase().trim();

      const searchMatch =
        !search ||
        payment.title.toLowerCase().includes(search) ||
        payment.orderId.toLowerCase().includes(search) ||
        payment.transactionId.toLowerCase().includes(search) ||
        payment.acceptedBy.toLowerCase().includes(search);

      let dateMatch = true;

if (dateFilter && dateFilter !== "All Dates") {
    const paymentDate = new Date(payment.date);
    const today = new Date();

    if (dateFilter === "today") {
        dateMatch =
            paymentDate.toDateString() ===
            today.toDateString();
    }

    if (dateFilter === "7days") {
        const from = new Date(today);
        from.setDate(today.getDate() - 6);

        dateMatch =
            paymentDate >= from &&
            paymentDate <= today;
    }

    if (dateFilter === "30days") {
        const from = new Date(today);
        from.setDate(today.getDate() - 29);

        dateMatch =
            paymentDate >= from &&
            paymentDate <= today;
    }
}

return (
    merchantMatch &&
    storeMatch &&
    searchMatch &&
    dateMatch
);

    });
    }, [selectedMerchant, selectedStore, searchTerm, dateFilter]);

  const totalItems = filteredPayments.length;

  const totalPages = Math.max(
      1,
      Math.ceil(totalItems / pageSize)
  );

const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return filteredPayments.slice(
        startIndex,
        endIndex
    );
}, [filteredPayments, currentPage, pageSize]);

// =========================================================
// RESET PAGINATION WHEN FILTERS CHANGE
// =========================================================

useEffect(() => {
  setCurrentPage(1);
}, [
  selectedMerchant,
  selectedStore,
  searchTerm,
  dateFilter,
]);


// =========================================================
// KEEP CURRENT PAGE VALID
// =========================================================

useEffect(() => {
  setCurrentPage((page) =>
    Math.min(page, totalPages)
  );
}, [totalPages]);

  /* =========================================================
     DASHBOARD VALUES
  ========================================================= */

  const totalPayments = filteredPayments.length;

  const completedPayments = filteredPayments.length;

  const pendingPayments = 0;

  const totalValue = filteredPayments.reduce((total, payment) => {
    return (
      total +
      Number(payment.tenderAmount.replace("$", "").replace(",", ""))
    );
  }, 0);

  /* =========================================================
     CLEAR FILTERS
  ========================================================= */

  const clearFilters = () => {
    setSelectedMerchant("");
    setSelectedStore("");
    setSearchTerm("");
    setDateFilter("All Dates");
  };

  return (
    <div className="page-content cash-management-page">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="cash-page-header">
        <div>
          <h1>Cash Management</h1>
          <p>
            View and manage cash payments and transactions for your stores.
          </p>
        </div>

      </div>

      {/* =====================================================
          KPI CARDS
      ===================================================== */}

      <div className="cash-kpi-grid">

        {/* TOTAL PAYMENTS */}
        <div className="cash-kpi-card purple">

          <div className="cash-kpi-icon">
            <i className="bi bi-wallet-fill" aria-hidden="true" />
          </div>

          <div className="cash-kpi-content">

            <span>Total Cash Payments</span>

            <strong>{totalPayments}</strong>

            <small className="cash-kpi-positive">
              <i className="bi bi-circle-fill" aria-hidden="true" />
              Live Records
            </small>

          </div>

          <div className="cash-kpi-line" />

        </div>

        {/* COMPLETED */}
        <div className="cash-kpi-card green">

          <div className="cash-kpi-icon">
            <i className="bi bi-check-circle-fill" aria-hidden="true" />
          </div>

          <div className="cash-kpi-content">

            <span>Completed</span>

            <strong>{completedPayments}</strong>

            <small className="cash-kpi-positive">
              <i className="bi bi-circle-fill" aria-hidden="true" />
              {totalPayments ? ((completedPayments / totalPayments) * 100).toFixed(1) : "0.0"}% of total
            </small>

          </div>

          <div className="cash-kpi-line" />

        </div>

        {/* PENDING */}
        <div className="cash-kpi-card orange">

          <div className="cash-kpi-icon">
            <i className="bi bi-clock-fill" aria-hidden="true" />
          </div>

          <div className="cash-kpi-content">

            <span>Pending Payment</span>

            <strong>{pendingPayments}</strong>

            <small className="cash-kpi-negative">
              <i className="bi bi-circle-fill" aria-hidden="true" />
              {totalPayments ? ((pendingPayments / totalPayments) * 100).toFixed(1) : "0.0"}% of total
            </small>

          </div>

          <div className="cash-kpi-line" />

        </div>

        {/* TOTAL VALUE */}
        <div className="cash-kpi-card blue">

          <div className="cash-kpi-icon">
            <i className="bi bi-cash-stack" aria-hidden="true" />
          </div>

          <div className="cash-kpi-content">

            <span>Total Value</span>

            <strong>
              $
              {totalValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </strong>

            <small className="cash-kpi-positive">
              <i className="bi bi-circle-fill" aria-hidden="true" />
              Across all payments
            </small>

          </div>

          <div className="cash-kpi-line" />

        </div>

      </div>


      {/* =====================================================
    TABLE CARD
===================================================== */}

<div className="cash-table-card">

 {/* =====================================================
    FILTER BAR
===================================================== */}

<FiltersBar
    searchValue={searchTerm}
    onSearchChange={(value) => {
        setSearchTerm(value);
        setCurrentPage(1);
    }}
    searchPlaceholder="Search order ID, transaction ID, or accepted by..."
    filters={[
        {
            key: "merchant",
            value: selectedMerchant,
            options: [
                {
                    label: "All Merchants",
                    value: "",
                },
                ...merchants.map((merchant) => ({
                    label: merchant.name,
                    value: merchant.id,
                })),
            ],
            onChange: (value) => {
                setSelectedMerchant(value);
                setCurrentPage(1);
            },
        },

        {
            key: "store",
            value: selectedStore,
            options: [
                {
                    label: "All Stores",
                    value: "",
                },
                ...stores.map((store) => ({
                    label: store,
                    value: store,
                })),
            ],
            onChange: (value) => {
                setSelectedStore(value);
                setCurrentPage(1);
            },
        },

        {
            key: "date",
            value: dateFilter,
            options: [
                {
                    label: "All Dates",
                    value: "All Dates",
                },
                {
                    label: "Today",
                    value: "today",
                },
                {
                    label: "Last 7 Days",
                    value: "7days",
                },
                {
                    label: "Last 30 Days",
                    value: "30days",
                },
            ],
            onChange: (value) => {
                setDateFilter(value);
                setCurrentPage(1);
            },
        },
    ]}
    onClear={clearFilters}
/>

  {/* TABLE */}
  <div className="cash-table-wrapper">
    <div className="cash-table-scroll">

    <table className="cash-table">

      <thead>
        <tr>

          <th>Title</th>

          <th>Order ID</th>

          <th>Order Total</th>

          <th>Tender Amount</th>

          <th>Balance Amount</th>

          <th>Change Amount</th>

          <th>Transaction ID</th>

          <th>Payment Accepted By</th>

          <th>Date</th>


        </tr>
      </thead>

      <tbody>

        {paginatedPayments.map((payment) => (

          <tr key={payment.id}>

            {/* TITLE */}
            <td>
              <a
                href="#cash-payment"
               className="cash-title" >
                Cash Payment for Order{" "}
                {payment.orderId}
                </a>
            </td>

            {/* ORDER ID */}
            <td>
              {payment.orderId}
            </td>

            {/* ORDER TOTAL */}
            <td>
              {payment.orderTotal}
            </td>

            {/* TENDER */}
            <td>
              {payment.tenderAmount}
            </td>

            {/* BALANCE */}
            <td>
              {payment.balanceAmount}
            </td>

            {/* CHANGE */}
            <td className="cash-change-positive">
              {payment.changeAmount}
            </td>

            {/* TRANSACTION ID */}
            <td>
              {payment.transactionId}
            </td>

            {/* ACCEPTED BY */}
            <td>
              {payment.acceptedBy}
            </td>

            {/* DATE */}
            <td className="cash-date">

              <strong>
                {payment.date}
              </strong>

              <span>
                {payment.time}
              </span>

            </td>

          </tr>

        ))}

        {filteredPayments.length === 0 && (

          <tr>

            <td
              colSpan="9"
              className="cash-empty-row"
               >
              No cash payments found.
            </td>

          </tr>

        )}

      </tbody>

    </table>

    </div>
  </div>


  {/* TABLE FOOTER */}

{filteredPayments.length > 0 && (
  <Pagination
    currentPage={currentPage}
    totalPages={totalPages}
    totalItems={totalItems}
    pageSize={pageSize}
    onPageChange={setCurrentPage}
    onPageSizeChange={handlePageSizeChange}
    itemLabel="cash payments"
    showWhenEmpty={true}
  />
)}

</div>

    </div>
  );
}
