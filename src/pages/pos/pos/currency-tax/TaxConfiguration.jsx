import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../api/http";
import {
  ConfigBadge, ConfigField, ConfigFooter, ConfigHeader, ConfigSwitch,
  DenominationRow, SettingInput,
  newRecordId, normalized, serverTaxClassId, useConfigEditor, useConfigState, usePosSettings, useSaveAction, validMoney,
} from "../shared";
import {
    getPosCurrencyTax,
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
        taxClasses: values.taxClasses
            .filter((item) => item.name.trim())
            .map((item) => ({
                ...(typeof item.id === "string" && serverTaxClassId.test(item.id) ? { id: item.id } : {}),
                name: item.name.trim(),
                rate: Number(item.rate),
            })),
    };
}

export function TaxConfiguration() {
    const settings = usePosSettings();
    const savedId = useRef(null);
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

    const [taxClasses, setTaxClasses] = useConfigState("taxClasses", [
        {
            id: 1,
            name: "Standard",
            rate: "8.25",
        },
        {
            id: 2,
            name: "Reduced",
            rate: "0.00",
        },
        {
            id: 3,
            name: "Zero Rated",
            rate: "0.00",
        },
    ]);

    const [saving, setSaving] = useState(false);

    const applyCurrencyTax = (record) => {
        savedId.current = record.id;
        setCurrency(record.currency);
        setRounding(record.rounding);
        setDecimalPlaces(String(record.decimalPlaces));
        setTaxEnabled(Boolean(record.taxEnabled));
        setDefaultTaxRate(record.defaultTaxRate === null || record.defaultTaxRate === undefined ? "" : String(record.defaultTaxRate));
        setTaxCalculation(record.taxCalculation);
        setTaxClasses((record.taxClasses || []).map((item) => ({
            id: item.id,
            name: item.name,
            rate: String(item.rate),
        })));
        settings.session.baseline = { ...settings.session.draft };
    };

    useEffect(() => {
        if (!settings.storeId) return undefined;
        let active = true;
        getPosCurrencyTax(settings.storeId)
            .then((record) => {
                if (active && record?.id) applyCurrencyTax(record);
            })
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) return;
                if (active) alert(error?.message || "Unable to load currency and tax settings.");
            });
        return () => { active = false; };
    }, [settings.storeId]);

    const updateTaxClass = (id, field, value) => {
        setTaxClasses((items) =>
            items.map((item) =>
                item.id === id
                    ? {
                          ...item,
                          [field]: value,
                      }
                    : item
            )
        );
    };

    const removeTaxClass = (id) => {
        setTaxClasses((items) =>
            items.filter((item) => item.id !== id)
        );
    };

    const addTaxClass = () => {
        setTaxClasses((items) => [
            ...items,
            {
                id: Date.now(),
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

        setSaving(true);

        try {
            const payload = currencyTaxPayload({
                currency,
                rounding,
                decimalPlaces,
                taxEnabled,
                defaultTaxRate,
                taxCalculation,
                taxClasses,
            });
            const record = savedId.current
                ? await updatePosCurrencyTax(settings.storeId, payload)
                : await createPosCurrencyTax(settings.storeId, payload);
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

                            <select
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
                            </select>

                            <i className="bi bi-chevron-down" />

                        </div>

                    </div>


                    {/* ROUNDING */}

                    <div className="currency-tax-field">

                        <label>
                            Rounding
                        </label>

                        <div className="currency-tax-input-wrap">

                            <select
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
                            </select>

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
                            onClick={() =>
                                setTaxEnabled(
                                    (value) => !value
                                )
                            }
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

                                        <select
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
                                        </select>

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
                                                key={
                                                    taxClass.id
                                                }
                                            >

                                                <div className="tax-class-name">

                                                    <input
                                                        type="text"
                                                        value={
                                                            taxClass.name
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            updateTaxClass(
                                                                taxClass.id,
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
                                                        step="0.01"
                                                        value={
                                                            taxClass.rate
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            updateTaxClass(
                                                                taxClass.id,
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
                                                    onClick={() =>
                                                        removeTaxClass(
                                                            taxClass.id
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
                    disabled={saving}
                >
                    {saving
                        ? "Saving..."
                        : "Save Changes"}
                </button>

            </div>

        </div>
    );
}

