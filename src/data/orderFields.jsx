import React from "react";

export const orderFields = [
    { key: "wooOrderId", label: "WooCommerce Order ID" },
    { key: "offlineOrderId", label: "Offline Order ID" },
    { key: "date", label: "Order Date" },
    { key: "time", label: "Order Time" },
    {
        key: "status",
        label: "Status",
        render: (value) => (
            <span
                className={`detail-status ${
                    value === "Completed"
                        ? "active"
                        : value === "Cancelled" || value === "Refunded"
                            ? "inactive"
                            : "pending"
                }`}
            >
                {value || "—"}
            </span>
        ),
    },
    { key: "author", label: "Author" },
    { key: "salesChannel", label: "Sales Channel" },
    { key: "customer", label: "Customer" },
    { key: "customerName", label: "Customer Name" },
    { key: "customerEmail", label: "Customer Email" },
    { key: "paymentMethod", label: "Payment Method" },
    { key: "subtotal", label: "Subtotal" },
    { key: "discount", label: "Discount" },
    { key: "tax", label: "Tax" },
    { key: "total", label: "Total" },
    {
        key: "totalValue",
        label: "Total Value",
        render: (value) =>
            value !== undefined && value !== null && value !== ""
                ? `$${Number(value).toFixed(2)}`
                : "—",
    },
    {
        key: "items",
        label: "Items",
        fullWidth: true,
        render: (value) => {
            if (!value) return "—";
            if (Array.isArray(value)) {
                return (
                    <div className="view-details-list">
                        {value.map((item, index) => (
                            <div
                                key={item?.id || item?.sku || index}
                                className="view-details-list-item"
                            >
                                {typeof item === "object"
                                    ? `${item.name || item.productName || "Item"}${
                                          item.quantity
                                              ? ` × ${item.quantity}`
                                              : ""
                                      }`
                                    : String(item)}
                            </div>
                        ))}
                    </div>
                );
            }
            return String(value);
        },
    },
    { key: "storeName", label: "Store" },
    { key: "storeId", label: "Store ID" },
];
