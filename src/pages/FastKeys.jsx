
import { useEffect, useMemo, useState } from "react";
import Pagination from "../components/Pagination";

const initialFastKeys = [
  {
    id: 1,
    title: "dairy",
    image: "🛒",
    products: [
      "Pizza",
      "Product #44854",
      "Product #43225",
      "Kitkat King Size",
      "Camel Crush",
    ],
    employeeId: "sumana@gmail.com",
    date: "2026/02/11",
    time: "4:14 pm",
    status: "Published",
  },
  {
    id: 2,
    title: "New",
    image: "",
    products: [
      "Kush Kube Apple Berry 15mg 2pk",
      "Mikes Black Cherry 11.2oz 6pk Bottle",
    ],
    employeeId: "employee2@gmail.com",
    date: "2026/06/03",
    time: "10:49 pm",
    status: "Published",
  },
  {
    id: 3,
    title: "Daily Needs",
    image: "🛍️",
    products: [
      "BD Almond Breeze Milk Unsweetened Vanilla 96oz",
      "G&G Whole Milk 1/2 Gallon",
      "Nestle Carnation Evaporated Milk 5Oz",
      "GV Whole Milk 1/2 Gallon",
    ],
    employeeId: "employee3@gmail.com",
    date: "2026/05/05",
    time: "3:03 pm",
    status: "Published",
  },
  {
    id: 4,
    title: "jean",
    image: "🍷",
    products: [
      "Clear Lighter",
      "Camel Blue",
      "Camel 99 Red",
    ],
    employeeId: "employee4@gmail.com",
    date: "2026/03/05",
    time: "2:31 pm",
    status: "Published",
  },
];

const emptyForm = {
  title: "",
  employeeId: "",
  products: "",
  image: "",
};

