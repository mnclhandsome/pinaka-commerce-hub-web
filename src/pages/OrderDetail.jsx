import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ShoppingBag, CreditCard, CircleDollarSign, Package, ReceiptText, History } from "lucide-react";
import { formatMoney, getOrder } from "../api/orders";
import { extractProducts, normalizeProduct, productsApi } from "../api/products";
import "../styles/orders.css";
import "../styles/employee-view.css";

function metaValue(entries, key) {
  const match = asArray(entries).find((entry) => entry?.key === key);
  return match?.value;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function metaValueFrom(entries, keys) {
  for (const key of keys) {
    const value = metaValue(entries, key);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
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

function statusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("create")) return "created";
  if (value.includes("complete")) return "completed";
  if (value.includes("pending")) return "pending";
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("refund")) return "refunded";
  if (value.includes("partial")) return "partial";
  if (value.includes("inactive")) return "inactive";
  if (value.includes("active")) return "active";
  return "processing";
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
  const payloadData = asObject(payload?.data);
  const response = Object.keys(payloadData).length ? payloadData : asObject(payload);
  const order = asObject(response?.order || response);
  const storeOrder = asObject(response?.storeOrder || response?.store_order || order?.storeOrder || order?.store_order);
  const request = asObject(order.requestPayload || order.request_payload || storeOrder.requestPayload || storeOrder.request_payload);
  const billing = request.billing || order.billing || {};
  const customer = order.customer && typeof order.customer === "object" ? order.customer : {};
  const metadata = asArray(storeOrder.metaData).length
    ? asArray(storeOrder.metaData)
    : asArray(storeOrder.metadata || storeOrder.meta_data).length
      ? asArray(storeOrder.metadata || storeOrder.meta_data)
      : asArray(order.metadata || order.meta_data || request.meta_data);
  const currency = storeOrder.currency || order.currency || request.currency || "USD";
  const rawLineItems = [
    asArray(storeOrder.lineItems),
    asArray(storeOrder.line_items),
    asArray(order.lineItems),
    asArray(order.line_items),
    asArray(request.line_items),
    asArray(response?.items),
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
    .map(asArray).find((lines) => lines.length) || [];
  const payments = asArray(storeOrder.payments).length
    ? asArray(storeOrder.payments)
    : asArray(order.payments).length
      ? asArray(order.payments)
      : asArray(metaValue(metadata, "_pos_payments"));
  const subtotal = storeOrder.subtotal ?? storeOrder.subtotalAmount ?? storeOrder.subtotal_amount ?? order.subtotal ?? order.subtotalAmount ?? order.subtotal_amount;
  const couponLines = [storeOrder.couponLines, storeOrder.coupon_lines, order.couponLines, order.coupon_lines, request.coupon_lines]
    .map(asArray).find((lines) => lines.length) || [];
  const feeLines = [storeOrder.feeLines, storeOrder.fee_lines, order.feeLines, order.fee_lines, request.fee_lines]
    .map(asArray).find((lines) => lines.length) || [];
  const discount = storeOrder.discountTotal ?? storeOrder.discount_total ?? storeOrder.discountAmount ?? storeOrder.discount_amount
    ?? order.discountTotal ?? order.discount_total ?? order.discountAmount ?? order.discount_amount;
  const discountLines = [
    ...couponLines.map((coupon) => {
      const couponMeta = coupon.meta_data || coupon.metaData;
      return {
        name: coupon.code || coupon.name || "Coupon",
        type: titleCase(metaValueFrom(couponMeta, ["discount_type", "discountType"])) || "Coupon",
        amount: coupon.discount ?? coupon.discount_amount ?? coupon.amount ?? coupon.discountAmount,
      };
    }),
    ...lineItems.flatMap((item) => {
      const itemMeta = item.meta_data || item.metaData;
      const amount = metaValueFrom(itemMeta, ["_pos_auto_discount", "pos_auto_discount"]);
      const value = Number(amount);
      return Number.isFinite(value) && value > 0 ? [{
        name: item.name,
        type: titleCase(metaValueFrom(itemMeta, ["_pos_discount_type", "pos_discount_type"])) || "Automatic discount",
        amount: value,
      }] : [];
    }),
    ...(Number(metaValueFrom(metadata, ["_merchant_discount", "merchant_discount"])) > 0 ? [{
      name: "Merchant discount",
      type: "Merchant discount",
      amount: Number(metaValueFrom(metadata, ["_merchant_discount", "merchant_discount"])),
    }] : []),
  ];
  const taxLineTotal = taxLines.reduce(
    (sum, line) => sum + (Number(line.tax_total ?? line.taxTotal ?? line.amount) || 0),
    0,
  );
  const itemTaxTotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.total_tax ?? item.totalTax ?? item.tax) || 0),
    0,
  );
  const tax = storeOrder.taxTotal ?? storeOrder.tax_total ?? storeOrder.taxAmount ?? storeOrder.tax_amount
    ?? storeOrder.totalTax ?? storeOrder.total_tax ?? storeOrder.tax
    ?? order.taxTotal ?? order.tax_total ?? order.taxAmount ?? order.tax_amount
    ?? order.totalTax ?? order.total_tax ?? order.tax
    ?? request.tax_total ?? request.total_tax ?? request.cart_tax
    ?? (taxLines.length ? taxLineTotal : undefined)
    ?? (itemTaxTotal || undefined)
    ?? metaValueFrom(metadata, ["_pos_order_tax", "pos_order_tax"]);
  const total = order.totalAmount ?? order.total_amount ?? storeOrder.total ?? storeOrder.totalAmount ?? storeOrder.total_amount ?? order.total ?? request.total;
  const shownSubtotal = subtotal ?? lineItems.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  const feeTotal = storeOrder.feeTotal ?? storeOrder.fee_total ?? order.feeTotal ?? order.fee_total
    ?? feeLines.reduce((sum, fee) => sum + (Number(fee.total ?? fee.amount) || 0), 0);
  const inferredDiscount = discountLines.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const shownDiscount = Number(discount) > 0 ? discount : inferredDiscount > 0 ? inferredDiscount : discount;
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
    discount: formatMoney(shownDiscount, currency),
    tax: formatMoney(tax, currency),
    fees: formatMoney(feeTotal, currency),
    total: formatMoney(shownTotal, currency),
    lineItems,
    feeLines,
    taxLines,
    couponLines,
    discountLines,
    payments,
    history: asArray(response?.history),
  };
}

