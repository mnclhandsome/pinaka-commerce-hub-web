import { api } from "./http";
import { endpoints } from "./endpoints";

function metaValue(entries, key) {
  const match = (Array.isArray(entries) ? entries : []).find((entry) => entry?.key === key);
  return match?.value;
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizeOrderStatus(value) {
  const status = titleCase(value || "Created");
  return status.toLowerCase() === "created" ? "Pending Payment" : status;
}

export function currencySymbol(currency = "USD") {
  switch (String(currency || "USD").toUpperCase()) {
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "INR":
      return "₹";
    default:
      return "$";
  }
}

export function formatMoney(value, currency = "USD") {
  const amount = Number(value || 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "USD").toUpperCase(),
    }).format(safe);
  } catch {
    return `${currencySymbol(currency)}${safe.toFixed(2)}`;
  }
}

export function normalizeOrder(order = {}) {
  const createdAt = order.createdAt || order.created_at || order.date_created || "";
  const created = createdAt ? new Date(createdAt) : null;
  const validDate = created && !Number.isNaN(created.getTime());
  const currency = order.currency || "USD";
  const totalValue = Number(order.totalAmount ?? order.total_amount ?? order.total ?? 0);
  const metadata = order.metadata || order.meta_data || [];
  return {
    id: order.id,
    wooOrderId: String(order.orderNumber || order.order_number || order.number || order.id || "").replace(/^#/, ""),
    offlineOrderId: order.clientOrderId || order.client_order_id || metaValue(metadata, "_pos_client_order_id") || "",
    createdAt,
    date: validDate
      ? created.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
      : "—",
    time: validDate
      ? created.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : "",
    status: normalizeOrderStatus(order.orderStatus || order.order_status || order.status || "Created"),
    author: order.customerName || order.customer_name || metaValue(metadata, "pos_placed_by") || "Walk-in Customer",
    paymentMethod: titleCase(order.paymentMethod || order.payment_method || ""),
    totalValue: Number.isFinite(totalValue) ? totalValue : 0,
    total: formatMoney(totalValue, currency),
    currency,
    merchantId: order.merchantId || order.merchant_id || "",
    storeId: order.storeId || order.store_id || "",
  };
}

export async function listOrders(storeId) {
  const response = await api.get(endpoints.orders(storeId), {
    headers: storeId ? { "x-store-id": storeId } : undefined,
  });
  const orders = Array.isArray(response?.orders)
    ? response.orders
    : Array.isArray(response)
      ? response
      : [];
  return orders.map(normalizeOrder);
}

export async function getOrder(orderId, storeId) {
  return api.get(endpoints.order(orderId), {
    headers: storeId ? { "x-store-id": storeId } : undefined,
  });
}
