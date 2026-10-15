import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../api/http";
import {
  ConfigBadge, ConfigField, ConfigFooter, ConfigHeader, ConfigSwitch,
  DenominationRow, SettingInput,
  newRecordId, normalized, serverTaxClassId, useConfigEditor, useConfigState, usePosSettings, useSaveAction, validMoney,
} from "../shared";
import {
    getPosCashRegisters,
    createPosCashRegisters,
    updatePosCashRegisters,
} from "./api";

export function registerRows(items) {
    return (items || []).map((item) => ({
        id: item.id,
        name: item.name,
        pos: item.pos,
        maxCash: String(item.maxCash),
        safeDrop: Boolean(item.safeDrop),
        status: item.status,
    }));
}

function registerPayload(rows) {
    return {
        registers: rows.map((row) => ({
            ...(typeof row.id === "string" && serverTaxClassId.test(row.id) ? { id: row.id } : {}),
            name: row.name.trim(),
            pos: row.pos.trim(),
            maxCash: Number(row.maxCash),
            safeDrop: Boolean(row.safeDrop),
            status: row.status,
        })),
    };
}

export function RegisterConfiguration({ value, mappings, onSave, onBack }) {
    const settings = usePosSettings();
    const savedId = useRef(null);
    const currency = settings.currency;
    
    const [rows, setRows] = useConfigState("rows", () => value.map((row) => ({ ...row })));
    const [editor, setEditor] = useConfigEditor();
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const update = (field, next) => setEditor((row) => ({ ...row, [field]: next }));
    const openEditor = (row) => { setEditor({ ...row }); setError(""); setMessage(""); };
    const apply = (event) => {
        event?.preventDefault();
        const row = { ...editor, name: editor.name.trim(), pos: editor.pos.trim() };
        if (!row.name || !row.pos || !validMoney(row.maxCash)) {
            setError("Enter a register name, assigned POS and a positive maximum cash amount (up to two decimal places)."); return;
        }
        if (rows.some((other) => other.id !== row.id &&
            (normalized(other.name) === normalized(row.name) || normalized(other.pos) === normalized(row.pos)))) {
            setError("Register names and assigned POS devices must be unique."); return;
        }
        if (row.status === "Inactive" && mappings.some((mapping) => mapping.registerId === row.id && mapping.status === "Active")) {
            setError("Set this register's active mapping to Inactive or Setup before deactivating the register."); return;
        }
        const nextRows = rows.some((item) => item.id === row.id)
            ? rows.map((item) => item.id === row.id ? row : item) : [...rows, row];
        setRows(nextRows);
        setEditor(null); setError(""); setMessage("Register updated in the draft. Save Changes to keep it for this session.");
        return nextRows;
    };
    const remove = (row) => {
        if (mappings.some((mapping) => mapping.registerId === row.id)) {
            setError("Remove this register's terminal mapping before deleting the register."); return;
        }
        setRows((current) => current.filter((item) => item.id !== row.id));
        setError(""); setMessage("Register removed from the draft. Save Changes to keep this change.");
    };

    const applyRegisters = (record) => {
        const savedRows = registerRows(record.registers);
        savedId.current = record.id;
        setRows(savedRows);
        onSave(savedRows);
        settings.session.baseline = { ...settings.session.draft };
    };

    useEffect(() => {
        if (!settings.storeId) return undefined;
        let active = true;
        getPosCashRegisters(settings.storeId)
            .then((record) => {
                if (active && record?.id) applyRegisters(record);
            })
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) return;
                if (active) setError(error?.message || "Unable to load cash register settings.");
            });
        return () => { active = false; };
    }, [settings.storeId]);

    const saveChanges = useSaveAction(async () => {
        if (!settings.storeId) {
            setError("Open Cash Register Settings from a store before saving.");
            return false;
        }
        const nextRows = editor ? apply() : rows;
        if (!nextRows) return false;
        const record = savedId.current
            ? await updatePosCashRegisters(settings.storeId, registerPayload(nextRows))
            : await createPosCashRegisters(settings.storeId, registerPayload(nextRows));
        applyRegisters(record);
        setError("");
        setMessage("Changes are saved.");
        return true;
    });
    return <section className="pc-screen">
        <ConfigHeader icon="cash-register" title="Cash Register Settings" description="Configure registers, assigned POS devices and cash limits.">
            <button type="button" className="pc-button pc-primary" disabled={!!editor}
                onClick={() => openEditor({ id: newRecordId(), name: "", pos: "", maxCash: "", safeDrop: true, status: "Active" })}>+ Add Register</button>
        </ConfigHeader>
        {editor && <form className="pc-editor" onSubmit={apply}>
            <h3>{rows.some((row) => row.id === editor.id) ? "Edit Register" : "Add Register"}</h3>
            <div className="pc-form-grid">
                <ConfigField label="Register"><input autoFocus required value={editor.name} onChange={(e) => update("name", e.target.value)} placeholder="REG-04" /></ConfigField>
                <ConfigField label="Assigned POS"><input required value={editor.pos} onChange={(e) => update("pos", e.target.value)} placeholder="SUNMI-D3-004" /></ConfigField>
                <ConfigField label={`Maximum Cash (${currency})`}><input required type="number" min="0.01" step="0.01" value={editor.maxCash} onChange={(e) => update("maxCash", e.target.value)} /></ConfigField>
                <ConfigField label="Status"><select value={editor.status} onChange={(e) => update("status", e.target.value)}><option>Active</option><option>Inactive</option></select></ConfigField>
                <ConfigSwitch label="Safe Drop Enabled" checked={editor.safeDrop} onChange={(next) => update("safeDrop", next)} />
            </div>
            <div className="pc-editor-actions pos-form-actions"><button type="button" className="pc-button" onClick={() => settings.requestLeave(null)}>Cancel</button><button className="pc-button pc-primary" type="submit">Apply Register</button></div>
        </form>}
        {error && <p className="pc-error" role="alert">{error}</p>}
        <div className="pc-table-wrap"><table className="pc-table"><caption className="pc-sr-only">Configured cash registers</caption>
            <thead><tr>{["Register", "Assigned POS", "Max Cash", "Safe Drop", "Status", "Actions"].map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id}><th scope="row">{row.name}</th><td>{row.pos}</td><td>{new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(row.maxCash))}</td><td>{row.safeDrop ? "Enabled" : "Disabled"}</td><td><ConfigBadge>{row.status}</ConfigBadge></td><td><div className="pc-row-actions"><button type="button" disabled={!!editor} aria-label={`Edit ${row.name}`} onClick={() => openEditor(row)}>Edit</button><button type="button" disabled={!!editor} className="pc-danger" aria-label={`Remove ${row.name}`} onClick={() => remove(row)}>Remove</button></div></td></tr>)}
            {!rows.length && <tr><td colSpan="6" className="pc-empty">No registers yet. Add your first register.</td></tr>}</tbody>
        </table></div>
        <ConfigFooter onBack={onBack} message={message} onSave={saveChanges} />
    </section>;
}

