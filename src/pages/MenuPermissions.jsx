import { useEffect, useMemo, useState } from "react";
import { readRoleTemplatesList, roleTemplatesApi } from "../api/roleTemplatesApi";
import { getMenuPermissions, saveMenuPermissions } from "../api/menuPermissionsApi";
import {
  grantsFromResponse,
  grantsToMap,
  mapToGrants,
  sameGrants,
} from "../auth/access";
import { actionsFor, MENU_SECTIONS } from "../navigation/menuCatalog";
import "../styles/menu-permissions.css";

const PLATFORM_ROLES = [
  {
    id: "SUPER_ADMIN",
    principalRole: "SUPER_ADMIN",
    roleTemplateId: null,
    name: "Super Admin",
    description: "Sees every menu and action. This role cannot be reduced.",
    locked: true,
  },
  {
    id: "ADMIN",
    principalRole: "ADMIN",
    roleTemplateId: null,
    name: "Admin",
    description: "Platform administrator menus and table actions.",
    locked: false,
  },
  {
    id: "MERCHANT",
    principalRole: "MERCHANT",
    roleTemplateId: null,
    name: "Merchant",
    description: "Menus and actions for a merchant owner.",
    locked: false,
  },
];

const ACTION_LABELS = {
  view: "View",
  create: "Create",
  update: "Edit",
  delete: "Delete",
};

function fullMap() {
  return grantsToMap(grantsFromResponse({ menuKeys: MENU_SECTIONS.flatMap((section) => section.items.map((item) => item.key)) }, "ADMIN"));
}

