import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../api/http";
import {
  ConfigBadge, ConfigField, ConfigFooter, ConfigHeader, ConfigSwitch,
  DenominationRow, SettingInput,
  newRecordId, normalized, serverTaxClassId, useConfigEditor, useConfigState, usePosSettings, useSaveAction, validMoney,
} from "../shared";
import {
    getPosCashDenominations,
    createPosCashDenominations,
    updatePosCashDenominations,
} from "./api";

function readDenominationFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("The image could not be read. Please try again."));
        reader.readAsDataURL(file);
    });
}

function denominationRows(items) {
    return (items || []).map((item) => ({
        id: item.id,
        amount: String(item.amount),
        image: item.imageData,
        imageName: item.imageName,
        file: null,
    }));
}

export function DenominationSettings() {
    const settings = usePosSettings();
    const savedId = useRef(null);
    /* ---------------------------------------------------------
       EMPTY LISTS
    --------------------------------------------------------- */

    const [cashDenominations, setCashDenominations] =
        useConfigState("cashDenominations", []);

    const [coinDenominations, setCoinDenominations] =
        useConfigState("coinDenominations", []);

    const applyDenominations = (record) => {
        savedId.current = record.id;
        setCashDenominations(denominationRows(record.cashDenominations));
        setCoinDenominations(denominationRows(record.coinDenominations));
        settings.session.baseline = { ...settings.session.draft };
    };

    useEffect(() => {
        if (!settings.storeId) return undefined;
        let active = true;
        getPosCashDenominations(settings.storeId)
            .then((record) => {
                if (active && record?.id) applyDenominations(record);
            })
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) return;
                if (active) alert(error?.message || "Unable to load cash denominations.");
            });
        return () => { active = false; };
    }, [settings.storeId]);

    

    

    /* ---------------------------------------------------------
       ADD CASH / COIN / SAFE DROP
    --------------------------------------------------------- */

    const addDenomination = (setter) => {
        setter((items) => [
            ...items,
            {
                amount: "",
                image: "",
                imageName: "",
                file: null,
            },
        ]);
    };

    /* ---------------------------------------------------------
       ADD TUBE
    --------------------------------------------------------- */

    

    /* ---------------------------------------------------------
       UPDATE AMOUNT
    --------------------------------------------------------- */

    const updateDenominationAmount = (
        setter,
        index,
        value
    ) => {
        setter((items) =>
            items.map((item, itemIndex) =>
                itemIndex === index
                    ? {
                          ...item,
                          amount: value,
                      }
                    : item
            )
        );
    };

    /* ---------------------------------------------------------
       UPDATE IMAGE
    --------------------------------------------------------- */

    const updateDenominationImage = (
        setter,
        index,
        imageData
    ) => {
        setter((items) =>
            items.map((item, itemIndex) =>
                itemIndex === index
                    ? {
                          ...item,
                          ...imageData,
                      }
                    : item
            )
        );
    };

    /* ---------------------------------------------------------
       REMOVE
    --------------------------------------------------------- */

    const removeDenomination = (
        setter,
        index
    ) => {
        setter((items) =>
            items.filter(
                (_, itemIndex) =>
                    itemIndex !== index
            )
        );
    };

    /* ---------------------------------------------------------
       UPDATE TUBE
    --------------------------------------------------------- */

    

    /* ---------------------------------------------------------
       SAVE
    --------------------------------------------------------- */

    const saveDenominations = useSaveAction(async () => {
        if (!settings.storeId) {
            alert("Open Cash Denominations from a store before saving.");
            return;
        }

        const allDenominations = [...cashDenominations, ...coinDenominations];

        const invalidAmount =
            allDenominations.some(
                (item) => !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0
            );

        const invalidImage =
            allDenominations.some(
                (item) => !item.image && !item.file
            );

        if (invalidAmount) {
            alert(
                "Please enter the amount for all denominations."
            );
            return;
        }

        if (invalidImage) {
            alert(
                "Please select an image for all denominations."
            );
            return;
        }

        const oversized = allDenominations.some((item) => item.file && item.file.size > 1024 * 1024);
        if (oversized) {
            alert("Each denomination image must be 1 MB or smaller.");
            return;
        }

        const toItem = async (item) => {
            const imageData = item.file ? await readDenominationFile(item.file) : item.image;
            if (typeof imageData !== "string" || !imageData.startsWith("data:image/")) {
                throw new Error("Please select a PNG, JPG, or WEBP image for every denomination.");
            }
            return {
                ...(typeof item.id === "string" && serverTaxClassId.test(item.id) ? { id: item.id } : {}),
                amount: Number(item.amount),
                imageName: item.imageName || "denomination",
                imageData,
            };
        };

        const payload = {
            cashDenominations: await Promise.all(cashDenominations.map(toItem)),
            coinDenominations: await Promise.all(coinDenominations.map(toItem)),
        };
        const record = savedId.current
            ? await updatePosCashDenominations(settings.storeId, payload)
            : await createPosCashDenominations(settings.storeId, payload);
        applyDenominations(record);
        return true;
    });

    return (
        <div className="pos-panel opening-denominations-panel denomination-split-panel cash-settings-panel">
            {/* =================================================
                HEADER
            ================================================= */}

            <ConfigHeader />

            {/* =================================================
                GENERAL SETTINGS
            ================================================= */}

            

            <div className="denomination-config-grid">
                <>
                {/* =================================================
                    CASH
                ================================================= */}

                <div className="denomination-section">
                    <div className="denomination-heading">
                        <div>
                            <h3>
                                Manage Cash Denominations
                            </h3>

                            <p>
                                Configure available cash
                                denominations.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="pos-add-button"
                            onClick={() =>
                                addDenomination(
                                    setCashDenominations
                                )
                            }
                        >
                            <i className="bi bi-plus-lg" />
                            Add Denomination
                        </button>
                    </div>

                    {cashDenominations.length === 0 ? (
                        <div className="settings-empty-state">
                            <i className="bi bi-cash-stack" />

                            <p>
                                No cash denominations added
                                yet.
                            </p>

                            <span>
                                Click "Add Denomination" to
                                add a denomination.
                            </span>
                        </div>
                    ) : (
                        <div className="denomination-list">
                            {cashDenominations.map(
                                (item, index) => (
                                    <DenominationRow
                                        key={index}
                                        item={item}
                                        index={index}
                                        onAmountChange={(
                                            rowIndex,
                                            value
                                        ) =>
                                            updateDenominationAmount(
                                                setCashDenominations,
                                                rowIndex,
                                                value
                                            )
                                        }
                                        onImageChange={(
                                            rowIndex,
                                            imageData
                                        ) =>
                                            updateDenominationImage(
                                                setCashDenominations,
                                                rowIndex,
                                                imageData
                                            )
                                        }
                                        onRemove={(rowIndex) =>
                                            removeDenomination(
                                                setCashDenominations,
                                                rowIndex
                                            )
                                        }
                                    />
                                )
                            )}
                        </div>
                    )}
                </div>

                {/* =================================================
                    COINS
                ================================================= */}

                <div className="denomination-section">
                    <div className="denomination-heading">
                        <div>
                            <h3>
                                Manage Coin Denominations
                            </h3>

                            <p>
                                Configure available coin
                                denominations.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="pos-add-button"
                            onClick={() =>
                                addDenomination(
                                    setCoinDenominations
                                )
                            }
                        >
                            <i className="bi bi-plus-lg" />
                            Add Denomination
                        </button>
                    </div>

                    {coinDenominations.length === 0 ? (
                        <div className="settings-empty-state">
                            <i className="bi bi-coin" />

                            <p>
                                No coin denominations added
                                yet.
                            </p>

                            <span>
                                Click "Add Denomination" to
                                add a denomination.
                            </span>
                        </div>
                    ) : (
                        <div className="denomination-list">
                            {coinDenominations.map(
                                (item, index) => (
                                    <DenominationRow
                                        key={index}
                                        item={item}
                                        index={index}
                                        onAmountChange={(
                                            rowIndex,
                                            value
                                        ) =>
                                            updateDenominationAmount(
                                                setCoinDenominations,
                                                rowIndex,
                                                value
                                            )
                                        }
                                        onImageChange={(
                                            rowIndex,
                                            imageData
                                        ) =>
                                            updateDenominationImage(
                                                setCoinDenominations,
                                                rowIndex,
                                                imageData
                                            )
                                        }
                                        onRemove={(rowIndex) =>
                                            removeDenomination(
                                                setCoinDenominations,
                                                rowIndex
                                            )
                                        }
                                    />
                                )
                            )}
                        </div>
                    )}
                </div>


                    </>
            </div>

            {/* =================================================
                SAVE
            ================================================= */}

            <div className="settings-actions pos-form-actions">
                <button type="button" className="pc-button" onClick={() => settings.requestLeave(null)}>Cancel</button>
<button
                    type="button"
                    className="pos-primary-button"
                    onClick={saveDenominations}
                >
                    {"Save Changes"}
                </button>
            </div>
        </div>
    );
}
