import { useCallback, useEffect, useMemo, useState } from "react";
import Pagination from "../components/Pagination";
import ViewDetailsModal from "../components/ViewDetailsModal";
import {
  getStoreCatalogTaxonomies,
  syncWordpressAttributes,
  syncWordpressTags,
} from "../api/storeConnector";
import "../styles/store-categories.css";


/* =========================================================
   TABS
========================================================= */

const tabs = [
  {
    id: "categories",
    label: "Categories",
    icon: "bi-folder",
  },
  {
    id: "tags",
    label: "Tags",
    icon: "bi-tags",
  },
  {
    id: "attributes",
    label: "Attributes",
    icon: "bi-sliders",
  },
];


export default function StoreCategories({
  merchantId,
  storeId,
  store,
  embedded = false,
}) {

  /* =======================================================
     TAB
  ======================================================= */

  const [activeTab, setActiveTab] =
    useState("categories");


  /* =======================================================
     SEARCH
  ======================================================= */

  const [search, setSearch] =
    useState("");


  /* =======================================================
     VIEW DETAILS
  ======================================================= */

  const [selectedItem, setSelectedItem] =
    useState(null);


  const [selectedItemType, setSelectedItemType] =
    useState("");


  /* =======================================================
     CATEGORY PAGINATION
  ======================================================= */

  const [categoryPage, setCategoryPage] =
    useState(1);

  const [categoryPageSize, setCategoryPageSize] =
    useState(10);


  /* =======================================================
     TAG PAGINATION
  ======================================================= */

  const [tagPage, setTagPage] =
    useState(1);

  const [tagPageSize, setTagPageSize] =
    useState(10);


  /* =======================================================
     ATTRIBUTE PAGINATION
  ======================================================= */

  const [attributePage, setAttributePage] =
    useState(1);

  const [attributePageSize, setAttributePageSize] =
    useState(10);

  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(Boolean(storeId));
  const [taxonomyError, setTaxonomyError] = useState("");
  const [taxonomySyncing, setTaxonomySyncing] = useState(false);
  const [taxonomySyncMessage, setTaxonomySyncMessage] = useState("");

  const applyTaxonomies = useCallback((response) => {
    const data = response?.taxonomies || response?.data?.taxonomies || response?.data || response || {};
    const categoryRows = Array.isArray(data.categories) ? data.categories : [];
    const categoryNames = new Map(categoryRows.map((item) => [String(item.id), item.name || ""]));

    setCategories(categoryRows.map((item) => ({
      ...item,
      id: item.id ?? item.wordpressId ?? item.wordpress_id ?? item.slug ?? item.name,
      name: item.name || item.title || "Unnamed category",
      slug: item.slug || "—",
      parent: categoryNames.get(String(item.parent)) || item.parent_name || item.parent?.name || "",
      productCount: Number(item.productCount ?? item.product_count ?? item.count ?? 0),
      status: item.status || "Active",
    })));
    setTags((Array.isArray(data.tags) ? data.tags : []).map((item) => ({
      ...item,
      id: item.id ?? item.wordpressId ?? item.wordpress_id ?? item.slug ?? item.name,
      name: item.name || item.title || "Unnamed tag",
      slug: item.slug || "—",
      productCount: Number(item.productCount ?? item.product_count ?? item.count ?? 0),
      status: item.status || "Active",
    })));
    setAttributes((Array.isArray(data.attributes) ? data.attributes : []).map((item) => ({
      ...item,
      id: item.id ?? item.wordpressId ?? item.wordpress_id ?? item.slug ?? item.name,
      name: item.name || item.title || "Unnamed attribute",
      slug: item.slug || "—",
      productCount: Number(item.productCount ?? item.product_count ?? item.count ?? 0),
      terms: Array.isArray(item.terms) ? item.terms.map((term) => typeof term === "object" ? term.name || term.slug : String(term)) : [],
      status: item.status || "Active",
    })));
  }, []);

  const refreshTaxonomies = useCallback(async (signal) => {
    const response = await getStoreCatalogTaxonomies(storeId, { signal });
    applyTaxonomies(response);
    return response;
  }, [applyTaxonomies, storeId]);

  useEffect(() => {
    if (!storeId) {
      setCategories([]);
      setTags([]);
      setAttributes([]);
      setTaxonomyLoading(false);
      setTaxonomyError("Select a store to view its catalog data.");
      return undefined;
    }

    const controller = new AbortController();
    setTaxonomyLoading(true);
    setTaxonomyError("");
    refreshTaxonomies(controller.signal)
      .catch((error) => {
        if (error?.name !== "AbortError") {
          setTaxonomyError(error?.message || "Could not load this store’s categories, tags, and attributes.");
          setCategories([]);
          setTags([]);
          setAttributes([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setTaxonomyLoading(false);
      });

    return () => controller.abort();
  }, [refreshTaxonomies, storeId]);

  const handleSyncTaxonomies = async () => {
    if (!storeId || taxonomySyncing) return;
    setTaxonomySyncing(true);
    setTaxonomyError("");
    setTaxonomySyncMessage("");
    try {
      const tagResult = await syncWordpressTags(storeId);
      const attributeResult = await syncWordpressAttributes(storeId);
      await refreshTaxonomies();
      setTaxonomySyncMessage(
        `Synced ${Number(tagResult?.tagCount ?? 0)} tags and ${Number(attributeResult?.attributeCount ?? 0)} attributes from WooCommerce.`,
      );
    } catch (error) {
      setTaxonomyError(error?.message || "Could not sync tags and attributes from WooCommerce.");
    } finally {
      setTaxonomySyncing(false);
    }
  };


  /* =========================================================
     FILTER CATEGORIES
  ========================================================= */

  const filteredCategories = useMemo(() => {

    const value =
      search.trim().toLowerCase();

    if (!value) {
      return categories;
    }

    return categories.filter(
      (item) =>
        [
          item.name,
          item.slug,
          item.parent,
          item.status,
        ].some((field) =>
          String(field || "")
            .toLowerCase()
            .includes(value)
        )
    );

  }, [categories, search]);


  /* =========================================================
     FILTER TAGS
  ========================================================= */

  const filteredTags = useMemo(() => {

    const value =
      search.trim().toLowerCase();

    if (!value) {
      return tags;
    }

    return tags.filter(
      (item) =>
        [
          item.name,
          item.slug,
          item.status,
        ].some((field) =>
          String(field || "")
            .toLowerCase()
            .includes(value)
        )
    );

  }, [search, tags]);


  /* =========================================================
     FILTER ATTRIBUTES
  ========================================================= */

  const filteredAttributes = useMemo(() => {

    const value =
      search.trim().toLowerCase();

    if (!value) {
      return attributes;
    }

    return attributes.filter(
      (item) =>
        [
          item.name,
          item.slug,
          item.status,
        ].some((field) =>
          String(field || "")
            .toLowerCase()
            .includes(value)
        )
    );

  }, [attributes, search]);


  /* =========================================================
     TOTAL PAGES
  ========================================================= */

  const categoryTotalPages =
    Math.ceil(
      filteredCategories.length /
        categoryPageSize
    );

  const tagTotalPages =
    Math.ceil(
      filteredTags.length /
        tagPageSize
    );

  const attributeTotalPages =
    Math.ceil(
      filteredAttributes.length /
        attributePageSize
    );


  /* =========================================================
     VISIBLE CATEGORIES
  ========================================================= */

  const visibleCategories =
    filteredCategories.slice(
      (categoryPage - 1) *
        categoryPageSize,
      categoryPage *
        categoryPageSize
    );


  /* =========================================================
     VISIBLE TAGS
  ========================================================= */

  const visibleTags =
    filteredTags.slice(
      (tagPage - 1) *
        tagPageSize,
      tagPage *
        tagPageSize
    );


  /* =========================================================
     VISIBLE ATTRIBUTES
  ========================================================= */

  const visibleAttributes =
    filteredAttributes.slice(
      (attributePage - 1) *
        attributePageSize,
      attributePage *
        attributePageSize
    );


  /* =========================================================
     TAB CHANGE
  ========================================================= */

  const handleTabChange = (tab) => {

    setActiveTab(tab);

    setSearch("");

    setSelectedItem(null);
    setSelectedItemType("");

    setCategoryPage(1);
    setTagPage(1);
    setAttributePage(1);
  };


  /* =========================================================
     SEARCH CHANGE
  ========================================================= */

  const handleSearchChange = (
    event
  ) => {

    setSearch(
      event.target.value
    );

    setCategoryPage(1);
    setTagPage(1);
    setAttributePage(1);
  };


  /* =========================================================
     OPEN VIEW MODAL
  ========================================================= */

  const openView = (
    item,
    type
  ) => {

    setSelectedItem(item);
    setSelectedItemType(type);
  };


  /* =========================================================
     CLOSE VIEW MODAL
  ========================================================= */

  const closeView = () => {

    setSelectedItem(null);
    setSelectedItemType("");
  };


  /* =========================================================
     CATEGORY VIEW FIELDS
  ========================================================= */

  const categoryDetailsFields = [
    {
      label: "Category Name",
      key: "name",
      fullWidth: true,
    },

    {
      label: "Category ID",
      key: "id",
    },

    {
      label: "Slug",
      key: "slug",
    },

    {
      label: "Parent Category",
      key: "parent",
    },

    {
      label: "Products",
      key: "productCount",
    },

    {
      label: "Status",
      key: "status",

      render: (value) => (
        <span
          className={`detail-status ${
            String(value || "Active")
              .toLowerCase()
              .replace(/\s+/g, "-")
          }`}
        >
          {value || "Active"}
        </span>
      ),
    },

    {
      label: "Description",
      key: "description",
      fullWidth: true,
    },
  ];


  /* =========================================================
     TAG VIEW FIELDS
  ========================================================= */

  const tagDetailsFields = [
    {
      label: "Tag Name",
      key: "name",
      fullWidth: true,
    },

    {
      label: "Tag ID",
      key: "id",
    },

    {
      label: "Slug",
      key: "slug",
    },

    {
      label: "Products",
      key: "productCount",
    },

    {
      label: "Status",
      key: "status",

      render: (value) => (
        <span
          className={`detail-status ${
            String(value || "Active")
              .toLowerCase()
              .replace(/\s+/g, "-")
          }`}
        >
          {value || "Active"}
        </span>
      ),
    },
  ];


  /* =========================================================
     ATTRIBUTE VIEW FIELDS
  ========================================================= */

  const attributeDetailsFields = [
    {
      label: "Attribute Name",
      key: "name",
      fullWidth: true,
    },

    {
      label: "Attribute ID",
      key: "id",
    },

    {
      label: "Slug",
      key: "slug",
    },

    {
      label: "Products",
      key: "productCount",
    },

    {
      label: "Status",
      key: "status",

      render: (value) => (
        <span
          className={`detail-status ${
            String(value || "Active")
              .toLowerCase()
              .replace(/\s+/g, "-")
          }`}
        >
          {value || "Active"}
        </span>
      ),
    },

    {
      label: "Terms / Values",
      key: "terms",
      fullWidth: true,

      render: (terms) =>
        Array.isArray(terms) &&
        terms.length > 0 ? (
          <div className="view-details-list">
            {terms.map(
              (term) => (
                <div
                  key={term}
                  className="view-details-list-item"
                >
                  <strong>
                    {term}
                  </strong>
                </div>
              )
            )}
          </div>
        ) : (
          <span>—</span>
        ),
    },
  ];


  /* =========================================================
     SELECT MODAL FIELDS
  ========================================================= */

  const getModalFields = () => {

    if (
      selectedItemType ===
      "category"
    ) {
      return categoryDetailsFields;
    }

    if (
      selectedItemType ===
      "tag"
    ) {
      return tagDetailsFields;
    }

    return attributeDetailsFields;
  };


  /* =========================================================
     MODAL TITLE
  ========================================================= */

  const getModalTitle = () => {

    if (
      selectedItemType ===
      "category"
    ) {
      return "Category Details";
    }

    if (
      selectedItemType ===
      "tag"
    ) {
      return "Tag Details";
    }

    return "Attribute Details";
  };


  /* =========================================================
     RENDER CATEGORIES
  ========================================================= */

  const renderCategories = () => (

    <>

      <div className="categories-table-wrap">

        <table className="categories-table">

          <thead>

            <tr>

              <th>
                Category
              </th>

              <th>
                Slug
              </th>

              <th>
                Parent Category
              </th>

              <th>
                Products
              </th>

              <th>
                Status
              </th>

              <th>
                Action
              </th>

            </tr>

          </thead>


          <tbody>

            {visibleCategories.length >
            0 ? (

              visibleCategories.map(
                (item) => (

                  <tr
                    key={item.id}
                  >

                    <td>

                      <div className="category-name-cell">

                        <div className="category-icon">

                          <i className="bi bi-folder" />

                        </div>

                        <div>

                          <strong>
                            {item.name}
                          </strong>

                          {item.description ? (
                            <span>
                              {
                                item.description
                              }
                            </span>
                          ) : null}

                        </div>

                      </div>

                    </td>


                    <td>

                      <span className="slug-text">
                        {item.slug}
                      </span>

                    </td>


                    <td>
                      {item.parent ||
                        "—"}
                    </td>


                    <td>

                      <strong className="count-value">
                        {item.productCount ??
                          0}
                      </strong>

                    </td>


                    <td>

                      <span
                        className={`category-status ${
                          String(
                            item.status ||
                              ""
                          )
                            .toLowerCase()
                            .replace(
                              /\s+/g,
                              "-"
                            )
                        }`}
                      >
                        {
                          item.status ||
                          "Active"
                        }
                      </span>

                    </td>


                    <td>

                      <button
                        type="button"
                        className="table-action"
                        title="View Category"
                        onClick={() =>
                          openView(
                            item,
                            "category"
                          )
                        }
                      >
                        <i className="bi bi-eye" />
                      </button>

                    </td>

                  </tr>

                )
              )

            ) : (

              <tr>

                <td colSpan="6">

                  <div className="categories-empty-state">

                    <div className="categories-empty-icon">

                      <i className="bi bi-folder2-open" />

                    </div>

                    <h3>
                      No categories found
                    </h3>

                    <p>
                      No categories match your current search.
                    </p>

                  </div>

                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>


      <Pagination
        currentPage={
          categoryPage
        }
        totalPages={
          categoryTotalPages
        }
        totalItems={
          filteredCategories.length
        }
        pageSize={
          categoryPageSize
        }
        onPageChange={
          setCategoryPage
        }
        onPageSizeChange={(
          size
        ) => {

          setCategoryPageSize(
            size
          );

          setCategoryPage(
            1
          );

        }}
      />

    </>

  );


  /* =========================================================
     RENDER TAGS
  ========================================================= */

  const renderTags = () => (

    <>

      <div className="categories-table-wrap">

        <table className="categories-table">

          <thead>

            <tr>

              <th>
                Tag
              </th>

              <th>
                Slug
              </th>

              <th>
                Products
              </th>

              <th>
                Status
              </th>

              <th>
                Action
              </th>

            </tr>

          </thead>


          <tbody>

            {visibleTags.length >
            0 ? (

              visibleTags.map(
                (item) => (

                  <tr
                    key={item.id}
                  >

                    <td>

                      <div className="category-name-cell">

                        <div className="category-icon tag-icon">

                          <i className="bi bi-tag" />

                        </div>

                        <div>

                          <strong>
                            {item.name}
                          </strong>

                        </div>

                      </div>

                    </td>


                    <td>

                      <span className="slug-text">
                        {item.slug}
                      </span>

                    </td>


                    <td>

                      <strong className="count-value">
                        {item.productCount ??
                          0}
                      </strong>

                    </td>


                    <td>

                      <span
                        className={`category-status ${
                          String(
                            item.status ||
                              ""
                          )
                            .toLowerCase()
                            .replace(
                              /\s+/g,
                              "-"
                            )
                        }`}
                      >
                        {
                          item.status ||
                          "Active"
                        }
                      </span>

                    </td>


                    <td>

                      <button
                        type="button"
                        className="table-action"
                        title="View Tag"
                        onClick={() =>
                          openView(
                            item,
                            "tag"
                          )
                        }
                      >
                        <i className="bi bi-eye" />
                      </button>

                    </td>

                  </tr>

                )
              )

            ) : (

              <tr>

                <td colSpan="5">

                  <div className="categories-empty-state">

                    <div className="categories-empty-icon">

                      <i className="bi bi-tags" />

                    </div>

                    <h3>
                      No tags found
                    </h3>

                    <p>
                      No tags match your current search.
                    </p>

                  </div>

                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>


      <Pagination
        currentPage={
          tagPage
        }
        totalPages={
          tagTotalPages
        }
        totalItems={
          filteredTags.length
        }
        pageSize={
          tagPageSize
        }
        onPageChange={
          setTagPage
        }
        onPageSizeChange={(
          size
        ) => {

          setTagPageSize(
            size
          );

          setTagPage(
            1
          );

        }}
      />

    </>

  );


  /* =========================================================
     RENDER ATTRIBUTES
  ========================================================= */

  const renderAttributes = () => (

    <>

      <div className="categories-table-wrap">

        <table className="categories-table">

          <thead>

            <tr>

              <th>
                Attribute
              </th>

              <th>
                Slug
              </th>

              <th>
                Terms / Values
              </th>

              <th>
                Products
              </th>

              <th>
                Status
              </th>

              <th>
                Action
              </th>

            </tr>

          </thead>


          <tbody>

            {visibleAttributes.length >
            0 ? (

              visibleAttributes.map(
                (item) => (

                  <tr
                    key={item.id}
                  >

                    <td>

                      <div className="category-name-cell">

                        <div className="category-icon attribute-icon">

                          <i className="bi bi-sliders" />

                        </div>

                        <div>

                          <strong>
                            {item.name}
                          </strong>

                        </div>

                      </div>

                    </td>


                    <td>

                      <span className="slug-text">
                        {item.slug}
                      </span>

                    </td>


                    <td>

                      <div className="attribute-terms">

                        {item.terms?.length ? (

                          item.terms
                            .slice(
                              0,
                              3
                            )
                            .map(
                              (term) => (
                                <span
                                  key={
                                    term
                                  }
                                >
                                  {
                                    term
                                  }
                                </span>
                              )
                            )

                        ) : (

                          <span className="no-value">
                            —
                          </span>

                        )}


                        {item.terms?.length >
                        3 ? (

                          <span className="more-terms">
                            +
                            {item.terms.length -
                              3}
                          </span>

                        ) : null}

                      </div>

                    </td>


                    <td>

                      <strong className="count-value">
                        {item.productCount ??
                          0}
                      </strong>

                    </td>


                    <td>

                      <span
                        className={`category-status ${
                          String(
                            item.status ||
                              ""
                          )
                            .toLowerCase()
                            .replace(
                              /\s+/g,
                              "-"
                            )
                        }`}
                      >
                        {
                          item.status ||
                          "Active"
                        }
                      </span>

                    </td>


                    <td>

                      <button
                        type="button"
                        className="table-action"
                        title="View Attribute"
                        onClick={() =>
                          openView(
                            item,
                            "attribute"
                          )
                        }
                      >
                        <i className="bi bi-eye" />
                      </button>

                    </td>

                  </tr>

                )
              )

            ) : (

              <tr>

                <td colSpan="6">

                  <div className="categories-empty-state">

                    <div className="categories-empty-icon">

                      <i className="bi bi-sliders" />

                    </div>

                    <h3>
                      No attributes found
                    </h3>

                    <p>
                      No attributes match your current search.
                    </p>

                  </div>

                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>


      <Pagination
        currentPage={
          attributePage
        }
        totalPages={
          attributeTotalPages
        }
        totalItems={
          filteredAttributes.length
        }
        pageSize={
          attributePageSize
        }
        onPageChange={
          setAttributePage
        }
        onPageSizeChange={(
          size
        ) => {

          setAttributePageSize(
            size
          );

          setAttributePage(
            1
          );

        }}
      />

    </>

  );


  /* =========================================================
     MAIN UI
  ========================================================= */

  return (

    <div
      className={`store-categories-page ${
        embedded
          ? "store-categories-embedded"
          : ""
      }`}
    >

      {/* =====================================================
         HEADER
      ===================================================== */}

      <div className="store-categories-header">

        <div>

          <h2>
            Categories
          </h2>

          <p>
            Manage store categories, tags and product attributes.
          </p>


        </div>

        <button
          type="button"
          className="taxonomy-sync-button"
          onClick={handleSyncTaxonomies}
          disabled={!storeId || taxonomySyncing}
        >
          <i className={`bi ${taxonomySyncing ? "bi-arrow-repeat taxonomy-sync-spinning" : "bi-cloud-download"}`} />
          {taxonomySyncing ? "Syncing…" : "Sync Tags & Attributes"}
        </button>

      </div>

      {taxonomySyncMessage ? (
        <div className="taxonomy-sync-message" role="status">
          {taxonomySyncMessage}
        </div>
      ) : null}


      {/* =====================================================
         PANEL
      ===================================================== */}

      <div className="categories-panel">


        {/* ===================================================
           TABS
        =================================================== */}

        <div className="categories-tabs">

          {tabs.map(
            (tab) => (

              <button
                key={tab.id}
                type="button"
                className={`categories-tab ${
                  activeTab ===
                  tab.id
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  handleTabChange(
                    tab.id
                  )
                }
              >

                <i
                  className={`bi ${tab.icon}`}
                />

                {tab.label}

              </button>

            )
          )}

        </div>


        {/* ===================================================
           TOOLBAR
        =================================================== */}

        <div className="categories-toolbar">

          <div className="categories-search">

            <i className="bi bi-search" />

            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={
                search
              }
              onChange={
                handleSearchChange
              }
            />

          </div>

        </div>


        {/* ===================================================
           CONTENT
        =================================================== */}

        {taxonomyLoading ? (
          <div className="categories-empty-state" role="status">
            Loading categories, tags, and attributes…
          </div>
        ) : taxonomyError ? (
          <div className="categories-empty-state" role="alert">
            {taxonomyError}
          </div>
        ) : null}

        {activeTab ===
          "categories" &&
          renderCategories()}

        {activeTab ===
          "tags" &&
          renderTags()}

        {activeTab ===
          "attributes" &&
          renderAttributes()}

      </div>


      {/* =====================================================
         FOOTER
      ===================================================== */}

      <div className="categories-footer">

        <span>

          <i className="bi bi-cloud-check" />

          Catalog data synced from WooCommerce

        </span>

      </div>


      {/* =====================================================
         VIEW DETAILS MODAL
      ===================================================== */}

      <ViewDetailsModal
        open={
          Boolean(
            selectedItem
          )
        }
        title={
          getModalTitle()
        }
        subtitle={
          selectedItem?.id
            ? `ID: ${selectedItem.id}`
            : ""
        }
        data={
          selectedItem
        }
        fields={
          getModalFields()
        }
        onClose={
          closeView
        }
      />

    </div>

  );
}
