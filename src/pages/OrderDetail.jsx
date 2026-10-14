import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { formatMoney, getOrder } from "../api/orders";
import { extractProducts, normalizeProduct, productsApi } from "../api/products";
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

function lineItemSku(item) {
  const metadata = asArray(item.meta_data || item.metaData);
  const metadataSku = metadata.find((entry) =>
    ["sku", "product_sku", "productsku"].includes(String(entry?.key || "").toLowerCase()),
  )?.value;
  return item.sku
    || item.productSku
    || item.product_sku
    || item.product?.sku
    || item.productDetails?.sku
    || item.product_details?.sku
    || metadataSku
    || "";
}

function productSkuMap(response) {
  const products = extractProducts(response).map((product) => normalizeProduct(product));
  const skuById = new Map();
  products.forEach((product) => {
    if (!product.sku) return;
    [product.id, product.wordpressId].filter(Boolean).forEach((id) => {
      skuById.set(String(id), product.sku);
    });
  });
  return skuById;
}

function catalogSkuForLineItem(item, skuById) {
  const product = item.product || item.productDetails || item.product_details || {};
  const ids = [
    item.productId,
    item.product_id,
    product.id,
    product.productId,
    product.product_id,
    item.variationId,
    item.variation_id,
  ];
  for (const id of ids) {
    if (id !== undefined && id !== null && skuById.has(String(id))) {
      return skuById.get(String(id));
    }
  }
  return "";
}

