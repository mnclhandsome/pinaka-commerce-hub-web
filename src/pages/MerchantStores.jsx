import "../styles/merchant-stores-embedded.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMerchant } from "../api/merchants";
import { api, ApiError, pendingStoreRead } from "../api/http";
import { activateStore, deactivateStore } from "../api/stores";
import { endpoints } from "../api/endpoints";

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

function toStoreRow(store) {
  const address = store.address && typeof store.address === "object" ? store.address : null;
  const typeValue = store.storeType ?? store.type;
  const type = typeof typeValue === "string"
    ? typeValue
    : typeValue?.name || typeValue?.storeTypeName || "Retail";
  const locationParts = [
    address?.street || (typeof store.address === "string" ? store.address : store.location),
    address?.addressLine2 || store.addressLine2,
    address?.city || store.city,
    address?.state || store.state,
    address?.zipCode || address?.postalCode || store.zip || store.postalCode,
    address?.country || store.country,
  ].flatMap((value) => String(value || "").split(",")).map((part) => part.trim()).filter(Boolean);
  const location = locationParts.filter((part, index) =>
    locationParts.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index,
  ).join(", ");
  const storeUuid = [store.id, store._id, store.storeUUID, store.storeUuid, store.store_uuid, store.uuid, store.storeId, store.storeID]
    .find(isUuid) || "";
  const storeCode = [store.storeCode, store.store_code, store.code, store.storeId, store.storeID, store.id]
    .find((value) => value && !isUuid(value)) || "";
  return {
    ...store,
    id: storeUuid,
    uuid: storeUuid,
    storeId: storeCode,
    storeCode,
    name: store.storeName || store.name || "Unnamed Store",
    type,
    storeType: type,
    location: location || "—",
    city: address?.city || store.city || "",
    state: address?.state || store.state || "",
    address: typeof store.address === "string" ? store.address : address?.street || "",
    status: store.status || "Active",
  };
}

function shortLocation(value, wordLimit = 8) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  return words.length > wordLimit ? `${words.slice(0, wordLimit).join(" ")}…` : words.join(" ");
}

