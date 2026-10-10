import { useEffect, useMemo, useState, } from "react";
import Pagination from "../components/Pagination";
import { useLocationOptions } from "../data/useLocationOptions";
import { getVendors, createVendor, updateVendor, deleteVendor as deleteVendorApi, } from "../api/vendors";

const emptyForm = {
  code: "",
  name: "",
  vendorType: "Supplier",
  contactPerson: "",
  phone: "",
  email: "",
  category: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zipCode: "",
  country: "",
  status: "Active",
};

/*
|--------------------------------------------------------------------------
| VENDOR TYPE HELPERS
|--------------------------------------------------------------------------
*/

function getVendorTypeLabel(vendorType) {
  const type = String(
    vendorType || ""
  ).toUpperCase();

  if (
    type === "ORGANIZER" ||
    type === "ORGANIZATION"
  ) {
    return "Organizer";
  }

  if (
    type === "SUPPLIER" ||
    type === "INDIVIDUAL"
  ) {
    return "Supplier";
  }

  return vendorType || "—";
}

function getVendorTypeApiValue(
  vendorType
) {
  return vendorType === "Organizer"
    ? "ORGANIZER"
    : "SUPPLIER";
}

function normalizeVendorType(
  vendorType
) {
  const type = String(
    vendorType || ""
  ).toUpperCase();

  if (
    type === "ORGANIZER" ||
    type === "ORGANIZATION"
  ) {
    return "Organizer";
  }

  return "Supplier";
}

