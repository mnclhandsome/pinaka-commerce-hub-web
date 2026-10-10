import React, { useEffect, useMemo, useState } from 'react';
 
import { useNavigate, useParams } from 'react-router-dom';
import Pagination from '../components/Pagination';
 
import { Store, Search, Plus, X, Trash2 } from 'lucide-react';
 
import { getFeature } from '../api/features';
 
import {
 
  listMappedStoreTypes,
 
  addStoreTypeToFeature,
 
  removeStoreTypeFromFeature,
 
} from '../api/featureStoreTypesApi';
 
import '../styles/featurestoretypes.css';
 
import '../styles/feature-detail-header.css';
 
/*
 
 * IMPORTANT
 
 * ----------
 
 * The DELETE API expects:
 
 *
 
 * DELETE /features/{featureId}/store-types/{storeTypeId}
 
 *
 
 * Therefore, the "id" used by this component MUST be the
 
 * actual storeTypeId and NOT the relationship/mapping id.
 
 *
 
 * Example mapped API response:
 
 *
 
 * {
 
 *   id: "mapping-id",
 
 *   storeTypeId: "store-type-id",
 
 *   storeType: {
 
 *     id: "store-type-id",
 
 *     code: "RESTAURANT",
 
 *     name: "Restaurant"
 
 *   }
 
 * }
 
 *
 
 * We always prefer storeTypeId first.
 
 */
 
const mapStore = (item = {}) => {
 
  const nestedStoreType = item?.storeType || {};
 
  /*
 
   * IMPORTANT ID ORDER
 
   *
 
   * 1. item.storeTypeId       -> actual store type ID
 
   * 2. item.store_type_id     -> snake_case API possibility
 
   * 3. nested storeType.id    -> nested store type ID
 
   * 4. nested storeType._id
 
   * 5. item.id                -> fallback only
 
   * 6. item._id               -> fallback only
 
   *
 
   * We DO NOT prefer item.id because that can be the
 
   * feature-store-type relationship ID.
 
   */
 
  const storeTypeId =
 
    item?.storeTypeId ||
 
    item?.store_type_id ||
 
    nestedStoreType?.id ||
 
    nestedStoreType?._id ||
 
    item?.id ||
 
    item?._id ||
 
    '';
 
  return {
 
    id: String(storeTypeId),
 
    code:
 
      nestedStoreType?.code ||
 
      nestedStoreType?.storeTypeCode ||
 
      item?.storeTypeCode ||
 
      item?.store_type_code ||
 
      item?.code ||
 
      '',
 
    name:
 
      nestedStoreType?.name ||
 
      nestedStoreType?.storeTypeName ||
 
      item?.storeTypeName ||
 
      item?.store_type_name ||
 
      item?.name ||
 
      '',
 
    description:
 
      nestedStoreType?.description ||
 
      item?.description ||
 
      '',
 
    /*
 
     * Keep the relationship ID separately.
 
     * This is NOT used for the DELETE API.
 
     */
 
    mappingId:
 
      item?.id ||
 
      item?._id ||
 
      '',

    isAssigned:
      item?.is_assigned ??
      item?.isAssigned ??
      item?.is_selected ??
      item?.isSelected ??
      item?.is_mapped ??
      item?.isMapped ??
      nestedStoreType?.is_assigned ??
      nestedStoreType?.isAssigned ??
      item?.selected ??
      item?.assigned ??
      true,
 
  };
 
};

const removedStoreTypesKey = (featureId) =>
  `feature:${featureId}:unassigned-store-types`;

