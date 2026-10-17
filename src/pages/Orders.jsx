import { pendingStoreRead } from "../api/http";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import Pagination from "../components/Pagination";
import FiltersBar from "../components/FiltersBar";
import { listMerchants } from "../api/merchants";
import { listMerchantStores } from "../api/stores";
import { listOrders } from "../api/orders";
import "../styles/orders.css";

function statusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("complete")) return "completed";
  if (value.includes("pending")) return "pending";
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("refund")) return "refunded";
  if (value.includes("partial")) return "partial";
  return "processing";
}

function matchesDate(createdAt, dateFilter) {
  if (!dateFilter) return true;
  const orderDate = new Date(createdAt);
  if (Number.isNaN(orderDate.getTime())) return false;
  const today = new Date();
  if (dateFilter === "today") return orderDate.toDateString() === today.toDateString();
  const from = new Date(today);
  from.setDate(today.getDate() - (dateFilter === "7days" ? 7 : 30));
  return orderDate >= from;
}

export default function Orders({
  embedded = false,
  merchantId,
  storeId,
  store,
}) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [merchants, setMerchants] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedMerchant, setSelectedMerchant] = useState(
    merchantId || (!embedded && searchParams.get("merchant")) || "",
  );
  const [selectedStore, setSelectedStore] = useState(
    storeId || (!embedded && searchParams.get("store")) || "",
  );
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (merchantId) setSelectedMerchant(merchantId);
  }, [merchantId]);

  useEffect(() => {
    if (storeId) setSelectedStore(storeId);
  }, [storeId]);

  useEffect(() => {
    if (embedded) return undefined;
    let active = true;
    listMerchants()
      .then((rows) => {
        if (active) setMerchants(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (active) setMerchants([]);
      });
    return () => {
      active = false;
    };
  }, [embedded]);

  useEffect(() => {
    if (!selectedMerchant || embedded) {
      if (!embedded) setStores([]);
      return undefined;
    }
    let active = true;
    listMerchantStores(selectedMerchant)
      .then((rows) => {
        if (!active) return;
        setStores(rows);
        if (rows.length === 1) setSelectedStore(rows[0].value);
      })
      .catch(() => {
        if (active) setStores([]);
      });
    return () => {
      active = false;
    };
  }, [selectedMerchant, embedded]);

  useEffect(() => {
    if (!selectedStore) {
      setOrders([]);
      setError("");
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError("");
    pendingStoreRead(`store-orders:${selectedStore}`, () => listOrders(selectedStore))
      .then((rows) => {
        if (!active) return;
        const merchantOrders = selectedMerchant
          ? rows.filter((order) => !order.merchantId || String(order.merchantId) === String(selectedMerchant))
          : rows;
        setOrders(merchantOrders);
      })
      .catch((loadError) => {
        if (!active) return;
        setOrders([]);
        setError(loadError?.message || "Failed to load orders.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedStore, selectedMerchant]);

  const authors = useMemo(
    () => [...new Set(orders.map((order) => order.author).filter(Boolean))],
    [orders],
  );

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      const searchText = `${order.wooOrderId} ${order.offlineOrderId} ${order.author} ${order.status}`.toLowerCase();
      return (
        (!query || searchText.includes(query)) &&
        (!statusFilter || order.status === statusFilter) &&
        (!authorFilter || order.author === authorFilter) &&
        matchesDate(order.createdAt, dateFilter)
      );
    });
  }, [orders, search, statusFilter, authorFilter, dateFilter]);

  const totalItems = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, dateFilter, authorFilter, selectedMerchant, selectedStore]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const completedCount = orders.filter((order) => statusClass(order.status) === "completed").length;
  const pendingCount = orders.filter((order) => statusClass(order.status) === "pending").length;
  const totalAmount = orders.reduce((sum, order) => sum + Number(order.totalValue || 0), 0);
  const orderPercentage = (count) => (orders.length ? ((count / orders.length) * 100).toFixed(1) : "0.0");
  function rememberFilters(nextMerchant, nextStore) {
    if (embedded) return;
    const next = new URLSearchParams(searchParams);
    if (nextMerchant) next.set("merchant", nextMerchant);
    else next.delete("merchant");
    if (nextStore) next.set("store", nextStore);
    else next.delete("store");
    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setDateFilter("");
    setAuthorFilter("");
    setCurrentPage(1);
  }

  const ordersToolbar = (
    <FiltersBar
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search order ID, client order ID, customer..."
      filters={[
        ...(!embedded ? [
          {
            key: "merchant",
            label: "Merchant",
            value: selectedMerchant,
            options: [
              { label: "All Merchants", value: "" },
              ...merchants.map((merchant) => ({
                label: merchant.name || merchant.merchantId,
                value: merchant.id,
              })),
            ],
            onChange: (value) => {
              setSelectedMerchant(value);
              setSelectedStore("");
              setOrders([]);
              rememberFilters(value, "");
            },
          },
          {
            key: "store",
            label: "Store",
            value: selectedStore,
            options: [
              { label: "All Stores", value: "" },
              ...stores.map((item) => ({ label: item.label, value: item.value })),
            ],
            onChange: (value) => {
              setSelectedStore(value);
              rememberFilters(selectedMerchant, value);
            },
          },
        ] : []),
        {
          key: "date",
          label: "Date",
          value: dateFilter,
          options: [
            { label: "All Dates", value: "" },
            { label: "Today", value: "today" },
            { label: "Last 7 Days", value: "7days" },
            { label: "Last 30 Days", value: "30days" },
          ],
          onChange: setDateFilter,
        },
        {
          key: "author",
          label: "Customer",
          value: authorFilter,
          options: [
            { label: "All Customers", value: "" },
            ...authors.map((author) => ({ label: author, value: author })),
          ],
          onChange: setAuthorFilter,
        },
        {
          key: "status",
          label: "Status",
          value: statusFilter,
          options: [
            { label: "All Status", value: "" },
            ...[...new Set(orders.map((order) => order.status).filter(Boolean))].map((status) => ({
              label: status,
              value: status,
            })),
          ],
          onChange: setStatusFilter,
        },
      ]}
      onClear={clearFilters}
    />
  );

  return (
    <div className="page-content orders-page">
      <div className="orders-header">
        <div className="orders-title-area">
          <div>
            <h1>Orders</h1>
            <p>View orders and transaction information for this store.</p>
          </div>
        </div>
      </div>

      <div className="orders-summary">
        <SummaryCard icon="bi-bag-fill" tone="purple" label="Total Orders" value={orders.length} meta="Live Records" metaTone="positive" />
        <SummaryCard icon="bi-check-circle-fill" tone="green" label="Completed" value={completedCount} meta={`${orderPercentage(completedCount)}% of total`} metaTone="positive" />
        <SummaryCard icon="bi-clock-fill" tone="orange" label="Pending Payment" value={pendingCount} meta={`${orderPercentage(pendingCount)}% of total`} metaTone="warning" />
        <SummaryCard icon="bi-cash-stack" tone="blue" label="Total Value" value={`$${totalAmount.toFixed(2)}`} meta="Across loaded orders" metaTone="info" />
      </div>

      <div className="orders-card">
        {ordersToolbar}

        {error && <div className="orders-banner error">{error}</div>}
        {loading && <div className="orders-banner">Loading orders...</div>}

        {!loading && (
          <>
            

            <div className="orders-table-wrapper">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Client Order ID</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Customer</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.length ? paginatedOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <div className="order-id-cell">
                          <div>
                            <Link
                              className="order-id-link"
                              to={`/orders/${encodeURIComponent(order.id)}?${new URLSearchParams({
                                ...(selectedMerchant ? { merchant: selectedMerchant } : {}),
                                ...(selectedStore ? { store: selectedStore } : {}),
                                number: order.wooOrderId,
                              }).toString()}`}
                              state={{ from: `${location.pathname}${location.search}` }}
                            >
                              <strong>{order.wooOrderId}</strong>
                            </Link>
                            <small>{order.paymentMethod || "POS"}</small>
                          </div>
                        </div>
                      </td>
                      <td><span className="offline-order-id">{order.offlineOrderId || "—"}</span></td>
                      <td>
                        <div className="order-date">
                          <strong>{order.date}</strong>
                          {order.time && <small>{order.time}</small>}
                        </div>
                      </td>
                      <td>
                        <span className={`order-status ${statusClass(order.status)}`}>
                          <i className="bi bi-circle-fill" />
                          {order.status}
                        </span>
                      </td>
                      <td>
                        <div className="order-author">
                          <span>{order.author}</span>
                        </div>
                      </td>
                      <td><strong className="order-total">{order.total}</strong></td>
                    </tr>
                  )) : (
                    <tr>
                      <td className="orders-table-empty" colSpan="6">
                        <div className="products-table-empty-state">
                          <strong>
                            {!selectedStore
                              ? "Select a store to view orders"
                              : error
                                ? "Orders could not be loaded"
                                : "No orders found"}
                          </strong>
                          <span>
                            {!selectedStore
                              ? "Choose a merchant and store to load that store's orders."
                              : error
                                ? error
                                : "Try changing your search or filters."}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && (
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
            itemLabel="orders"
            showWhenEmpty={true}
          />
        )}

        {selectedStore && !loading && filteredOrders.length > 0 && (
          <div className="orders-footer">
            <span className="orders-source">
              <i className="bi bi-arrow-repeat" />
              Store orders
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, tone, label, value, meta, metaTone }) {
  return (
    <div className="order-summary-card">
      <div className={`order-summary-icon ${tone}`}>
        <i className={`bi ${icon}`} aria-hidden="true" />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small className={`order-summary-meta ${metaTone}`}>
          <i className="bi bi-circle-fill" aria-hidden="true" /> {meta}
        </small>
      </div>
    </div>
  );
}
