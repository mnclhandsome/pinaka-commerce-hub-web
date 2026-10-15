import { createContext, useContext, useEffect, useRef, useState } from "react";

export const PosSettingsContext = createContext(null);
export const snapshotKey = (value) => JSON.stringify(value);
export function usePosSettings() {
    return useContext(PosSettingsContext);
}
export function useConfigState(name, initialValue) {
    const settings = usePosSettings();
    const [value, setValue] = useState(() => {
        const initial = settings.session.saved[name] ?? (typeof initialValue === "function" ? initialValue() : initialValue);
        settings.session.baseline[name] = initial;
        settings.session.draft[name] = initial;
        return initial;
    });
    const update = (next) => {
        const resolved = typeof next === "function" ? next(settings.session.draft[name]) : next;
        settings.session.draft[name] = resolved;
        setValue(resolved);
        settings.clearNotice();
    };
    settings.session.resets[name] = () => setValue(settings.session.baseline[name]);
    return [value, update];
}
// Opening an editor is not itself a change. Only edits to its fields are dirty.
export function useConfigEditor() {
    const { session } = usePosSettings();
    const [editor, setEditor] = useState(null);
    const current = useRef(null);
    const baseline = useRef(null);
    session.editorDirty = () => current.current !== null && snapshotKey(current.current) !== baseline.current;
    session.resetEditor = () => { current.current = null; baseline.current = null; setEditor(null); };
    return [editor, (next) => {
        const resolved = typeof next === "function" ? next(current.current) : next;
        if (resolved !== null && current.current === null) baseline.current = snapshotKey(resolved);
        current.current = resolved;
        setEditor(resolved);
    }];
}
export function useSaveAction(handler) {
    const settings = usePosSettings();
    useEffect(() => { settings.session.save = handler; });
    return () => settings.saveChanges();
}
export function SettingsChangeDialog({ busy, onSave, onDiscard, onStay }) {
    const dialog = useRef(null);
    useEffect(() => {
        const previous = document.activeElement;
        dialog.current.showModal();
        return () => { if (previous?.isConnected) previous.focus(); };
    }, []);
    return <dialog className="pos-change-dialog" ref={dialog} aria-labelledby="pos-change-title"
        aria-describedby="pos-change-description" onCancel={(event) => { event.preventDefault(); if (!busy) onStay(); }}>
        <h2 id="pos-change-title">Unsaved changes</h2>
        <p id="pos-change-description">Save or discard your changes. You will stay on this screen.</p>
        <div className="pos-change-actions">
            <button type="button" className="pc-button" disabled={busy} onClick={onStay}>Keep Editing</button>
            <button type="button" className="pc-button" disabled={busy} onClick={onDiscard}>Discard Changes</button>
            <button type="button" className="pc-button pc-primary" disabled={busy} onClick={onSave}>{busy ? "Saving…" : "Save Changes"}</button>
        </div>
    </dialog>;
}

export function SettingsGearIcon() {
    return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" /></svg>;
}

export function SettingCheckbox({ label, checked, onChange }) {
    return (
        <label className="settings-checkbox">
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) =>
                    onChange(event.target.checked)
                }
            />

            <span className="settings-checkbox-box">
                <i className="bi bi-check" />
            </span>

            <span>{label}</span>
        </label>
    );
}

export function SettingInput({
    label,
    value,
    onChange,
    placeholder = "",
    type = "text",
}) {
    return (
        <div className="settings-row">
            <div className="settings-label">
                <label>{label}</label>
            </div>

            <div className="settings-field">
                <input
                    type={type}
                    value={value}
                    placeholder={placeholder}
                    onChange={(event) =>
                        onChange(event.target.value)
                    }
                />
            </div>
        </div>
    );
}

export function SettingSelect({
    label,
    value,
    onChange,
    children,
}) {
    return (
        <div className="settings-row">
            <div className="settings-label">
                <label>{label}</label>
            </div>

            <div className="settings-field">
                <select
                    value={value}
                    onChange={(event) =>
                        onChange(event.target.value)
                    }
                >
                    {children}
                </select>
            </div>
        </div>
    );
}

/* =========================================================
   DENOMINATION ROW
========================================================= */

