import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../api/http";
import {
  ConfigBadge, ConfigField, ConfigFooter, ConfigHeader, ConfigSwitch,
  DenominationRow, SettingInput,
  newRecordId, normalized, serverTaxClassId, useConfigEditor, useConfigState, usePosSettings, useSaveAction, validMoney,
} from "../shared";
import {
    getPosTerminalMappings,
    createPosTerminalMappings,
    updatePosTerminalMappings,
} from "./api";

export function mappingRows(items) {
    return (items || []).map((item) => ({
        id: item.id,
        registerId: item.registerId,
        terminal: item.terminal || "",
        printer: item.printer || "",
        drawer: item.drawer || "",
        status: item.status,
    }));
}

function mappingPayload(rows) {
    return {
        mappings: rows.map((row) => ({
            ...(typeof row.id === "string" && serverTaxClassId.test(row.id) ? { id: row.id } : {}),
            registerId: row.registerId,
            terminal: (row.terminal || "").trim(),
            printer: (row.printer || "").trim(),
            drawer: (row.drawer || "").trim(),
            status: row.status,
        })),
    };
}

export function MappingConfiguration({ value, registers, onSave, onBack, onManageRegisters }) {
    const settings = usePosSettings();
    const savedId = useRef(null);
    
    
    const [rows, setRows] = useConfigState("rows", () => value.map((row) => ({ ...row })));
    const [editor, setEditor] = useConfigEditor();
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const update = (field, next) => setEditor((row) => ({ ...row, [field]: next }));
    const apply = (event) => {
        event?.preventDefault();
        const row = { ...editor, terminal: editor.terminal.trim(), printer: editor.printer.trim(), drawer: editor.drawer.trim() };
        const register = registers.find((item) => item.id === row.registerId);
        if (!register) { setError("Choose an existing register."); return; }
        if (row.status === "Active" && (register.status !== "Active" || !row.terminal || !row.printer || !row.drawer)) {
            setError("Active mappings require an active register, card terminal, printer and cash drawer. Use Setup for incomplete mappings."); return;
        }
        if (rows.some((other) => other.id !== row.id && (other.registerId === row.registerId ||
            (row.terminal && normalized(other.terminal) === normalized(row.terminal)) ||
            (row.drawer && normalized(other.drawer) === normalized(row.drawer))))) {
            setError("A register, card terminal or cash drawer cannot be assigned to more than one mapping."); return;
        }
        const nextRows = rows.some((item) => item.id === row.id)
            ? rows.map((item) => item.id === row.id ? row : item) : [...rows, row];
        setRows(nextRows);
        setEditor(null); setError(""); setMessage("Mapping applied to the draft. Save Changes to keep it for this session.");
        return nextRows;
    };

    const applyMappings = (record) => {
        const savedRows = mappingRows(record.mappings);
        savedId.current = record.id;
        setRows(savedRows);
        onSave(savedRows);
        settings.session.baseline = { ...settings.session.draft };
    };

    useEffect(() => {
        if (!settings.storeId) return undefined;
        let active = true;
        getPosTerminalMappings(settings.storeId)
            .then((record) => {
                if (active && record?.id) applyMappings(record);
            })
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) return;
                if (active) setError(error?.message || "Unable to load terminal mappings.");
            });
        return () => { active = false; };
    }, [settings.storeId]);

    const saveChanges = useSaveAction(async () => {
        if (!settings.storeId) {
            setError("Open Terminals & Registers from a store before saving.");
            return false;
        }
        const nextRows = editor ? apply() : rows;
        if (!nextRows) return false;
        const record = savedId.current
            ? await updatePosTerminalMappings(settings.storeId, mappingPayload(nextRows))
            : await createPosTerminalMappings(settings.storeId, mappingPayload(nextRows));
        applyMappings(record);
        setError("");
        setMessage("Changes are saved.");
        return true;
    });
    return <section className="pc-screen">
        <ConfigHeader icon="display" title="Terminals & Registers" description="Map POS devices and peripherals to registers.">
            <button type="button" className="pc-button pc-primary" disabled={!!editor}
                onClick={() => { setEditor({ id: newRecordId(), registerId: registers.find((register) => !rows.some((row) => row.registerId === register.id))?.id || "", terminal: "", printer: "", drawer: "", status: "Setup" }); setError(""); setMessage(""); }}>+ Add Mapping</button>
        </ConfigHeader>
        <p className="pc-help">POS devices come from Cash Register Settings. Add a register there before mapping its peripherals.</p>
        {editor && <form className="pc-editor" onSubmit={apply}><h3>{rows.some((row) => row.id === editor.id) ? "Edit Mapping" : "Add Mapping"}</h3>
            {!registers.some((register) => !rows.some((row) => row.id !== editor.id && row.registerId === register.id)) && <div className="pc-mapping-notice" role="status">
                <p>{registers.length ? "All registers already have a mapping. Cancel to edit an existing mapping, or add and save a new register first." : "Add and save a register before creating its device mapping."}</p>
                <button type="button" className="pc-button" onClick={onManageRegisters}>Open Cash Register Settings</button>
            </div>}
           <div className="pc-form-grid">
                <ConfigField label="Register">
                    <select required value={editor.registerId || ""} onChange={(event) => update("registerId", event.target.value)}>
                        <option value="">Select a register</option>
                        {registers.map((register) => (
                            <option key={register.id} value={register.id}>{register.name} · {register.pos}</option>
                        ))}
                    </select>
                </ConfigField>
                <ConfigField label="Card Terminal"><input value={editor.terminal || ""} onChange={(event) => update("terminal", event.target.value)} placeholder="LANE3000-001" /></ConfigField>
                <ConfigField label="Printer"><input value={editor.printer || ""} onChange={(event) => update("printer", event.target.value)} placeholder="STAR-01" /></ConfigField>
                <ConfigField label="Cash Drawer"><input value={editor.drawer || ""} onChange={(event) => update("drawer", event.target.value)} placeholder="DRAWER-01" /></ConfigField>
                <ConfigField label="Status">
                    <select value={editor.status} onChange={(event) => update("status", event.target.value)}>
                        <option>Active</option>
                        <option>Inactive</option>
                        <option>Setup</option>
                    </select>
                </ConfigField>
            </div>
        <div className="pc-editor-actions pos-form-actions"><button type="button" className="pc-button" onClick={() => settings.requestLeave(null)}>Cancel</button><button type="submit" className="pc-button pc-primary" disabled={!editor.registerId}>Apply Mapping</button></div></form>}
        {error && <p className="pc-error" role="alert">{error}</p>}
        <div className="pc-table-wrap"><table className="pc-table"><caption className="pc-sr-only">Terminal and register mappings</caption><thead><tr>{["Register", "POS Device", "Card Terminal", "Printer", "Cash Drawer", "Status", "Actions"].map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead><tbody>
            {rows.map((row) => { const register = registers.find((item) => item.id === row.registerId); return <tr key={row.id}><th scope="row">{register?.name || "Missing register"}</th><td>{register?.pos || "—"}</td><td>{row.terminal || "—"}</td><td>{row.printer || "—"}</td><td>{row.drawer || "—"}</td><td><ConfigBadge>{row.status}</ConfigBadge></td><td><div className="pc-row-actions"><button type="button" disabled={!!editor} aria-label={`Edit mapping for ${register?.name}`} onClick={() => { setEditor({ ...row }); setError(""); setMessage(""); }}>Edit</button><button type="button" disabled={!!editor} className="pc-danger" aria-label={`Remove mapping for ${register?.name}`} onClick={() => { setRows((current) => current.filter((item) => item.id !== row.id)); setError(""); setMessage("Mapping removed from the draft. Save Changes to keep this change."); }}>Remove</button></div></td></tr>; })}
            {!rows.length && <tr><td colSpan="7" className="pc-empty">No mappings yet. Add a mapping to connect your devices.</td></tr>}
        </tbody></table></div>
        <ConfigFooter onBack={onBack} message={message} onSave={saveChanges} />
    </section>;
}

