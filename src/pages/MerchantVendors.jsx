import { useEffect, useRef, useState } from "react";
import { Eye, Trash2 } from "lucide-react";
import "../styles/merchant-vendors.css";
import Vendors from "./Vendors";

import {
    getMappedMerchantVendors,
    getAvailableMerchantVendors,
    addMerchantVendors,
    createVendor,
    unmapMerchantVendor,
    getMappedStoreVendors,
    addStoreVendors,
    unmapStoreVendor,
} from "../api/vendors";

/* =========================================================
   HELPERS
========================================================= */

const idOf = (value) =>
    String(
        typeof value === "object"
            ? value.vendorId ??
              value.id ??
              value._id ??
              ""
            : value ?? ""
    );

const normalize = (value) => ({
    ...value,

    id: idOf(value),

    name:
        value.name ||
        value.vendorName ||
        value.vendor_name ||
        "Unnamed vendor",

    code: value.code || value.vendorCode || value.vendor_code || "—",

    type:
        value.type ||
        value.vendorType ||
        value.vendor_type ||
        "—",

    products:
        value.products || value.productList || value.product_list ||
        value.productCategory || value.product_category || value.category || "—",

    contactPerson: value.contactPerson || value.contact_person || value.contactName || "",
    email: value.email || "",
    addressLine1: value.addressLine1 || value.address_line1 || "",
    addressLine2: value.addressLine2 || value.address_line2 || "",
    city: value.city || "",
    state: value.state || "",
    zipCode: value.zipCode || value.zip_code || "",
    country: value.country || "",
    createdTime: value.createdTime || value.createdAt || value.created_at || "",
    updatedTime: value.updatedTime || value.updatedAt || value.updated_at || "",

    phone:
        value.phone ||
        value.mobile ||
        value.mobileNumber ||
        value.phoneNumber ||
        value.contactPhone ||
        "",

    contact:
        value.contactName ||
        value.contactPerson?.name ||
        (typeof value.contactPerson === "string"
            ? value.contactPerson
            : "") ||
        "—",

    status: String(value.status || "Active"),

    assignedStoreCount:
        Array.isArray(value.stores)
            ? value.stores.length
            : Number(
                  value.assignedStoreCount ??
                      value.assignedStoresCount ??
                      value.storeCount ??
                      0
              ),
});

const active = (vendor) =>
    vendor.status.toLowerCase() === "active";

const searchableValues = value => {
    if (value == null) return [];
    if (typeof value === "object") return Object.values(value).flatMap(searchableValues);
    return [String(value)];
};
const displayValue = value => {
    if (Array.isArray(value)) {
        const items = value.map(item => item && typeof item === "object"
            ? item.name || item.productName || item.product_name || JSON.stringify(item)
            : item).filter(Boolean);
        return items.length ? items.join(", ") : "—";
    }
    if (value && typeof value === "object") {
        return value.name || value.productName || value.product_name || JSON.stringify(value);
    }
    return String(value ?? "").trim() || "—";
};
const matches = (vendor, query) => {
    const text = searchableValues(vendor).join(" ").toLowerCase();
    return query.trim().toLowerCase().split(/\s+/).filter(Boolean).every(term => text.includes(term));
};
const vendorCountry = vendor => String(vendor.country || vendor.address?.country || "").trim();
const vendorState = vendor => String(vendor.state || vendor.address?.state || "").trim();
const locationKey = value => value.toLowerCase();
const locationOptions = values => [...new Map(values.filter(Boolean).map(value => [locationKey(value), value])).values()].sort((a, b) => a.localeCompare(b));

/* =========================================================
   COMPONENT
========================================================= */

