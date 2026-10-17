import { pendingStoreRead } from "../api/http";
import { useEffect, useRef, useState } from "react";
import DeleteConfirmationDialog from "../components/DeleteConfirmationDialog";
import FiltersBar from "../components/FiltersBar";
import ListActions from "../components/ListActions";
import Pagination from "../components/Pagination";
import "../styles/merchant-vendors.css";
import Vendors from "./Vendors";
import { listMerchantStores } from "../api/stores";

import {
    getMappedMerchantVendors,
    getAvailableMerchantVendors,
    addMerchantVendors,
    createVendor,
    unmapMerchantVendor,
    getMappedStoreVendors,
    getVendors,
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
    onNavigationChange,
    navigationBackRef,
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

    async function loadMappedVendors(searchValue = "", { preserveIdsWhenEmpty = false } = {}) {
        if (!mappingId) {
            setIds([]);
            return;
        }

        setMappedLoading(true);
        setMappedError("");

        try {
            const mapped = storeScope
                ? await pendingStoreRead(`store-vendors:${mappingId}:${searchValue}`, () => getMappedStoreVendors(mappingId, { search: searchValue }))
                : await pendingStoreRead(`merchant-vendors:${mappingId}:${searchValue}`, () => getMappedMerchantVendors(mappingId, { search: searchValue }));
            // Store mapping responses can contain only vendor IDs. Load the
            // vendor records as well so the assigned rows show their details
            // on the first visit to a store's Vendors section.
            const storeVendorDetails = storeScope
                ? await getVendors().catch(() => [])
                : [];
            let assignedStoreCounts = new Map();
            if (storeScope && merchantId) {
                const merchantStores = await listMerchantStores(merchantId).catch(() => []);
                const storeIds = [...new Set([
                    mappingId,
                    ...merchantStores.map(store => store.value),
                ].filter(Boolean).map(String))];
                const storeAssignments = await Promise.all(storeIds.map(async storeId => {
                    try {
                        const vendorsForStore = await pendingStoreRead(
                            `store-vendors:${storeId}:`,
                            () => getMappedStoreVendors(storeId),
                        );
                        return vendorsForStore.map(idOf);
                    } catch {
                        return [];
                    }
                }));
                assignedStoreCounts = new Map();
                storeAssignments.forEach(vendorIds => vendorIds.forEach(vendorId => {
                    if (vendorId) assignedStoreCounts.set(vendorId, (assignedStoreCounts.get(vendorId) || 0) + 1);
                }));
            }

            const mappedIds = mapped.map(idOf);

            setMasterVendors((current) => {
                const byId = new Map(
                    [...current, ...storeVendorDetails].map((vendor) => [idOf(vendor), vendor])
                );

                mapped.forEach((vendor) => {
                    const id = idOf(vendor);
                    if (!id) return;
                    const details = byId.get(id) || {};
                    // Keep full merchant vendor details when the store mapping
                    // endpoint returns only IDs and mapping metadata.
                    byId.set(id, {
                        ...vendor,
                        ...details,
                        id,
                        vendorId: id,
                        mappingId: vendor.mappingId || details.mappingId || "",
                        ...(storeScope ? { assignedStoreCount: assignedStoreCounts.get(id) ?? details.assignedStoreCount ?? vendor.assignedStoreCount ?? 0 } : {}),
                    });
                });

                return Array.from(byId.values());
            });

            if (!preserveIdsWhenEmpty || mappedIds.length) setIds(mappedIds);
            setPage(1);
            return mapped;
        } catch (e) {
            console.error(
                `Failed to load mapped ${entityName} vendors:`,
                e
            );

            setMappedError(
                e?.message ||
                    "Unable to load mapped vendors."
            );
            return null;
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
    if (
        modal &&
        modal.type !== "create" &&
        modal.type !== "remove"
    ) {
        if (!dialog.current?.open) {
            dialog.current?.showModal();
        }
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
        Math.ceil(rows.length / pageSize)
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
            let latestMappedIds = ids;
            if (storeScope) {
                const latestMappings = await getMappedStoreVendors(mappingId);
                latestMappedIds = latestMappings.map(idOf);
                setIds(latestMappedIds);
                setMasterVendors((current) => {
                    const byId = new Map(current.map((vendor) => [idOf(vendor), vendor]));
                    latestMappings.forEach((vendor) => byId.set(idOf(vendor), vendor));
                    return Array.from(byId.values());
                });
            }
            const vendors = storeScope
                ? (await getMappedMerchantVendors(merchantId)).filter(vendor => !latestMappedIds.includes(idOf(vendor)))
                : await getAvailableMerchantVendors(mappingId);

            setMasterVendors((current) => {
                const byId = new Map(current.map((vendor) => [idOf(vendor), vendor]));
                (Array.isArray(vendors) ? vendors : []).forEach((vendor) => {
                    const id = idOf(vendor);
                    if (id) byId.set(id, { ...byId.get(id), ...vendor });
                });
                return Array.from(byId.values()).filter((vendor) => idOf(vendor));
            });

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

    if (navigationBackRef) navigationBackRef.current = close;
    useEffect(() => {
        onNavigationChange?.(modal?.type === "create" || modal?.type === "select" ? modal.type : null);
    }, [modal, onNavigationChange]);

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
                if (storeScope) await unmapStoreVendor(modal.vendor.mappingId, { storeId: mappingId, vendorId: modal.vendor.id });
                else await unmapMerchantVendor(mappingId, modal.vendor.id);
                if (storeScope) setIds((current) => current.filter((id) => id !== modal.vendor.id));
            } else if (modal?.type === "select") {
                if (!addedIds.length) {
                    throw new Error(
                        "At least one vendor must be selected."
                    );
                }

                if (storeScope) {
                    let latestIds = ids;
                    try {
                        latestIds = (await getMappedStoreVendors(mappingId)).map(idOf);
                    } catch {
                        // Continue with the latest IDs already loaded in the screen.
                    }
                    const idsToAdd = addedIds.filter((id) => !latestIds.includes(id));
                    if (idsToAdd.length) {
                        try {
                            await addStoreVendors(mappingId, idsToAdd);
                        } catch (error) {
                            const message = String(error?.message || "").toLowerCase();
                            if (!/(already|duplicate|exists|mapped)/.test(message)) throw error;
                        }
                    }
                    const assignedIds = [...new Set([...latestIds, ...addedIds])];
                    setIds(assignedIds);
                    setMasterVendors((current) => {
                        const byId = new Map(current.map((vendor) => [idOf(vendor), vendor]));
                        addedIds.forEach((id) => {
                            const selectedVendor = vendors.find((vendor) => vendor.id === id);
                            if (selectedVendor) byId.set(id, selectedVendor);
                        });
                        return Array.from(byId.values());
                    });
                } else {
                    await addMerchantVendors(mappingId, addedIds);
                }
            }

            await loadMappedVendors("", { preserveIdsWhenEmpty: storeScope });

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
                          ...(!storeScope ? ["assignedStoreCount"] : []),
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
                <button type="button" className="store-config-back-button" disabled={busy} onClick={close}>← Back to Vendors</button>
            </header>
            <div className="mv-create-content"><Vendors formOnly onCreate={createAndAssignVendor} onCancel={close} /></div>
        </section>
    );

    if (modal?.type === "select") return (
        <section className="merchant-vendors mv-create-page mv-existing-page">
            <header className="mv-card mv-header">
                <div>
                    <h2 className="mv-existing-title"> Add Existing Vendor</h2>
                    <p>Choose one or more vendors to add to this {entityName}.</p>
                </div>
                <button type="button" className="store-config-back-button" disabled={busy} onClick={close}>← Back to Vendors</button>
            </header>

            <div className="mv-existing-content">
                {masterLoading && <p role="status">Loading master vendors…</p>}
                {masterError && <p role="alert" className="mv-error">{masterError}</p>}

                <FiltersBar
                    className="mv-existing-toolbar"
                    searchValue={search}
                    onSearchChange={value => { setSearch(value); setPickerPage(1); }}
                    searchPlaceholder="Search vendors by name, code, contact or product"
                    searchAriaLabel="Search master vendors"
                    searchDisabled={busy || masterLoading}
                    filters={[
                        { key: "country", label: "Filter by country", value: countryFilter, disabled: busy || masterLoading, options: [{ value: "", label: "All countries" }, ...countries.map(country => ({ value: locationKey(country), label: country }))], onChange: value => { setCountryFilter(value); setStateFilter(""); setPickerPage(1); } },
                        { key: "state", label: "Filter by state", value: stateFilter, disabled: busy || masterLoading, options: [{ value: "", label: "All states" }, ...states.map(state => ({ value: locationKey(state), label: state }))], onChange: value => { setStateFilter(value); setPickerPage(1); } },
                    ]}
                    onClear={() => { setSearch(""); setCountryFilter(""); setStateFilter(""); setPickerPage(1); }}
                />

                <div className="mv-picker-summary">
                    <span></span>
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
                    itemLabel="vendors"
                    showWhenEmpty={true}
                />
                {saveError && <p role="alert" className="mv-error">{saveError}</p>}
            </div>

            <footer className="mv-existing-footer">
                <span></span>
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
            {storeScope && (
                <header className="mv-card mv-header">
                    <div>
                        <h2>Vendors</h2>
                        <p>These are the vendors connected to this {entityName}.</p>
                    </div>
                    <div className="mv-popup-actions">
                        <button ref={addButton} type="button" className="mv-primary"
                            disabled={loading || !!error || masterLoading || !mappingId}
                            onClick={openAddVendorModal}>
                            <i className="bi bi-plus-lg" aria-hidden="true" />
                            Add Existing Vendor
                        </button>
                    </div>
                </header>
            )}
            <section className={`mv-card${storeScope ? "" : " mv-list-card"}`}>
                {storeScope ? <h3>Vendor List</h3> : (
                    <header className="mv-header">
                        <div>
                            <h2>Vendor List</h2>
                            <p>These are the vendors connected to this {entityName}.</p>
                        </div>
                        <div className="mv-list-actions">
                            <button ref={addButton} type="button" className="mv-secondary"
                                disabled={loading || !!error || masterLoading || !mappingId}
                                onClick={openAddVendorModal}>
                                <i className="bi bi-plus-lg" aria-hidden="true" />
                                {masterLoading ? "Loading Vendors\u2026" : "Add Existing Vendor"}
                            </button>
                            <button type="button" className="mv-primary" disabled={!mappingId || busy}
                                onClick={() => {
                                    pendingNewVendor.current = null;
                                    setSaveError("");
                                    setModal({ type: "create" });
                                }}>
                                <i className="bi bi-plus-lg" aria-hidden="true" /> Add New Vendor
                            </button>
                        </div>
                    </header>
                )}
                {storeScope ? (
                    <div className="mv-toolbar">
                        <input aria-label="Search assigned vendors"
                            placeholder="Search vendors by code, name, type or phone…"
                            value={query}
                            onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
                        <button type="button" onClick={() => {
                            setQuery("");
                            setPage(1);
                            setSort({ key: "name", direction: 1 });
                        }}>
                            <i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Clear
                        </button>
                    </div>
                ) : (
                    <FiltersBar
                        searchValue={query}
                        onSearchChange={(value) => { setQuery(value); setPage(1); }}
                        searchPlaceholder={"Search vendors by code, name, type or phone\u2026"}
                        onClear={() => {
                            setQuery("");
                            setPage(1);
                            setSort({ key: "name", direction: 1 });
                        }}
                    />
                )}

                {(loading || mappedLoading) && !rows.length ? (
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
                                            (current - 1) * pageSize,
                                            current * pageSize
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

                                                {!storeScope && (
                                                    <td>
                                                        {vendor.assignedStoreCount}
                                                    </td>
                                                )}

                                                <td>
                                                    {badge(vendor)}
                                                </td>

                                                {/* =================================================
                                                    ACTIONS
                                                ================================================= */}

                                                <td>
                                                    <ListActions
                                                        onView={() => setModal({ type: "view", vendor })}
                                                        viewLabel={`View ${vendor.name}`}
                                                        onDelete={() => {
                                                            setSaveError("");
                                                            setModal({ type: "remove", vendor });
                                                        }}
                                                        deleteLabel={`Remove ${vendor.name} assignment`}
                                                    />
                                                </td>

                                            </tr>
                                        ))}

                                    {!rows.length && (
                                        <tr>
                                            <td colSpan={storeScope ? 7 : 8}>
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

                        {storeScope ? (
                            <footer className="mv-footer">
                                <span>
                                    Showing {rows.length ? (current - 1) * pageSize + 1 : 0} to {Math.min(current * pageSize, rows.length)} of {rows.length} entries
                                </span>
                                <div className="mv-pagination">
                                    <button type="button" className="pagination-arrow" disabled={current === 1}
                                        onClick={() => setPage(current - 1)} aria-label="Previous page">
                                        <i className="bi bi-chevron-left" aria-hidden="true" />
                                    </button>
                                    <div className="pagination-pages">
                                        <button type="button" className="pagination-page active" aria-current="page" onClick={() => setPage(current)}>
                                            {current}
                                        </button>
                                    </div>
                                    <button type="button" className="pagination-arrow" disabled={current === pages}
                                        onClick={() => setPage(current + 1)} aria-label="Next page">
                                        <i className="bi bi-chevron-right" aria-hidden="true" />
                                    </button>
                                </div>
                            </footer>
                        ) : (
                            <Pagination
                                currentPage={current}
                                totalPages={pages}
                                totalItems={rows.length}
                                pageSize={pageSize}
                                onPageChange={setPage}
                                onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                                itemLabel="vendors"
                                showWhenEmpty={true}
                            />
                        )}

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

                            <div className="mv-location-filters"><select aria-label="Filter by country" value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setStateFilter(""); setPickerPage(1); }}><option value="">All countries</option>{countries.map(country => <option key={locationKey(country)} value={locationKey(country)}>{country}</option>)}</select><select aria-label="Filter by state" value={stateFilter} onChange={e => { setStateFilter(e.target.value); setPickerPage(1); }}><option value="">All states</option>{states.map(state => <option key={locationKey(state)} value={locationKey(state)}>{state}</option>)}</select><button type="button" onClick={() => { setSearch(""); setCountryFilter(""); setStateFilter(""); setPickerPage(1); }}><i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Clear</button></div>
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
                            <Pagination currentPage={currentPickerPage} totalPages={pickerPages} totalItems={available.length} pageSize={pickerPageSize} onPageChange={setPickerPage} onPageSizeChange={(size) => { setPickerPageSize(size); setPickerPage(1); }} itemLabel="vendors" showWhenEmpty />

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

                        </div>

                    </footer>}

                </div>

            </dialog>


<DeleteConfirmationDialog
    isOpen={modal?.type === "remove"}
    title="Remove Vendor Assignment?"
    message={`Are you sure you want to remove ${
        modal?.vendor?.name || "this vendor"
    } from this ${entityName}? The vendor will remain available in Master Data.`}
    cancelLabel="Cancel"
    confirmLabel="Remove"
    busyLabel="Removing..."
    busy={busy}
    error={saveError}
    iconClassName="bi bi-trash3"
    onCancel={close}
    onConfirm={() =>
        save(
            ids.filter(
                (id) => id !== modal?.vendor?.id
            )
        )
    }
/>


        </div>
    );
}
