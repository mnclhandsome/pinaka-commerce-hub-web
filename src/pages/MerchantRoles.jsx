import { useEffect, useMemo, useState } from "react";
import {
  merchantRoleTemplatesApi,
  readAvailableRoleTemplates,
} from "../api/merchantRoleTemplatesApi";
import "../styles/merchant-roles.css";

export default function MerchantRoles({ merchantId }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [storeTypes, setStoreTypes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [baseline, setBaseline] = useState(() => new Set());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!merchantId) {
      setLoading(false);
      setError("Merchant id is required.");
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    setMessage("");
    merchantRoleTemplatesApi
      .getAvailable(merchantId)
      .then((response) => {
        if (!active) return;
        const { storeTypes: types, roleTemplates } = readAvailableRoleTemplates(response);
        // Prefer already-saved selections; otherwise keep all roles unchecked by default.
        const saved = roleTemplates.filter((row) => row.selected).map((row) => row.id);
        const initial = new Set(saved);
        setStoreTypes(types);
        setTemplates(roleTemplates);
        setSelected(initial);
        setBaseline(new Set(initial));
      })
      .catch((failure) => {
        if (active) setError(failure.message || "Unable to load role templates.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [merchantId, attempt]);

  const dirty = useMemo(() => {
    if (selected.size !== baseline.size) return true;
    for (const id of selected) if (!baseline.has(id)) return true;
    return false;
  }, [selected, baseline]);

  const storeTypeLabel = storeTypes.length
    ? storeTypes.map((type) => type.name || type.storeTypeCode || type.id).join(", ")
    : "—";

  function toggle(id) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMessage("");
  }

  function toggleAll(checked) {
    setSelected(checked ? new Set(templates.map((row) => row.id)) : new Set());
    setMessage("");
  }

  function cancel() {
    setSelected(new Set(baseline));
    setMessage("");
    setError("");
  }

  async function save() {
    if (!merchantId || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const roleTemplateIds = [...selected];
      const response = await merchantRoleTemplatesApi.save(merchantId, roleTemplateIds);
      if (response?.success === false) {
        throw new Error(response.message || "Unable to save role templates.");
      }
      setBaseline(new Set(roleTemplateIds));
      setTemplates((previous) =>
        previous.map((row) => ({ ...row, selected: roleTemplateIds.includes(row.id) })),
      );
      setMessage("Role templates saved.");
    } catch (failure) {
      setError(failure.message || "Unable to save role templates.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="merchant-roles">
      <div className="mr-card">
        <div className="mr-header">
          <div>
            <h2>Roles &amp; Permissions</h2>
            <p>
              Role templates from the merchant subscription store type
              {storeTypes.length ? <> (<strong>{storeTypeLabel}</strong>)</> : null}.
              Select which roles apply to this merchant.
            </p>
          </div>
          <label className="mr-select-all">
            <input
              type="checkbox"
              checked={templates.length > 0 && templates.every((row) => selected.has(row.id))}
              disabled={loading || saving || !templates.length}
              onChange={(event) => toggleAll(event.target.checked)}
            />
            <span>Select all</span>
          </label>
        </div>

        {loading && <p role="status">Loading role templates…</p>}
        {error && (
          <div className="mr-error" role="alert">
            {error}{" "}
            <button type="button" onClick={() => setAttempt((value) => value + 1)}>
              Retry
            </button>
          </div>
        )}
        {message && (
          <p className="mr-success" role="status">
            {message}
          </p>
        )}

        {!loading && !error && !storeTypes.length && (
          <p className="mr-empty">
            No store type found on this merchant&apos;s active subscription. Assign a plan with a
            store type first.
          </p>
        )}

        {!loading && !error && storeTypes.length > 0 && !templates.length && (
          <p className="mr-empty">
            No role templates are mapped to store type <strong>{storeTypeLabel}</strong>. Map them
            in Master Setup → Store Type Role Templates.
          </p>
        )}

        {!loading && templates.length > 0 && (
          <ul className="mr-list" aria-label="Role templates">
            {templates.map((row) => {
              const checked = selected.has(row.id);
              return (
                <li key={row.id} className={checked ? "mr-item is-checked" : "mr-item"}>
                  <label className="mr-check">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={saving}
                      onChange={() => toggle(row.id)}
                    />
                    <span className="mr-copy">
                      <span className="mr-name">
                        {row.name}
                        {row.required ? <em className="mr-tag">Required</em> : null}
                        {row.defaultEnabled && !row.required ? (
                          <em className="mr-tag mr-tag-soft">Default</em>
                        ) : null}
                      </span>
                      <span className="mr-meta">
                        {[row.roleCode, row.scopeType].filter(Boolean).join(" · ")}
                      </span>
                      {row.description ? <span className="mr-desc">{row.description}</span> : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mr-footer-actions">
          <button type="button" onClick={cancel} disabled={loading || saving || !dirty}>
            Cancel
          </button>
          <button type="button" className="mr-primary" onClick={save} disabled={loading || saving || !dirty}>
            {saving ? "Saving..." : "Save roles"}
          </button>
        </div>
      </div>
    </section>
  );
}