export default function MerchantVendors({
    merchantId,
    storeId,
    masterVendors: initialMasterVendors = [],
    assignedVendorIds = [],
    onSaveAssignments,
    loading = false,
    error = "",
}) {
    const storeScope = Boolean(storeId);
    const mappingId = storeScope ? storeId : merchantId;
    const entityName = storeScope ? "store" : "merchant";
    const [ids, setIds] = useState(() =>
        assignedVendorIds.map(idOf)
    );

    const [query, setQuery] = useState("");

    const [page, setPage] = useState(1);
    const [pickerPage, setPickerPage] = useState(1);
    const pickerPageSize = 25;

    const [sort, setSort] = useState({
        key: "name",
        direction: 1,
    });

    const [modal, setModal] = useState(null);

    const [selection, setSelection] = useState([]);

    const [search, setSearch] = useState("");
    const [countryFilter, setCountryFilter] = useState("");
    const [stateFilter, setStateFilter] = useState("");

    const [busy, setBusy] = useState(false);

    const [saveError, setSaveError] = useState("");

    const [masterVendors, setMasterVendors] =
        useState(initialMasterVendors);

    const [masterLoading, setMasterLoading] =
        useState(false);

    const [masterError, setMasterError] =
        useState("");

    const [mappedLoading, setMappedLoading] =
        useState(false);

    const [mappedError, setMappedError] =
        useState("");

    const lock = useRef(false);
    const pendingNewVendor = useRef(null);

    const dialog = useRef(null);

    const addButton = useRef(null);

    /* =========================================================
       LOAD MAPPED VENDORS
    ========================================================= */

    async function loadMappedVendors(searchValue = "") {
        if (!mappingId) {
            setIds([]);
            return;
        }

        setMappedLoading(true);
        setMappedError("");

        try {
            const mapped = storeScope
                ? await getMappedStoreVendors(mappingId, { search: searchValue })
                : await getMappedMerchantVendors(mappingId, { search: searchValue });

            const mappedIds = mapped.map(idOf);

            setMasterVendors((current) => {
                const byId = new Map(
                    current.map((vendor) => [
                        idOf(vendor),
                        vendor,
                    ])
                );

                mapped.forEach((vendor) => {
                    byId.set(idOf(vendor), vendor);
                });

                return Array.from(byId.values());
            });

            setIds(mappedIds);
            setPage(1);
        } catch (e) {
            console.error(
                `Failed to load mapped ${entityName} vendors:`,
                e
            );

            setMappedError(
                e?.message ||
                    "Unable to load mapped vendors."
            );
        } finally {
            setMappedLoading(false);
        }
    }

    /* =========================================================
       EFFECTS
    ========================================================= */

    useEffect(() => {
        setModal(null);
        setSelection([]);
        setPickerPage(1);
        setSearch("");
        setCountryFilter("");
        setStateFilter("");

        if (mappingId) {
            loadMappedVendors();
        } else {
            setIds(assignedVendorIds.map(idOf));
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mappingId, storeScope]);

    useEffect(() => {
        if (modal && modal.type !== "create") {
            if (!dialog.current?.open) dialog.current?.showModal();
        } else if (dialog.current?.open) {
            dialog.current.close();
            addButton.current?.focus();
        }
    }, [modal]);

    /* =========================================================
       MASTER VENDORS
    ========================================================= */

    const vendors = Array.from(
        new Map(
            masterVendors
                .map(normalize)
                .filter((vendor) => vendor.id)
                .map((vendor) => [
                    vendor.id,
                    vendor,
                ])
        ).values()
    );

    /* =========================================================
       ASSIGNED VENDORS
    ========================================================= */

    const assigned = ids.map(
        (id) =>
            vendors.find(
                (vendor) => vendor.id === id
            ) || {
                id,
                name: `Vendor ${id}`,
                type: "—",
                contact: "—",
                phone: "",
                status: "Unavailable",
                assignedStoreCount: 0,
            }
    );

    /* =========================================================
       FILTER + SORT
    ========================================================= */

    const rows = assigned
        .filter((vendor) =>
            matches(vendor, query)
        )
        .sort(
            (a, b) =>
                String(
                    a[sort.key] ?? ""
                ).localeCompare(
                    String(
                        b[sort.key] ?? ""
                    )
                ) * sort.direction
        );

    const pages = Math.max(
        1,
        Math.ceil(rows.length / 10)
    );

    const current = Math.min(page, pages);

    /* =========================================================
       AVAILABLE VENDORS
    ========================================================= */

    const unassignedVendors = vendors.filter(vendor => !ids.includes(vendor.id));
    const countries = locationOptions(unassignedVendors.map(vendorCountry));
    const states = locationOptions(unassignedVendors.filter(vendor => !countryFilter || locationKey(vendorCountry(vendor)) === countryFilter).map(vendorState));
    const available = vendors.filter(
        (vendor) =>
            !ids.includes(vendor.id) &&
            matches(vendor, search) &&
            (!countryFilter || locationKey(vendorCountry(vendor)) === countryFilter) &&
            (!stateFilter || locationKey(vendorState(vendor)) === stateFilter)
    );

    const pickerPages = Math.max(1, Math.ceil(available.length / pickerPageSize));
    const currentPickerPage = Math.min(pickerPage, pickerPages);
    const pickerRows = available.slice((currentPickerPage - 1) * pickerPageSize, currentPickerPage * pickerPageSize);
    const selectable = pickerRows.filter(active);

    const toggleVendorSelection = (vendor) => {
        if (busy || !active(vendor)) return;
        setSelection(current => current.includes(vendor.id)
            ? current.filter(id => id !== vendor.id)
            : [...current, vendor.id]);
    };

    /* =========================================================
       OPEN ADD VENDOR MODAL
    ========================================================= */

    async function openAddVendorModal() {
        if (masterLoading || !mappingId) {
            return;
        }

        setMasterLoading(true);
        setMasterError("");
        setSelection([]);
        setSearch("");
        setCountryFilter("");
        setStateFilter("");
        setSaveError("");

        try {
            const vendors = storeScope
                ? (await getMappedMerchantVendors(merchantId)).filter(vendor => !ids.includes(idOf(vendor)))
                : await getAvailableMerchantVendors(mappingId);

            setMasterVendors(
                Array.isArray(vendors)
                    ? vendors
                    : []
            );

            setModal({
                type: "select",
            });
        } catch (e) {
            console.error(
                `Failed to load available ${storeScope ? "merchant-mapped" : "merchant"} vendors:`,
                e
            );

            setMasterError(
                e?.message ||
                    "Unable to load available vendors."
            );

            setMasterVendors([]);

            setModal({
                type: "select",
            });
        } finally {
            setMasterLoading(false);
        }
    }

    /* =========================================================
       CLOSE MODAL
    ========================================================= */

    const close = () => {
        if (!lock.current) {
            setModal(null);
            setSaveError("");
            setMasterError("");
        }
    };

    /* =========================================================
       SAVE
    ========================================================= */

    async function createAndAssignVendor(payload) {
        if (lock.current || !mappingId || storeScope) throw new Error(`Select a ${entityName} before adding a vendor.`);
        lock.current = true;
        setBusy(true);
        try {
            const vendor = pendingNewVendor.current || await createVendor(payload);
            pendingNewVendor.current = vendor;
            const vendorId = idOf(vendor);
            if (!vendorId) throw new Error("Vendor was created but its ID was not returned. Close this popup and use Add Existing Vendor to assign it.");
            try {
                await addMerchantVendors(mappingId, [vendorId]);
            } catch (error) {
                throw new Error("Vendor created, but assignment failed. Retry Create Vendor to assign the same vendor, or use Add Existing Vendor. " + (error?.message || ""));
            }
            pendingNewVendor.current = null;
            await loadMappedVendors();
            setModal(null);
            return vendor;
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }

    async function save(next) {
        if (lock.current || !mappingId) {
            return;
        }

        lock.current = true;
        setBusy(true);
        setSaveError("");

        try {
            const addedIds = next.filter(
                (id) => !ids.includes(id)
            );

            if (modal?.type === "remove") {
                if (storeScope) await unmapStoreVendor(modal.vendor.mappingId);
                else await unmapMerchantVendor(mappingId, modal.vendor.id);
            } else if (modal?.type === "select") {
                if (!addedIds.length) {
                    throw new Error(
                        "At least one vendor must be selected."
                    );
                }

                if (storeScope) await addStoreVendors(mappingId, addedIds);
                else await addMerchantVendors(mappingId, addedIds);
            }

            await loadMappedVendors();

            setModal(null);
        } catch (e) {
            console.error(
                `Failed to save ${entityName} vendor mapping:`,
                e
            );

            if (storeScope) await loadMappedVendors();

            setSaveError(
                e?.message ||
                    "Unable to save vendor assignment."
            );
        } finally {
            lock.current = false;
            setBusy(false);
        }
    }

    /* =========================================================
       STATUS BADGE
    ========================================================= */

    const badge = (vendor) => (
        <span
            className={`mv-badge ${
                active(vendor)
                    ? "mv-active"
                    : "mv-inactive"
            }`}
        >
             {vendor.status}
        </span>
    );

    /* =========================================================
       VENDOR NAME
    ========================================================= */

    const name = (vendor) => (
        <span className="mv-name">
            <strong>{vendor.name}</strong>
        </span>
    );

    /* =========================================================
       TABLE HEADINGS
    ========================================================= */

    function headings(select = false) {
        return (
            <tr>
                {select && (
                    <th>
                        <input
                            type="checkbox"
                            aria-label="Select all active vendors on this page"
                            checked={
                                selectable.length > 0 &&
                                selectable.every(
                                    (vendor) =>
                                        selection.includes(
                                            vendor.id
                                        )
                                )
                            }
                            disabled={
                                !selectable.length ||
                                busy
                            }
                            onChange={(e) =>
                                setSelection((old) =>
                                    e.target.checked
                                        ? [
                                              ...new Set([
                                                  ...old,
                                                  ...selectable.map(
                                                      (vendor) =>
                                                          vendor.id
                                                  ),
                                              ]),
                                          ]
                                        : old.filter(
                                              (id) =>
                                                  !selectable.some(
                                                      (vendor) =>
                                                          vendor.id ===
                                                          id
                                                  )
                                          )
                                )
                            }
                        />
                    </th>
                )}

                {(select
                    ? [
                          "code",
                          "name",
                          "type",
                          "products",
                          "contact",
                      ]
                    : [
                          "code",
                          "name",
                          "type",
                          "products",
                          "contact",
                          "assignedStoreCount",
                          "status",
                      ]
                ).map((key) => (
                    <th key={key}>
                        {select ? (
                            {
                                code: "Vendor Code",
                                name: "Vendor Name",
                                type: "Vendor Type",
                                products: "Products Supplied",
                                contact: "Contact",
                                assignedStoreCount:
                                    "Assigned Stores",
                                status: "Status",
                            }[key]
                        ) : (
                            <span>
                                {key === "name"
                                    ? "Vendor Name"
                                    : key === "code"
                                    ? "Vendor Code"
                                    : key === "type"
                                    ? "Vendor Type"
                                    : key ===
                                      "assignedStoreCount"
                                    ? "Assigned Stores"
                                    : key === "products"
                                    ? "Products Supplied"
                                    : key[0].toUpperCase() +
                                      key.slice(1)}
                            </span>
                        )}
                    </th>
                ))}

                {!select && <th>Actions</th>}
            </tr>
        );
    }

    /* =========================================================
       UI
    ========================================================= */

    if (modal?.type === "create") return (
        <section className="merchant-vendors mv-create-page">
            <header className="mv-card mv-header">
                <h2>Add New Vendor</h2>
                <button type="button" disabled={busy} onClick={close}>← Back to Vendors</button>
            </header>
            <div className="mv-create-content"><Vendors formOnly onCreate={createAndAssignVendor} onCancel={close} /></div>
        </section>
    );

    if (modal?.type === "select") return (
        <section className="merchant-vendors mv-create-page mv-existing-page">
            <header className="mv-card mv-header">
                <div>
                    <h2>Add Existing Vendor</h2>
                    <p>Choose one or more vendors to add to this {entityName}.</p>
                </div>
                <button type="button" disabled={busy} onClick={close}>← Back to Vendors</button>
            </header>

            <div className="mv-existing-content">
                {masterLoading && <p role="status">Loading master vendors…</p>}
                {masterError && <p role="alert" className="mv-error">{masterError}</p>}

                <div className="mv-existing-toolbar">
                    <input
                        className="mv-search"
                        autoFocus
                        aria-label="Search master vendors"
                        placeholder="Search vendors by name, code, contact or product…"
                        value={search}
                        disabled={busy || masterLoading}
                        onChange={e => { setSearch(e.target.value); setPickerPage(1); }}
                    />
                    <select aria-label="Filter by country" value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setStateFilter(""); setPickerPage(1); }}><option value="">All countries</option>{countries.map(country => <option key={locationKey(country)} value={locationKey(country)}>{country}</option>)}</select>
                    <select aria-label="Filter by state" value={stateFilter} onChange={e => { setStateFilter(e.target.value); setPickerPage(1); }}><option value="">All states</option>{states.map(state => <option key={locationKey(state)} value={locationKey(state)}>{state}</option>)}</select>
                    <button type="button" onClick={() => { setSearch(""); setCountryFilter(""); setStateFilter(""); setPickerPage(1); }}>Clear filters</button>
                </div>

                <div className="mv-picker-summary">
                    <span>{available.length} matching vendors · {selection.length} selected</span>
                </div>

                <div className="mv-existing-table-wrap">
                    <table>
                        <thead><tr><th>Select</th><th>Vendor Code</th><th>Vendor Name</th><th>Vendor Type</th><th>Products Supplied</th><th>Contact</th></tr></thead>
                        <tbody>
                            {pickerRows.map(vendor => {
                                const selected = selection.includes(vendor.id);
                                return (
                                    <tr
                                        key={vendor.id}
                                        className={`${selected ? "mv-row-selected" : ""} ${!active(vendor) ? "mv-row-disabled" : ""}`}
                                        aria-selected={selected}
                                        title={active(vendor) ? "Click to select or deselect this vendor" : "Inactive vendors cannot be selected"}
                                        onClick={event => {
                                            if (event.target.closest("input,button,a,select")) return;
                                            toggleVendorSelection(vendor);
                                        }}
                                    >
                                        <td><input type="checkbox" aria-label={`Select ${vendor.name}`} disabled={busy || !active(vendor)} checked={selected} onChange={() => toggleVendorSelection(vendor)} /></td>
                                        <td>{displayValue(vendor.code)}</td>
                                        <td><strong>{vendor.name}</strong></td>
                                        <td>{displayValue(vendor.type)}</td>
                                        <td>{displayValue(vendor.products)}</td>
                                        <td>{vendor.phone || vendor.contact || "—"}</td>
                                    </tr>
                                );
                            })}
                            {!available.length && <tr><td colSpan={6}>{storeScope ? "No unassigned vendors mapped to this merchant." : "No unassigned vendors found in master data."}</td></tr>}
                        </tbody>
                    </table>
                </div>

                <nav className="mv-picker-pagination" aria-label="Existing vendor pages">
                    <span>Showing {available.length ? (currentPickerPage - 1) * pickerPageSize + 1 : 0}–{Math.min(currentPickerPage * pickerPageSize, available.length)} of {available.length}</span>
                    <div className="mv-popup-actions">
                        <button type="button" disabled={currentPickerPage === 1} onClick={() => setPickerPage(currentPickerPage - 1)}>Previous</button>
                        <span>Page {currentPickerPage} of {pickerPages}</span>
                        <button type="button" disabled={currentPickerPage === pickerPages} onClick={() => setPickerPage(currentPickerPage + 1)}>Next</button>
                    </div>
                </nav>
                {saveError && <p role="alert" className="mv-error">{saveError}</p>}
            </div>

            <footer className="mv-existing-footer">
                <span>{selection.length} vendors selected</span>
                <div className="mv-popup-actions">
                    <button type="button" disabled={busy} onClick={close}>Cancel</button>
                    <button type="button" className="mv-primary" disabled={busy || !selection.length} onClick={() => save([...new Set([...ids, ...selection.filter(id => vendors.some(vendor => vendor.id === id && active(vendor)))])])}>
                        {busy ? "Saving…" : "Add Selected"}
                    </button>
                </div>
            </footer>
        </section>
    );

    return (
        <div className="merchant-vendors">

            {/* =================================================
                HEADER
            ================================================= */}

            <header className="mv-card mv-header">
                <div>
                    <h2>Vendors</h2>

                    <p>
                        These are the vendors connected
                        to this {entityName}.
                    </p>
                </div>

                <div className="mv-popup-actions">
                {!storeScope && <button type="button" className="mv-primary" disabled={!mappingId || busy} onClick={() => { pendingNewVendor.current = null; setSaveError(""); setModal({ type: "create" }); }}>＋ Add New Vendor</button>}
                <button
                    ref={addButton}
                    type="button"
                    className="mv-primary"
                    disabled={
                        loading ||
                        !!error ||
                        masterLoading ||
                        !mappingId
                    }
                    onClick={openAddVendorModal}
                >
                    {masterLoading
                        ? "Loading Vendors…"
                        : "＋ Add Existing Vendor"}
                </button>
                </div>
            </header>

            {/* =================================================
                VENDOR LIST
            ================================================= */}

            <section className="mv-card">

                <h3>Vendor List</h3>

                <div className="mv-toolbar">

                    <input
                        aria-label="Search assigned vendors"
                        placeholder="Search vendors by code, name, type or phone…"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setPage(1);
                        }}
                    />

                    <button
                        type="button"
                        onClick={() => {
                            setQuery("");
                            setPage(1);

                            setSort({
                                key: "name",
                                direction: 1,
                            });
                        }}
                    >
                        ↺ Reset
                    </button>

                </div>

                {loading || mappedLoading ? (
                    <p role="status">
                        Loading vendors…
                    </p>
                ) : error || mappedError ? (
                    <p role="alert">
                        {error || mappedError}
                    </p>
                ) : (
                    <>
                        <div className="mv-scroll">

                            <table>

                                <thead>
                                    {headings()}
                                </thead>

                                <tbody>

                                    {rows
                                        .slice(
                                            (current - 1) * 10,
                                            current * 10
                                        )
                                        .map((vendor) => (
                                            <tr
                                                key={vendor.id}
                                            >

                                                <td>
                                                    {displayValue(vendor.code)}
                                                </td>

                                                <td>
                                                    {name(vendor)}
                                                </td>

                                                <td>
                                                    {vendor.type}
                                                </td>

                                                <td>
                                                    {displayValue(vendor.products)}
                                                </td>

                                                <td>
                                                    {vendor.phone ||
                                                        vendor.contact ||
                                                        "—"}
                                                </td>

                                                <td>
                                                    {
                                                        vendor.assignedStoreCount
                                                    }
                                                </td>

                                                <td>
                                                    {badge(vendor)}
                                                </td>

                                                {/* =================================================
                                                    ACTIONS
                                                ================================================= */}

                                                <td>
                                                    <div className="mv-actions">

                                                        <button
                                                            type="button"
                                                            className="mv-view mv-icon-button"
                                                            aria-label={`View ${vendor.name}`}
                                                            title={`View ${vendor.name}`}
                                                            onClick={() =>
                                                                setModal({
                                                                    type: "view",
                                                                    vendor,
                                                                })
                                                            }
                                                        >
                                                            <Eye size={18} aria-hidden="true" />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="mv-remove mv-icon-button"
                                                            aria-label={`Remove ${vendor.name} assignment`}
                                                            title={`Remove ${vendor.name} assignment`}
                                                            onClick={() => {
                                                                setSaveError("");

                                                                setModal({
                                                                    type: "remove",
                                                                    vendor,
                                                                });
                                                            }}
                                                        >
                                                            <Trash2 size={18} aria-hidden="true" />
                                                        </button>

                                                    </div>
                                                </td>

                                            </tr>
                                        ))}

                                    {!rows.length && (
                                        <tr>
                                            <td colSpan={7}>
                                                No assigned vendors
                                                match. Use Add Existing Vendor
                                                to select from master
                                                data.
                                            </td>
                                        </tr>
                                    )}

                                </tbody>

                            </table>

                        </div>

                        {/* =================================================
                            PAGINATION
                            ONLY SHOW WHEN MORE THAN ONE PAGE
                        ================================================= */}

                        <footer className="mv-footer">

                            <span>
                                Showing{" "}
                                {rows.length
                                    ? (current - 1) * 10 + 1
                                    : 0}{" "}
                                to{" "}
                                {Math.min(
                                    current * 10,
                                    rows.length
                                )}{" "}
                                of {rows.length} entries
                            </span>

                            {pages > 1 && (
                                <div className="mv-pagination">

                                    <button
                                        type="button"
                                        className="mv-page"
                                        disabled={
                                            current === 1
                                        }
                                        onClick={() =>
                                            setPage(
                                                current - 1
                                            )
                                        }
                                        aria-label="Previous page"
                                    >
                                        ‹
                                    </button>

                                    <span className="mv-page-number">
                                        {current} / {pages}
                                    </span>

                                    <button
                                        type="button"
                                        className="mv-page"
                                        disabled={
                                            current === pages
                                        }
                                        onClick={() =>
                                            setPage(
                                                current + 1
                                            )
                                        }
                                        aria-label="Next page"
                                    >
                                        ›
                                    </button>

                                </div>
                            )}

                        </footer>
                    </>
                )}

            </section>

            {/* =================================================
                DIALOG
                EXISTING POPUP STRUCTURE PRESERVED
            ================================================= */}

            <dialog
                className={`mv-dialog ${modal?.type === "create" ? "mv-dialog-create" : ["select", "view-existing"].includes(modal?.type) ? "mv-dialog-select" : ""}`}
                ref={dialog}
                aria-labelledby="mv-dialog-title"
                onCancel={(e) => {
                    e.preventDefault();
                    close();
                }}
            >

                <div className="merchant-vendors">

                    <header className="mv-header">

                        <div>

                            <h2 id="mv-dialog-title">
                                {modal?.type === "create" ? "Add New Vendor" : modal?.type === "select"
                                    ? "Add Existing Vendor"
                                    : modal?.type === "view-existing"
                                    ? `Vendor Details — ${modal.vendor?.name || "Vendor"}`
                                    : modal?.type === "remove"
                                    ? "Remove vendor assignment"
                                    : "Vendor Details"}
                            </h2>

                            <p>
                                {modal?.type === "create" ? "Create a vendor and connect it to this merchant." : modal?.type === "select"
                                    ? `Choose one or more vendors to add to this ${entityName}.`
                                    : modal?.type === "view-existing"
                                    ? "Read-only master vendor details."
                                    : modal?.type === "remove"
                                    ? "The vendor remains available in Master Data."
                                    : "Read-only master vendor details."}
                            </p>

                        </div>

                        <button
                            type="button"
                            aria-label="Close"
                            disabled={busy}
                            onClick={close}
                        >
                            ×
                        </button>

                    </header>

                    {/* =================================================
                        SELECT VENDOR POPUP
                    ================================================= */}

                    {modal?.type === "create" ? (
                        <Vendors formOnly onCreate={createAndAssignVendor} onCancel={close} />
                    ) : modal?.type === "select" ? (
                        <div className="mv-picker-body">

                            {masterLoading && (
                                <p role="status">
                                    Loading master vendors…
                                </p>
                            )}

                            {masterError && (
                                <p
                                    role="alert"
                                    className="mv-error"
                                >
                                    {masterError}
                                </p>
                            )}

                            <input
                                className="mv-search"
                                autoFocus
                                aria-label="Search master vendors"
                                placeholder="Search any vendor field: name, code, contact, product, location…"
                                value={search}
                                disabled={
                                    busy ||
                                    masterLoading
                                }
                                onChange={(e) => { setSearch(e.target.value); setPickerPage(1); }}
                            />

                            <div className="mv-location-filters"><select aria-label="Filter by country" value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setStateFilter(""); setPickerPage(1); }}><option value="">All countries</option>{countries.map(country => <option key={locationKey(country)} value={locationKey(country)}>{country}</option>)}</select><select aria-label="Filter by state" value={stateFilter} onChange={e => { setStateFilter(e.target.value); setPickerPage(1); }}><option value="">All states</option>{states.map(state => <option key={locationKey(state)} value={locationKey(state)}>{state}</option>)}</select><button type="button" onClick={() => { setSearch(""); setCountryFilter(""); setStateFilter(""); setPickerPage(1); }}>Clear filters</button></div>
                            <div className="mv-picker-summary"><span>{available.length} matching vendors · {selection.length} selected</span></div>
                            <div className="mv-scroll mv-options">

                                <table>

                                    <thead>
                                        {headings(true)}
                                    </thead>

                                    <tbody>

                                        {pickerRows.map(
                                            (vendor) => (
                                                <tr
                                                    key={
                                                        vendor.id
                                                    }
                                                >

                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            aria-label={`Select ${vendor.name}`}
                                                            disabled={
                                                                busy ||
                                                                !active(
                                                                    vendor
                                                                )
                                                            }
                                                            checked={selection.includes(
                                                                vendor.id
                                                            )}
                                                            onChange={(
                                                                e
                                                            ) =>
                                                                setSelection(
                                                                    (
                                                                        old
                                                                    ) =>
                                                                        e
                                                                            .target
                                                                            .checked
                                                                            ? [
                                                                                  ...old,
                                                                                  vendor.id,
                                                                              ]
                                                                            : old.filter(
                                                                                  (
                                                                                      id
                                                                                  ) =>
                                                                                      id !==
                                                                                      vendor.id
                                                                              )
                                                                )
                                                            }
                                                        />
                                                    </td>

                                                    <td>
                                                        {vendor.code}
                                                    </td>

                                                    <td>
                                                        {name(
                                                            vendor
                                                        )}
                                                    </td>

                                                    <td>
                                                        {
                                                            vendor.type
                                                        }
                                                    </td>

                                                    <td>
                                                        {displayValue(vendor.products)}
                                                    </td>

                                                    <td>
                                                        {vendor.phone ||
                                                            vendor.contact ||
                                                            "—"}
                                                    </td>

                                                </tr>
                                            )
                                        )}

                                        {!available.length && (
                                            <tr>
                                                <td colSpan={6}>
                                                    {storeScope ? "No unassigned vendors mapped to this merchant." : "No unassigned vendors found in master data."}
                                                </td>
                                            </tr>
                                        )}

                                    </tbody>

                                </table>

                            </div>
                            <nav className="mv-picker-pagination" aria-label="Existing vendor pages"><span>Showing {available.length ? (currentPickerPage - 1) * pickerPageSize + 1 : 0}–{Math.min(currentPickerPage * pickerPageSize, available.length)} of {available.length}</span><div className="mv-popup-actions"><button type="button" disabled={currentPickerPage === 1} onClick={() => setPickerPage(currentPickerPage - 1)}>Previous</button><span>Page {currentPickerPage} of {pickerPages}</span><button type="button" disabled={currentPickerPage === pickerPages} onClick={() => setPickerPage(currentPickerPage + 1)}>Next</button></div></nav>

                        </div>
                    ) : (
                        modal?.vendor && (
                            <dl className="mv-details">

                                {[
                                    ["Vendor Code", modal.vendor.code],
                                    ["Vendor Name", modal.vendor.name],
                                    ["Vendor Type", modal.vendor.type],
                                    ["Contact Person Name", modal.vendor.contactPerson || modal.vendor.contact],
                                    ["Phone Number", modal.vendor.phone],
                                    ["Email Address", modal.vendor.email],
                                    ["Products Supplied", modal.vendor.products],
                                    ["Address Line 1", modal.vendor.addressLine1],
                                    ["Address Line 2", modal.vendor.addressLine2],
                                    ["City", modal.vendor.city],
                                    ["State", modal.vendor.state],
                                    ["ZIP Code", modal.vendor.zipCode],
                                    ["Country", modal.vendor.country],
                                    ["Status", modal.vendor.status],
                                    ["Assigned Stores", modal.vendor.assignedStoreCount],
                                    ["Created At", modal.vendor.createdTime],
                                    ["Updated At", modal.vendor.updatedTime],
                                ].map(
                                    ([label, value]) => (
                                        <div key={label}>

                                            <dt>
                                                {label}
                                            </dt>

                                            <dd>
                                                {displayValue(value)}
                                            </dd>

                                        </div>
                                    )
                                )}

                            </dl>
                        )
                    )}

                    {/* =================================================
                        ERROR
                    ================================================= */}

                    {saveError && (
                        <p
                            role="alert"
                            className="mv-error"
                        >
                            {saveError}
                        </p>
                    )}

                    {/* =================================================
                        POPUP FOOTER
                    ================================================= */}

                    {modal?.type !== "create" && <footer className="mv-footer">

                        <span>
                            {modal?.type === "select"
                                ? `${selection.length} vendors selected`
                                : ""}
                        </span>

                        <div className="mv-popup-actions">

                            <button
                                type="button"
                                disabled={busy}
                                onClick={modal?.type === "view-existing" ? () => setModal({ type: "select" }) : close}
                            >
                                {modal?.type === "view-existing"
                                    ? "Back to list"
                                    : modal?.type === "view"
                                    ? "Close"
                                    : "Cancel"}
                            </button>

                            {modal?.type === "select" && (
                                <button
                                    type="button"
                                    className="mv-primary"
                                    disabled={
                                        busy ||
                                        !selection.length
                                    }
                                    onClick={() =>
                                        save([
                                            ...new Set([
                                                ...ids,
                                                ...selection.filter(
                                                    (id) =>
                                                        vendors.some(
                                                            (
                                                                vendor
                                                            ) =>
                                                                vendor.id ===
                                                                    id &&
                                                                active(
                                                                    vendor
                                                                )
                                                        )
                                                ),
                                            ]),
                                        ])
                                    }
                                >
                                    {busy
                                        ? "Saving…"
                                        : "Add Selected"}
                                </button>
                            )}

                            {modal?.type === "remove" && (
                                <button
                                    type="button"
                                    className="mv-primary"
                                    disabled={busy}
                                    onClick={() =>
                                        save(
                                            ids.filter(
                                                (id) =>
                                                    id !==
                                                    modal
                                                        .vendor
                                                        .id
                                            )
                                        )
                                    }
                                >
                                    {busy
                                        ? "Saving…"
                                        : "Remove Assignment"}
                                </button>
                            )}

                        </div>

                    </footer>}

                </div>

            </dialog>

        </div>
    );
}
