import FilterDropdown from "../components/FilterDropdown";
import { useMemo, useState } from "react";
import ViewDetailsModal from "../components/ViewDetailsModal";
import "../styles/store-payment-records.css";

const paymentRecordsSeed = [
  {
    id: "PAY-001",
    title: "Cash Payment for Order 33141",
    orderId: "33141",
    orderTotal: 27.20,
    tenderAmount: 27.20,
    balanceAmount: 0,
    changeAmount: 0,
    transactionId: "33142",
    paymentAcceptedBy: "merchant 1",
    status: "Published",
    date: "2026/09/16 at 2:40 am",
    paymentMethod: "Cash",
    paymentType: "Cash",
    shiftId: "SHIFT-001",
    notes: "",
  },
  {
    id: "PAY-002",
    title: "Cash Payment for Order 33139",
    orderId: "33139",
    orderTotal: 6.52,
    tenderAmount: 5.98,
    balanceAmount: 0.54,
    changeAmount: 0,
    transactionId: "33140",
    paymentAcceptedBy: "merchant 1",
    status: "Published",
    date: "2026/09/16 at 2:40 am",
    paymentMethod: "Cash",
    paymentType: "Cash",
    shiftId: "SHIFT-001",
    notes: "",
  },
  {
    id: "PAY-003",
    title: "Cash Payment for Order 33135",
    orderId: "33135",
    orderTotal: 26.11,
    tenderAmount: 30.00,
    balanceAmount: 0,
    changeAmount: 3.89,
    transactionId: "33136",
    paymentAcceptedBy: "merchant 1",
    status: "Published",
    date: "2026/09/16 at 1:16 am",
    paymentMethod: "Cash",
    paymentType: "Cash",
    shiftId: "SHIFT-001",
    notes: "",
  },
  {
    id: "PAY-004",
    title: "Cash Payment for Order 33132",
    orderId: "33132",
    orderTotal: 124.37,
    tenderAmount: 114.00,
    balanceAmount: 10.37,
    changeAmount: 0,
    transactionId: "33133",
    paymentAcceptedBy: "manager 1",
    status: "Published",
    date: "2026/09/16 at 1:06 am",
    paymentMethod: "Cash",
    paymentType: "Cash",
    shiftId: "SHIFT-002",
    notes: "",
  },
  {
    id: "PAY-005",
    title: "Cash Payment for Order 33130",
    orderId: "33130",
    orderTotal: 6.52,
    tenderAmount: 6.52,
    balanceAmount: 0,
    changeAmount: 0,
    transactionId: "33131",
    paymentAcceptedBy: "manager 1",
    status: "Published",
    date: "2026/09/16 at 1:06 am",
    paymentMethod: "Cash",
    paymentType: "Cash",
    shiftId: "SHIFT-002",
    notes: "",
  },
  {
    id: "PAY-006",
    title: "Cash Payment for Order 33128",
    orderId: "33128",
    orderTotal: 10.87,
    tenderAmount: 10.87,
    balanceAmount: 0,
    changeAmount: 0,
    transactionId: "33129",
    paymentAcceptedBy: "manager 1",
    status: "Published",
    date: "2026/09/16 at 1:06 am",
    paymentMethod: "Cash",
    paymentType: "Cash",
    shiftId: "SHIFT-002",
    notes: "",
  },
];

