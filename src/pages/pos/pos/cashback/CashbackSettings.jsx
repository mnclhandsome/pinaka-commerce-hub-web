import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../api/http";
import {
  ConfigBadge, ConfigField, ConfigFooter, ConfigHeader, ConfigSwitch,
  DenominationRow, SettingInput,
  newRecordId, normalized, serverTaxClassId, useConfigEditor, useConfigState, usePosSettings, useSaveAction, validMoney,
} from "../shared";
import {
    getPosCashback,
    createPosCashback,
    updatePosCashback,
} from "./api";

function cashbackPayload(values) {
    return {
        enabled: values.enabled,
        ...(values.maxCashback === "" ? {} : { maxCashback: Number(values.maxCashback) }),
        tiers: values.tiers
            .filter((item) => item.from !== "" && item.to !== "" && item.fee !== "")
            .map((item) => ({
                ...(typeof item.id === "string" && serverTaxClassId.test(item.id) ? { id: item.id } : {}),
                from: Number(item.from),
                to: Number(item.to),
                fee: Number(item.fee),
            })),
    };
}

export function CashbackSettings() {
    const settings = usePosSettings();
    const savedId = useRef(null);
    const currency = settings.currency;
    
    const [enabled, setEnabled] = useConfigState("enabled", false);

    const [maxCashback, setMaxCashback] =
        useConfigState("maxCashback", "");

    const [tiers, setTiers] = useConfigState("tiers", [
        {
            id: 1,
            from: "1",
            to: "9.9",
            fee: "1",
        },
        {
            id: 2,
            from: "10",
            to: "1000",
            fee: "10",
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
            },
        ]);
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

    const removeTier = (id) => {
        setTiers((items) =>
            items.filter((item) => item.id !== id)
        );
    };

    const applyCashback = (record) => {
        savedId.current = record.id;
        setEnabled(Boolean(record.enabled));
        setMaxCashback(record.maxCashback === null || record.maxCashback === undefined ? "" : String(record.maxCashback));
        setTiers((record.tiers || []).map((item) => ({
            id: item.id,
            from: String(item.from),
            to: String(item.to),
            fee: String(item.fee),
        })));
        settings.session.baseline = { ...settings.session.draft };
    };

    useEffect(() => {
        if (!settings.storeId) return undefined;
        let active = true;
        getPosCashback(settings.storeId)
            .then((record) => {
                if (active && record?.id) applyCashback(record);
            })
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) return;
                if (active) alert(error?.message || "Unable to load cashback settings.");
            });
        return () => { active = false; };
    }, [settings.storeId]);

    const saveCashbackSettings = useSaveAction(async () => {
        if (!settings.storeId) {
            alert("Open Cashback Settings from a store before saving.");
            return;
        }

        if (enabled && maxCashback === "") {
            alert("Please enter the maximum cashback limit.");
            return;
        }

        if (enabled && tiers.some((item) => item.from === "" || item.to === "" || item.fee === "")) {
            alert("Each cashback tier needs a from, to, and fee.");
            return;
        }

        const payload = cashbackPayload({ enabled, maxCashback, tiers });
        const record = savedId.current
            ? await updatePosCashback(settings.storeId, payload)
            : await createPosCashback(settings.storeId, payload);
        applyCashback(record);
        return true;
    });

    return (
        <div className="pos-panel cashback-panel">

            {/* =================================================
                HEADER
            ================================================= */}

            <ConfigHeader />


            {/* =================================================
                GENERAL SETTINGS
            ================================================= */}

            <div className="cashback-card">

                <div className="cashback-card-header">

                    {/* <div className="cashback-section-icon">
                        <i className="bi bi-gear" />
                    </div>

                    <div>
                        <h3>General Settings</h3>

                        <p>
                            Enable cashback and configure
                            the maximum allowed amount.
                        </p>
                    </div> */}

                </div>


                <div className="cashback-general-grid">

                    {/* ENABLE CASHBACK */}

                    <div className="cashback-setting">

                        <label>
                            Enable Cash Back
                        </label>

                        <button
                            type="button"
                            className={`cashback-switch ${
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


                    {/* MAX LIMIT */}

                    <div className="cashback-setting cashback-limit-setting">

                        <label>
                            Max Cash Back Limit ({currency})
                        </label>

                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={maxCashback}
                            onChange={(event) =>
                                setMaxCashback(
                                    event.target.value
                                )
                            }
                            placeholder="Enter maximum cashback limit"
                        />

                    </div>

                </div>

            </div>


            {/* =================================================
                CASHBACK FEE TIERS
            ================================================= */}

            <div className="cashback-card cashback-tiers-card">

                <div className="cashback-card-header">

                    <div className="cashback-section-icon purple">
                        <i className="bi bi-list-ul" />
                    </div>

                    <div>

                        <h3>
                            Cash Back Fee Tiers
                        </h3>

                        <p>
                            Configure cashback fee tiers
                            based on the cashback amount.
                        </p>

                    </div>

                    <button
                        type="button"
                        className="cashback-add-button"
                        onClick={addTier}
                    >
                        <i className="bi bi-plus-lg" />
                        Add Tier
                    </button>

                </div>


                {/* TABLE */}

                <div className="cashback-table-wrapper">

                    <table className="cashback-table">

                        <thead>

                            <tr>

                                <th>
                                    From ({currency})
                                </th>

                                <th>
                                    To ({currency})
                                </th>

                                <th>
                                    Fee ({currency})
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
                                            type="number"
                                            min="0"
                                            step="0.01"
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
                                            type="number"
                                            min="0"
                                            step="0.01"
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

                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
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

                                    </td>


                                    {/* ACTIONS */}

                                    <td>

                                        <div className="cashback-actions">

                                            <button
                                                type="button"
                                                className="cashback-edit"
                                                title="Edit"
                                            >
                                                <i className="bi bi-pencil" />
                                            </button>

                                            <button
                                                type="button"
                                                className="cashback-delete"
                                                title="Remove"
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


                {/* TABLE FOOTER */}

                <div className="cashback-table-footer">

                    <span>
                        Showing 1 to {tiers.length} of{" "}
                        {tiers.length} entries
                    </span>

                    <div className="cashback-pagination">

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
                ACTIONS
            ================================================= */}

            <div className="cashback-page-actions pos-form-actions">

                <button
                    type="button"
                    className="cashback-cancel-button"
                 onClick={() => settings.requestLeave(null)}>
                    Cancel
                </button>

                <button
                    type="button"
                    className="cashback-save-button"
                    onClick={saveCashbackSettings}
                >
                    Save Changes
                </button>

            </div>

        </div>
    );
}

