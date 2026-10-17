import { useEffect, useRef, useState } from "react";
import FilterDropdown from "../../../components/FilterDropdown";
import { ApiError } from "../../../api/http";
import {
  ConfigBadge, ConfigField, ConfigFooter, ConfigHeader, ConfigSwitch,
  DenominationRow, SettingInput,
  newRecordId, normalized, serverTaxClassId, useConfigEditor, useConfigState, usePosSettings, useSaveAction, validMoney,
} from "../shared";
import {
    getPosCurrencyTax,
    updateStoreTaxSettings,
    createStoreTaxClass, updateStoreTaxClass, deleteStoreTaxClass,
    createPosCurrencyTax,
    updatePosCurrencyTax,
} from "./api";

function currencyTaxPayload(values) {
    return {
        currency: values.currency,
        rounding: values.rounding,
        decimalPlaces: Number(values.decimalPlaces),
        taxEnabled: values.taxEnabled,
        defaultTaxRate: values.defaultTaxRate === "" ? undefined : Number(values.defaultTaxRate),
        taxCalculation: values.taxCalculation,
    };
}

export function TaxConfiguration() {
    const settings = usePosSettings();
    const savedId = useRef(null);
    const savedClasses = useRef(new Map());
    const [classesLoaded, setClassesLoaded] = useState(false);
    const [currency, setCurrency] = useConfigState("currency", settings.currency);

    const [rounding, setRounding] = useConfigState("rounding", 
        "nearest-cent"
    );

    const [decimalPlaces, setDecimalPlaces] =
        useConfigState("decimalPlaces", "2");

    const [taxEnabled, setTaxEnabled] =
        useConfigState("taxEnabled", true);

    const [defaultTaxRate, setDefaultTaxRate] =
        useConfigState("defaultTaxRate", "8.25");

    const [taxCalculation, setTaxCalculation] =
        useConfigState("taxCalculation", "item-price");

    const [taxClasses, setTaxClasses] = useConfigState("taxClasses", []);

    const [saving, setSaving] = useState(false);
    const [updatingTaxEnabled, setUpdatingTaxEnabled] = useState(false);
    const togglePending = useRef(false);
    const handleTaxToggle = async () => {
        if (!settings.storeId || saving || togglePending.current) return;
        const next = !taxEnabled;
        togglePending.current = true;
        setUpdatingTaxEnabled(true);
        try {
            const result = await updateStoreTaxSettings(settings.storeId, next);
            if (result?.success === false) throw new Error(result.message || "Unable to update tax settings.");
            setTaxEnabled(next);
            settings.session.baseline = { ...settings.session.baseline, taxEnabled: next };
            if (next) {
                try {
                    const payload = result?.data || result;
                    const classes = Array.isArray(payload?.taxClasses)
                        ? payload.taxClasses
                        : (await getPosCurrencyTax(settings.storeId))?.taxClasses;
                    if (!Array.isArray(classes)) throw new Error("Tax classes were not returned. Please reload the page.");
                    const rows = classes.map(item => ({ ...item, clientId: newRecordId(), name: item.name || "", rate: item.rate == null ? "" : String(item.rate) }));
                    savedClasses.current = new Map(classes.filter(item => item.slug).map(item => [item.slug, item]));
                    setTaxClasses(rows);
                    setClassesLoaded(true);
                    settings.session.baseline = { ...settings.session.baseline, taxClasses: rows };
                } catch (error) {
                    setClassesLoaded(false);
                    alert(error?.message || "Taxes enabled, but tax classes could not be loaded. Please reload the page.");
                }
            }
        } catch (error) {
            alert(error?.message || "Unable to update tax settings.");
        } finally {
            togglePending.current = false;
            setUpdatingTaxEnabled(false);
        }
    };

    const applyCurrencyTax = (record) => {
        savedId.current = record.id;
        savedClasses.current = new Map((record.taxClasses || []).filter(item => item.slug).map(item => [item.slug, item]));
        setClassesLoaded(true);
        setCurrency(record.currency);
        setRounding(record.rounding);
        setDecimalPlaces(String(record.decimalPlaces));
        setTaxEnabled(Boolean(record.taxEnabled));
        setDefaultTaxRate(record.defaultTaxRate === null || record.defaultTaxRate === undefined ? "" : String(record.defaultTaxRate));
        setTaxCalculation(record.taxCalculation);
        setTaxClasses((record.taxClasses || []).map((item) => ({
            ...item,
            id: item.id,
            clientId: newRecordId(),
            name: item.name,
            rate: item.rate == null ? "" : String(item.rate),
        })));
        settings.session.baseline = { ...settings.session.draft };
    };

    useEffect(() => {
        if (!settings.storeId) return undefined;
        let active = true;
        setClassesLoaded(false);
        savedClasses.current = new Map();
        const load = async () => {
            try {
                const record = await getPosCurrencyTax(settings.storeId);
                if (active && record?.id) applyCurrencyTax(record);
                else if (active) { setTaxClasses([]); setClassesLoaded(true); }
            } catch (error) {
                if (!active) return;
                if (error instanceof ApiError && error.status === 404) {
                    setTaxClasses([]);
                    setClassesLoaded(true);
                    return;
                }
                alert(error?.message || "Unable to load currency and tax settings.");
            }
        };
        load();
        return () => { active = false; };
    }, [settings.storeId]);

    const updateTaxClass = (clientId, field, value) => {
        setTaxClasses((items) =>
            items.map((item) =>
                item.clientId === clientId
                    ? {
                          ...item,
                          [field]: value,
                      }
                    : item
            )
        );
    };

    const removeTaxClass = (clientId) => {
        setTaxClasses((items) =>
            items.filter((item) => item.clientId !== clientId)
        );
    };

    const addTaxClass = () => {
        setTaxClasses((items) => [
            ...items,
            {
                id: Date.now(),
                clientId: newRecordId(),
                name: "",
                rate: "0.00",
            },
        ]);
    };

    const saveTaxConfiguration = useSaveAction(async () => {
        if (!settings.storeId) {
            alert("Open Currency & Taxes from a store before saving.");
            return;
        }

        if (!currency) {
            alert("Please select a currency.");
            return;
        }

        if (taxEnabled && !defaultTaxRate) {
            alert("Please enter the default tax rate.");
            return;
        }

        if (taxEnabled && taxClasses.some((item) => !item.name.trim())) {
            alert("Each tax class needs a name.");
            return;
        }

        if (!classesLoaded) {
            alert("Wait for tax classes to load before saving.");
            return;
        }
        if (taxClasses.some(item => !item.name.trim() || (!(item.rates?.length > 1) && (item.rate === "" || !Number.isFinite(Number(item.rate)) || Number(item.rate) < 0 || Number(item.rate) > 100)))) {
            alert("Each tax class needs a name and a rate between 0 and 100.");
            return;
        }
        setSaving(true);

        try {
            for (const item of taxClasses) {
                const original = item.slug ? savedClasses.current.get(item.slug) : null;
                let result;
                if (!item.slug) {
                    result = await createStoreTaxClass(settings.storeId, { name: item.name.trim(), rate: Number(item.rate) });
                    if (!result?.taxClass?.slug) throw new Error("Tax class created, but its slug was not returned. Reload before retrying.");
                    const created = result.taxClass;
                    item.slug = created.slug;
                    setTaxClasses(items => items.map(row => row.clientId === item.clientId ? { ...row, ...created, rate: created.rate == null ? "" : String(created.rate) } : row));
                } else if (original && Number(item.rate) !== Number(original.rate) && !(item.rates?.length > 1)) {
                    result = await updateStoreTaxClass(settings.storeId, item.slug, { rate: Number(item.rate) });
                }
                if (result?.success === false) throw new Error(result.message || "Unable to save tax class.");
                if (result?.taxClasses) savedClasses.current = new Map(result.taxClasses.map(row => [row.slug, row]));
            }
            for (const slug of [...savedClasses.current.keys()]) {
                if (!taxClasses.some(item => item.slug === slug)) {
                    const result = await deleteStoreTaxClass(settings.storeId, slug);
                    if (result?.success === false) throw new Error(result.message || "Unable to delete tax class.");
                    savedClasses.current.delete(slug);
                }
            }
            const payload = currencyTaxPayload({
                currency,
                rounding,
                decimalPlaces,
                taxEnabled,
                defaultTaxRate,
                taxCalculation,
                taxClasses,
            });
            if (savedId.current) {
                await updatePosCurrencyTax(settings.storeId, payload);
            } else {
                await createPosCurrencyTax(settings.storeId, payload);
            }
            const record = await getPosCurrencyTax(settings.storeId);
            if (!record || !Array.isArray(record.taxClasses)) {
                throw new Error("Settings saved, but tax classes could not be refreshed. Please reload the page.");
            }
            applyCurrencyTax(record);
            return true;
        } finally {
            setSaving(false);
        }
    });

    return (
        <div className="pos-panel currency-tax-panel">

            {/* =================================================
                HEADER
            ================================================= */}

            <ConfigHeader />


            {/* =================================================
                TWO COLUMN CONFIGURATION
            ================================================= */}

            <div className="currency-tax-grid">

                {/* =================================================
                    CURRENCY SETTINGS
                ================================================= */}

                <div className="currency-tax-card">

                    <div className="currency-tax-card-header">

                        <h3>
                            Currency Settings
                        </h3>

                    </div>


                    {/* CURRENCY */}

                    <div className="currency-tax-field">

                        <label>
                            Currency
                            <span className="required">*</span>
                        </label>

                        <div className="currency-tax-input-wrap">

                            <FilterDropdown
                                value={currency}
                                onChange={(event) =>
                                    setCurrency(
                                        event.target.value
                                    )
                                }
                            >
                                <option value="USD">
                                    USD - US Dollar
                                </option>

                                <option value="INR">
                                    INR - Indian Rupee
                                </option>

                                <option value="EUR">
                                    EUR - Euro
                                </option>

                                <option value="GBP">
                                    GBP - British Pound
                                </option>

                                <option value="CAD">
                                    CAD - Canadian Dollar
                                </option>

                                <option value="AUD">
                                    AUD - Australian Dollar
                                </option>
                            </FilterDropdown>

                            <i className="bi bi-chevron-down" />

                        </div>

                    </div>


                    {/* ROUNDING */}

                    <div className="currency-tax-field">

                        <label>
                            Rounding
                        </label>

                        <div className="currency-tax-input-wrap">

                            <FilterDropdown
                                value={rounding}
                                onChange={(event) =>
                                    setRounding(
                                        event.target.value
                                    )
                                }
                            >
                                <option value="nearest-cent">
                                    Round to nearest cent (0.01)
                                </option>

                                <option value="nearest-dollar">
                                    Round to nearest dollar (1.00)
                                </option>

                                <option value="down">
                                    Always round down
                                </option>

                                <option value="up">
                                    Always round up
                                </option>
                            </FilterDropdown>

                            <i className="bi bi-chevron-down" />

                        </div>

                    </div>


                    {/* DECIMAL PLACES */}

                    <div className="currency-tax-field">

                        <label>
                            Decimal Places
                        </label>

                        <input
                            type="number"
                            min="0"
                            max="4"
                            value={decimalPlaces}
                            onChange={(event) =>
                                setDecimalPlaces(
                                    event.target.value
                                )
                            }
                        />

                    </div>

                </div>


                {/* =================================================
                    TAX CONFIGURATION
                ================================================= */}

                <div className="currency-tax-card">

                    <div className="currency-tax-card-header">

                        <h3>
                            Tax Configuration
                        </h3>

                    </div>


                    {/* ENABLE TAX */}

                    <div className="tax-enable-row">

                        <label>
                            Enable Taxes
                        </label>

                        <button
                            type="button"
                            className={`tax-switch ${
                                taxEnabled
                                    ? "active"
                                    : ""
                            }`}
                            onClick={handleTaxToggle}
                            disabled={saving || updatingTaxEnabled || !classesLoaded}
                            aria-busy={updatingTaxEnabled}
                            aria-pressed={taxEnabled}
                        >
                            <span />
                        </button>

                    </div>


                    {taxEnabled && (
                        <>

                            {/* DEFAULT RATE + CALCULATION */}

                            <div className="tax-top-fields">

                                <div className="currency-tax-field">

                                    <label>
                                        Default Tax Rate (%)
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={
                                            defaultTaxRate
                                        }
                                        onChange={(event) =>
                                            setDefaultTaxRate(
                                                event.target.value
                                            )
                                        }
                                        placeholder="0.00"
                                    />

                                </div>


                                <div className="currency-tax-field">

                                    <label>
                                        Tax Calculation
                                    </label>

                                    <div className="currency-tax-input-wrap">

                                        <FilterDropdown
                                            value={
                                                taxCalculation
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setTaxCalculation(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                        >
                                            <option value="item-price">
                                                Calculate Tax on Item Price
                                            </option>

                                            <option value="subtotal">
                                                Calculate Tax on Subtotal
                                            </option>

                                            <option value="total">
                                                Calculate Tax on Total
                                            </option>
                                        </FilterDropdown>

                                        <i className="bi bi-chevron-down" />

                                    </div>

                                </div>

                            </div>


                            {/* TAX CLASSES */}

                            <div className="tax-class-section">

                                <div className="tax-class-heading">

                                    <h4>
                                        Tax Classes Mapping
                                    </h4>

                                </div>


                                <div className="tax-class-table">

                                    {taxClasses.map(
                                        (taxClass) => (

                                            <div
                                                className="tax-class-row"
                                                key={taxClass.clientId}
                                            >

                                                <div className="tax-class-name">

                                                    <input
                                                        type="text"
                                                        disabled={saving || Boolean(taxClass.slug)}
                                                        value={
                                                            taxClass.name
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            updateTaxClass(
                                                                taxClass.clientId,
                                                                "name",
                                                                event
                                                                    .target
                                                                    .value
                                                            )
                                                        }
                                                        placeholder="Tax class name"
                                                    />

                                                </div>


                                                <div className="tax-class-rate">

                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        disabled={saving || taxClass.rates?.length > 1}
                                                        title={taxClass.rates?.length > 1 ? "Multiple regional rates cannot be edited in this form" : ""}
                                                        step="0.01"
                                                        value={
                                                            taxClass.rate
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            updateTaxClass(
                                                                taxClass.clientId,
                                                                "rate",
                                                                event
                                                                    .target
                                                                    .value
                                                            )
                                                        }
                                                    />

                                                </div>

                                                <span className="tax-percent">
                                                    %
                                                </span>


                                                <button
                                                    type="button"
                                                    className="tax-class-delete"
                                                    disabled={saving || taxClass.slug === "standard"}
                                                    onClick={() =>
                                                        removeTaxClass(
                                                            taxClass.clientId
                                                        )
                                                    }
                                                    aria-label={`Remove ${taxClass.name || "tax class"}`}
                                                >
                                                    <i className="bi bi-trash3" />
                                                </button>

                                            </div>

                                        )
                                    )}

                                </div>


                                {/* ADD TAX CLASS */}

                                <button
                                    type="button"
                                    className="add-tax-class-button"
                                    onClick={addTaxClass}
                                    disabled={saving || updatingTaxEnabled || !classesLoaded}
                                >
                                    <i className="bi bi-plus-lg" />
                                    Add Tax Class
                                </button>

                            </div>

                        </>
                    )}

                </div>

            </div>


            {/* =================================================
                ACTIONS
            ================================================= */}

            <div className="currency-tax-actions pos-form-actions">

                <button
                    type="button"
                    className="currency-tax-back-button"
                    onClick={() => settings.requestLeave(null)}
                >Cancel</button>

                <button
                    type="button"
                    className="currency-tax-save-button"
                    onClick={saveTaxConfiguration}
                    disabled={saving || updatingTaxEnabled || !classesLoaded}
                >
                    {saving
                        ? "Saving..."
                        : "Save Changes"}
                </button>

            </div>

        </div>
    );
}

