import { useMemo, useState } from "react";
import "../styles/vendor-payments.css";

const initialVendors = [
  {
    id: 1,
    name: "Jacob",
    status: "Published",
    date: "2026/04/02 at 3:00 am",
  },
  {
    id: 2,
    name: "Bubba",
    status: "Published",
    date: "2026/03/23 at 2:45 pm",
  },
  {
    id: 3,
    name: "Vendor",
    status: "Published",
    date: "2026/03/20 at 3:12 pm",
  },
];

const initialPayments = [
  {
    id: 1,
    title: "Payment – Raghu Store – 2026-07-01 13:14:22",
    vendor: "Payment - Raghu Store - 2026-07-01 13:14:22",
    purpose: "",
    method: "",
    amount: "0.00",
    date: "2026/07/01 at 1:14 pm",
  },
  {
    id: 2,
    title: "Payment – Raghu Store – 2026-07-01 13:10:08",
    vendor: "Payment - Raghu Store - 2026-07-01 13:10:08",
    purpose: "",
    method: "",
    amount: "0.00",
    date: "2026/07/01 at 1:10 pm",
  },
  {
    id: 3,
    title: "Payment – Raghu Store – 2026-07-01 13:09:46",
    vendor: "Payment - Raghu Store - 2026-07-01 13:09:46",
    purpose: "",
    method: "",
    amount: "0.00",
    date: "2026/07/01 at 1:09 pm",
  },
  {
    id: 4,
    title: "Payment for vendor id #56009",
    vendor: "Bubba",
    purpose: "Purchase",
    method: "Cash",
    amount: "100.00",
    date: "2026/06/05 at 2:31 am",
  },
  {
    id: 5,
    title: "Payment for vendor id #62985",
    vendor: "N/A",
    purpose: "Purchase",
    method: "Cash",
    amount: "10.00",
    date: "2026/06/05 at 12:02 am",
  },
  {
    id: 6,
    title: "Payment for vendor id #56009",
    vendor: "Bubba",
    purpose: "Purchase",
    method: "Cash",
    amount: "100.00",
    date: "2026/06/04 at 3:15 am",
  },
  {
    id: 7,
    title: "Payment for vendor id #56009",
    vendor: "Bubba",
    purpose: "Purchase",
    method: "Cash",
    amount: "5.00",
    date: "2026/06/03 at 11:29 pm",
  },
  {
    id: 8,
    title: "Payment for vendor id #56549",
    vendor: "Jacob",
    purpose: "Purchase",
    method: "Cash",
    amount: "100.00",
    date: "2026/06/03 at 10:10 pm",
  },
];