const readRemovedStoreTypes = (featureId) => {
  try {
    const items = JSON.parse(localStorage.getItem(removedStoreTypesKey(featureId)) || "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

const rememberRemovedStoreType = (featureId, storeType) => {
  try {
    const items = readRemovedStoreTypes(featureId).filter(
      (item) => String(item.id) !== String(storeType.id),
    );
    localStorage.setItem(
      removedStoreTypesKey(featureId),
      JSON.stringify([{ ...storeType, isAssigned: false }, ...items]),
    );
  } catch {
    // The API operation remains successful if local persistence is unavailable.
  }
};

const forgetAssignedStoreTypes = (featureId, storeTypeIds) => {
  try {
    const assignedIds = new Set(storeTypeIds.map(String));
    const remaining = readRemovedStoreTypes(featureId).filter(
      (item) => !assignedIds.has(String(item.id)),
    );
    localStorage.setItem(removedStoreTypesKey(featureId), JSON.stringify(remaining));
  } catch {
    // The API operation remains successful if local persistence is unavailable.
  }
};
 
const FeatureStoreTypes = () => {
 
  const navigate = useNavigate();
 
  const { featureId } = useParams();
 
  const [feature, setFeature] = useState(null);
 
  const [storeTypes, setStoreTypes] = useState([]);
 
  const [available, setAvailable] = useState([]);
 
  const [search, setSearch] = useState('');
 
  const [modalSearch, setModalSearch] = useState('');

  const [currentPage, setCurrentPage] = useState(1);

  const [pageSize, setPageSize] = useState(5);
 
  const [showAddModal, setShowAddModal] = useState(false);
 
  const [selected, setSelected] = useState([]);
 
  const [saving, setSaving] = useState(false);
 
  const [removingId, setRemovingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
 
  const [error, setError] = useState('');
 
  /*
 
   * Load feature + mapped store types + available store types
 
   */
 
  const load = async () => {
 
    if (!featureId) {
 
      setError('Feature ID is missing.');
 
      return;
 
    }
 
    try {
 
      setError('');
 
      const [f, featureStoreTypes] = await Promise.all([
 
        getFeature(featureId),
 
        listMappedStoreTypes(featureId),
 
      ]);
 
      setFeature(f);
 
      /*
 
       * Convert API response into the UI model.
 
       */
 
      const scopedStoreTypes = Array.isArray(featureStoreTypes)
        ? featureStoreTypes.map(mapStore)
        : [];
      const availableById = new Map(
        scopedStoreTypes.map((storeType) => [String(storeType.id), storeType]),
      );
      readRemovedStoreTypes(featureId).forEach((storeType) => {
        if (!availableById.has(String(storeType.id))) {
          availableById.set(String(storeType.id), { ...storeType, isAssigned: false });
        }
      });

      setStoreTypes(scopedStoreTypes.filter((storeType) => storeType.isAssigned));
      setAvailable(Array.from(availableById.values()));
 
    } catch (e) {
 
      console.error('Failed to load store types:', e);
 
      setError(
 
        e?.message ||
 
        'Unable to load store types.'
 
      );
 
    }
 
  };
 
  /*
 
   * Initial load / feature change
 
   */
 
  useEffect(() => {
 
    load();
 
  }, [featureId]);
 
  /*
 
   * Search mapped store types
 
   */
 
  const filtered = useMemo(() => {
 
    const searchValue = search.trim().toLowerCase();
 
    if (!searchValue) {
 
      return storeTypes;
 
    }
 
    return storeTypes.filter((s) =>
 
      [
 
        s.code,
 
        s.name,
 
        s.description,
 
      ]
 
        .join(' ')
 
        .toLowerCase()
 
        .includes(searchValue)
 
    );
 
  }, [storeTypes, search]);

  const totalPages = Math.max(
  1,
  Math.ceil(filtered.length / pageSize)
);

const paginatedStoreTypes = useMemo(() => {
  const startIndex = (currentPage - 1) * pageSize;

  return filtered.slice(startIndex, startIndex + pageSize);
}, [filtered, currentPage, pageSize]);

useEffect(() => {
  if (currentPage > totalPages) {
    setCurrentPage(totalPages);
  }
}, [currentPage, totalPages]);
 
  /*
 
   * Store types that can be added.
 
   *
 
   * Compare using the ACTUAL store type IDs.
 
   */
 
  const selectableStoreTypes = useMemo(() => {
 
    const mappedIds = new Set(
 
      storeTypes
 
        .map((s) => String(s.id))
 
        .filter(Boolean)
 
    );
 
    const searchValue = modalSearch.trim().toLowerCase();
 
    return available
 
      .filter((s) => {
 
        if (!s.id) {
 
          return false;
 
        }
 
        return !mappedIds.has(String(s.id));
 
      })
 
      .filter((s) => {
 
        if (!searchValue) {
 
          return true;
 
        }
 
        return [
 
          s.code,
 
          s.name,
 
          s.description,
 
        ]
 
          .join(' ')
 
          .toLowerCase()
 
          .includes(searchValue);
 
      });
 
  }, [
 
    available,
 
    storeTypes,
 
    modalSearch,
 
  ]);
 
  /*
 
   * Select / unselect store type in Add modal
 
   */
 
  const toggleSelected = (id) => {
 
    const storeTypeId = String(id);
 
    setSelected((current) =>
 
      current.includes(storeTypeId)
 
        ? current.filter(
 
            (item) => item !== storeTypeId
 
          )
 
        : [
 
            ...current,
 
            storeTypeId,
 
          ]
 
    );
 
  };
 
  /*
 
   * Close Add Store Type modal
 
   */
 
  const closeModal = () => {
 
    if (saving) {
 
      return;
 
    }
 
    setShowAddModal(false);
 
    setSelected([]);
 
    setModalSearch('');
 
  };
 
  /*
 
   * Add selected store types
 
   */
 
  const add = async () => {
 
    if (!selected.length || saving) {
 
      return;
 
    }
 
    try {
 
      setSaving(true);
 
      setError('');
 
      await Promise.all(
 
        selected.map(
 
          (storeTypeId, index) =>
 
            addStoreTypeToFeature(
 
              featureId,
 
              {
 
                storeTypeId,
 
                defaultEnabled: true,
 
                required: false,
 
                displayOrder:
 
                  storeTypes.length +
 
                  index +
 
                  1,
 
              }
 
            )
 
        )
 
      );

      forgetAssignedStoreTypes(featureId, selected);
 
      /*
 
       * Close modal after successful API calls.
 
       */
 
      closeModal();
 
      /*
 
       * Refresh table.
 
       */
 
      await load();
 
    } catch (e) {
 
      console.error('Failed to add store type:', e);
 
      setError(
 
        e?.message ||
 
        'Unable to add store type.'
 
      );
 
    } finally {
 
      setSaving(false);
 
    }
 
  };
 
  /*
 
   * Remove store type from feature
 
   *
 
   * IMPORTANT:
 
   * "id" here is the actual storeTypeId.
 
   *
 
   * It is NOT mappingId.
 
   */
 
  const remove = async (storeType) => {

    const storeTypeId = typeof storeType === 'object' ? storeType?.id : storeType;
 
    if (!featureId || !storeTypeId || removingId) {
 
      return false;
 
    }
 
    try {
 
      setError('');
 
      setRemovingId(String(storeTypeId));
 
      console.log(
 
        'Removing store type:',
 
        {
 
          featureId,
 
          storeTypeId,
 
        }
 
      );
 
      /*
 
       * Correct API:
 
       *
 
       * DELETE
 
       * /features/{featureId}/store-types/{storeTypeId}
 
       */
 
      await removeStoreTypeFromFeature(
 
        featureId,
 
        String(storeTypeId)
 
      );

      if (typeof storeType === 'object') {
        rememberRemovedStoreType(featureId, storeType);
      }
 
      /*
 
       * Reload table after successful delete.
 
       */
 
      await load();

      return true;
 
    } catch (e) {
 
      console.error(
 
        'Failed to remove store type:',
 
        e
 
      );
 
      setError(
 
        e?.message ||
 
        'Unable to remove store type.'
 
      );
      return false;
 
    } finally {
 
      setRemovingId(null);
 
    }
 
  };
 
  const name =
 
    feature?.name ||
 
    'Feature';
 
  const desc =
 
    feature?.description ||
 
    '';
 
  return (
 
    <div className="store-types-page feature-detail-page">
 
      {/* =========================
 
          FEATURE HEADER
 
      ========================== */}
 
      <section className="feature-detail-header">
 
        <div className="feature-detail-top">
 
          <button
 
            type="button"
 
            className="feature-detail-back"
 
            onClick={() => navigate('/features')}
 
            aria-label="Back to Features"
 
            title="Back to Features"
 
          >
 
            <i className="bi bi-arrow-left" />
 
          </button>
 
          <div className="feature-detail-copy">
 
            <h1>{name}</h1>
 
            <p>{desc}</p>
 
          </div>
 
        </div>
 
        {/* =========================
 
            TABS
 
        ========================== */}
 
        <nav
 
          className="feature-detail-tabs"
 
          aria-label="Feature sections"
 
        >
 
          <button
 
            className="feature-detail-tab"
 
            type="button"
 
            onClick={() =>
 
              navigate(
 
                `/features/${featureId}/overview`
 
              )
 
            }
 
          >
 
            Overview
 
          </button>
 
          <button
 
            className="feature-detail-tab active"
 
            type="button"
 
          >
 
            Applicable Store Types
 
          </button>
 
          <button
 
            className="feature-detail-tab"
 
            type="button"
 
            onClick={() =>
 
              navigate(
 
                `/features/${featureId}/permissions`
 
              )
 
            }
 
          >
 
            Permissions
 
          </button>
 
        </nav>
 
      </section>
 
      {/* =========================
 
          MAIN CARD
 
      ========================== */}
 
      <section className="st-main-card">
 
        {/* =========================
 
            CARD HEADER
 
        ========================== */}
 
        <div className="st-card-top">
 
          <div className="st-section-heading">
 
            <div className="st-store-icon">
 
              <Store size={20} />
 
            </div>
 
            <div>
 
              <h2>
 
                Applicable Store Types
 
              </h2>
 
              <p>
 
                Select the store types where this
 
                feature will be available.
 
              </p>
 
            </div>
 
          </div>
 
          {/* =========================
 
              SEARCH + ADD
 
          ========================== */}
 
          <div className="st-toolbar pch-master-toolbar pch-master-control">
 
            <div className="st-search pch-master-search pch-master-control">
 
              <Search size={17} />
 
              <input
 
                placeholder="Search store types..."
 
                value={search}
 
                onChange={(e) => {
                 setSearch(e.target.value);
                 setCurrentPage(1);
                      }}
 
              />
 
            </div>
 
            <button
 
              type="button"
 
              className="st-add-button"
 
              onClick={() =>
 
                setShowAddModal(true)
 
              }
 
            >
 
              <Plus size={17} />
 
              <span>
                Assign Store Type
              </span>
 
            </button>
 
          </div>
 
        </div>
 
        {/* =========================
 
            ERROR
 
        ========================== */}
 
        {error && (
 
          <p
 
            role="alert"
 
            className="st-error"
 
          >
 
            {error}
 
          </p>
 
        )}
 
        {/* =========================
 
            STORE TYPE TABLE
 
        ========================== */}
 
        <div className="st-table-wrapper">
 
          <table className="st-table">
 
            <thead>
 
              <tr>
 
                <th>
 
                  Store Type Code
 
                </th>
 
                <th>
 
                  Store Type Name
 
                </th>
 
                <th>
 
                  Description
 
                </th>
 
                <th>
 
                  Actions
 
                </th>
 
              </tr>
 
            </thead>
 
            <tbody>
 
              {paginatedStoreTypes.length > 0 ? (
                   paginatedStoreTypes.map((s) => {
 
                  /*
 
                   * s.id is the ACTUAL storeTypeId.
 
                   */
 
                  const isRemoving =
 
                    removingId ===
 
                    String(s.id);
 
                  return (
 
                    <tr key={s.id}>
 
                      <td className="st-code">
 
                        {s.code}
 
                      </td>
 
                      <td className="st-name">
 
                        {s.name}
 
                      </td>
 
                      <td className="st-description">
 
                        {s.description}
 
                      </td>
 
                      <td className="st-action-cell">
 
                        <button
 
                          type="button"
 
                          className="st-delete-button"
 
                          onClick={() =>
 
                            setDeleteTarget(s)
 
                          }
 
                          disabled={isRemoving}
 
                          aria-label={`Delete ${s.name}`}
 
                          title={
 
                            isRemoving
 
                              ? 'Removing...'
 
                              :  'Remove Assignment'
 
                          }
 
                        >
 
                          {isRemoving ? (
 
                            <span
 
                              style={{
 
                                fontSize: '12px',
 
                              }}
 
                            >
 
                              ...
 
                            </span>
 
                          ) : (
 
                            <Trash2 size={16} />
 
                          )}
 
                        </button>
 
                      </td>
 
                    </tr>
 
                  );
 
                })
 
              ) : (
 
                <tr>
 
                  <td
 
                    colSpan="4"
 
                    style={{
 
                      textAlign: 'center',
 
                      padding: '24px',
 
                    }}
 
                  >
 
                    No store types found.
 
                  </td>
 
                </tr>
 
              )}
 
            </tbody>
 
          </table>
 
        </div>

        <Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  totalItems={filtered.length}
  pageSize={pageSize}
  onPageChange={setCurrentPage}
  onPageSizeChange={(newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  }}
  itemLabel="store types"
/>
 
      </section>
 
      {/** =========================
          DELETE CONFIRMATION
      ========================== */}
      {deleteTarget && (
        <div
          className="st-delete-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="st-delete-title"
          onMouseDown={() => !removingId && setDeleteTarget(null)}
        >
          <div
            className="st-delete-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="st-delete-modal-icon">
              <Trash2 size={23} strokeWidth={2} />
            </div>
 
            <h2 id="st-delete-title">Unassign Store Type?</h2>
 
            <p>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget.name || deleteTarget.code}</strong>?
            </p>
 
            <p className="st-delete-warning">The store type will remain available and can be assigned again.</p>
 
            <div className="st-delete-modal-actions">
              <button
                type="button"
                className="st-delete-cancel-button"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(removingId)}
              >
                Cancel
              </button>
 
              <button
                type="button"
                className="st-delete-confirm-button"
                onClick={async () => {
                  const removed = await remove(deleteTarget);
                  if (removed) {
                    setDeleteTarget(null);
                    setSelected([]);
                    setModalSearch('');
                    setShowAddModal(true);
                  }
                }}
                disabled={Boolean(removingId)}
              >
                {removingId ? 'Unassigning...' : 'Unassign'}
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* =========================
 
          ADD STORE TYPE MODAL
 
      ========================== */}
 
      {showAddModal && (
 
        <div
 
          className="st-modal-backdrop"
 
          role="presentation"
 
        >
 
          <div
 
            className="st-add-modal"
 
            role="dialog"
 
            aria-modal="true"
 
            aria-labelledby="add-store-type-title"
 
          >
 
            {/* =========================
 
                MODAL HEADER
 
            ========================== */}
 
            <div className="st-modal-header">
 
              <div>
 
                <h2 id="add-store-type-title">
 
                  Add Store Type
 
                </h2>
 
                <p>
 
                  Manage store types where this feature is available.
 
                </p>
 
              </div>
 
              <button
 
                type="button"
 
                className="st-modal-close"
 
                onClick={closeModal}
 
                aria-label="Close"
 
                disabled={saving}
 
              >
 
                <X size={22} />
 
              </button>
 
            </div>
 
            {/* =========================
 
                MODAL SEARCH
 
            ========================== */}
 
            <div className="st-modal-search pch-master-search pch-master-control">
 
              <Search size={19} />
 
              <input
 
                autoFocus
 
                placeholder="Search store types..."
 
                value={modalSearch}
 
                onChange={(e) =>
 
                  setModalSearch(e.target.value)
 
                }
 
              />
 
            </div>
 
            {/* =========================
 
                STORE TYPE OPTIONS
 
            ========================== */}
 
            <div className="st-modal-options">
 
              {selectableStoreTypes.length > 0 ? (
 
                selectableStoreTypes.map((s) => (
 
                  <label
 
                    className="st-modal-option"
 
                    key={s.id}
 
                  >
 
                    <input
 
                      type="checkbox"
 
                      checked={selected.includes(
 
                        String(s.id)
 
                      )}
 
                      onChange={() =>
 
                        toggleSelected(s.id)
 
                      }
 
                    />
 
                    <span>
 
                      <strong>
 
                        {s.name || s.code}
 
                      </strong>
 
                      <small>
 
                        {s.code}
 
                      </small>
 
                    </span>
 
                  </label>
 
                ))
 
              ) : (
 
                <p className="st-modal-empty">
 
                  No store types available.
 
                </p>
 
              )}
 
            </div>
 
            {/* =========================
 
                MODAL ACTIONS
 
            ========================== */}
 
            <div className="st-modal-actions">
 
              <button
 
                type="button"
 
                className="st-modal-cancel"
 
                onClick={closeModal}
 
                disabled={saving}
 
              >
 
                Cancel
 
              </button>
 
              <button
 
                type="button"
 
                className="st-modal-confirm"
 
                onClick={add}
 
                disabled={
 
                  !selected.length ||
 
                  saving
 
                }
 
              >
 
                {saving
 
                  ? 'Adding...'
 
                  : 'Add Selected'}
 
              </button>
 
            </div>
 
          </div>
 
        </div>
 
      )}
 
    </div>
 
  );
 
};
 
export default FeatureStoreTypes;