function generateNextVendorCode(vendorsList = []) {
  let maxNum = 0;
  (Array.isArray(vendorsList) ? vendorsList : []).forEach((v) => {
    const code = String(v.code || v.vendorCode || "");
    const match = code.match(/VND[_\-]?(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!Number.isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  const nextNum = maxNum + 1;
  return `VND_${String(nextNum).padStart(5, "0")}`;
}

/*
|--------------------------------------------------------------------------
| TABLE VALUE HELPER
|--------------------------------------------------------------------------
*/

function VendorCell({ value, strong = false }) {
  const displayValue =
    value === null || value === undefined || value === ""
      ? "—"
      : String(value);

  return strong ? (
    <strong className="vendors-cell-value">
      {displayValue}
    </strong>
  ) : (
    <span className="vendors-cell-value">
      {displayValue}
    </span>
  );
}

function formatAuditDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: String(value),
      time: "",
    };
  }

  return {
    date: date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function VendorAuditCell({ value }) {
  const formatted = formatAuditDate(value);

  if (!formatted) {
    return <span className="vendors-cell-value">—</span>;
  }

  return (
    <span className="vendors-audit-cell">
      <span className="vendors-audit-date">
        {formatted.date}
      </span>
      {formatted.time && (
        <span className="vendors-audit-time">
          {formatted.time}
        </span>
      )}
    </span>
  );
}

/*
|--------------------------------------------------------------------------
| COMPONENT
|--------------------------------------------------------------------------
*/

export default function Vendors({
  merchantId,
  storeId,
  store,
  embedded = false,
  formOnly = false,
  onCreate,
  onCancel,
}) {
  const [vendors, setVendors] =
    useState([]);

  const [form, setForm] =
    useState(emptyForm);
  const locationOptions = useLocationOptions(form);

  // Keeps the last saved values while editing so the Update button
  // remains disabled until the user actually changes a field.
  const [originalForm, setOriginalForm] =
    useState(emptyForm);

  const [editingId, setEditingId] =
    useState(null);

  // Read-only vendor view mode.
  const [viewingId, setViewingId] =
    useState(null);

  const [deleteTarget, setDeleteTarget] =
    useState(null);

  const [search, setSearch] =
    useState("");

  const [currentPage, setCurrentPage] =
    useState(1);

  const [rowsPerPage, setRowsPerPage] = useState(10);

  function handlePageSizeChange(size) {
  setRowsPerPage(size);
  setCurrentPage(1);
}

  const [statusFilter, setStatusFilter] =
    useState("All Statuses");

  const [
    vendorTypeFilter,
    setVendorTypeFilter,
  ] = useState("All Vendor Types");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [error, setError] =
    useState("");

  const nextVendorCode = useMemo(
    () => generateNextVendorCode(vendors),
    [vendors]
  );

  /*
  |--------------------------------------------------------------------------
  | LOAD VENDORS
  |--------------------------------------------------------------------------
  */

  async function loadVendors(overrideStatusFilter) {
    try {
      setLoading(true);
      setError("");

      const activeStatus = overrideStatusFilter ?? statusFilter;

      let resultList = [];

      if (activeStatus === "Inactive") {
        resultList = await getVendors({ is_deleted: true });
      } else if (activeStatus === "Active") {
        resultList = await getVendors();
      } else {
        // "All Statuses": Fetch both active vendors and inactive/deleted vendors
        const [activeList, inactiveList] = await Promise.all([
          getVendors().catch(() => []),
          getVendors({ is_deleted: true }).catch(() => []),
        ]);

        const map = new Map();
        (Array.isArray(activeList) ? activeList : []).forEach((v) => {
          if (v && v.id) map.set(String(v.id), v);
        });
        (Array.isArray(inactiveList) ? inactiveList : []).forEach((v) => {
          if (v && v.id) map.set(String(v.id), v);
        });

        resultList = Array.from(map.values());
      }

      setVendors(
        Array.isArray(resultList)
          ? resultList
          : []
      );
    } catch (err) {
      console.error(
        "Failed to load vendors:",
        err
      );

      setError(
        err?.message ||
          "Failed to load vendors."
      );

      setVendors([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVendors();
  }, [statusFilter]);

  /*
  |--------------------------------------------------------------------------
  | FILTER VENDORS
  |--------------------------------------------------------------------------
  */

  const filteredVendors =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return vendors.filter(
        (vendor) => {
          const searchableText = [
            vendor.name,
            vendor.code,
            vendor.vendorType,
            getVendorTypeLabel(
              vendor.vendorType
            ),
            vendor.contactPerson,
            vendor.phone,
            vendor.email,
            vendor.category,
            vendor.addressLine1,
            vendor.addressLine2,
            vendor.city,
            vendor.state,
            vendor.zipCode,
            vendor.country,
            vendor.status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !query ||
            searchableText.includes(
              query
            );

          const matchesStatus =
            statusFilter ===
              "All Statuses" ||
            vendor.status ===
              statusFilter ||
            (statusFilter === "Inactive" &&
              (vendor.status === "Inactive" ||
                vendor.is_deleted === true ||
                vendor.is_deleted === "true" ||
                vendor.isDeleted === true ||
                vendor.isDeleted === "true" ||
                Boolean(vendor.deletedAt)));

          const matchesVendorType =
            vendorTypeFilter ===
              "All Vendor Types" ||
            getVendorTypeLabel(
              vendor.vendorType
            ) ===
              vendorTypeFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesVendorType
          );
        }
      );
    }, [
      vendors,
      search,
      statusFilter,
      vendorTypeFilter,
    ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredVendors.length / rowsPerPage),
  );
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const displayedVendors = filteredVendors.slice(
    startIndex,
    startIndex + rowsPerPage,
  );

  function handleFilterChange(setter, value) {
    setter(value);
    setCurrentPage(1);
  }

  /*
  |--------------------------------------------------------------------------
  | FORM CHANGE
  |--------------------------------------------------------------------------
  */

  function handleChange(event) {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => {
      const updated = {
        ...current,
        [name]: value,
      };
      if (name === "country") updated.state = "";

      /*
      |--------------------------------------------------------------------------
      | PHONE NUMBER
      |--------------------------------------------------------------------------
      | Only numbers
      | Maximum 10 digits
      |--------------------------------------------------------------------------
      */

      if (name === "phone") {
        updated.phone = value
          .replace(/\D/g, "")
          .slice(0, 10);
      }

      /*
      |--------------------------------------------------------------------------
      | SUPPLIER
      |--------------------------------------------------------------------------
      | Supplier does not need Contact Person
      |--------------------------------------------------------------------------
      */

      if (
        name === "vendorType" &&
        value === "Supplier"
      ) {
        updated.contactPerson = "";
      }

      return updated;
    });
  }

  /*
  |--------------------------------------------------------------------------
  | RESET FORM
  |--------------------------------------------------------------------------
  */

  function resetForm() {
    setForm({
      ...emptyForm,
    });

    setEditingId(null);
    setViewingId(null);
    setOriginalForm({
      ...emptyForm,
    });
    setError("");
  }

  /*
  |--------------------------------------------------------------------------
  | BUILD API PAYLOAD
  |--------------------------------------------------------------------------
  */

  function buildPayload() {
    return {
      code:
        editingId !== null
          ? form.code
          : nextVendorCode,

      vendorName:
        form.name.trim(),

      vendorType:
        getVendorTypeApiValue(
          form.vendorType
        ),

      contactPerson:
        form.vendorType ===
        "Organizer"
          ? form.contactPerson.trim()
          : "",

      phone:
        form.phone.trim(),

      email:
        form.email.trim(),

      productCategory:
        form.category.trim(),

      addressLine1:
        form.addressLine1.trim(),

      addressLine2:
        form.addressLine2.trim(),

      city:
        form.city.trim(),

      state:
        form.state.trim(),

      zipCode:
        form.zipCode.trim(),

      country:
        form.country.trim(),

      status:
        editingId !== null
          ? form.status
          : "Active",
    };
  }

  /*
  |--------------------------------------------------------------------------
  | FORM COMPLETION
  |--------------------------------------------------------------------------
  | Keep the primary action disabled until all required data is entered.
  |--------------------------------------------------------------------------
  */

  const isFormComplete =
    Boolean(
      form.name.trim() &&
      form.vendorType &&
      form.phone.trim() &&
      form.email.trim() &&
      form.category.trim() &&
      form.addressLine1.trim() &&
      form.city.trim() &&
      form.state.trim() &&
      form.zipCode.trim() &&
      form.country.trim() &&
      (form.vendorType !== "Organizer" ||
        form.contactPerson.trim())
    ) &&
    /^\d{10}$/.test(form.phone.trim()) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      form.email.trim()
    );

  const isEditDirty =
    editingId !== null &&
    Object.keys(emptyForm).some(
      (field) =>
        String(form[field] ?? "") !==
        String(originalForm[field] ?? "")
    );

  /*
  |--------------------------------------------------------------------------
  | SAVE VENDOR
  |--------------------------------------------------------------------------
  */

  async function saveVendor(event) {
    event.preventDefault();

    setError("");

    /*
    |--------------------------------------------------------------------------
    | BASIC REQUIRED VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
      !form.name.trim() ||
      !form.vendorType ||
      !form.phone.trim() ||
      !form.email.trim() ||
      !form.category.trim() ||
      !form.addressLine1.trim() ||
      !form.city.trim() ||
      !form.state.trim() ||
      !form.zipCode.trim() ||
      !form.country.trim()
    ) {
      setError(
        "Please fill all mandatory fields. Address Line 2 is optional."
      );

      return;
    }


    /*
    |--------------------------------------------------------------------------
    | ORGANIZER CONTACT PERSON VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
      form.vendorType ===
        "Organizer" &&
      !form.contactPerson.trim()
    ) {
      setError(
        "Contact Person Name is required for an Organizer."
      );

      return;
    }

    /*
    |--------------------------------------------------------------------------
    | PHONE REQUIRED
    |--------------------------------------------------------------------------
    */

    if (!form.phone.trim()) {
      setError(
        "Phone Number is required."
      );

      return;
    }

    /*
    |--------------------------------------------------------------------------
    | PHONE 10 DIGIT VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
      !/^\d{10}$/.test(
        form.phone
      )
    ) {
      setError(
        "Phone Number must contain exactly 10 digits."
      );

      return;
    }

    /*
    |--------------------------------------------------------------------------
    | EMAIL REQUIRED
    |--------------------------------------------------------------------------
    */

    if (!form.email.trim()) {
      setError(
        "Email is required."
      );

      return;
    }

    /*
    |--------------------------------------------------------------------------
    | EMAIL FORMAT VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email.trim()
      )
    ) {
      setError(
        "Please enter a valid email address."
      );

      return;
    }

    /*
    |--------------------------------------------------------------------------
    | SAVE
    |--------------------------------------------------------------------------
    */

    try {
      setSaving(true);

      const payload =
        buildPayload();

      /*
      |--------------------------------------------------------------------------
      | UPDATE
      |--------------------------------------------------------------------------
      */

      if (
        editingId !== null
      ) {
        const updatedVendor =
          await updateVendor(
            editingId,
            payload
          );

        setVendors(
          (current) =>
            current.map(
              (vendor) =>
                String(
                  vendor.id
                ) ===
                String(
                  editingId
                )
                  ? updatedVendor
                  : vendor
            )
        );
      }

      /*
      |--------------------------------------------------------------------------
      | CREATE
      |--------------------------------------------------------------------------
      */

      else {
        const newVendor =
          await (onCreate || createVendor)(payload);

        setVendors(
          (current) => [
            newVendor,
            ...current,
          ]
        );
      }

      resetForm();
    } catch (err) {
      console.error(
        "Failed to save vendor:",
        err
      );

      setError(
        err?.message ||
          "Failed to save vendor."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | VIEW VENDOR
  |--------------------------------------------------------------------------
  | Populate the same form in read-only mode.
  */

  function viewVendor(
    vendor
  ) {
    const viewForm = {
      code: vendor.code || "",
      name: vendor.name || "",
      vendorType: normalizeVendorType(
        vendor.vendorType
      ),
      contactPerson: vendor.contactPerson || "",
      phone: vendor.phone || "",
      email: vendor.email || "",
      category: vendor.category || "",
      addressLine1: vendor.addressLine1 || "",
      addressLine2: vendor.addressLine2 || "",
      city: vendor.city || "",
      state: vendor.state || "",
      zipCode: vendor.zipCode || "",
      country: vendor.country || "",
      status: vendor.status || "Active",
    };

    setViewingId(vendor.id);
    setEditingId(null);
    setForm(viewForm);
    setOriginalForm(viewForm);
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | EDIT VENDOR
  |--------------------------------------------------------------------------
  */

  function editVendor(
    vendor
  ) {
    const editForm = {
      code:
        vendor.code || "",

      name:
        vendor.name || "",

      vendorType:
        normalizeVendorType(
          vendor.vendorType
        ),

      contactPerson:
        vendor.contactPerson ||
        "",

      phone:
        vendor.phone || "",

      email:
        vendor.email || "",

      category:
        vendor.category || "",

      addressLine1:
        vendor.addressLine1 ||
        "",

      addressLine2:
        vendor.addressLine2 ||
        "",

      city:
        vendor.city || "",

      state:
        vendor.state ||
        "",

      zipCode:
        vendor.zipCode ||
        "",

      country:
        vendor.country ||
        "",

      status:
        vendor.status ||
        "Active",
    };

    setEditingId(
      vendor.id
    );
    setViewingId(null);

    setForm(editForm);
    setOriginalForm(editForm);
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | OPEN DELETE POPUP
  |--------------------------------------------------------------------------
  */

  function confirmDelete(
    vendor
  ) {
    setDeleteTarget(
      vendor
    );

    setError("");
  }

  /*
  |--------------------------------------------------------------------------
  | DELETE VENDOR
  |--------------------------------------------------------------------------
  */

  async function handleDeleteVendor() {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleting(true);
      setError("");

      await deleteVendorApi(
        deleteTarget.id
      );

      setVendors(
        (current) =>
          current.filter(
            (vendor) =>
              String(
                vendor.id
              ) !==
              String(
                deleteTarget.id
              )
          )
      );

      setDeleteTarget(
        null
      );
    } catch (err) {
      console.error(
        "Failed to delete vendor:",
        err
      );

      setError(
        err?.message ||
          "Failed to delete vendor."
      );
    } finally {
      setDeleting(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | CLEAR FILTERS
  |--------------------------------------------------------------------------
  */

  function clearFilters() {
    setSearch("");
    setCurrentPage(1);

    setStatusFilter(
      "All Statuses"
    );

    setVendorTypeFilter(
      "All Vendor Types"
    );
  }



  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  const vendorForm = (
      <form
        className={`vendors-form ${
          viewingId !== null
            ? "vendors-form-view-mode"
            : ""
        }`}
        onSubmit={saveVendor}
        autoComplete="off"
      >

        <div className="vendors-form-heading">

          <div className="vendors-heading-content">

            <div className="vendors-heading-icon">
              <i
                className={
                  viewingId !== null
                    ? "bi bi-lock-fill"
                    : "bi bi-truck"
                }
              />
            </div>

            <div>
              <h2>
                {viewingId !== null
                  ? `View Vendor - ${form.name || "Vendor"}`
                  : editingId !== null
                  ? "Edit Vendor"
                  : "Add Vendor"}
              </h2>

              <p>
                {viewingId !== null
                  ? "View vendor and business details. Editing is disabled."
                  : "Enter the vendor details."}
              </p>
            </div>

          </div>

        </div>

        {/* ===================================================
            FORM FIELDS
        =================================================== */}

        <div className="vendors-form-grid">
          {/* =================================================
              VENDOR CODE
          ================================================= */}

          <label>
            <span>
              Vendor Code
            </span>

            <input
              data-field="code"
              value={form.code}
              readOnly
              disabled
              autoComplete="off"
              placeholder="Auto Generated"
              class="vendor-placeholder "
            />

          </label>

          {/* =================================================
              VENDOR NAME
          ================================================= */}

          <label>
            <span>
              Vendor Name <b>*</b>
            </span>

            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter vendor name"
              autoComplete="off"
              required
              disabled={saving || viewingId !== null}
            />

          </label>

          {/* =================================================
              VENDOR TYPE
          ================================================= */}

          <label>
            <span>
              Vendor Type <b>*</b>
            </span>

            <select
              name="vendorType"
              value={
                form.vendorType
              }
              onChange={handleChange}
              required
              disabled={saving || viewingId !== null}
            >
              <option value="Supplier">
                Supplier
              </option>

              <option value="Organizer">
                Organizer
              </option>
            </select>

          </label>

          {/* =================================================
              CONTACT PERSON
          ================================================= */}

          {form.vendorType ===
            "Organizer" && (
            <label>
              <span>
                Contact Person Name{" "}
                <b>*</b>
              </span>

              <input
                type="text"
                name="contactPerson"
                value={
                  form.contactPerson
                }
                onChange={
                  handleChange
                }
                placeholder="Enter contact person name"
                autoComplete="off"
                required
                disabled={saving || viewingId !== null}
              />

            </label>
          )}

          {/* =================================================
              PHONE
          ================================================= */}

          <label>
            <span>
              Phone Number <b>*</b>
            </span>

            <input
              type="tel"
              name="phone"
              placeholder="Enter phone number"
              value={form.phone}
              onChange={handleChange}
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              autoComplete="off"
              required
              disabled={saving || viewingId !== null}
              aria-invalid={
                Boolean(form.phone) &&
                !/^\d{10}$/.test(form.phone)
              }
            />

            {form.phone && !/^\d{10}$/.test(form.phone) ? (
              <small className="vendors-field-error">
              </small>
            ) : null}
          </label>

          {/* =================================================
              EMAIL
          ================================================= */}

          <label>
            <span>
              Email Address <b>*</b>
            </span>

            <input
              type="email"
              name="email"
              placeholder="Enter email address"
              value={form.email}
              onChange={handleChange}
              autoComplete="off"
              required
              disabled={saving || viewingId !== null}
              aria-invalid={
                Boolean(form.email) &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                  form.email.trim()
                )
              }
            />

            {form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? (
              <small className="vendors-field-error">
              </small>
            ) : null}
          </label>

          {/* =================================================
              PRODUCT / CATEGORY
          ================================================= */}

          <label>
            <span>
              Products Supplied <b>*</b>
            </span>

            <input
              type="text"
              name="category"
              value={
                form.category
              }
              onChange={handleChange}
              placeholder="Enter products or product categories"
              autoComplete="off"
              required
              disabled={saving || viewingId !== null}
            />

          </label>

          {/* =================================================
              ADDRESS LINE 1
          ================================================= */}

          <label>
            <span>
              Address Line 1 <b>*</b>
            </span>

            <input
              type="text"
              name="addressLine1"
              value={
                form.addressLine1
              }
              onChange={handleChange}
              placeholder="Enter street address"
              autoComplete="off"
              required
              disabled={saving || viewingId !== null}
            />

          </label>

          {/* =================================================
              ADDRESS LINE 2
          ================================================= */}

          <label>
            <span>
              Address Line 2 (Optional)
            </span>

            <input
              type="text"
              name="addressLine2"
              value={
                form.addressLine2
              }
              onChange={handleChange}
              placeholder="Apartment, suite, unit"
              autoComplete="off"
              disabled={saving || viewingId !== null}
            />

          </label>

          {/* =================================================
              CITY
          ================================================= */}

          <label>
            <span>
              City <b>*</b>
            </span>

            <input
              type="text"
              name="city"
              value={form.city}
              onChange={handleChange}
              placeholder="Enter city"
              autoComplete="off"
              required
              disabled={saving || viewingId !== null}
            />

          </label>

          {/* =================================================
              STATE
          ================================================= */}

          <label>
            <span>
              State <b>*</b>
            </span>

            <select
              name="state"
              value={form.state}
              onChange={handleChange}
              required
              disabled={saving || viewingId !== null}
            >
              <option value="">{form.country ? "Select state or province" : "Select country first"}</option>
              {locationOptions.states.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>

          </label>

          {/* =================================================
              ZIP CODE
          ================================================= */}

          <label>
            <span>
              ZIP Code <b>*</b>
            </span>

            <input
              type="text"
              name="zipCode"
              value={
                form.zipCode
              }
              onChange={handleChange}
              placeholder="Enter ZIP code"
              autoComplete="off"
              required
              disabled={saving || viewingId !== null}
            />

          </label>

          {/* =================================================
              COUNTRY
          ================================================= */}

          <label>
            <span>
              Country <b>*</b>
            </span>

            <select
              name="country"
              value={form.country}
              onChange={handleChange}
              required
              disabled={saving || viewingId !== null}
            >
              <option value="">Select country</option>
              {locationOptions.countries.map((country) => <option key={country} value={country}>{country}</option>)}
            </select>

          </label>

          {/* =================================================
              STATUS
          ================================================= */}

          {(editingId !== null ||
            viewingId !== null) && (
            <label>
              <span>
                Status <b>*</b>
              </span>

              <select
                name="status"
                className={`vendors-status-select ${
                  String(form.status || "active").toLowerCase()
                }`}
                value={
                  form.status
                }
                onChange={handleChange}
                required
                disabled={saving || viewingId !== null}
              >
                <option value="Active">
                  Active
                </option>

                <option value="Inactive">
                  Inactive
                </option>
              </select>

            </label>
          )}

        </div>

        {/* ===================================================
            FORM ACTIONS
        =================================================== */}

        <div className="vendors-form-actions">

          <button
            type="button"
            className="vendors-clear-button"
            onClick={onCancel || resetForm}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="vendors-save-button"
            disabled={
              saving ||
              viewingId !== null ||
              !isFormComplete ||
              (editingId !== null && !isEditDirty)
            }
          >
            {saving ? (
              <>
                <i className="bi bi-arrow-repeat vendors-loading-icon" />

                {editingId !== null
                  ? "Saving..."
                  : "Creating..."}
              </>
            ) : (
              <>
                {editingId !== null
                  ? "Save Changes"
                  : "Create Vendor"}
              </>
            )}
          </button>

        </div>

      </form>
  );

  if (formOnly) return <section className="vendors-page">{error && <div className="vendors-error" role="alert">{error}</div>}{vendorForm}</section>;

  return (
    <section className="vendors-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="vendors-header">
        <div>
          <h1>
            Vendors
          </h1>

          <p>
            Manage vendor details and contact information.
          </p>
        </div>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="vendors-error">
          <i className="bi bi-exclamation-circle" />

          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            aria-label="Close error"
          >
            <i className="bi bi-x" />
          </button>
        </div>
      )}

      {/* =====================================================
          VENDOR FORM
      ===================================================== */}

      {vendorForm}

      {/* =====================================================
          VENDORS LIST
      ===================================================== */}

      <div className="vendors-list-card">

        <div className="vendors-list-toolbar">

          <div>
            <h2>
              Vendors List
            </h2>

            <p>
              {filteredVendors.length}{" "}
              vendor
              {filteredVendors.length ===
              1
                ? ""
                : "s"}{" "}
              found
            </p>
          </div>

          <div className="vendors-filters">
  {/* SEARCH */}
  <div className="vendors-search">
    <i className="bi bi-search" />
    <input
      type="text"
      value={search}
      onChange={(event) => handleFilterChange(setSearch, event.target.value)}
      placeholder="Search vendors..."
      autoComplete="off"
      data-lpignore="true"
      data-1p-ignore="true"
    />
  </div>

  {/* Vendor Type */}
  <select
    value={vendorTypeFilter}
    onChange={(event) => handleFilterChange(setVendorTypeFilter, event.target.value)}
  >
    <option>All Vendor Types</option>
    <option value="Supplier">Supplier</option>
    <option value="Organizer">Organizer</option>
  </select>

  {/* Status */}
  <select
    value={statusFilter}
    onChange={(event) => handleFilterChange(setStatusFilter, event.target.value)}
  >
    <option>All Statuses</option>
    <option value="Active">Active</option>
    <option value="Inactive">Inactive</option>
  </select>

  {/* Reset Icon */}
  <button
    type="button"
    className="vendors-reset-button"
    onClick={clearFilters}
    title="Reset filters"
    aria-label="Reset filters"
  >
    <i className="bi bi-arrow-counterclockwise" />
  </button>
</div>

        </div>

        {/* ===================================================
            TABLE
        =================================================== */}

        <div className="vendors-table-wrap">
          <div className="vendors-table-scroll">

          <table className="vendors-table">

            <thead>
              <tr>

                <th>
                  Vendor Code
                </th>

                <th>
                  Vendor Name
                </th>

                <th>
                  Address
                </th>

                <th>
                  Vendor Type
                </th>

                <th>
                  Contact Person
                </th>

                <th>
                  Phone Number
                </th>

                <th>
                  Email Address
                </th>

                <th>
                  Products Supplied
                </th>

                <th>
                  Status
                </th>

                <th>
                  Created At
                </th>

                <th>
                  Updated At
                </th>

                <th>
                  Actions
                </th>

              </tr>
            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td
                    colSpan="12"
                    className="vendors-loading-cell"
                  >
                    <i className="bi bi-arrow-repeat vendors-loading-icon" />

                    Loading vendors...
                  </td>
                </tr>
              ) : (
                displayedVendors.map(
                  (vendor) => (
                    <tr
                      key={vendor.id}
                      tabIndex={saving || deleting ? -1 : 0}
                      aria-label={`View ${vendor.name}`}
                      style={{ cursor: saving || deleting ? undefined : "pointer" }}
                      onClick={(event) => {
                        if (event.target.closest('button, a, input, select, textarea, label, [role="button"], [contenteditable="true"]')) {
                          event.stopPropagation();
                          return;
                        }
                        if (!saving && !deleting) viewVendor(vendor);
                      }}
                      onKeyDown={(event) => {
                        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ") && !saving && !deleting) {
                          event.preventDefault();
                          viewVendor(vendor);
                        }
                      }}
                    >
                      {/* CODE */}

                      <td>
                        <VendorCell
                          value={vendor.code}
                          strong
                        />
                      </td>

                      {/* NAME */}

                      <td>
                        <VendorCell
                          value={vendor.name}
                          strong
                        />
                      </td>

                      {/* ADDRESS */}

                      <td>
                        <VendorCell
                          value={vendor.addressLine1}
                        />
                      </td>

                      {/* TYPE */}

                      <td>
                        <span
                          className={`vendors-type ${
                            String(
                              vendor.vendorType ||
                                ""
                            ).toLowerCase()
                          }`}
                        >
                          {getVendorTypeLabel(
                            vendor.vendorType
                          )}
                        </span>
                      </td>

                      {/* CONTACT PERSON */}

                      <td>
                        <VendorCell
                          value={
                            getVendorTypeLabel(
                              vendor.vendorType
                            ) === "Organizer"
                              ? vendor.contactPerson
                              : "—"
                          }
                        />
                      </td>

                      {/* PHONE */}

                      <td>
                        <VendorCell
                          value={vendor.phone}
                        />
                      </td>

                      {/* EMAIL */}

                      <td>
                        <VendorCell
                          value={vendor.email}
                        />
                      </td>

                      {/* CATEGORY */}

                      <td>
                        <VendorCell
                          value={vendor.category}
                        />
                      </td>

                      {/* STATUS */}

                     <td>
                           <span className={`vendors-status ${
                             String(vendor.status || "").toLowerCase() }`} >
                             <i className="bi bi-circle-fill" />
                              {vendor.status || "—"}
                                  </span>
                     </td>

                      {/* CREATED TIME */}

                      <td>
                        <VendorAuditCell
                          value={vendor.createdTime}
                        />
                      </td>

                      {/* UPDATED TIME */}

                      <td>
                        <VendorAuditCell
                          value={vendor.updatedTime}
                        />
                      </td>

                      {/* ACTIONS */}

                      <td className="vendors-actions">

                        {/* VIEW */}

                        <button
                          type="button"
                          className="vendors-view-action"
                          onClick={() =>
                            viewVendor(
                              vendor
                            )
                          }
                          aria-label={`View ${vendor.name}`}
                          title="View"
                          disabled={
                            saving ||
                            deleting
                          }
                        >
                          <i className="bi bi-eye" />
                        </button>

                        {/* EDIT */}

                        <button
                          type="button"
                          onClick={() =>
                            editVendor(
                              vendor
                            )
                          }
                          aria-label={`Edit ${vendor.name}`}
                          title="Edit Vendor"
                          disabled={
                            saving ||
                            deleting
                          }
                        >
                          <i className="bi bi-pencil" />
                        </button>

                        {/* DELETE */}

                        <button
                          type="button"
                          className="vendors-delete-action"
                          onClick={() =>
                            confirmDelete(
                              vendor
                            )
                          }
                          aria-label={`Delete ${vendor.name}`}
                          title="Delete Vendor"
                          disabled={
                            saving ||
                            deleting
                          }
                        >
                          <i className="bi bi-trash" />
                        </button>

                      </td>

                    </tr>
                  )
                )
              )}

            </tbody>

          </table>

          {/* =================================================
              EMPTY STATE
          ================================================= */}

          {!loading &&
            filteredVendors.length ===
              0 && (
              <div className="vendors-empty">

                <i className="bi bi-truck" />

                <h3>
                  No vendors found
                </h3>

                <p>
                  Try changing your
                  search or filters.
                </p>

                <button
                  type="button"
                  onClick={
                    clearFilters
                  }
                >
                  Clear Filters
                </button>

              </div>
            )}

          </div>
        </div>

        <Pagination
  currentPage={safePage}
  totalPages={totalPages}
  totalItems={filteredVendors.length}
  pageSize={rowsPerPage}
  onPageChange={setCurrentPage}
  onPageSizeChange={handlePageSizeChange}
  itemLabel="vendors"
  showWhenEmpty={true} 
/>

      </div>

      {/* =====================================================
          DELETE CONFIRMATION POPUP
      ===================================================== */}

      {deleteTarget && (
        <div
          className="vendors-delete-backdrop"
          onClick={() =>
            !deleting &&
            setDeleteTarget(
              null
            )
          }
        >

          <div
            className="vendors-delete-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* DELETE ICON */}

            <div className="vendors-delete-icon">
              <i className="bi bi-exclamation-triangle" />
            </div>

            {/* TITLE */}

            <h2>
              Delete Vendor?
            </h2>

            {/* MESSAGE */}

            <p>
              Are you sure you want
              to delete{" "}
              <strong>
                {deleteTarget.name}
              </strong>
              ?
            </p>

            <p className="vendors-delete-warning">
              This action cannot be undone.
            </p>

            {/* ACTIONS */}

            <div className="vendors-delete-actions">

              <button
                type="button"
                className="vendors-delete-cancel"
                onClick={() =>
                  setDeleteTarget(
                    null
                  )
                }
                disabled={deleting}
              >
                No, Keep It
              </button>

              <button
                type="button"
                className="vendors-delete-confirm"
                onClick={
                  handleDeleteVendor
                }
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <i className="bi bi-arrow-repeat vendors-loading-icon" />

                    Deleting...
                  </>
                ) : (
                  <>
                    Yes, Delete
                  </>
                )}
              </button>

            </div>

          </div>

        </div>
      )}

    </section>
  );
}
