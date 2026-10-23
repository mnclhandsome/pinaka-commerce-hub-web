import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { activateStore, deactivateStore, listStores } from "../api/stores";
import Pagination from "../components/Pagination";
import ListActions from "../components/ListActions";
import Can from "../components/Can";
import FiltersBar from "../components/FiltersBar";
import DeleteConfirmationDialog from "../components/DeleteConfirmationDialog";
import { getStoreDeviceMappings } from "../api/storeDeviceMappings";

const title = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
const locationOf = (store) =>
  [store.city || store.address?.city, store.state || store.address?.state].filter(Boolean).join(", ") || (typeof store.address === "string" ? store.address : "");
const dateTimeParts = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    date: date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
    time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  };
};
const initials = (name) =>
  String(name || "Store")
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
const displayStoreId = (store) =>
  [
    store.storeCode,
    store.store_code,
    store.code,
    store.storeId,
    store.storeID,
  ].find(
    (value) =>
      value &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        String(value),
      ),
  ) || store.id;
const deviceCountOf = (store) =>
  store.deviceCount ?? store.device_count ?? (Array.isArray(store.devices) ? store.devices.length : "");

function exportStores(rows, merchants) {
  if (!rows.length) {
    alert("There are no stores to export.");
    return;
  }
  const header = ["Store", "Store ID", "Merchant", "Store Type", "Address Line 1", "Address Line 2", "City", "State", "ZIP / Postal Code", "Country", "Phone", "Email", "Store URL", "Currency", "Time Zone", "Default Language", "POS Devices", "Status", "Connection", "Sync", "Created At", "Updated At"];
  const data = rows.map((store) => [
    store.storeName,
    displayStoreId(store),
    merchantNameOf(store, merchants),
    store.storeTypeName || store.type,
    store.addressLine1,
    store.addressLine2,
    store.city,
    store.state,
    store.zip,
    store.country,
    store.phone,
    store.email,
    store.url,
    store.currency,
    store.timezone,
    store.defaultLanguage,
    deviceCountOf(store),
    store.status,
    store.connectionStatus,
    store.syncStatus,
    store.createdAt,
    store.updatedAt,
  ]);
  const csv = [header, ...data]
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pch-stores.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const merchantNameOf = (store, merchants) => {
  const merchant = merchants.find(
    (m) => [m.id, m.merchantId, m.merchantCode].some((id) => String(id || "") === String(store.merchantId || "")),
  );
  return (
    store.merchantName ||
    merchant?.name ||
    merchant?.merchantName ||
    store.merchantId ||
    "—"
  );
};

export default function Stores() {
  const nav = useNavigate();
  const openView = (store) => nav(`/stores/${encodeURIComponent(store.id)}`);

  const [stores, setStores] = useState([]),
    [merchants, setMerchants] = useState([]);
  const [query, setQuery] = useState(""),
    [merchant, setMerchant] = useState(""),
    [status, setStatus] = useState(""),
    [location, setLocation] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(10);

const handlePageSizeChange = (size) => {
  setPageSize(size);
  setCurrentPage(1);
};
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [activatingStoreId, setActivatingStoreId] = useState("");
  const [statusActionError, setStatusActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");
  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 1800);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    listStores()
      .then((data) => {
        if (active) {
          const storeRows = Array.isArray(data.stores) ? data.stores : [];
          setStores(storeRows);
          setMerchants([...new Map((data.stores || []).filter(store => store.merchantId).map(store => [String(store.merchantId), { id: store.merchantId, name: store.merchantName || String(store.merchantId) }])).values()]);
          Promise.all(storeRows.map(async (store) => {
            const storeId = store.id || store.storeId || store.store_id;
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(storeId || ""))) return null;
            try {
              const mappings = await getStoreDeviceMappings(storeId);
              const deviceIds = new Set(mappings.map(mapping => {
                const device = mapping.device || {};
                return mapping.deviceId || mapping.device_id || device.id || device.deviceId || device.device_id || mapping.id || mapping.mappingId || mapping.mapping_id;
              }).filter(Boolean).map(String));
              return { storeId: String(storeId), count: deviceIds.size };
            } catch {
              return null;
            }
          })).then(counts => {
            if (!active) return;
            const countByStore = new Map(counts.filter(Boolean).map(({ storeId, count }) => [storeId, count]));
            if (countByStore.size) {
              setStores(current => current.map(store => {
                const storeId = String(store.id || store.storeId || store.store_id || "");
                return countByStore.has(storeId) ? { ...store, deviceCount: countByStore.get(storeId) } : store;
              }));
            }
          });
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const rows = stores.filter(
    (s) =>
      (!query ||
        `${s.storeName} ${displayStoreId(s)}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!merchant || String(s.merchantId) === String(merchant)) &&
      (!status || s.status === status) &&
      (!location || locationOf(s) === location),
  );

 const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

const safeCurrentPage = Math.min(currentPage, totalPages);

const startIndex = (safeCurrentPage - 1) * pageSize;

const paginatedRows = rows.slice(
  startIndex,
  startIndex + pageSize
);

useEffect(() => {
  setCurrentPage(1);
}, [query, merchant, status, location]);

useEffect(() => {
  setCurrentPage((previous) =>
    Math.min(previous, totalPages)
  );
}, [totalPages]);
  const activeCount = stores.filter((s) => String(s.status).toUpperCase() === "ACTIVE").length;
  const inactiveCount = stores.filter((s) => String(s.status).toUpperCase() === "INACTIVE").length;
  const recent = stores.filter(
    (s) => new Date(s.createdAt).getTime() >= Date.now() - 7 * 86400000,
  ).length;
  const hasSync =
    stores.length > 0 && stores.every((s) => s.syncStatus != null);
  const syncIssues = hasSync
    ? stores.filter((s) => ["ERROR", "FAILED"].includes(s.syncStatus)).length
    : null;
  const stats = [
    [
      "purple",
      "bi-building-fill",
      "Total Stores",
      stores.length,
      `${recent} added this week`,
    ],
    [
      "green",
      "bi-check-circle-fill",
      "Active Stores",
      activeCount,
      `${stores.length ? ((activeCount / stores.length) * 100).toFixed(1) : "0.0"}% of total`,
    ],
    [
      "red",
      "bi-x-circle-fill",
      "Inactive Stores",
      inactiveCount,
      `${stores.length ? ((inactiveCount / stores.length) * 100).toFixed(1) : "0.0"}% of total`,
    ],
    [
      "orange",
      "bi-exclamation-triangle-fill",
      "Sync Issues",
      syncIssues ?? "—",
      syncIssues === null
        ? "Not available"
        : `${stores.length ? ((syncIssues / stores.length) * 100).toFixed(1) : "0.0"}% of stores`,
    ],
  ];
  const statuses = [
    ...new Set([
      ...["ACTIVE", "INACTIVE"],
      ...stores.map((s) => s.status),
    ]),
  ];
  return (
    <div className="page-content stores-page">
      {notice && <div className={`alert stores-notice ${noticeType === "Inactive" ? "stores-notice-Inactive" : "alert-success"}`} role="status">{notice}</div>}
      <div className="page-header">
        <div>
          <h1>Stores</h1>
          <p>Manage and monitor all stores connected to Pinaka Commerce Hub</p>
        </div>
        <div className="page-actions">
          <Can resource="stores" action="create">
          <button className="add-store-btn btn-primary" onClick={() => nav("/stores/new")}>
            <i className="bi bi-plus-lg" /> Add Store
          </button>
          </Can>
          <button
            className="add-store-btn btn-secondary"
            type="button"
            onClick={() => exportStores(rows, merchants)}
          >
            <i className="bi bi-download" /> Export
          </button>
        </div>
      </div>
      <div className="row g-3 summary-row">
        {stats.map(([color, icon, label, value, detail]) => (
          <div className="col-xl-3 col-md-6" key={label}>
            <div className="summary-card">
              <div className={`summary-icon ${color}`}>
                <i className={`bi ${icon}`} />
              </div>
              <div>
                <span>{label}</span>
                <strong>{loading || error ? "—" : value}</strong>
                <small className={`${color}-text`}>
                  {loading ? "Loading…" : error ? "Unavailable" : detail}
                </small>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="stores-card">
        {statusActionError && <p className="stores-feedback" role="alert">{statusActionError}</p>}
        <FiltersBar
    searchValue={query}
    onSearchChange={(value) => {
        setQuery(value);
        setCurrentPage(1);
    }}
    searchPlaceholder="Search stores..."
    filters={[
        {
            key: "merchant",
            label: "Merchant",
            value: merchant,
            options: [
                {
                    label: "All Merchants",
                    value: "",
                },
                ...merchants.map((m) => ({
                    label: m.name,
                    value: m.id,
                })),
            ],
            onChange: (value) => {
                setMerchant(value);
                setCurrentPage(1);
            },
        },

        {
            key: "status",
            label: "Status",
            value: status,
            options: [
                {
                    label: "All Status",
                    value: "",
                },
                ...statuses
                    .filter(Boolean)
                    .map((s) => ({
                        label: title(s),
                        value: s,
                    })),
            ],
            onChange: (value) => {
                setStatus(value);
                setCurrentPage(1);
            },
        },

        {
            key: "location",
            label: "Location",
            value: location,
            options: [
                {
                    label: "All Locations",
                    value: "",
                },
                ...[
                    ...new Set(
                        stores
                            .map(locationOf)
                            .filter(Boolean)
                    ),
                ]
                    .sort()
                    .map((l) => ({
                        label: l,
                        value: l,
                    })),
            ],
            onChange: (value) => {
                setLocation(value);
                setCurrentPage(1);
            },
        },
    ]}
    onClear={() => {
        setQuery("");
        setMerchant("");
        setStatus("");
        setLocation("");
        setCurrentPage(1);
    }}
/>
        <div className="table-responsive">
          <table className="table stores-table">
            <thead>
              <tr>
                {[
                  "Store",
                  "Merchant Name",
                  "Store Type",
                  "Location",
                  "Contact Information",
                  "Devices Count",
                  "Status",
                  "Created At",
                  "Updated At",
                  "Actions",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} role="status">
                    Loading stores…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={10} role="alert">
                    {error}
                  </td>
                </tr>
              ) : paginatedRows.length ? (
                paginatedRows.map((s) => (
                  <tr
                    key={s.id}
                    tabIndex={0}
                    aria-label={`View ${s.storeName}`}
                    style={{ cursor: "pointer" }}
                    onClick={(event) => {
                      if (event.target.closest('button, a, input, select, textarea, label, [role="button"], [contenteditable="true"]')) {
                        event.stopPropagation();
                        return;
                      }
                      openView(s);
                    }}
                    onKeyDown={(event) => {
                      if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        openView(s);
                      }
                    }}
                  >
                    <td>
                      <button
                        type="button"
                        className="store-cell stores-name-button"
                        aria-label={`View ${s.storeName}`}
                        title="View store"
                        onClick={() => openView(s)}
                      >
                  
                        <div>
                          <strong>{s.storeName}</strong>
                          <small>{displayStoreId(s)}</small>
                        </div>
                      </button>
                    </td>
                    <td>
                      <div className="store-cell merchant-name-cell">
                        <div>
                          <strong>{merchantNameOf(s, merchants)}</strong>
                        </div>
                      </div>
                    </td>
                    <td>{s.storeTypeName || s.type || "—"}</td>
                    <td>
                      <div className="store-table-details">
                        <strong>{s.state || s.address?.state || "—"}</strong>
                        <small>{s.country || s.address?.country || "—"}</small>
                      </div>
                    </td>
                    <td>
                      <div className="store-table-details">
                        <strong>{s.phone || "—"}</strong>
                        <small>{s.email || "—"}</small>
                      </div>
                    </td>
                    <td>{deviceCountOf(s) || 0}</td>
                    <td>
                      <span
                        className={`store-status ${String(s.status).toLowerCase()}`}
                      >
                        <i className="bi bi-circle-fill" /> {title(s.status)}
                      </span>
                    </td>
                    {[s.createdAt, s.updatedAt].map((value, index) => {
                      const parts = dateTimeParts(value);
                      return (
                        <td key={index}>
                          {parts ? (
                            <div className="store-table-details store-table-datetime">
                              <strong>{parts.date}</strong>
                              <small>{parts.time}</small>
                            </div>
                          ) : "—"}
                        </td>
                      );
                    })}
                    <td>
                      <ListActions resource="stores"
                         onView={() => openView(s)}
                         onEdit={() =>
                             nav(`/stores/${encodeURIComponent(s.id)}/edit`)}
                         onActivate={String(s.status).toUpperCase() === "INACTIVE" ? async () => {
                           const rowId = String(s.id);
                           const key = s.storeCode || s.code || s.id;
                           setActivatingStoreId(rowId);
                           setStatusActionError("");
                           try {
                             await activateStore(key, s);
                             const refreshed = await listStores();
                             setStores(refreshed.stores);
                             const updated = refreshed.stores.find((store) =>
                               String(store.id) === rowId ||
                               String(store.storeCode || store.code || "") === String(key),
                             );
                             if (String(updated?.status).toUpperCase() !== "ACTIVE") {
                               throw new Error("The API did not confirm that the store is active. Please try again or check the store API.");
                             }
                            setNoticeType("success");
                            setNotice(`${s.storeName || "Store"} was activated.`);
                           } catch (failure) {
                             setStatusActionError(failure.message || "Unable to activate store.");
                           } finally {
                             setActivatingStoreId("");
                           }
                         } : undefined}
                         activateDisabled={Boolean(activatingStoreId)}
                         onDelete={String(s.status).toUpperCase() === "INACTIVE" ? undefined : () => {
                             setDeleteError("");
                             setDeleteTarget(s); }}
                         viewLabel={`View ${s.storeName}`}
                         editLabel={`Edit ${s.storeName}`}
                         deleteLabel={`Inactive ${s.storeName}`}
                         activateLabel={activatingStoreId === String(s.id) ? "Activating…" : `Activate ${s.storeName}`}
                           />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="10"
                    style={{
                      textAlign: "center",
                      padding: "40px",
                    }}
                  >No stores found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

    <Pagination
  currentPage={safeCurrentPage}
  totalPages={totalPages}
  totalItems={rows.length}
  pageSize={pageSize}
  onPageChange={setCurrentPage}
  onPageSizeChange={handlePageSizeChange}
  itemLabel="stores"
  showWhenEmpty={true}
/>

      </div>

            <DeleteConfirmationDialog
        isOpen={Boolean(deleteTarget)}
        title="Inactive Store?"
        message={`Are you sure you want to Inactive ${
          deleteTarget?.storeName ||
          deleteTarget?.name ||
          "this store"
        }?`}
        cancelLabel="Cancel"
        confirmLabel="Inactive"
        busyLabel="Inactivating..."
        busy={deleting}
        error={deleteError}
        iconClassName="bi bi-trash3"
        onCancel={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setDeleteError("");
          }
        }}
        onConfirm={async () => {
          if (!deleteTarget || deleting) return;

          setDeleting(true);
          setDeleteError("");

          try {
            await deactivateStore(
              deleteTarget.storeCode || deleteTarget.id,
              deleteTarget
            );

            setStores((current) =>
              current.map((store) =>
                String(store.id) === String(deleteTarget.id)
                  ? { ...store, status: "INACTIVE" }
                  : store
              )
            );

            setNoticeType("Inactive");
            setNotice(`${deleteTarget.storeName || deleteTarget.name || "Store"} was Inactive.`);
            setDeleteTarget(null);
          } catch (failure) {
            setDeleteError(
              failure.message || "Unable to Inactive store."
            );
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}