export default function MerchantStores({
  merchantId: selectedMerchantId,
  embedded = false,
  merchantDetails = null,
}) {
  const params = useParams();
  const merchantId = selectedMerchantId ?? params.merchantId;
  const nav = useNavigate();

  const [merchant, setMerchant] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [activatingStoreId, setActivatingStoreId] = useState("");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const pageSize = 5;

  useEffect(() => {
    let cancelled = false;

    async function loadMerchant() {
      setLoading(true);
      setError("");

      try {
        if (!merchantId) {
          throw new Error("A merchant must be selected.");
        }

        const [result, storesResult] = await Promise.all([
          merchantDetails ? Promise.resolve({ merchant: merchantDetails }) : pendingStoreRead(`merchant:${merchantId}`, () => getMerchant(merchantId)),
          pendingStoreRead(`merchant-stores:${merchantId}`, () => api.get(endpoints.merchantStores(merchantId))),
        ]);

        if (!cancelled) {
          if (!result?.merchant) {
            throw new Error("Merchant details were not returned.");
          }

          const listed = storesResult?.stores ?? storesResult?.data?.stores ?? result.stores ?? [];
          setMerchant(result.merchant);
          setStores((Array.isArray(listed) ? listed : []).map(toStoreRow));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Unable to load this merchant."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMerchant();

    return () => {
      cancelled = true;
    };
  }, [merchantId, attempt]);

  /* =========================
     SEARCH
  ========================== */

  const filteredStores = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return stores;
    }

    return stores.filter((store) => {
      const searchableText = [
        store.name,
        store.id,
        store.storeId,
        store.type,
        store.storeType,
        store.location,
        store.address,
        store.city,
        store.state,
        store.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [stores, search]);

  /* =========================
     PAGINATION
  ========================== */

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStores.length / pageSize)
  );

  const currentPage = Math.min(page, totalPages);

  const visibleStores = filteredStores.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleReset = () => {
    setSearch("");
    setPage(1);
  };

  /* =========================
     HELPERS
  ========================== */

  const getStoreId = (store) =>
    [store.uuid, store.id, store._id, store.storeUUID, store.storeUuid, store.store_uuid]
      .find(isUuid) || "";

  const getStoreName = (store) =>
    store.name ??
    store.storeName ??
    "Unnamed Store";

  const getStoreType = (store) =>
    store.type ??
    store.storeType ??
    store.store_type ??
    "Retail";

  const getStoreLocation = (store) => {
    if (store.location) {
      return store.location;
    }

    if (store.address) {
      return store.address;
    }

    return [
      store.addressLine1,
      store.addressLine2,
      store.city,
      store.state,
      store.country,
    ]
      .filter(Boolean)
      .join(", ") || "—";
  };

  const getStoreStatus = (store) =>
    store.status ??
    "Active";

  const getStatusClass = (status) =>
    String(status || "active")
      .toLowerCase()
      .replace(/\s+/g, "-");

  /* =========================
     NAVIGATION
  ========================== */

  const handleNewStore = () => {
    const targetId = merchantId || merchant?.merchantId || merchant?.merchantCode || merchant?.id;
    nav(`/merchants/${encodeURIComponent(targetId)}/stores/new`);
  };

  const handleStoreOverview = (store) => {
    const storeUuid = getStoreId(store);
    if (!storeUuid) {
      setError("This store record does not include a valid UUID.");
      return;
    }
    const targetMerchantId = merchantId || merchant?.merchantId || merchant?.merchantCode || merchant?.id;
    nav(`/merchants/${encodeURIComponent(targetMerchantId)}/stores/${encodeURIComponent(storeUuid)}`);
  };

  const handleEdit = (store) => {
    const targetId = merchantId || merchant?.merchantId || merchant?.merchantCode || merchant?.id;
    const storeUuid = getStoreId(store);
    if (!storeUuid) {
      setError("This store record does not include a valid UUID.");
      return;
    }
    nav(`/merchants/${encodeURIComponent(targetId)}/stores/edit/${storeUuid}`);
  };

  return (
    <div
      className={
        embedded
          ? "merchant-store-page merchant-stores-embedded"
          : "page-content merchant-store-page"
      }
    >
      {/* =====================================
          BREADCRUMB
      ====================================== */}

      {!embedded && (
        <div className="breadcrumb-area">
          <button
            className="link-button"
            onClick={() => nav(`/merchants?view=${encodeURIComponent(merchantId || '')}&tab=stores`)}
          >
            <i className="bi bi-arrow-left" /> Merchants
          </button>

          <span>/</span>

          <span>Merchant Stores</span>
        </div>
      )}

      {/* =====================================
          LOADING
      ====================================== */}

      {loading ? (
        <section className="merchant-summary-card">
          Loading merchant details...
        </section>
      ) : error ? (
        <section
          className="merchant-summary-card"
          role="alert"
        >
          {error}

          <button
            type="button"
            onClick={() =>
              setAttempt((value) => value + 1)
            }
          >
            Retry
          </button>
        </section>
      ) : (
        <div className="merchant-stores-layout">

          {/* =====================================
              TOP HEADER
          ====================================== */}

          <section className="stores-card stores-header-card">
            <div className="stores-card-header">
              <div>
                <h2>Stores</h2>

                <p>
                  Manage the store locations for this
                  merchant.
                </p>
              </div>

              <button
                className="btn-new-store"
                type="button"
                onClick={handleNewStore}
              >
                <i className="bi bi-plus-lg" />
                New Store
              </button>
            </div>
          </section>

          {/* =====================================
              STORE LIST
          ====================================== */}

          <section className="stores-card store-list-card">

            {error && <p className="store-action-error" role="alert">{error}</p>}

            <div className="store-list-heading">
              <h2>Store List</h2>
            </div>

            {/* SEARCH + RESET */}

            <div className="store-list-toolbar">

              <div className="store-search-box">
                <input
                  type="text"
                  value={search}
                  placeholder="Search stores by name, type or location..."
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </div>

              <button
                type="button"
                className="store-reset-btn"
                onClick={handleReset}
              >
                <i className="bi bi-arrow-counterclockwise" />
                Clear
              </button>

            </div>

            {/* =====================================
                TABLE
            ====================================== */}

            <div className="store-table-wrapper">

              <table className="store-table">

                <thead>
                  <tr>
                    <th>Store ↑</th>
                    <th>Type ↕</th>
                    <th>Location ↕</th>
                    <th>Status ↕</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>

                  {visibleStores.length === 0 ? (
                    <tr>
                      <td
                        colSpan="5"
                        className="store-empty-row"
                      >
                        No stores found for this merchant.
                      </td>
                    </tr>
                  ) : (
                    visibleStores.map((store, index) => {

                      const storeId = store.storeId || store.storeCode || "—";

                      const storeName =
                        getStoreName(store);

                      const storeType =
                        getStoreType(store);

                      const location =
                        getStoreLocation(store);

                      const status =
                        getStoreStatus(store);

                      return (
                        <tr
                          key={
                            store.id ??
                            store.storeId ??
                            `store-${index}`
                          }
                        >

                          {/* STORE */}

                          <td>
                            <button type="button" className="store-name-cell store-name-link" title={`View ${storeName}`} onClick={() => handleStoreOverview(store)}>

                              <div className="store-icon">
                                <i className="bi bi-shop" />
                              </div>

                              <div className="store-name-info">

                                <strong>
                                  {storeName}
                                </strong>

                                <span>
                                  Store ID: {storeId}
                                </span>

                              </div>

                            </button>
                          </td>

                          {/* TYPE */}

                          <td>
                            <span className="store-type">
                              {storeType}
                            </span>
                          </td>

                          {/* LOCATION */}

                          <td>
                            <span className="store-location" title={location} aria-label={`Address: ${location}`}>
                              {shortLocation(location)}
                            </span>
                          </td>

                          {/* STATUS */}

                          <td>
                            <span
                              className={`store-status-badge ${getStatusClass(
                                status
                              )}`}
                            >
                              {status}
                            </span>
                          </td>

                          {/* ACTIONS */}

                          <td>
                            <div className="store-actions">
                              <button
                                type="button"
                                className="store-edit-btn"
                                title={`Edit ${storeName}`}
                                aria-label={`Edit ${storeName}`}
                                onClick={() => handleEdit(store)}
                              >
                                <i className="bi bi-pencil" />
                              </button>
                              {String(status).toUpperCase() === "INACTIVE" ? (
                                <button type="button" className="store-icon-btn store-activate-btn" title={`Activate ${storeName}`} aria-label={`Activate ${storeName}`} disabled={Boolean(activatingStoreId)} onClick={async () => {
                                  const storeUuid = getStoreId(store);
                                  setActivatingStoreId(storeUuid);
                                  setError("");
                                  try {
                                    await activateStore(store.storeCode || storeUuid, store);
                                    setStores((current) => current.map((item) => item.uuid === storeUuid ? { ...item, status: "ACTIVE" } : item));
                                  } catch (failure) {
                                    setError(failure.message || "Unable to activate store.");
                                  } finally {
                                    setActivatingStoreId("");
                                  }
                                }}><i className="bi bi-arrow-counterclockwise" /></button>
                              ) : (
                                <button type="button" className="store-icon-btn store-delete-btn" title={`Deactivate ${storeName}`} aria-label={`Deactivate ${storeName}`} onClick={() => { setDeleteError(""); setDeleteTarget(store); }}><i className="bi bi-trash" /></button>
                              )}
                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}

                </tbody>

              </table>

            </div>

            {/* =====================================
                PAGINATION
            ====================================== */}

            <div className="store-pagination">

              <span className="store-pagination-info">
                Showing{" "}
                {filteredStores.length === 0
                  ? 0
                  : (currentPage - 1) *
                      pageSize +
                    1}{" "}
                to{" "}
                {Math.min(
                  currentPage * pageSize,
                  filteredStores.length
                )}{" "}
                of {filteredStores.length} entries
              </span>

              <div className="store-pagination-controls">

                <button
                  type="button"
                  className="pagination-arrow"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setPage((value) =>
                      Math.max(1, value - 1)
                    )
                  }
                  aria-label="Previous page"
                >
                  <i className="bi bi-chevron-left" aria-hidden="true" />
                </button>

                <div className="pagination-pages">
                  <button
                    type="button"
                    className="pagination-page active"
                    aria-current="page"
                    onClick={() => setPage(currentPage)}
                  >
                    {currentPage}
                  </button>
                </div>

                <button
                  type="button"
                  className="pagination-arrow"
                  disabled={
                    currentPage === totalPages
                  }
                  onClick={() =>
                    setPage((value) =>
                      Math.min(
                        totalPages,
                        value + 1
                      )
                    )
                  }
                  aria-label="Next page"
                >
                  <i className="bi bi-chevron-right" aria-hidden="true" />
                </button>

              </div>

            </div>

          </section>
        </div>
      )}
      {deleteTarget && (
        <div className="pch-delete-overlay" role="dialog" aria-modal="true" aria-labelledby="merchant-store-delete-title" onClick={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteTarget(null); }}>
          <div className="pch-delete-modal">
            <div className="pch-delete-icon" aria-hidden="true"><i className="bi bi-trash3" /></div>
            <h2 id="merchant-store-delete-title">Deactivate Store?</h2>
            <p className="pch-delete-message">Are you sure you want to deactivate <strong>{getStoreName(deleteTarget)}</strong>?</p>
            <p className="pch-delete-warning">The store will remain in the system with inactive status.</p>
            {deleteError && <p role="alert" className="store-action-error">{deleteError}</p>}
            <div className="pch-delete-actions">
              <button type="button" className="pch-delete-cancel" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="pch-delete-confirm" disabled={deleting} onClick={async () => {
                setDeleting(true);
                setDeleteError("");
                try {
                  await deactivateStore(deleteTarget.storeCode || getStoreId(deleteTarget), deleteTarget);
                  const targetUuid = getStoreId(deleteTarget);
                  setStores((current) => current.map((store) => store.uuid === targetUuid ? { ...store, status: "INACTIVE" } : store));
                  setDeleteTarget(null);
                } catch (failure) {
                  setDeleteError(failure.message || "Unable to deactivate store.");
                } finally {
                  setDeleting(false);
                }
              }}>{deleting ? "Deactivating…" : "Deactivate Store"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