export default function FastKeys() {
  const [items, setItems] = useState(initialFastKeys);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [imagePreview, setImagePreview] = useState("");

  // Filter fast keys
  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesTab =
        tab === "all" || item.status === "Published";

      const searchText = `
        ${item.title}
        ${item.employeeId}
        ${item.products.join(" ")}
      `.toLowerCase();

      const matchesSearch = searchText.includes(
        search.toLowerCase()
      );

      return matchesTab && matchesSearch;
    });
  }, [items, search, tab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const pageItems = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, tab]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const publishedCount = items.filter(
    (item) => item.status === "Published"
  ).length;

  // Open Add / Edit popup
  const openForm = (item = null) => {
    setEditing(item);

    if (item) {
      setForm({
        title: item.title,
        employeeId: item.employeeId,
        products: item.products.join("\n"),
        image: item.image || "",
      });

      setImagePreview(item.image || "");
    } else {
      setForm({ ...emptyForm });
      setImagePreview("");
    }

    setFormOpen(true);
  };

  // Close Add / Edit popup
  const closeForm = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setImagePreview("");
    setFormOpen(false);
  };

  // Handle text input changes
  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  // Handle local image upload
  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }

    const imageUrl = URL.createObjectURL(file);

    setImagePreview(imageUrl);

    setForm((current) => ({
      ...current,
      image: imageUrl,
    }));
  };

  // Remove uploaded image
  const removeImage = () => {
    setImagePreview("");

    setForm((current) => ({
      ...current,
      image: "",
    }));
  };

  // Save Add / Edit
  const save = (event) => {
    event.preventDefault();

    if (
      !form.title.trim() ||
      !form.employeeId.trim()
    ) {
      return;
    }

    const next = {
      id: editing?.id || Date.now(),

      title: form.title.trim(),

      image: form.image.trim(),

      products: form.products
        .split("\n")
        .map((product) => product.trim())
        .filter(Boolean),

      employeeId: form.employeeId.trim(),

      date:
        editing?.date ||
        new Date()
          .toISOString()
          .slice(0, 10)
          .replaceAll("-", "/"),

      time: editing?.time || "—",

      status: "Published",
    };

    if (editing) {
      setItems((current) =>
        current.map((item) =>
          item.id === editing.id ? next : item
        )
      );
    } else {
      setItems((current) => [next, ...current]);
    }

    closeForm();
  };

  // Open delete confirmation
  const remove = (item) => {
    setDeleteTarget(item);
  };

  // Cancel delete
  const cancelDelete = () => {
    setDeleteTarget(null);
  };

  // Confirm delete
  const confirmDelete = () => {
    if (!deleteTarget) return;

    setItems((current) =>
      current.filter(
        (item) => item.id !== deleteTarget.id
      )
    );

    setDeleteTarget(null);
  };

  // Check whether image is a real image URL
  const isImageUrl = (value) => {
    return (
      typeof value === "string" &&
      (
        value.startsWith("blob:") ||
        value.startsWith("data:image/") ||
        value.startsWith("http://") ||
        value.startsWith("https://")
      )
    );
  };

  return (
    <div className="fast-keys-panel">

      {/* ================= HEADER ================= */}

      <div className="fast-keys-heading">
        <div>
          <h2>Fast Keys</h2>

          <p>
            Manage fast keys for this store.
            Fast keys allow quick access to products in POS.
          </p>
        </div>

        <button
          type="button"
          className="store-config-btn"
          onClick={() => openForm()}
        >
          <i className="bi bi-plus-lg" />
          Add New Fast Key
        </button>
      </div>

      {/* ================= TABS ================= */}

      <div className="fast-key-tabs">
        <button
          type="button"
          className={tab === "all" ? "active" : ""}
          onClick={() => setTab("all")}
        >
          All ({items.length})
        </button>

        <button
          type="button"
          className={tab === "published" ? "active" : ""}
          onClick={() => setTab("published")}
        >
          Published ({publishedCount})
        </button>
      </div>

      {/* ================= TOOLBAR ================= */}

      <div className="fast-key-toolbar">
        <input
          type="text"
          placeholder="Search fast keys..."
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />

        <button
          type="button"
          className="store-edit-btn"
          onClick={() => setSearch("")}
        >
          <i className="bi bi-arrow-counterclockwise" />
          Reset
        </button>
      </div>

      {/* ================= TABLE ================= */}

      <div className="fast-key-table-wrap">
        <table className="fast-key-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Title</th>
              <th>Products</th>
              <th>Created By (Email ID)</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {pageItems.map((item) => (
              <tr key={item.id}>

                {/* Image */}
                <td>
                  <div className="fast-key-image">
                    {isImageUrl(item.image) ? (
                      <img
                        src={item.image}
                        alt={item.title}
                      />
                    ) : (
                      item.image || (
                        <i className="bi bi-image" />
                      )
                    )}
                  </div>
                </td>

                {/* Title */}
                <td>
                  <strong>{item.title}</strong>
                </td>

                {/* Products */}
                <td>
                  <div className="fast-key-products">
                    {item.products
                      .slice(0, 3)
                      .map((product, index) => (
                        <span
                          key={`${item.id}-${index}`}
                        >
                          {product} - sl_number: {index + 1}
                        </span>
                      ))}

                    {item.products.length > 3 && (
                      <b>
                        +{item.products.length - 3} more
                      </b>
                    )}
                  </div>
                </td>

                {/* Created By Email */}
                <td>{item.employeeId}</td>

                {/* Date */}
                <td>
                  {item.date}
                  <br />
                  {item.time}
                </td>

                {/* Status */}
                <td>
                  <span className="fast-key-status">
                    {item.status}
                  </span>
                </td>

                {/* Actions */}
                <td>
                  <div className="fast-key-actions">

                    {/* Edit */}
                    <button
                      type="button"
                      className="edit-button"
                      aria-label={`Edit ${item.title}`}
                      onClick={() => openForm(item)}
                    >
                      <i className="bi bi-pencil" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      aria-label={`Delete ${item.title}`}
                      className="delete-button"
                      onClick={() => remove(item)}
                    >
                      <i className="bi bi-trash" />
                    </button>

                  </div>
                </td>

              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="fast-key-empty">
            No fast keys found.
          </div>
        )}
      </div>

      {/* ================= FOOTER ================= */}

      <div className="fast-key-footer">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={itemsPerPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={(pageSize) => {
            setItemsPerPage(pageSize);
            setCurrentPage(1);
          }}
          itemLabel="fast keys"
          showWhenEmpty
        />
      </div>

      {/* ================= ADD / EDIT POPUP ================= */}

      {formOpen && (
        <div className="fast-key-modal-backdrop">

          <form
            className="fast-key-modal"
            onSubmit={save}
          >

            {/* Modal Header */}
            <div className="fast-key-modal-header">
              <div>
                <h2>
                  {editing
                    ? "Edit Fast Key"
                    : "Add New Fast Key"}
                </h2>

                <p>
                  {editing
                    ? "Update the fast key details."
                    : "Add a fast key to this store."}
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={closeForm}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="fast-key-modal-body">

              <div className="fast-key-form-grid">

                {/* Fast Key Name */}
                <label className="fast-key-field">
                  <span className="fast-key-label">
                    Fast Key Name <em>*</em>
                  </span>

                  <input
                    type="text"
                    name="title"
                    required
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Enter fast key name"
                  />
                </label>

                {/* Created By Email ID */}
                <label className="fast-key-field">
                  <span className="fast-key-label">
                    Created By (Email ID) <em>*</em>
                  </span>

                  <input
                    type="email"
                    name="employeeId"
                    required
                    value={form.employeeId}
                    onChange={handleChange}
                    placeholder="Enter employee email ID"
                  />
                </label>

                {/* Image / Emoji */}
                <label className="fast-key-field">
                  <span className="fast-key-label">
                    Image / Emoji
                  </span>

                  {/* Local image upload */}
                  <input
                    type="file"
                    accept="image/*"
                    className="fast-key-file-input"
                    onChange={handleImageUpload}
                  />

                  {/* Image Preview */}
                  {imagePreview && (
                    <div className="fast-key-image-preview">
                      {isImageUrl(imagePreview) ? (
                        <img
                          src={imagePreview}
                          alt="Fast key preview"
                        />
                      ) : (
                        imagePreview
                      )}

                      <button
                        type="button"
                        className="remove-image-btn"
                        onClick={removeImage}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </label>

                {/* Products */}
                <label className="fast-key-field">
                  <span className="fast-key-label">
                    Products{" "}
                    <small>(one per line)</small>
                  </span>

                  <textarea
                    name="products"
                    rows="4"
                    value={form.products}
                    onChange={handleChange}
                    placeholder={`Pizza
Product #44854
Product #43225`}
                  />
                </label>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="fast-key-modal-footer">

              <button
                type="button"
                className="store-edit-btn"
                onClick={closeForm}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="store-config-btn"
              >
                <i className="bi bi-plus-lg" />

                {editing
                  ? "Save Changes"
                  : "Save Fast Key"}
              </button>

            </div>

          </form>
        </div>
      )}

      
{/* ================= DELETE CONFIRMATION ================= */}

<DeleteConfirmationDialog
  isOpen={Boolean(deleteTarget)}
  title="Delete Fast Key?"
  message={
    deleteTarget
      ? `Are you sure you want to delete "${deleteTarget.title}"?`
      : ""
  }
  cancelLabel="Cancel"
  confirmLabel="Delete"
  busyLabel="Deleting..."
  iconClassName="bi bi-trash3"
  onCancel={cancelDelete}
  onConfirm={confirmDelete}
/>
    </div>
  );
}