export default function OrderDetail({ embedded = false, orderId: providedOrderId, storeId: providedStoreId, orderNumber: providedOrderNumber, onBack }) {
  const { orderId: routeOrderId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const orderId = providedOrderId || routeOrderId;
  const storeId = providedStoreId || searchParams.get("store") || "";
  const orderNumber = providedOrderNumber || searchParams.get("number") || "";
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
          {embedded
            ? (
              <button type="button" className="order-detail-back" onClick={onBack}>
                <ArrowLeft size={16} /> Back
              </button>
            )
            : (
              <Link className="order-detail-back" to={backTo}>
                <ArrowLeft size={16} /> Back to orders
              </Link>
            )}
          <h1>{view ? `Order ${view.number}` : "Order"}</h1>
          <p>Order, payment, line, and tender details for this sale.</p>
        </div>
        {view && (
          <span className={`order-status ${statusClass(view.status)}`}>
            <i className="bi bi-circle-fill" />
            {view.status}
          </span>
        )}
      </div>

      {loading && <p role="status">Loading order...</p>}
      {error && <div className="employee-view-error" role="alert">{error}</div>}

      {view && (
        <div className="employee-view-sections order-detail-layout">
          <DetailBlock title="Order">
            <Fields items={[["Order ID", view.number], ["Client order ID", view.clientOrderId], ["Created", view.createdAt], ["Currency", view.currency], ["Timezone", view.timezone], ["Customer", view.customer], ["Phone", view.phone], ["Email", view.email]]} />
          </DetailBlock>

          <DetailBlock title="Payment and device">
            <Fields items={[["Payment", view.paymentMethod], ["Payment status", view.paymentStatus], ["Pay later", view.payLater], ["Device", view.deviceId], ["Placed by", view.placedBy], ["Shift", view.shiftId]]} />
          </DetailBlock>

          <DetailBlock title="Totals">
            <Fields items={[["Subtotal", view.subtotal], ["Discount", view.discount], ["Tax", view.tax], ["Fees", view.fees], ["Total", view.total]]} />
          </DetailBlock>

          <DetailBlock title="Line items">
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
          </DetailBlock>

          <section className="order-detail-block">
            <h2>Fees, discounts, tax, and coupons</h2>
            <h3>Fees</h3>
            <Lines
              columns={["Name", "Tax status", "Total"]}
              rows={view.feeLines.map((fee) => [fee.name || "Fee", fee.tax_status || "—", formatMoney(fee.total, view.currency)])}
            />
            <h3>Discounts</h3>
            <Lines
              columns={["Name", "Type", "Amount"]}
              rows={view.discountLines.map((discount) => [discount.name || "Discount", discount.type || "—", formatMoney(discount.amount, view.currency)])}
            />
            <h3>Tax</h3>
            <Lines
              columns={["Label", "Rate", "Tax"]}
              rows={view.taxLines.map((tax) => [tax.label || tax.rate_code || "Tax", `${tax.rate_percent ?? 0}%`, formatMoney(tax.tax_total, view.currency)])}
            />
            <h3>Coupons</h3>
            <Lines
              columns={["Code", "Discount"]}
              rows={view.couponLines.map((coupon) => [coupon.code || "—", formatMoney(coupon.discount ?? coupon.discount_amount ?? coupon.amount, view.currency)])}
            />
          </DetailBlock>

          <DetailBlock title="Payments">
            <Lines
              columns={["Method", "Amount", "Status", "Created"]}
              rows={view.payments.map((payment) => [
                payment.method || "—",
                formatMoney(payment.amount, view.currency),
                titleCase(payment.status),
                displayDate(payment.created_at || payment.createdAt),
              ])}
            />
          </DetailBlock>

          <DetailBlock title="Status history">
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
          </DetailBlock>
        </div>
      )}
    </div>
  );
}

function DetailBlock({ title, children }) {
  const Icon = title === "Order" ? ShoppingBag
    : title === "Payment and device" || title === "Payments" ? CreditCard
      : title === "Totals" ? CircleDollarSign
        : title === "Line items" ? Package
          : title === "Fees, tax, and coupons" ? ReceiptText : History;
  return (
    <section className="employee-view-card order-detail-block">
      <div className="employee-view-card-header"><span><Icon size={19} /></span><h2>{title}</h2></div>
      {children}
    </section>
  );
}

function Fields({ items }) {
  return (
    <dl className="employee-view-grid">
      {items.map(([label, value]) => <div className="employee-view-field" key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}
    </dl>
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