function buildView(payload) {
  // The API may return the order directly or wrap it in `data` / `order`.
  const response = payload?.data && typeof payload.data === "object" ? payload.data : payload;
  const order = response?.order || response || {};
  const storeOrder = response?.storeOrder || response?.store_order || {};
  const request = order.requestPayload || order.request_payload || {};
  const billing = request.billing || order.billing || {};
  const customer = order.customer && typeof order.customer === "object" ? order.customer : {};
  const metadata = asArray(storeOrder.metaData).length ? storeOrder.metaData : asArray(order.metadata || order.meta_data);
  const currency = storeOrder.currency || order.currency || request.currency || "USD";
  const rawLineItems = [
    storeOrder.lineItems,
    storeOrder.line_items,
    order.lineItems,
    order.line_items,
    request.line_items,
    response?.items,
  ].find((items) => Array.isArray(items) && items.length) || [];
  const lineItems = rawLineItems.map((item) => ({
    ...item,
    name: item.name || item.productName || item.product_name || item.title || "Item",
    sku: lineItemSku(item),
    quantity: item.quantity ?? item.qty,
    subtotal: item.subtotal ?? item.totalPrice ?? item.total_price ?? item.total,
    total: item.total ?? item.totalPrice ?? item.total_price ?? item.subtotal,
  }));
  const taxLines = [storeOrder.taxLines, storeOrder.tax_lines, order.taxLines, order.tax_lines, request.tax_lines]
    .find((lines) => Array.isArray(lines) && lines.length) || [];
  const payments = asArray(storeOrder.payments).length
    ? storeOrder.payments
    : asArray(metaValue(metadata, "_pos_payments"));
  const subtotal = storeOrder.subtotal ?? storeOrder.subtotalAmount ?? storeOrder.subtotal_amount ?? order.subtotal ?? order.subtotalAmount ?? order.subtotal_amount;
  const discount = storeOrder.discountTotal ?? storeOrder.discount_total ?? order.discountAmount ?? order.discount_amount;
  const taxLineTotal = taxLines.reduce(
    (sum, line) => sum + (Number(line.tax_total ?? line.taxTotal ?? line.amount) || 0),
    0,
  );
  const itemTaxTotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.total_tax ?? item.totalTax ?? item.tax) || 0),
    0,
  );
  const tax = storeOrder.taxTotal ?? storeOrder.tax_total ?? order.taxAmount ?? order.tax_amount
    ?? (taxLines.length ? taxLineTotal : itemTaxTotal);
  const total = order.totalAmount ?? order.total_amount ?? storeOrder.total ?? storeOrder.totalAmount ?? storeOrder.total_amount ?? request.total;
  const shownSubtotal = subtotal ?? lineItems.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  const shownTotal = total ?? (payments.length
    ? payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
    : lineItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0));

  return {
    id: order.id,
    number: String(order.orderNumber || order.order_number || order.number || request.number || order.id || "").replace(/^#/, ""),
    status: titleCase(storeOrder.status || storeOrder.orderStatus || storeOrder.order_status || order.orderStatus || order.order_status || order.status || request.status),
    currency: storeOrder.currency || order.currency || request.currency || "USD",
    timezone: storeOrder.timezone || storeOrder.time_zone || "UTC",
    createdAt: displayDate(storeOrder.createdAt || storeOrder.created_at || order.createdAt || order.created_at || request.date_created || request.created_at),
    clientOrderId: storeOrder.clientOrderId || storeOrder.client_order_id || order.clientOrderId || order.client_order_id || metaValue(metadata, "_pos_client_order_id") || "—",
    customer: storeOrder.customerName || storeOrder.customer_name || order.customerName || order.customer_name || [billing.first_name, billing.last_name].filter(Boolean).join(" ") || customer.name || "Walk-in Customer",
    phone: storeOrder.customerPhone || storeOrder.customer_phone || order.customerPhone || order.customer_phone || billing.phone || customer.phone || "—",
    email: storeOrder.customerEmail || storeOrder.customer_email || order.customerEmail || order.customer_email || billing.email || customer.email || "—",
    paymentMethod: titleCase(storeOrder.paymentMethodTitle || storeOrder.payment_method_title || storeOrder.paymentMethod || storeOrder.payment_method || order.paymentMethod || order.payment_method || request.payment_method),
    paymentStatus: titleCase(
      order.paymentStatus || order.payment_status || storeOrder.paymentStatus || storeOrder.payment_status
        || payments.find((payment) => payment.status)?.status,
    ),
    deviceId: storeOrder.deviceId || metaValue(metadata, "pos_device_id") || "—",
    placedBy: storeOrder.placedBy || metaValue(metadata, "pos_placed_by") || "—",
    shiftId: storeOrder.shiftId || order.shiftId || metaValue(metadata, "shift_id") || "—",
    payLater: storeOrder.payLater ? "Yes" : "No",
    subtotal: formatMoney(shownSubtotal, currency),
    discount: formatMoney(discount, currency),
    tax: formatMoney(tax, currency),
    fees: formatMoney(storeOrder.feeTotal ?? storeOrder.fee_total ?? order.feeTotal ?? order.fee_total, currency),
    total: formatMoney(shownTotal, currency),
    lineItems,
    feeLines: asArray(storeOrder.feeLines).length ? storeOrder.feeLines : asArray(request.fee_lines),
    taxLines,
    couponLines: asArray(storeOrder.couponLines).length ? storeOrder.couponLines : asArray(request.coupon_lines),
    payments,
    history: asArray(response?.history),
  };
}

export default function OrderDetail() {
  const { orderId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const storeId = searchParams.get("store") || "";
  const orderNumber = searchParams.get("number") || "";
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
    getOrder(orderId, storeId)
      .then(async (payload) => {
        if (!active) return;
        let nextView = buildView(payload);
        if (storeId && nextView.lineItems.some((item) => !item.sku)) {
          try {
            const catalog = await productsApi.getCatalog(storeId);
            const skuById = productSkuMap(catalog);
            nextView = {
              ...nextView,
              lineItems: nextView.lineItems.map((item) => ({
                ...item,
                sku: item.sku || catalogSkuForLineItem(item, skuById),
              })),
            };
          } catch {
            // Keep the order details available when the catalog cannot be read.
          }
        }
        if (active) {
          setView(orderNumber ? { ...nextView, number: orderNumber.replace(/^#/, "") } : nextView);
        }
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
  }, [orderId, storeId, orderNumber]);

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
