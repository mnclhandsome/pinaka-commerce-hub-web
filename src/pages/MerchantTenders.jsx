import { pendingStoreRead } from "../api/http";
import { useEffect, useRef, useState } from "react";
import DeleteConfirmationDialog from "../components/DeleteConfirmationDialog";
import BentoDetailModal from "../components/BentoDetailModal";
import ListActions from "../components/ListActions";
import "../styles/merchant-tenders.css";
import Pagination from "../components/Pagination";
import FiltersBar from "../components/FiltersBar";
import { tendorsApi } from "../api/tendors";

const idOf = (value) =>
  String(
    value && typeof value === "object"
      ? (value.tendorId ??
          value.tendor_id ??
          value.tenderId ??
          value.tender_id ??
          value.id ??
          value._id ??
          "")
      : (value ?? ""),
  );

const tendorsFrom = (response) => {
  const candidates = [
    response?.tendors,
    response?.data?.tendors,
    response?.data?.items,
    response?.items,
    response?.data,
    response,
  ];

  return candidates.find(Array.isArray) || [];
};

const assignedIdsFrom = (response) => {
  const candidates = [
    response?.tendorIds,
    response?.tenderIds,
    response?.data?.tendorIds,
    response?.data?.tenderIds,
    response?.tendors,
    response?.data?.tendors,
    response?.items,
    response?.data?.items,
    response?.data,
    response,
  ];
  const assigned = candidates.find(Array.isArray);

  return assigned ? assigned.map(idOf).filter(Boolean) : [];
};

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