export default function StorePaymentRecords({ store }) {
  const [payments] = useState(paymentRecordsSeed);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedPayment, setSelectedPayment] = useState(null);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchesSearch =
        !query ||
        [
          payment.title,
          payment.orderId,
          payment.transactionId,
          payment.paymentAcceptedBy,
          payment.paymentMethod,
          payment.paymentType,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesDate =
        !dateFilter ||
        payment.date.startsWith(
          dateFilter.replaceAll("-", "/")
        );

      return matchesSearch && matchesDate;
    });
  }, [payments, search, dateFilter]);

  const clearFilters = () => {
    setSearch("");
    setDateFilter("");
  };

  return (
    <div className="store-payment-records-page">
      <div className="store-payment-records-header">
        <div className="store-payment-records-title-area">
          <div className="store-payment-records-title-icon">
            <i className="bi bi-credit-card" />
          </div>

          <div>
            <h1>Payment Records</h1>
            <p>View payment transactions associated with this store.</p>
          </div>
        </div>

        {store && (
          <div className="store-payment-records-context">
            <i className="bi bi-shop" />
            <div>
              <span>STORE</span>
              <strong>{store.name}</strong>
              <small>{store.id}</small>
            </div>
          </div>
        )}
      </div>

      <div className="store-payment-records-card">
        <div className="store-payment-records-top">
          <div className="store-payment-records-tabs">
            <button type="button" className="active">
              All ({payments.length})
            </button>
            <span>|</span>
            <button type="button">Published ({payments.length})</button>
          </div>

          <div className="store-payment-records-search">
            <input
              type="text"
              value={search}
              placeholder="Search payments..."
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="button" className="store-payment-search-submit">
              Search Payments
            </button>
          </div>
        </div>

        <div className="store-payment-records-toolbar">
          <FilterDropdown defaultValue="" className="store-payment-records-bulk-select">
            <option value="">Bulk actions</option>
            <option value="export">Export</option>
          </FilterDropdown>

          <button type="button">Apply</button>

          <FilterDropdown
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          >
            <option value="">All dates</option>
            <option value="2026-09-16">September 16, 2026</option>
          </FilterDropdown>

          <button type="button" onClick={clearFilters}>
            Filter
          </button>

          <button type="button">Export CSV</button>
          <button type="button">Print</button>

          <span className="store-payment-records-count">
            {filteredPayments.length} items
          </span>

          <div className="store-payment-records-pagination">
            <button type="button" disabled>«</button>
            <button type="button" disabled>‹</button>
            <button type="button" className="active">1</button>
            <span>of 1</span>
            <button type="button" disabled>›</button>
            <button type="button" disabled>»</button>
          </div>
        </div>

        <div className="store-payment-records-table-wrapper">
          <table className="store-payment-records-table">
            <thead>
              <tr>
                <th className="check-column">
                  <input type="checkbox" />
                </th>
                <th>Title</th>
                <th>Order Id</th>
                <th>Order Total</th>
                <th>Tender Amount</th>
                <th>Balance Amount</th>
                <th>Change Amount</th>
                <th>Transaction Id</th>
                <th>Payment Accepted By</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {filteredPayments.length ? (
                filteredPayments.map((payment) => (
                  <PaymentRecordRow
                    key={payment.id}
                    payment={payment}
                    onView={() => setSelectedPayment(payment)}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="store-payment-records-empty">
                    No payment records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="store-payment-records-footer">
          Payment data synced from Pinaka POS
        </div>
      </div>

      <ViewDetailsModal
        open={Boolean(selectedPayment)}
        title="Payment Details"
        subtitle={
          selectedPayment
            ? selectedPayment.title
            : ""
        }
        data={selectedPayment}
        onClose={() => setSelectedPayment(null)}
        fields={[
          { key: "id", label: "Payment ID" },
          { key: "title", label: "Payment Title", fullWidth: true },
          { key: "orderId", label: "Order ID" },
          {
            key: "orderTotal",
            label: "Order Total",
            render: (value) => money(value),
          },
          {
            key: "tenderAmount",
            label: "Tender Amount",
            render: (value) => money(value),
          },
          {
            key: "balanceAmount",
            label: "Balance Amount",
            render: (value) => money(value),
          },
          {
            key: "changeAmount",
            label: "Change Amount",
            render: (value) => money(value),
          },
          { key: "transactionId", label: "Transaction ID" },
          { key: "paymentMethod", label: "Payment Method" },
          { key: "paymentType", label: "Payment Type" },
          { key: "paymentAcceptedBy", label: "Payment Accepted By" },
          { key: "shiftId", label: "Shift ID" },
          { key: "date", label: "Payment Date" },
          {
            key: "status",
            label: "Status",
            render: (value) => (
              <span className="detail-status active">
                {value || "—"}
              </span>
            ),
          },
          { key: "notes", label: "Notes", fullWidth: true },
        ]}
      />
    </div>
  );
}

function PaymentRecordRow({ payment, onView }) {
  return (
    <tr
      className="store-payment-record-clickable"
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
      <td className="check-column">
        <input
          type="checkbox"
          onClick={(event) => event.stopPropagation()}
        />
      </td>

      <td>
        <button
          type="button"
          className="store-payment-title-link"
          onClick={(event) => {
            event.stopPropagation();
            onView?.();
          }}
        >
          {payment.title}
        </button>
      </td>

      <td>{payment.orderId}</td>
      <td>{money(payment.orderTotal)}</td>
      <td>{money(payment.tenderAmount)}</td>
      <td>{money(payment.balanceAmount)}</td>
      <td className={payment.changeAmount > 0 ? "change-positive" : ""}>
        {money(payment.changeAmount)}
      </td>
      <td>{payment.transactionId}</td>
      <td>{payment.paymentAcceptedBy}</td>
      <td>
        <span className="payment-status">{payment.status}</span>
        <span className="payment-date">{payment.date}</span>
      </td>
    </tr>
  );
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}