export default function MenuPermissions() {
  const [templates, setTemplates] = useState([]);
  const [templatesReady, setTemplatesReady] = useState(false);
  const [templatesError, setTemplatesError] = useState("");
  const [selectedId, setSelectedId] = useState("SUPER_ADMIN");
  const [grants, setGrants] = useState(fullMap);
  const [savedGrants, setSavedGrants] = useState(fullMap);
  const [configured, setConfigured] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const roles = useMemo(() => {
    const employeeRoles = templates.map((template) => ({
      id: `template:${template.id}`,
      principalRole: "MERCHANT_EMPLOYEE",
      roleTemplateId: String(template.id),
      name: template.name || template.roleCode || "Role template",
      description: template.roleCode
        ? `Employee role ${template.roleCode}`
        : "Merchant employee role template",
      locked: false,
    }));
    return [...PLATFORM_ROLES, ...employeeRoles];
  }, [templates]);

  const selectedRole = roles.find((role) => role.id === selectedId) || PLATFORM_ROLES[0];
  const dirty = !sameGrants(mapToGrants(grants), mapToGrants(savedGrants));
  const viewCount = Object.values(grants).filter((actions) => actions.includes("view")).length;

  useEffect(() => {
    let cancelled = false;
    roleTemplatesApi
      .getAll()
      .then((response) => {
        if (cancelled) return;
        setTemplates(readRoleTemplatesList(response).filter((item) => item?.id != null));
      })
      .catch((failure) => {
        if (!cancelled) setTemplatesError(failure?.message || "Unable to load role templates.");
      })
      .finally(() => {
        if (!cancelled) setTemplatesReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setMessage("");

    getMenuPermissions(selectedRole.principalRole, selectedRole.roleTemplateId)
      .then((response) => {
        if (cancelled) return;
        const next = grantsToMap(
          selectedRole.locked
            ? grantsFromResponse({ menuKeys: MENU_SECTIONS.flatMap((section) => section.items.map((item) => item.key)) }, "SUPER_ADMIN")
            : grantsFromResponse(response, selectedRole.principalRole),
        );
        setGrants(next);
        setSavedGrants(next);
        setConfigured(Boolean(response?.configured) || selectedRole.locked);
      })
      .catch((failure) => {
        if (cancelled) return;
        const next = grantsToMap(grantsFromResponse(null, selectedRole.principalRole));
        setGrants(next);
        setSavedGrants(next);
        setConfigured(false);
        setError(failure?.message || "Unable to load menu permissions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRole.id, selectedRole.principalRole, selectedRole.roleTemplateId, selectedRole.locked]);

  function selectRole(roleId) {
    if (roleId === selectedRole.id) return;
    if (dirty) {
      setError("Save or discard changes before switching roles.");
      return;
    }
    setSelectedId(roleId);
  }

  function setActions(menuKey, actions) {
    if (selectedRole.locked) return;
    const known = actionsFor(menuKey);
    const next = [...new Set(actions.filter((action) => known.includes(action)))];
    if (next.some((action) => action !== "view")) next.push("view");
    setMessage("");
    setGrants((current) => ({
      ...current,
      [menuKey]: known.filter((action) => next.includes(action)),
    }));
  }

  function toggleAction(menuKey, action) {
    if (selectedRole.locked || (menuKey === "dashboard" && action === "view")) return;
    const current = grants[menuKey] || [];
    if (action === "view") {
      setActions(menuKey, current.includes("view") ? [] : ["view"]);
      return;
    }
    setActions(
      menuKey,
      current.includes(action)
        ? current.filter((item) => item !== action)
        : [...current, action],
    );
  }

  function toggleSection(items, enable) {
    if (selectedRole.locked) return;
    setMessage("");
    setGrants((current) => {
      const next = { ...current };
      items.forEach((item) => {
        if (item.key === "dashboard") return;
        next[item.key] = enable ? [...actionsFor(item.key)] : [];
      });
      return next;
    });
  }

  function selectAll() {
    if (selectedRole.locked) return;
    setMessage("");
    setGrants(grantsToMap(grantsFromResponse({
      menuKeys: MENU_SECTIONS.flatMap((section) => section.items.map((item) => item.key)),
    }, "ADMIN")));
  }

  function clearOptional() {
    if (selectedRole.locked) return;
    setMessage("");
    const next = grantsToMap([]);
    next.dashboard = ["view"];
    setGrants(next);
  }

  function discard() {
    setGrants(savedGrants);
    setMessage("");
  }

  async function save() {
    if (selectedRole.locked || saving || !dirty) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = mapToGrants(grants);
      const response = await saveMenuPermissions({
        principalRole: selectedRole.principalRole,
        roleTemplateId: selectedRole.roleTemplateId,
        grants: payload,
      });
      const next = grantsToMap(grantsFromResponse(response, selectedRole.principalRole));
      setGrants(next);
      setSavedGrants(next);
      setConfigured(true);
      setMessage("Menu permissions saved.");
    } catch (failure) {
      setError(failure?.message || "Unable to save menu permissions.");
    } finally {
      setSaving(false);
    }
  }

  const visibleSections = MENU_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return `${item.label} ${item.description} ${section.title}`.toLowerCase().includes(query);
    }),
  })).filter((section) => section.items.length > 0);

  return (
    <section className="menu-permissions-page">
      <header className="menu-permissions-heading">
        <div>
          <h1>Menu Permissions</h1>
          <p>
            Choose which screens a role can open, and whether that role can create, edit, or delete records.
            Table actions use these same permissions.
          </p>
        </div>
        <span className="menu-permissions-count">{viewCount} menus visible</span>
      </header>

      <div className="menu-permissions-layout">
        <aside className="menu-permissions-roles">
          <h2>Roles</h2>
          <p className="menu-permissions-group">Platform</p>
          <ul>
            {roles.filter((role) => role.principalRole !== "MERCHANT_EMPLOYEE").map((role) => (
              <li key={role.id}>
                <button
                  type="button"
                  className={role.id === selectedRole.id ? "active" : ""}
                  onClick={() => selectRole(role.id)}
                >
                  <strong>{role.name}</strong>
                  <small>{role.description}</small>
                </button>
              </li>
            ))}
          </ul>
          <p className="menu-permissions-group">Merchant employee roles</p>
          <ul>
            {roles.filter((role) => role.principalRole === "MERCHANT_EMPLOYEE").map((role) => (
              <li key={role.id}>
                <button
                  type="button"
                  className={role.id === selectedRole.id ? "active" : ""}
                  onClick={() => selectRole(role.id)}
                >
                  <strong>{role.name}</strong>
                  <small>{role.description}</small>
                </button>
              </li>
            ))}
          </ul>
          {templatesError ? <p className="menu-permissions-note">{templatesError}</p> : null}
          {!templatesReady && !templatesError ? <p className="menu-permissions-note">Loading role templates…</p> : null}
          {templatesReady && !templatesError && templates.length === 0 ? (
            <p className="menu-permissions-note">No role templates yet.</p>
          ) : null}
        </aside>

        <div className="menu-permissions-editor">
          <div className="menu-permissions-toolbar">
            <div>
              <h2>{selectedRole.name}</h2>
              <p>
                {configured
                  ? "Saved access for this role."
                  : "Not saved yet. These are the suggested permissions."}
              </p>
            </div>
            <div className="menu-permissions-actions">
              <button type="button" onClick={selectAll} disabled={selectedRole.locked || loading}>Select all</button>
              <button type="button" onClick={clearOptional} disabled={selectedRole.locked || loading}>Clear</button>
            </div>
          </div>

          <label className="menu-permissions-search">
            <i className="bi bi-search" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search menus"
            />
          </label>

          {error ? <p className="menu-permissions-error" role="alert">{error}</p> : null}
          {message ? <p className="menu-permissions-success">{message}</p> : null}
          {loading ? <p className="menu-permissions-note">Loading saved permissions…</p> : null}

          {!loading && visibleSections.map((section) => {
            const editable = section.items.filter((item) => item.key !== "dashboard");
            const sectionOn = editable.length > 0 && editable.every((item) => (grants[item.key] || []).includes("view"));
            return (
              <section className="menu-permissions-section" key={section.title}>
                <div className="menu-permissions-section-head">
                  <h3>{section.title}</h3>
                  {editable.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggleSection(section.items, !sectionOn)}
                      disabled={selectedRole.locked}
                    >
                      {sectionOn ? "Clear section" : "Select section"}
                    </button>
                  ) : null}
                </div>
                <div className="menu-permissions-grid">
                  {section.items.map((item) => {
                    const selected = grants[item.key] || [];
                    const locked = selectedRole.locked || item.key === "dashboard";
                    return (
                      <div key={item.key} className={selected.includes("view") ? "menu-permission-card selected" : "menu-permission-card"}>
                        <label>
                          <input
                            type="checkbox"
                            checked={selected.includes("view")}
                            disabled={locked || loading || saving}
                            onChange={() => toggleAction(item.key, "view")}
                          />
                          <i className={`bi ${item.icon}`} />
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                          </span>
                        </label>
                        {actionsFor(item.key).length > 1 ? (
                          <div className="menu-permission-action-row">
                            {actionsFor(item.key).filter((action) => action !== "view").map((action) => (
                              <label key={action}>
                                <input
                                  type="checkbox"
                                  checked={selected.includes(action)}
                                  disabled={locked || loading || saving || !selected.includes("view")}
                                  onChange={() => toggleAction(item.key, action)}
                                />
                                {ACTION_LABELS[action]}
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <div className="menu-permissions-footer">
            <button type="button" onClick={discard} disabled={!dirty || saving}>Discard</button>
            <button
              type="button"
              className="primary"
              onClick={save}
              disabled={selectedRole.locked || !dirty || saving || loading}
            >
              {saving ? "Saving…" : "Save permissions"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