// Status ni Title Case ("Active", "Inactive") loki marchadaniki helper
const formatStatus = (status) => {
  if (!status) return "Active";
  const str = String(status).trim();
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const normalize = (value = {}) => ({
  ...value,

  id: idOf(value),

  name:
    value.tendor_name ??
    value.tendorName ??
    value.tenderName ??
    value.name ??
    "Unnamed tender",

  code:
    value.tendor_code ??
    value.tendorCode ??
    value.tenderCode ??
    value.code ??
    "—",

  createdAt: formatDate(value.createdAt ?? value.created_at),

  updatedAt: formatDate(value.updatedAt ?? value.updated_at),

  status: formatStatus(value.status ?? "ACTIVE"),
});

const active = (tender) =>
  String(tender?.status || "").toLowerCase() === "active";

const matches = (tender, query) =>
  [tender?.name, tender?.code]
    .join(" ")
    .toLowerCase()
    .includes(query.trim().toLowerCase());

export default function MerchantTenders({
  merchantId,
  masterTenders: initialMasterTenders = [],
  assignedTenderIds = [],
  loading = false,
  error = "",
  onNavigationChange,
  navigationBackRef,
}) {
  const [ids, setIds] = useState(() => assignedTenderIds.map(idOf));

  const [masterTenders, setMasterTenders] = useState(initialMasterTenders);

  const [masterLoading, setMasterLoading] = useState(false);

  const [masterError, setMasterError] = useState("");

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pickerPage, setPickerPage] = useState(1);
  const [pickerPageSize, setPickerPageSize] = useState(25);

  const [sort, setSort] = useState({
    key: "name",
    direction: 1,
  });

  const [modal, setModal] = useState(null);
  const [selection, setSelection] = useState([]);
  const [search, setSearch] = useState("");

  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [assignmentError, setAssignmentError] = useState("");

  const lock = useRef(false);
  const dialog = useRef(null);
  const addButton = useRef(null);

  const signature = JSON.stringify(assignedTenderIds.map(idOf));

  useEffect(() => {
    setIds(JSON.parse(signature));
    setPage(1);
    setModal(null);
  }, [merchantId, signature]);

  useEffect(() => {
    let cancelled = false;

    async function loadMasterTenders() {
      setMasterLoading(true);
      setMasterError("");

      try {
        const response = await pendingStoreRead("tendors", () => tendorsApi.getAll());

        if (!cancelled) {
          setMasterTenders(tendorsFrom(response));
        }
      } catch (loadError) {
        console.error("Failed to load master tenders:", loadError);

        if (!cancelled) {
          setMasterError(
            loadError?.message || "Unable to load master tenders.",
          );
        }
      } finally {
        if (!cancelled) {
          setMasterLoading(false);
        }
      }
    }

    loadMasterTenders();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAssignments() {
      setAssignmentsLoading(true);
      setAssignmentError("");

      try {
        const response = await pendingStoreRead(`merchant-tendors:${merchantId}`, () => tendorsApi.getMerchantTendors(merchantId));

        if (!cancelled) {
          setIds(assignedIdsFrom(response));
        }
      } catch (loadError) {
        console.error("Failed to load merchant tender assignments:", loadError);

        if (!cancelled) {
          setAssignmentError(
            loadError?.message || "Unable to load merchant tender assignments.",
          );
        }
      } finally {
        if (!cancelled) {
          setAssignmentsLoading(false);
        }
      }
    }

    loadAssignments();

    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  useEffect(() => {
    if (dialog.current?.open) {
      dialog.current.close();
      addButton.current?.focus();
    }
  }, [modal]);

  useEffect(() => {
    if (modal?.type === "select") {
      onNavigationChange?.("select");
      if (navigationBackRef) navigationBackRef.current = close;
    } else {
      onNavigationChange?.(null);
    }
  }, [modal?.type, onNavigationChange, navigationBackRef]);

  const tenders = Array.from(
    new Map(
      masterTenders
        .map(normalize)
        .filter((value) => value.id)
        .map((value) => [value.id, value]),
    ).values(),
  );

  const assigned = ids.map(
    (id) =>
      tenders.find((value) => value.id === id) || {
        id,
        name: `Tender ${id}`,
        code: "—",
        createdAt: "—",
        updatedAt: "—",
        status: "Unavailable",
      },
  );

  const rows = assigned
    .filter((value) => matches(value, query))
    .sort(
      (a, b) =>
        String(a[sort.key]).localeCompare(String(b[sort.key])) *
        sort.direction
    );

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = rows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    setPage((previous) => Math.min(previous, totalPages));
  }, [totalPages]);

  const available = tenders.filter(
    (value) => !ids.includes(value.id) && matches(value, search),
  );

  const selectable = available.filter(active);
  const pickerPages = Math.max(1, Math.ceil(available.length / pickerPageSize));
  const currentPickerPage = Math.min(pickerPage, pickerPages);
  const pickerRows = available.slice((currentPickerPage - 1) * pickerPageSize, currentPickerPage * pickerPageSize);

  const close = () => {
    if (!lock.current) {
      setModal(null);
      setSaveError("");
      setMasterError("");
    }
  };

  async function openAddTenderModal() {
    if (masterLoading) return;

    setMasterLoading(true);
    setMasterError("");
    setSelection([]);
    setSearch("");
    setPickerPage(1);
    setSaveError("");

    try {
      const response = await pendingStoreRead("tendors", () => tendorsApi.getAll());

      console.log("TENDORS API RESPONSE:", response);

      setMasterTenders(tendorsFrom(response));

      setModal({
        type: "select",
      });
    } catch (e) {
      console.error("Failed to load master tendors:", e);

      setMasterError(e?.message || "Unable to load master tendors.");

      setMasterTenders([]);

      setModal({
        type: "select",
      });
    } finally {
      setMasterLoading(false);
    }
  }

  async function save(next) {
    if (lock.current) return;

    lock.current = true;
    setBusy(true);
    setSaveError("");

    try {
      await tendorsApi.assignToMerchant(merchantId, next);

      setIds(next);
      setModal(null);
    } catch (e) {
      console.error("Failed to save merchant tendors:", e);

      setSaveError(e?.message || "Unable to save merchant tender assignments.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const badge = (tender) => (
    <span
      className={`mt-badge ${active(tender) ? "mt-active" : "mt-inactive"}`}
    >
      {formatStatus(tender.status)}
    </span>
  );

  const name = (tender) => (
    <span className="mt-name">
      <strong>{tender.name}</strong>
    </span>
  );

  function headings(select = false) {
    return (
      <tr>
        {select && (
          <th>
            <input
              type="checkbox"
              aria-label="Select all available active tenders in search"
              checked={
                selectable.length > 0 &&
                selectable.every((value) => selection.includes(value.id))
              }
              disabled={!selectable.length || busy}
              onChange={(event) =>
                setSelection((old) =>
                  event.target.checked
                    ? [
                        ...new Set([
                          ...old,
                          ...selectable.map((value) => value.id),
                        ]),
                      ]
                    : old.filter(
                        (id) => !selectable.some((value) => value.id === id),
                      ),
                )
              }
            />
          </th>
        )}

        {["name", "code", "status"].map((key) => (
          <th key={key}>
            {select ? (
              {
                name: "Tender",
                code: "Code",
                status: "Status",
              }[key]
            ) : (
              <button
                className="mt-sort"
                onClick={() =>
                  setSort((old) => ({
                    key,
                    direction: old.key === key ? -old.direction : 1,
                  }))
                }
              >
                {key === "name"
                  ? "Tender"
                  : key[0].toUpperCase() + key.slice(1)}{" "}
              </button>
            )}
          </th>
        ))}

        {!select && <th>Actions</th>}
      </tr>
    );
  }

  async function removeTender(tendorId) {
    if (lock.current) return;

    lock.current = true;
    setBusy(true);
    setSaveError("");

    try {
      await tendorsApi.removeFromMerchant(merchantId, tendorId);

      setIds((current) => current.filter((id) => id !== tendorId));

      setModal(null);
    } catch (e) {
      console.error("Failed to remove merchant tendor:", e);

      setSaveError(e?.message || "Unable to remove tender assignment.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="merchant-tenders">
      {modal?.type === "select" ? (
        <section className="mt-card mt-existing-page">
          <header className="mt-existing-heading">
            <div>
              <h2>Add Tender</h2>
              <p>Choose one or more tenders to add to this merchant.</p>
            </div>
            <button type="button" disabled={busy} onClick={close}>
              <i className="bi bi-arrow-left" /> Back to Tenders
            </button>
          </header>
          {masterLoading && <p role="status">Loading master tenders…</p>}
          {masterError && <p role="alert" className="mt-error">{masterError}</p>}
          <FiltersBar
            className="mt-picker-toolbar"
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPickerPage(1);
            }}
            searchPlaceholder="Search tenders by name or code"
            searchAriaLabel="Search master tenders"
            searchDisabled={busy || masterLoading}
            searchAutoFocus
            onClear={() => {
              setSearch("");
              setPickerPage(1);
            }}
            clearLabel="Reset"
          />
          <div className="mt-scroll mt-options">
            <table>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Tender Code</th>
                  <th>Tender Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pickerRows.map((tender) => (
                  <tr key={tender.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${tender.name}`}
                        disabled={busy || !active(tender)}
                        checked={selection.includes(tender.id)}
                        onChange={(event) =>
                          setSelection((old) =>
                            event.target.checked
                              ? [...old, tender.id]
                              : old.filter((id) => id !== tender.id)
                          )
                        }
                      />
                    </td>
                    <td>{tender.code}</td>
                    <td>
                      <strong>{tender.name}</strong>
                    </td>
                    <td>{badge(tender)}</td>
                  </tr>
                ))}
                {!available.length && !masterLoading && (
                  <tr>
                    <td colSpan={4}>No unassigned tenders found in master data.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPickerPage}
            totalPages={pickerPages}
            totalItems={available.length}
            pageSize={pickerPageSize}
            onPageChange={setPickerPage}
            onPageSizeChange={(size) => {
              setPickerPageSize(size);
              setPickerPage(1);
            }}
            itemLabel="tenders"
            showWhenEmpty={true}
          />
          {saveError && <p role="alert" className="mt-error">{saveError}</p>}
          <footer className="mt-existing-footer">
            <button type="button" disabled={busy} onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className="mt-primary"
              disabled={busy || !selection.length || masterLoading}
              onClick={() =>
                save([
                  ...new Set([
                    ...ids,
                    ...selection.filter((id) =>
                      tenders.some((value) => value.id === id && active(value))
                    ),
                  ]),
                ])
              }
            >
              {busy ? "Saving…" : "Add Selected"}
            </button>
          </footer>
        </section>
      ) : (
        <section className="mt-card">
          <div className="mt-header">
            <div>
              <h3>Tender List</h3>
              <p>These are the tenders connected to this merchant.</p>
            </div>

            <button
              ref={addButton}
              className="mt-primary"
              disabled={loading || !!error || masterLoading}
              onClick={openAddTenderModal}
            >
              {masterLoading ? "Loading Tenders…" : "＋ Add Tender"}
            </button>
          </div>

          <FiltersBar
            searchValue={query}
            onSearchChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            searchPlaceholder="Search tenders by name or code…"
            onClear={() => {
              setQuery("");
              setPage(1);
              setSort({ key: "name", direction: 1 });
            }}
            showClear={true}
          />

          {loading || assignmentsLoading ? (
            <p role="status">Loading tenders…</p>
          ) : error || assignmentError || masterError ? (
            <p role="alert">{error || assignmentError || masterError}</p>
          ) : (
            <>
              <div className="mt-scroll">
                <table>
                  <thead>{headings()}</thead>

                  <tbody>
                    {paginatedRows.map((tender) => (
                      <tr
                        key={tender.id}
                        style={{ cursor: "pointer" }}
                        onClick={(event) => {
                          if (event.target.closest('button, a, input, select, textarea, label, [role="button"], [contenteditable="true"]')) {
                            return;
                          }
                          setModal({ type: "view", tender });
                        }}
                      >
                        <td>{name(tender)}</td>
                        <td>{tender.code}</td>
                        <td>{badge(tender)}</td>

                        <td>
                          <ListActions resource="tenders"
                            onView={() => setModal({ type: "view", tender })}
                            viewLabel={`View ${tender.name}`}
                            onDelete={() => {
                              setSaveError("");
                              setModal({ type: "remove", tender });
                            }}
                            deleteLabel={`Remove ${tender.name} assignment`}
                          />
                        </td>
                      </tr>
                    ))}

                    {!rows.length && (
                      <tr>
                        <td colSpan={4}>
                          No assigned tenders match. Use Add Tender to select from
                          master data.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={rows.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                itemLabel="tenders"
                showWhenEmpty={true}
              />
            </>
          )}
        </section>
      )}

      <dialog
        className="mt-dialog"
        ref={dialog}
        aria-labelledby="mt-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <div className="merchant-tenders">
          <header className="mt-header">
            <div>
              <h2 id="mt-dialog-title">
                {modal?.type === "select"
                  ? "Select Tender"
                  : modal?.type === "remove"
                    ? "Remove tender assignment"
                    : "Tender Details"}
              </h2>

              <p>
                {modal?.type === "select"
                  ? "Choose one or more tenders to add to this merchant."
                  : modal?.type === "remove"
                    ? "The tender remains available in Master Data."
                    : "Read-only master tender details."}
              </p>
            </div>

            <button aria-label="Close" disabled={busy} onClick={close} className="close-button">
              ×
            </button>
          </header>

          {modal?.type === "select" ? (
            <>
              {masterLoading && <p role="status">Loading master tenders…</p>}

              {masterError && (
                <p role="alert" className="mt-error">
                  {masterError}
                </p>
              )}

              <FiltersBar
                className="mt-picker-toolbar"
                searchValue={search}
                onSearchChange={(value) => {
                  setSearch(value);
                  setPickerPage(1);
                }}
                searchPlaceholder="Search tenders by name or code"
                searchAriaLabel="Search master tenders"
                searchDisabled={busy || masterLoading}
                searchAutoFocus
                onClear={() => {
                  setSearch("");
                  setPickerPage(1);
                }}
                clearLabel="Clear filters"
              />

              <div className="mt-scroll mt-options">
                <table>
                  <thead>{headings(true)}</thead>

                  <tbody>
                    {available.map((tender) => (
                      <tr key={tender.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select ${tender.name}`}
                            disabled={busy || !active(tender)}
                            checked={selection.includes(tender.id)}
                            onChange={(event) =>
                              setSelection((old) =>
                                event.target.checked
                                  ? [...old, tender.id]
                                  : old.filter((id) => id !== tender.id)
                              )
                            }
                          />
                        </td>

                        <td>{name(tender)}</td>
                        <td>{tender.code}</td>
                        <td>{badge(tender)}</td>
                      </tr>
                    ))}

                    {!available.length && !masterLoading && (
                      <tr>
                        <td colSpan={4}>
                          No unassigned tenders found in master data.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            modal?.tender && (
              <dl className="mt-details">
                {Object.entries({
                  Tender: modal.tender.name,
                  Code: modal.tender.code,
                  Status: formatStatus(modal.tender.status),
                  Created: modal.tender.createdAt,
                  Updated: modal.tender.updatedAt,
                }).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )
          )}

          {saveError && (
            <p role="alert" className="mt-error">
              {saveError}
            </p>
          )}

          <footer className="mt-footer">
            <span />

            <div>
              <button disabled={busy} onClick={close}>
                {modal?.type === "view" ? "Close" : "Cancel"}
              </button>

              {modal?.type === "select" && (
                <button
                  className="mt-primary"
                  disabled={busy || !selection.length || masterLoading}
                  onClick={() =>
                    save([
                      ...new Set([
                        ...ids,
                        ...selection.filter((id) =>
                          tenders.some(
                            (value) => value.id === id && active(value),
                          ),
                        ),
                      ]),
                    ])
                  }
                >
                  {busy ? "Saving…" : "Add Selected"}
                </button>
              )}
            </div>
          </footer>
        </div>
      </dialog>

      <DeleteConfirmationDialog
        isOpen={modal?.type === "remove"}
        title="Remove Tender Assignment?"
        message={`Are you sure you want to remove ${
          modal?.tender?.name || "this tender"
        } from this merchant? The tender will remain available in Master Data.`}
        cancelLabel="Cancel"
        confirmLabel="Remove"
        busyLabel="Removing..."
        busy={busy}
        error={saveError}
        iconClassName="bi bi-trash3"
        onCancel={close}
        onConfirm={() => {
          if (modal?.tender?.id) {
            removeTender(modal.tender.id);
          }
        }}
      />

      <BentoDetailModal
        open={Boolean(modal?.tender && modal?.type === "view")}
        onClose={close}
        headerIcon="bi-credit-card-2-front"
        title="Tender Details"
        code={modal?.tender?.code ? `Code: ${modal.tender.code}` : ""}
        size="compact"
        hero={
          modal?.tender
            ? {
                icon: "bi-credit-card",
                title: modal.tender.name || "Tender",
                status: formatStatus(modal.tender.status),
                metricLabel: "TENDER TYPE",
                metricValue: modal.tender.type || modal.tender.code || "Payment Method",
              }
            : null
        }
        layout="bento-2"
        sections={
          modal?.tender
            ? [
                {
                  title: "TENDER SPECIFICATIONS",
                  fields: [
                    {
                      label: "TENDER NAME",
                      value: modal.tender.name,
                    },
                    {
                      label: "TENDER CODE",
                      value: modal.tender.code,
                      mono: true,
                    },
                    {
                      label: "STATUS",
                      value: formatStatus(modal.tender.status),
                      render: (val) => (
                        <span
                          className={`bento-status-pill ${
                            String(val).toLowerCase() === "active" ? "active" : "inactive"
                          }`}
                        >
                          {formatStatus(val)}
                        </span>
                      ),
                    },
                  ],
                },
                {
                  title: "SYSTEM AUDIT",
                  fields: [
                    {
                      label: "CREATED AT",
                      value: modal.tender.createdAt ? new Date(modal.tender.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not specified",
                    },
                    {
                      label: "LAST UPDATED",
                      value: modal.tender.updatedAt ? new Date(modal.tender.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recently",
                    },
                    {
                      label: "CONFIGURATION",
                      value: modal.tender.isDefault ? "Default Method" : "Standard Method",
                    },
                  ],
                },
              ]
            : []
        }
      />
    </div>
  );
}