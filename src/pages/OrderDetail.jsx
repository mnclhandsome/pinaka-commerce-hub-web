import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { formatMoney, getOrder } from "../api/orders";
import "../styles/orders.css";

function metaValue(entries, key) {
  const match = (Array.isArray(entries) ? entries : []).find((entry) => entry?.key === key);
  return match?.value;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function displayDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function titleCase(value) {
  const text = String(value || "").replace(/^#/, "").replace(/_/g, " ").trim();
  if (!text) return "—";
  return text.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildView(payload) {
  const order = payload?.order || {};
  const storeOrder = payload?.storeOrder || {};
  const request = order.requestPayload || {};
  const metadata = asArray(storeOrder.metaData).length ? storeOrder.metaData : asArray(order.metadata);
  const currency = storeOrder.currency || request.currency || "USD";
  const lineItems = asArray(storeOrder.lineItems).length
    ? storeOrder.lineItems
    : asArray(payload?.items).map((item) => ({
        name: item.productName,
        product_id: item.productId,
        quantity: item.quantity,
        subtotal: item.totalPrice,
        total: item.totalPrice,
        sku: "",
      }));
  const payments = asArray(storeOrder.payments).length
    ? storeOrder.payments
    : asArray(metaValue(metadata, "_pos_payments"));

  return {
    id: order.id,
    number: String(order.orderNumber || request.number || order.id || "").replace(/^#/, ""),
    status: titleCase(storeOrder.status || order.orderStatus || request.status),
    currency,
    timezone: storeOrder.timezone || "UTC",
    createdAt: displayDate(order.createdAt || request.date_created),
    clientOrderId: storeOrder.clientOrderId || order.clientOrderId || metaValue(metadata, "_pos_client_order_id") || "—",
    customer: order.customerName || "Walk-in Customer",
    phone: order.customerPhone || request.billing?.phone || "—",
    email: request.billing?.email || "—",
    paymentMethod: titleCase(storeOrder.paymentMethodTitle || storeOrder.paymentMethod || order.paymentMethod),
    paymentStatus: titleCase(order.paymentStatus),
    deviceId: storeOrder.deviceId || metaValue(metadata, "pos_device_id") || "—",
    placedBy: storeOrder.placedBy || metaValue(metadata, "pos_placed_by") || "—",
    shiftId: storeOrder.shiftId || order.shiftId || metaValue(metadata, "shift_id") || "—",
    payLater: storeOrder.payLater ? "Yes" : "No",
    subtotal: formatMoney(storeOrder.subtotal ?? order.subtotal, currency),
    discount: formatMoney(storeOrder.discountTotal ?? order.discountAmount, currency),
    tax: formatMoney(storeOrder.taxTotal ?? order.taxAmount, currency),
    fees: formatMoney(storeOrder.feeTotal, currency),
    total: formatMoney(order.totalAmount ?? storeOrder.total ?? request.total, currency),
    lineItems,
    feeLines: asArray(storeOrder.feeLines).length ? storeOrder.feeLines : asArray(request.fee_lines),
    taxLines: asArray(storeOrder.taxLines).length ? storeOrder.taxLines : asArray(request.tax_lines),
    couponLines: asArray(storeOrder.couponLines).length ? storeOrder.couponLines : asArray(request.coupon_lines),
    payments,
    history: asArray(payload?.history),
  };
}

export default function OrderDetail() {
  const { orderId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const listQuery = new URLSearchParams();
  if (searchParams.get("merchant")) listQuery.set("merchant", searchParams.get("merchant"));
  if (searchParams.get("store")) listQuery.set("store", searchParams.get("store"));
  const backTo = location.state?.from || `/orders${listQuery.toString() ? `?${listQuery}` : ""}`;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getOrder(orderId)
      .then((payload) => {
        if (active) setView(buildView(payload));
      })
      .catch((loadError) => {
        if (!active) return;
        setView(null);
        setError(loadError?.message || "Failed to load this order.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId]);

  return (
    <div className="page-content orders-page order-detail-page">
      <div className="orders-header">
        <div>
          <Link className="order-detail-back" to={backTo}>
            <i className="bi bi-arrow-left" /> Back to orders
          </Link>
          <h1>{view ? `Order ${view.number}` : "Order"}</h1>
          <p>Order, payment, line, and tender details for this sale.</p>
        </div>
        {view && (
          <span className={`order-status ${String(view.status).toLowerCase().includes("complete") ? "completed" : "processing"}`}>
            <i className="bi bi-circle-fill" />
            {view.status}
          </span>
        )}
      </div>

      {loading && <div className="orders-banner">Loading order...</div>}
      {error && <div className="orders-banner error">{error}</div>}

      {view && (
        <div className="order-detail-layout">
          <DetailBlock title="Order">
            <Field label="Order ID" value={view.number} />
            <Field label="Client order ID" value={view.clientOrderId} />
            <Field label="Created" value={view.createdAt} />
            <Field label="Currency" value={view.currency} />
            <Field label="Timezone" value={view.timezone} />
            <Field label="Customer" value={view.customer} />
            <Field label="Phone" value={view.phone} />
            <Field label="Email" value={view.email} />
          </DetailBlock>

          <DetailBlock title="Payment and device">
            <Field label="Payment" value={view.paymentMethod} />
            <Field label="Payment status" value={view.paymentStatus} />
            <Field label="Pay later" value={view.payLater} />
            <Field label="Device" value={view.deviceId} />
            <Field label="Placed by" value={view.placedBy} />
            <Field label="Shift" value={view.shiftId} />
          </DetailBlock>

          <DetailBlock title="Totals">
            <Field label="Subtotal" value={view.subtotal} />
            <Field label="Discount" value={view.discount} />
            <Field label="Tax" value={view.tax} />
            <Field label="Fees" value={view.fees} />
            <Field label="Total" value={view.total} />
          </DetailBlock>

          <section className="order-detail-block">
            <h2>Line items</h2>
            <Lines
              columns={["Product", "SKU", "Qty", "Subtotal", "Total"]}
              rows={view.lineItems.map((item) => [
                item.name || item.productName || "Item",
                item.sku || "—",
                item.quantity ?? "—",
                formatMoney(item.subtotal ?? item.total, view.currency),
                formatMoney(item.total ?? item.subtotal, view.currency),
              ])}
            />
          </section>

          <section className="order-detail-block">
            <h2>Fees, tax, and coupons</h2>
            <h3>Fees</h3>
            <Lines
              columns={["Name", "Tax status", "Total"]}
              rows={view.feeLines.map((fee) => [fee.name || "Fee", fee.tax_status || "—", formatMoney(fee.total, view.currency)])}
            />
            <h3>Tax</h3>
            <Lines
              columns={["Label", "Rate", "Tax"]}
              rows={view.taxLines.map((tax) => [tax.label || tax.rate_code || "Tax", `${tax.rate_percent ?? 0}%`, formatMoney(tax.tax_total, view.currency)])}
            />
            <h3>Coupons</h3>
            <Lines
              columns={["Code"]}
              rows={view.couponLines.map((coupon) => [coupon.code || "—"])}
            />
          </section>

          <section className="order-detail-block">
            <h2>Payments</h2>
            <Lines
              columns={["Method", "Amount", "Status", "Created"]}
              rows={view.payments.map((payment) => [
                payment.method || "—",
                formatMoney(payment.amount, view.currency),
                titleCase(payment.status),
                displayDate(payment.created_at || payment.createdAt),
              ])}
            />
          </section>

          <section className="order-detail-block">
            <h2>Status history</h2>
            <Lines
              columns={["From", "To", "Changed by", "Reason", "When"]}
              rows={view.history.map((entry) => [
                titleCase(entry.fromStatus),
                titleCase(entry.toStatus),
                entry.changedBy || "—",
                entry.reason || "—",
                displayDate(entry.createdAt),
              ])}
            />
          </section>
        </div>
      )}
    </div>
  );
}

function DetailBlock({ title, children }) {
  return (
    <section className="order-detail-block">
      <h2>{title}</h2>
      <div className="order-detail-grid">{children}</div>
    </section>
  );
}

function Field({ label, value }) {
  return (
    <div className="order-detail-field">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function Lines({ columns, rows }) {
  if (!rows.length) return <p className="order-detail-empty">None</p>;
  return (
    <div className="order-detail-table-wrap">
      <table className="orders-table order-detail-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`}>
              {row.map((cell, cellIndex) => <td key={`${columns[cellIndex]}-${index}`}>{cell || "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