export default function VendorPayments({ viewMode } = {}) {
  const [selectedView, setView] = useState("vendors");
  const view = viewMode || selectedView;

  const [vendors, setVendors] = useState(initialVendors);
  const [payments, setPayments] = useState(initialPayments);

  const [search, setSearch] = useState("");

  const [showVendorForm, setShowVendorForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const [vendorName, setVendorName] = useState("");

  const [payment, setPayment] = useState({
    vendor: "",
    purpose: "Purchase",
    method: "Cash",
    amount: "",
  });

  // Search vendors
  const filteredVendors = useMemo(() => {
    const term = search.toLowerCase().trim();

    return vendors.filter((vendor) =>
      vendor.name.toLowerCase().includes(term)
    );
  }, [vendors, search]);

  // Search payments
  const filteredPayments = useMemo(() => {
    const term = search.toLowerCase().trim();

    return payments.filter((payment) =>
      `${payment.title} ${payment.vendor} ${payment.purpose}`
        .toLowerCase()
        .includes(term)
    );
  }, [payments, search]);

  // Add vendor
  const addVendor = (event) => {
    event.preventDefault();

    if (!vendorName.trim()) return;

    setVendors((current) => [
      ...current,
      {
        id: Date.now(),
        name: vendorName.trim(),
        status: "Published",
        date: "Just now",
      },
    ]);

    setVendorName("");
    setShowVendorForm(false);
  };

  // Add payment
  const addPayment = (event) => {
    event.preventDefault();

    if (!payment.vendor || !payment.amount) return;

    setPayments((current) => [
      {
        id: Date.now(),
        title: `Payment for vendor ${payment.vendor}`,
        ...payment,
        date: "Just now",
      },
      ...current,
    ]);

    setPayment({
      vendor: "",
      purpose: "Purchase",
      method: "Cash",
      amount: "",
    });

    setShowPaymentForm(false);
  };

  return (
    <div className="vendor-screen">

      {/* Header */}
      <div className="vendor-title-row">

        <h2>
          {view === "vendors" ? "Vendors" : viewMode ? "Vendor History" : "Vendor Payments"}
        </h2>

        <div className="vendor-actions">

          {!viewMode && view === "payments" && (
            <button onClick={() => setView("vendors")}>
              View Vendors
            </button>
          )}

          {!viewMode && view === "vendors" && (
            <button onClick={() => setView("payments")}>
              View Vendor Payments
            </button>
          )}

          {view === "vendors" && (
            <button className="vendor-primary-action" onClick={() => setShowVendorForm(true)}>
              Add New Vendor
            </button>
          )}

          {view === "payments" && (
            <button className="vendor-primary-action" onClick={() => setShowPaymentForm(true)}>
              Add New Vendor Payment
            </button>
          )}

        </div>
      </div>

      {/* Toolbar */}
      <div className="vendor-toolbar">

        <div className="vendor-tabs">

          <button className="active">
            All (
            {view === "vendors"
              ? vendors.length
              : payments.length}
            )
          </button>

          <button>
            Published (
            {view === "vendors"
              ? vendors.length
              : payments.length}
            )
          </button>

        </div>

        {/* Single Search Box */}
       <div className="vendor-search">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={
            view === "vendors"
              ? "Search Vendors"
              : "Search Vendor Payments"
          }
        />
      </div>


      </div>

      {/* Vendors Table */}
      {view === "vendors" && (
        <table className="vendor-table">

          <thead>
            <tr>
              <th>□</th>
              <th>Title ↕</th>
              <th>Date ↕</th>
            </tr>
          </thead>

          <tbody>

            {filteredVendors.map((vendor) => (
              <tr key={vendor.id}>

                <td>□</td>

                <td>
                  <strong>{vendor.name}</strong>
                </td>

                <td>
                  Published
                  <br />
                  {vendor.date}
                </td>

              </tr>
            ))}

          </tbody>

        </table>
      )}

      {/* Vendor Payments Table */}
      {view === "payments" && (
        <table className="vendor-table">

          <thead>
            <tr>
              <th>□</th>
              <th>Title ↕</th>
              <th>Vendor Name</th>
              <th>Payment Purpose</th>
              <th>Payment Method</th>
              <th>Payment Amount</th>
              <th>Date ↕</th>
            </tr>
          </thead>

          <tbody>

            {filteredPayments.map((payment) => (
              <tr key={payment.id}>

                <td>□</td>

                <td>
                  <strong>{payment.title}</strong>
                </td>

                <td>{payment.vendor}</td>

                <td>{payment.purpose}</td>

                <td>{payment.method}</td>

                <td>$ {payment.amount}</td>

                <td>
                  Published
                  <br />
                  {payment.date}
                </td>

              </tr>
            ))}

          </tbody>

        </table>
      )}

      {/* Add Vendor Modal */}
      {showVendorForm && (
        <div className="vendor-modal">

          <form onSubmit={addVendor}>

            <h3>Add New Vendor</h3>

            <label>
              Vendor Name

              <input
                type="text"
                value={vendorName}
                onChange={(event) =>
                  setVendorName(event.target.value)
                }
                autoFocus
              />

            </label>

            <div>

              <button
                className="vendor-secondary-action"
                type="button"
                onClick={() => setShowVendorForm(false)}
              >
                Cancel
              </button>

              <button className="vendor-primary-action" type="submit">
                Add Vendor
              </button>

            </div>

          </form>

        </div>
      )}

      {/* Add Payment Modal */}
      {showPaymentForm && (
        <div className="vendor-modal">

          <form onSubmit={addPayment}>

            <h3>Add New Vendor Payment</h3>

            <label>
              Vendor

              <select
                value={payment.vendor}
                onChange={(event) =>
                  setPayment({
                    ...payment,
                    vendor: event.target.value,
                  })
                }
              >
                <option value="">Select vendor</option>

                {vendors.map((vendor) => (
                  <option
                    key={vendor.id}
                    value={vendor.name}
                  >
                    {vendor.name}
                  </option>
                ))}

              </select>

            </label>

            <label>
              Payment Purpose

              <select
                value={payment.purpose}
                onChange={(event) =>
                  setPayment({
                    ...payment,
                    purpose: event.target.value,
                  })
                }
              >
                <option>Purchase</option>
                <option>Refund</option>
                <option>Other</option>
              </select>

            </label>

            <label>
              Payment Method

              <select
                value={payment.method}
                onChange={(event) =>
                  setPayment({
                    ...payment,
                    method: event.target.value,
                  })
                }
              >
                <option>Cash</option>
                <option>Card</option>
                <option>Bank Transfer</option>
              </select>

            </label>

            <label>
              Payment Amount

              <input
                type="number"
                min="0"
                step="0.01"
                value={payment.amount}
                onChange={(event) =>
                  setPayment({
                    ...payment,
                    amount: event.target.value,
                  })
                }
              />

            </label>

            <div>

              <button
                className="vendor-secondary-action"
                type="button"
                onClick={() => setShowPaymentForm(false)}
              >
                Cancel
              </button>

              <button className="vendor-primary-action" type="submit">
                Save Payment
              </button>

            </div>

          </form>

        </div>
      )}

    </div>
  );
}
