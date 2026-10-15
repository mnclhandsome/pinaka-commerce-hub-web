import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../api/http";
import {
  ConfigBadge, ConfigField, ConfigFooter, ConfigHeader, ConfigSwitch,
  DenominationRow, SettingInput,
  newRecordId, normalized, serverTaxClassId, useConfigEditor, useConfigState, usePosSettings, useSaveAction, validMoney,
} from "../shared";
import {
    getPosServiceCharges,
    createPosServiceCharges,
    updatePosServiceCharges,
} from "./api";

function serviceChargePayload(values) {
    return {
        enabled: values.enabled,
        applyTo: values.applyTo,
        defaultType: values.defaultType,
        maxLimit: Number(values.maxLimit),
        tiers: values.tiers
            .filter((item) => item.from.trim() && item.to.trim() && item.fee.trim())
            .map((item) => ({
                ...(typeof item.id === "string" && serverTaxClassId.test(item.id) ? { id: item.id } : {}),
                from: item.from.trim(),
                to: item.to.trim(),
                fee: item.fee.trim(),
                feeType: item.feeType,
                appliesTo: item.appliesTo,
            })),
    };
}

export function ServiceChargeSettings() {
    const settings = usePosSettings();
    const savedId = useRef(null);
    const currency = settings.currency;
    const currencySymbol = settings.currencySymbol;
    const [enabled, setEnabled] = useConfigState("enabled", true);

    const [applyTo, setApplyTo] = useConfigState("applyTo", "order-total");

    const [defaultType, setDefaultType] =
        useConfigState("defaultType", "percentage");

    const [maxLimit, setMaxLimit] = useConfigState("maxLimit", "10");

    const [tiers, setTiers] = useConfigState("tiers", [
        {
            id: 1,
            from: "0",
            to: "100",
            fee: "5",
            feeType: "Percentage",
            appliesTo: "Dine-In",
        },
        {
            id: 2,
            from: "101",
            to: "500",
            fee: "8",
            feeType: "Percentage",
            appliesTo: "Delivery",
        },
        {
            id: 3,
            from: "501+",
            to: "50",
            fee: "Fixed",
            feeType: "Fixed",
            appliesTo: "Takeaway",
        },
    ]);

    const addTier = () => {
        setTiers((items) => [
            ...items,
            {
                id: Date.now(),
                from: "",
                to: "",
                fee: "",
                feeType: "Percentage",
                appliesTo: "Dine-In",
            },
        ]);
    };

    const removeTier = (id) => {
        setTiers((items) =>
            items.filter((item) => item.id !== id)
        );
    };

    const updateTier = (id, field, value) => {
        setTiers((items) =>
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

    const applyServiceCharge = (record) => {
        savedId.current = record.id;
        setEnabled(Boolean(record.enabled));
        setApplyTo(record.applyTo);
        setDefaultType(record.defaultType);
        setMaxLimit(record.maxLimit === null || record.maxLimit === undefined ? "" : String(record.maxLimit));
        setTiers((record.tiers || []).map((item) => ({
            id: item.id,
            from: item.from,
            to: item.to,
            fee: item.fee,
            feeType: item.feeType,
            appliesTo: item.appliesTo,
        })));
        settings.session.baseline = { ...settings.session.draft };
    };

    useEffect(() => {
        if (!settings.storeId) return undefined;
        let active = true;
        getPosServiceCharges(settings.storeId)
            .then((record) => {
                if (active && record?.id) applyServiceCharge(record);
            })
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) return;
                if (active) alert(error?.message || "Unable to load service charge settings.");
            });
        return () => { active = false; };
    }, [settings.storeId]);

    const saveServiceChargeSettings = useSaveAction(async () => {
        if (!settings.storeId) {
            alert("Open Service Charges from a store before saving.");
            return;
        }

        if (!applyTo) {
            alert("Please select Apply To.");
            return;
        }

        if (!defaultType) {
            alert("Please select Default Charge Type.");
            return;
        }

        if (!maxLimit) {
            alert(
                "Please enter Maximum Service Charge Limit."
            );
            return;
        }

        if (enabled && tiers.some((item) => !item.from.trim() || !item.to.trim() || !item.fee.trim())) {
            alert("Each service charge tier needs a from, to, and fee.");
            return;
        }

        const payload = serviceChargePayload({
            enabled,
            applyTo,
            defaultType,
            maxLimit,
            tiers,
        });
        const record = savedId.current
            ? await updatePosServiceCharges(settings.storeId, payload)
            : await createPosServiceCharges(settings.storeId, payload);
        applyServiceCharge(record);
        return true;
    });

    return (
        <div className="pos-panel service-charge-panel">

            {/* =================================================
                PAGE HEADER
            ================================================= */}

            <ConfigHeader />


            {/* =================================================
                GENERAL SETTINGS
            ================================================= */}

            <div className="service-charge-card">


                <div className="service-charge-general-grid">

                    {/* ENABLE */}

                    <div className="service-charge-setting">

                        <label>
                            Enable Service Charge
                        </label>

                        <button
                            type="button"
                            className={`service-charge-switch ${
                                enabled ? "active" : ""
                            }`}
                            onClick={() =>
                                setEnabled(
                                    (value) => !value
                                )
                            }
                            aria-pressed={enabled}
                        >
                            <span />
                        </button>

                    </div>


                    {/* APPLY TO */}

                    <div className="service-charge-setting">

                        <label>
                            Apply To
                        </label>

                        <div className="service-charge-select">

                            <select
                                value={applyTo}
                                onChange={(event) =>
                                    setApplyTo(
                                        event.target.value
                                    )
                                }
                            >
                                <option value="order-total">
                                    Order Total
                                </option>

                                <option value="line-item">
                                    Each Line Item
                                </option>
                            </select>

                            <i className="bi bi-chevron-down" />

                        </div>

                    </div>


                    {/* DEFAULT CHARGE TYPE */}

                    <div className="service-charge-setting">

                        <label>
                            Default Charge Type
                        </label>

                        <div className="service-charge-select">

                            <select
                                value={defaultType}
                                onChange={(event) =>
                                    setDefaultType(
                                        event.target.value
                                    )
                                }
                            >
                                <option value="percentage">
                                    Percentage
                                </option>

                                <option value="fixed">
                                    Fixed
                                </option>
                            </select>

                            <i className="bi bi-chevron-down" />

                        </div>

                    </div>


                    {/* MAXIMUM LIMIT */}

                    <div className="service-charge-setting">

                        <label>
                            Maximum Service Charge Limit
                        </label>

                        <div className="service-charge-limit-input">

                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={maxLimit}
                                onChange={(event) =>
                                    setMaxLimit(
                                        event.target.value
                                    )
                                }
                            />

                            <span>{defaultType === "percentage" ? "%" : currencySymbol}</span>

                        </div>

                    </div>

                </div>

            </div>


            {/* =================================================
                SERVICE CHARGE TIERS
            ================================================= */}

            <div className="service-charge-card service-charge-tiers-card">

                <div className="service-charge-card-header">

                    <div className="service-charge-section-icon purple">
                        <i className="bi bi-list-ul" />
                    </div>

                    <div>

                        <h3>
                            Service Charge Tiers
                        </h3>

                        <p>
                            Configure tier-wise service charge
                            rules.
                        </p>

                    </div>

                    <button
                        type="button"
                        className="service-charge-add-button"
                        onClick={addTier}
                    >
                        <i className="bi bi-plus-lg" />
                        Add Tier
                    </button>

                </div>


                {/* TABLE */}

                <div className="service-charge-table-wrapper">

                    <table className="service-charge-table">

                        <thead>

                            <tr>

                                <th>
                                    From ({currency})
                                </th>

                                <th>
                                    To ({currency})
                                </th>

                                <th>
                                    Fee
                                </th>

                                <th>
                                    Fee Type
                                </th>

                                <th>
                                    Applies To
                                </th>

                                <th>
                                    Actions
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            {tiers.map((tier) => (

                                <tr key={tier.id}>

                                    {/* FROM */}

                                    <td>

                                        <input
                                            type="text"
                                            value={tier.from}
                                            placeholder="From"
                                            onChange={(event) =>
                                                updateTier(
                                                    tier.id,
                                                    "from",
                                                    event.target.value
                                                )
                                            }
                                        />

                                    </td>


                                    {/* TO */}

                                    <td>

                                        <input
                                            type="text"
                                            value={tier.to}
                                            placeholder="To"
                                            onChange={(event) =>
                                                updateTier(
                                                    tier.id,
                                                    "to",
                                                    event.target.value
                                                )
                                            }
                                        />

                                    </td>


                                    {/* FEE */}

                                    <td>

                                        <div className="service-charge-fee-input">

                                            <input
                                                type="text"
                                                value={tier.fee}
                                                placeholder="Fee"
                                                onChange={(event) =>
                                                    updateTier(
                                                        tier.id,
                                                        "fee",
                                                        event.target.value
                                                    )
                                                }
                                            />

                                            <span>{tier.feeType === "Percentage" ? "%" : currencySymbol}</span>

                                        </div>

                                    </td>


                                    {/* FEE TYPE */}

                                    <td>

                                        <div className="service-charge-table-select">

                                            <select
                                                value={
                                                    tier.feeType
                                                }
                                                onChange={(event) =>
                                                    updateTier(
                                                        tier.id,
                                                        "feeType",
                                                        event.target.value
                                                    )
                                                }
                                            >
                                                <option value="Percentage">
                                                    Percentage
                                                </option>

                                                <option value="Fixed">
                                                    Fixed
                                                </option>
                                            </select>

                                            <i className="bi bi-chevron-down" />

                                        </div>

                                    </td>


                                    {/* APPLIES TO */}

                                    <td>

                                        <div className="service-charge-table-select">

                                            <select
                                                value={
                                                    tier.appliesTo
                                                }
                                                onChange={(event) =>
                                                    updateTier(
                                                        tier.id,
                                                        "appliesTo",
                                                        event.target.value
                                                    )
                                                }
                                            >
                                                <option value="Dine-In">
                                                    Dine-In
                                                </option>

                                                <option value="Delivery">
                                                    Delivery
                                                </option>

                                                <option value="Takeaway">
                                                    Takeaway
                                                </option>

                                                <option value="All">
                                                    All
                                                </option>
                                            </select>

                                            <i className="bi bi-chevron-down" />

                                        </div>

                                    </td>


                                    {/* ACTIONS */}

                                    <td>

                                        <div className="service-charge-actions">

                                            <button
                                                type="button"
                                                className="service-charge-edit"
                                                title="Edit"
                                            >
                                                <i className="bi bi-pencil" />
                                            </button>

                                            <button
                                                type="button"
                                                className="service-charge-delete"
                                                title="Delete"
                                                onClick={() =>
                                                    removeTier(
                                                        tier.id
                                                    )
                                                }
                                            >
                                                <i className="bi bi-trash3" />
                                            </button>

                                        </div>

                                    </td>

                                </tr>

                            ))}

                        </tbody>

                    </table>

                </div>


                {/* FOOTER */}

                <div className="service-charge-table-footer">

                    <span>
                        Showing 1 to {tiers.length} of{" "}
                        {tiers.length} entries
                    </span>

                    <div className="service-charge-pagination">

                        <button
                            type="button"
                            disabled
                        >
                            <i className="bi bi-chevron-left" />
                        </button>

                        <button
                            type="button"
                            className="active"
                        >
                            1
                        </button>

                        <button type="button">
                            <i className="bi bi-chevron-right" />
                        </button>

                    </div>

                </div>

            </div>


            {/* =================================================
                PAGE ACTIONS
            ================================================= */}

            <div className="service-charge-page-actions pos-form-actions">

                <button
                    type="button"
                    className="service-charge-cancel-button"
                 onClick={() => settings.requestLeave(null)}>
                    Cancel
                </button>

                <button
                    type="button"
                    className="service-charge-save-button"
                    onClick={saveServiceChargeSettings}
                >
                    Save Changes
                </button>

            </div>

        </div>
    );
}


