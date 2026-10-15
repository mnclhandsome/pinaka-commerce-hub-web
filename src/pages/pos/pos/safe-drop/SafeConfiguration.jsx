import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../api/http";
import {
  ConfigBadge, ConfigField, ConfigFooter, ConfigHeader, ConfigSwitch,
  DenominationRow, SettingInput,
  newRecordId, normalized, serverTaxClassId, useConfigEditor, useConfigState, usePosSettings, useSaveAction, validMoney,
} from "../shared";
import {
    getPosSafeDrop,
    createPosSafeDrop,
    updatePosSafeDrop,
} from "./api";

export function SafeConfiguration({ value, onSave, onBack }) {
    const settings = usePosSettings();
    const savedId = useRef(null);
    const currency = settings.currency;
    
    const [draft, setDraft] = useConfigState("draft", () => ({ ...value, tubes: value.tubes.map((row) => ({ ...row })), drops: value.drops.map((row) => ({ ...row })) }));
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [uploads, setUploads] = useState(0);
    const update = (field, next) => { setDraft((current) => ({ ...current, [field]: next })); setMessage(""); setError(""); };
    const updateRow = (list, id, patch) => {
        setDraft((current) => ({ ...current, [list]: current[list].map((row) => row.id === id ? { ...row, ...patch } : row) })); setMessage("");
    };
    const upload = (id, file) => {
        if (!file) return;
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
            setError("Select a PNG, JPG or WEBP image smaller than 2 MB."); return;
        }
        setUploads((count) => count + 1); setError("");
        const reader = new FileReader();
        reader.onload = () => updateRow("drops", id, { image: reader.result, imageName: file.name });
        reader.onerror = () => setError("The image could not be read. Please try again.");
        reader.onloadend = () => setUploads((count) => count - 1);
        reader.readAsDataURL(file);
    };
    const moneyOrNull = (amount) => validMoney(amount) ? Number(amount) : null;
    const safeDropPayload = (source) => ({
        enabled: source.enabled,
        primarySafe: source.primarySafe.trim(),
        dropEnabled: source.enabled && source.dropEnabled,
        threshold: moneyOrNull(source.threshold),
        minimum: moneyOrNull(source.minimum),
        maximum: moneyOrNull(source.maximum),
        managerApproval: source.managerApproval,
        cashierInitiated: source.cashierInitiated,
        reasonRequired: source.reasonRequired,
        tubeSize: source.tubeSize === "" ? null : Number(source.tubeSize),
        tubes: source.tubes.map((row) => ({
            ...(typeof row.id === "string" && serverTaxClassId.test(row.id) ? { id: row.id } : {}),
            amount: Number(row.amount),
            quantity: Number(row.quantity),
        })),
        drops: source.drops.map((row) => ({
            ...(typeof row.id === "string" && serverTaxClassId.test(row.id) ? { id: row.id } : {}),
            amount: Number(row.amount),
            imageName: row.imageName || "denomination",
            imageData: row.image,
        })),
    });
    const applySafeDrop = (record) => {
        const next = {
            enabled: Boolean(record.enabled),
            primarySafe: record.primarySafe || "",
            dropEnabled: Boolean(record.dropEnabled),
            threshold: record.threshold === null || record.threshold === undefined ? "" : String(record.threshold),
            minimum: record.minimum === null || record.minimum === undefined ? "" : String(record.minimum),
            maximum: record.maximum === null || record.maximum === undefined ? "" : String(record.maximum),
            managerApproval: Boolean(record.managerApproval),
            cashierInitiated: Boolean(record.cashierInitiated),
            reasonRequired: Boolean(record.reasonRequired),
            tubeSize: record.tubeSize === null || record.tubeSize === undefined ? "" : String(record.tubeSize),
            tubes: (record.tubes || []).map((row) => ({
                id: row.id,
                amount: String(row.amount),
                quantity: String(row.quantity),
            })),
            drops: (record.drops || []).map((row) => ({
                id: row.id,
                amount: String(row.amount),
                image: row.imageData,
                imageName: row.imageName,
            })),
        };
        savedId.current = record.id;
        setDraft(next);
        onSave(next);
        settings.session.baseline = { ...settings.session.draft };
    };
    useEffect(() => {
        if (!settings.storeId) return undefined;
        let active = true;
        getPosSafeDrop(settings.storeId)
            .then((record) => {
                if (active && record?.id) applySafeDrop(record);
            })
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) return;
                if (active) setError(error?.message || "Unable to load safe and safe drop settings.");
            });
        return () => { active = false; };
    }, [settings.storeId]);
    const save = useSaveAction(async () => {
        if (!settings.storeId) {
            setError("Open Safe & Safe Drop from a store before saving.");
            return false;
        }
        if (draft.enabled && !draft.primarySafe.trim()) { setError("Enter a primary safe."); return; }
        if (draft.enabled && draft.dropEnabled && (![draft.threshold, draft.minimum, draft.maximum].every((amount) => validMoney(amount)) || Number(draft.minimum) > Number(draft.maximum))) {
            setError("Enter positive drop amounts with up to two decimal places. Minimum drop must not exceed maximum drop."); return;
        }
        if (draft.tubeSize && (!Number.isSafeInteger(Number(draft.tubeSize)) || Number(draft.tubeSize) <= 0)) { setError("Tube size must be a positive whole number."); return; }
        if (draft.tubes.some((row) => !validMoney(row.amount) || !Number.isSafeInteger(Number(row.quantity)) || Number(row.quantity) <= 0)) { setError("Every tube needs a positive amount and a positive whole-number quantity."); return; }
        if (draft.drops.some((row) => !validMoney(row.amount) || !row.image?.startsWith("data:image/"))) { setError("Every safe-drop denomination needs a positive amount and a PNG, JPG, or WEBP image."); return; }
        if ([draft.tubes, draft.drops].some((list) => new Set(list.map((row) => Number(row.amount))).size !== list.length)) { setError("Denomination amounts must be unique within each list."); return; }
        if (uploads > 0) { setError("Please wait for the image upload to finish."); return false; }
        const next = { ...draft, primarySafe: draft.primarySafe.trim(), dropEnabled: draft.enabled && draft.dropEnabled };
        const record = savedId.current
            ? await updatePosSafeDrop(settings.storeId, safeDropPayload(next))
            : await createPosSafeDrop(settings.storeId, safeDropPayload(next));
        applySafeDrop(record);
        setError("");
        setMessage("Changes are saved.");
        return true;
    });
    const moneyField = (label, field) => <ConfigField label={`${label} (${currency})`}><input type="number" min="0.01" step="0.01" value={draft[field]} onChange={(e) => update(field, e.target.value)} /></ConfigField>;
    return <section className="pc-screen">
        <ConfigHeader icon="safe" title="Safe & Safe Drop" description="Manage your safe, drop rules and cash-handling denominations." />
        <div className="pc-safe-grid">
            <section className="pc-card"><h3>Safe Management</h3><ConfigSwitch label="Safe Enabled" checked={draft.enabled} onChange={(next) => { setDraft((current) => ({ ...current, enabled: next, dropEnabled: next ? current.dropEnabled : false })); setMessage(""); }} />
                <fieldset disabled={!draft.enabled}><ConfigField label="Primary Safe"><input value={draft.primarySafe} placeholder="SAFE-01" onChange={(e) => update("primarySafe", e.target.value)} /></ConfigField></fieldset>
                <ConfigField label="Currency"><select value={currency} disabled aria-label="Store currency (managed in Currency & Taxes)"><option value={currency}>{currency}</option></select></ConfigField>
            </section>
            <section className="pc-card"><h3>Safe Drop</h3><ConfigSwitch label="Safe Drop Enabled" checked={draft.dropEnabled} disabled={!draft.enabled} onChange={(next) => update("dropEnabled", next)} />
                <fieldset disabled={!draft.enabled || !draft.dropEnabled}>{moneyField("Trigger Threshold", "threshold")}{moneyField("Minimum Drop", "minimum")}{moneyField("Maximum Drop", "maximum")}</fieldset>
            </section>
            <section className="pc-card"><h3>Approval & Permissions</h3><fieldset disabled={!draft.enabled || !draft.dropEnabled}>
                <ConfigSwitch label="Manager Approval Required" checked={draft.managerApproval} onChange={(next) => update("managerApproval", next)} />
                <ConfigSwitch label="Cashier Can Initiate" checked={draft.cashierInitiated} onChange={(next) => update("cashierInitiated", next)} />
                <ConfigSwitch label="Reason Required" checked={draft.reasonRequired} onChange={(next) => update("reasonRequired", next)} />
            </fieldset><p className="pc-help">Drop controls are available when the safe and safe drop are enabled.</p></section>
        </div>
        <section className="pc-card pc-spaced"><h3>Tube Settings</h3><div className="pc-form-grid">
            <ConfigField label="Safe Drop Tube Size"><input type="number" min="1" step="1" value={draft.tubeSize} placeholder="Enter tube size" onChange={(e) => update("tubeSize", e.target.value)} /></ConfigField>
        </div></section>
        <section className="pc-card pc-spaced"><div className="pc-section-heading"><div><h3>Manage Tube Denominations</h3><p>Set the amount and quantity for each tube denomination.</p></div><button type="button" className="pc-button" onClick={() => update("tubes", [...draft.tubes, { id: newRecordId(), amount: "", quantity: "" }])}>+ Add Denomination</button></div>
            <div className="pc-table-wrap"><table className="pc-table"><caption className="pc-sr-only">Tube denominations</caption><thead><tr>{["Currency", "Amount", "Quantity", "Actions"].map((text) => <th key={text} scope="col">{text}</th>)}</tr></thead><tbody>{draft.tubes.map((row, index) => <tr key={row.id}><td>{currency}</td><td><input aria-label={`Tube ${index + 1} amount`} type="number" min="0.01" step="0.01" value={row.amount} onChange={(e) => updateRow("tubes", row.id, { amount: e.target.value })} /></td><td><input aria-label={`Tube ${index + 1} quantity`} type="number" min="1" step="1" value={row.quantity} onChange={(e) => updateRow("tubes", row.id, { quantity: e.target.value })} /></td><td><button type="button" className="pc-button pc-danger" aria-label={`Remove tube ${index + 1}`} onClick={() => update("tubes", draft.tubes.filter((item) => item.id !== row.id))}>Remove</button></td></tr>)}{!draft.tubes.length && <tr><td colSpan="4" className="pc-empty">No tube denominations added yet.</td></tr>}</tbody></table></div>
        </section>
        <section className="pc-card pc-spaced"><div className="pc-section-heading"><div><h3>Manage Safe Drop Denominations</h3><p>Add amounts and denomination images for safe drops.</p></div><button type="button" className="pc-button" onClick={() => update("drops", [...draft.drops, { id: newRecordId(), amount: "", image: "", imageName: "" }])}>+ Add Denomination</button></div>
            {!draft.drops.length && <p className="pc-empty">No safe-drop denominations added yet.</p>}
            {draft.drops.map((row, index) => <div className="pc-denomination" key={row.id}><ConfigField label={`Amount (${currency})`}><input type="number" min="0.01" step="0.01" value={row.amount} onChange={(e) => updateRow("drops", row.id, { amount: e.target.value })} /></ConfigField><div className="pc-upload">{row.image && <img src={row.image} alt={`Safe-drop denomination ${row.amount}`} />}<ConfigField label="Denomination Image"><input type="file" disabled={uploads > 0} accept="image/png,image/jpeg,image/webp" onChange={(e) => { upload(row.id, e.target.files?.[0]); e.target.value = ""; }} /><small>{row.imageName || "PNG, JPG or WEBP · Up to 2 MB"}</small></ConfigField></div><button type="button" className="pc-button pc-danger" aria-label={`Remove safe-drop denomination ${index + 1}`} onClick={() => update("drops", draft.drops.filter((item) => item.id !== row.id))}>Remove</button></div>)}
        </section>
        {error && <p role="alert" className="pc-error">{error}</p>}
        <ConfigFooter onBack={onBack} onSave={save} disabled={uploads > 0} message={uploads > 0 ? "Reading denomination image…" : message} />
    </section>;
}