export function DenominationRow({
    item,
    index,
    onAmountChange,
    onImageChange,
    onRemove,
}) {
    const { currency } = usePosSettings();
    const handleImageChange = (event) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        const imageUrl = URL.createObjectURL(file);

        onImageChange(index, {
            file,
            image: imageUrl,
            imageName: file.name,
        });
    };

    return (
        <div className="denomination-row">
            {/* AMOUNT */}

            <div className="denomination-amount-field">
                <label>Amount ({currency})</label>

                <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.amount}
                    placeholder="Enter amount"
                    onChange={(event) =>
                        onAmountChange(
                            index,
                            event.target.value
                        )
                    }
                />
            </div>

            {/* IMAGE */}

            <div className="denomination-image-field">
                <label>Image</label>

                <div className="denomination-image-upload">
                    <div className="denomination-image-preview">
                        {item.image ? (
                            <img
                                src={item.image}
                                alt={
                                    item.amount ||
                                    "Denomination"
                                }
                            />
                        ) : (
                            <i className="bi bi-image" />
                        )}
                    </div>

                    <div className="denomination-upload-content">
                        <label className="denomination-upload-button">
                            <i className="bi bi-upload" />

                            {item.image
                                ? "Change Image"
                                : "Select Image"}

                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                            />
                        </label>

                        <span>
                            {item.imageName ||
                                "PNG, JPG or WEBP"}
                        </span>
                    </div>
                </div>
            </div>

            {/* REMOVE */}

            <div className="denomination-action-field">
                <label>Actions</label>

                <button
                    type="button"
                    className="pos-remove-button"
                    onClick={() => onRemove(index)}
                >
                    <i className="bi bi-trash" />
                    Remove
                </button>
            </div>
        </div>
    );
}


export const serverTaxClassId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let recordSequence = 0;
export const newRecordId = () => globalThis.crypto?.randomUUID?.() || `pos-${Date.now()}-${++recordSequence}`;
export const normalized = (value) => value.trim().toLowerCase();
export const validMoney = (value, allowZero = false) =>
    /^\d+(\.\d{1,2})?$/.test(String(value)) && Number.isFinite(Number(value)) &&
    (allowZero ? Number(value) >= 0 : Number(value) > 0);

export function ConfigField({ label, children }) {
    return <label className="pc-field"><span>{label}</span>{children}</label>;
}
export function ConfigSwitch({ label, checked, onChange, disabled = false }) {
    return <label className={`pc-switch-field ${disabled ? "pc-muted" : ""}`}>
        <span>{label}</span>
        <input type="checkbox" role="switch" checked={checked} disabled={disabled}
            onChange={(event) => onChange(event.target.checked)} />
        <span className="pc-switch-track" aria-hidden="true" />
    </label>;
}
export function CashRegisterIcon() {
    return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M4 12h16v9H4zM7 12V5h10v7M10 5V2h4v3M7 17h10M10 20h4" />
        <path d="M10 8h4M7 14h1m3 0h1m3 0h1" />
    </svg>;
}
export function ConfigHeader({ icon, title, description, children }) {
    const settings = usePosSettings();
    icon = icon || settings.card.icon;
    title = title || settings.card.title;
    description = description || settings.card.description;
    return <header className="pc-heading"><div className="pc-heading-title">
        <span className="pc-icon">{icon === "cash-register" ? <CashRegisterIcon /> : icon === "gear" ? <SettingsGearIcon /> : <i className={`bi bi-${icon}`} aria-hidden="true" />}</span>
        <div><h2>{title}</h2><p>{description}</p></div>
    </div>{children}</header>;
}
export function ConfigFooter({ onBack, onSave, disabled, message }) {
    return <footer className="pc-footer pos-form-actions"><p role="status">{message || "Changes are saved for this session. API integration is required for permanent storage."}</p>
        <button type="button" className="pc-button" onClick={onBack}>Cancel</button>
        <button type="button" className="pc-button pc-primary" disabled={disabled} onClick={onSave}>Save Changes</button>
    </footer>;
}
export function ConfigBadge({ children }) {
    return <span className={`pc-badge pc-${children.toLowerCase()}`}>{children}</span>;
}
