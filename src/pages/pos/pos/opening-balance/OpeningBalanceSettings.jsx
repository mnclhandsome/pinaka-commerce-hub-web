import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../api/http";
import {
  ConfigBadge, ConfigField, ConfigFooter, ConfigHeader, ConfigSwitch,
  DenominationRow, SettingInput,
  newRecordId, normalized, serverTaxClassId, useConfigEditor, useConfigState, usePosSettings, useSaveAction, validMoney,
} from "../shared";
import {
    getPosOpeningBalance,
    createPosOpeningBalance,
    updatePosOpeningBalance,
} from "./api";

export function OpeningBalanceSettings() {
    const settings = usePosSettings();
    const savedId = useRef(null);
    const currencySymbol = settings.currencySymbol;
    const [requireOpeningBalance, setRequireOpeningBalance] =
        useConfigState("requireOpeningBalance", true);

    const [defaultOpeningAmount, setDefaultOpeningAmount] =
        useConfigState("defaultOpeningAmount", "200.00");

    const [managerApprovalRequired, setManagerApprovalRequired] =
        useConfigState("managerApprovalRequired", true);

    const [varianceTolerance, setVarianceTolerance] =
        useConfigState("varianceTolerance", "5.00");

    const [allowCashierOverride, setAllowCashierOverride] =
        useConfigState("allowCashierOverride", false);

    const [countByDenomination, setCountByDenomination] =
        useConfigState("countByDenomination", true);

    const toggleClass = (value) =>
        `opening-balance-switch ${value ? "active" : ""}`;

    const applyOpeningBalance = (record) => {
        savedId.current = record.id;
        setRequireOpeningBalance(Boolean(record.requireOpeningBalance));
        setDefaultOpeningAmount(String(record.defaultOpeningAmount));
        setManagerApprovalRequired(Boolean(record.managerApprovalRequired));
        setVarianceTolerance(String(record.varianceTolerance));
        setAllowCashierOverride(Boolean(record.allowCashierOverride));
        setCountByDenomination(Boolean(record.countByDenomination));
        settings.session.baseline = { ...settings.session.draft };
    };

    useEffect(() => {
        if (!settings.storeId) return undefined;
        let active = true;
        getPosOpeningBalance(settings.storeId)
            .then((record) => {
                if (active && record?.id) applyOpeningBalance(record);
            })
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) return;
                if (active) alert(error?.message || "Unable to load opening balance settings.");
            });
        return () => { active = false; };
    }, [settings.storeId]);

    const saveOpeningBalanceSettings = useSaveAction(async () => {
        if (!settings.storeId) {
            alert("Open Opening Balance from a store before saving.");
            return;
        }

        const payload = {
            requireOpeningBalance,
            defaultOpeningAmount: Number(defaultOpeningAmount || 0),
            managerApprovalRequired,
            varianceTolerance: Number(varianceTolerance || 0),
            allowCashierOverride,
            countByDenomination,
        };
        const record = savedId.current
            ? await updatePosOpeningBalance(settings.storeId, payload)
            : await createPosOpeningBalance(settings.storeId, payload);
        applyOpeningBalance(record);
        return true;
    });

    return (
        <div className="pos-panel opening-balance-panel">

            {/* =================================================
                HEADER
            ================================================= */}

            <ConfigHeader />


            {/* =================================================
                SETTINGS CARD
            ================================================= */}

            <div className="opening-balance-card">

                                {/* =================================================
                    SETTINGS GRID
                ================================================= */}

                <div className="opening-balance-grid">

                    {/* ------------------------------------------------
                        REQUIRE OPENING BALANCE
                    ------------------------------------------------ */}

                    <div className="opening-balance-setting">

                        <label>
                            Require Opening Balance
                        </label>

                        <button
                            type="button"
                            className={toggleClass(
                                requireOpeningBalance
                            )}
                            onClick={() =>
                                setRequireOpeningBalance(
                                    (value) => !value
                                )
                            }
                            aria-pressed={
                                requireOpeningBalance
                            }
                        >
                            <span />
                        </button>

                    </div>


                    {/* ------------------------------------------------
                        MANAGER APPROVAL
                    ------------------------------------------------ */}

                    <div className="opening-balance-setting">

                        <label>
                            Manager Approval Required
                        </label>

                        <button
                            type="button"
                            className={toggleClass(
                                managerApprovalRequired
                            )}
                            onClick={() =>
                                setManagerApprovalRequired(
                                    (value) => !value
                                )
                            }
                            aria-pressed={
                                managerApprovalRequired
                            }
                        >
                            <span />
                        </button>

                    </div>


                    {/* ------------------------------------------------
                        DEFAULT OPENING AMOUNT
                    ------------------------------------------------ */}

                    <div className="opening-balance-setting">

                        <label>
                            Default Opening Amount
                        </label>

                        <div className="opening-balance-money-input">

                            <span>{currencySymbol}</span>

                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                    defaultOpeningAmount
                                }
                                onChange={(event) =>
                                    setDefaultOpeningAmount(
                                        event.target.value
                                    )
                                }
                                placeholder="0.00"
                            />

                        </div>

                    </div>


                    {/* ------------------------------------------------
                        VARIANCE TOLERANCE
                    ------------------------------------------------ */}

                    <div className="opening-balance-setting">

                        <label>
                            Variance Tolerance
                        </label>

                        <div className="opening-balance-money-input">

                            <span>{currencySymbol}</span>

                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                    varianceTolerance
                                }
                                onChange={(event) =>
                                    setVarianceTolerance(
                                        event.target.value
                                    )
                                }
                                placeholder="0.00"
                            />

                        </div>

                    </div>


                    {/* ------------------------------------------------
                        CASHIER OVERRIDE
                    ------------------------------------------------ */}

                    <div className="opening-balance-setting">

                        <label>
                            Allow Cashier Override
                        </label>

                        <button
                            type="button"
                            className={toggleClass(
                                allowCashierOverride
                            )}
                            onClick={() =>
                                setAllowCashierOverride(
                                    (value) => !value
                                )
                            }
                            aria-pressed={
                                allowCashierOverride
                            }
                        >
                            <span />
                        </button>

                    </div>


                    {/* ------------------------------------------------
                        COUNT BY DENOMINATION
                    ------------------------------------------------ */}

                    <div className="opening-balance-setting">

                        <label>
                            Count Cash by Denomination
                        </label>

                        <button
                            type="button"
                            className={toggleClass(
                                countByDenomination
                            )}
                            onClick={() =>
                                setCountByDenomination(
                                    (value) => !value
                                )
                            }
                            aria-pressed={
                                countByDenomination
                            }
                        >
                            <span />
                        </button>

                    </div>

                </div>

            </div>


            {/* =================================================
                ACTIONS
            ================================================= */}

            <div className="opening-balance-actions pos-form-actions">

                <button
                    type="button"
                    className="opening-balance-back"
                 onClick={() => settings.requestLeave(null)}>Cancel</button>

                <button
                    type="button"
                    className="opening-balance-save"
                    onClick={
                        saveOpeningBalanceSettings
                    }
                >
                    Save Changes
                </button>

            </div>

        </div>
    );
}

