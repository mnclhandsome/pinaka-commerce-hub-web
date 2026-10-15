import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../api/http";
import {
  ConfigBadge, ConfigField, ConfigFooter, ConfigHeader, ConfigSwitch,
  DenominationRow, SettingInput,
  newRecordId, normalized, serverTaxClassId, useConfigEditor, useConfigState, usePosSettings, useSaveAction, validMoney,
} from "../shared";
import {
    getPosCardPayments,
    createPosCardPayments,
    updatePosCardPayments,
} from "./api";

const emptyCardCredentials = () => ({
    id: null,
    deviceId: "",
    merchantId: "",
    terminalId: "",
    secretKey: "",
    webhookUrl: "",
});

export function PaymentSettings() {
    const settings = usePosSettings();
    const providerCredentials = useRef({
        Kickback: emptyCardCredentials(),
        Payroc: emptyCardCredentials(),
    });
    
    
    const [provider, setProvider] = useConfigState("provider", "Kickback");

    const [deviceId, setDeviceId] = useConfigState("deviceId", "");
    const [merchantId, setMerchantId] = useConfigState("merchantId", "");
    const [terminalId, setTerminalId] = useConfigState("terminalId", "");
    const [secretKey, setSecretKey] = useConfigState("secretKey", "");
    const [webhookUrl, setWebhookUrl] = useConfigState("webhookUrl", "");

    const showProviderCredentials = (name, source = providerCredentials.current[name]) => {
        setProvider(name);
        setDeviceId(source?.deviceId || "");
        setMerchantId(source?.merchantId || "");
        setTerminalId(name === "Payroc" ? source?.terminalId || "" : "");
        setSecretKey(source?.secretKey || "");
        setWebhookUrl(source?.webhookUrl || "");
    };

    const handleProviderChange = (value) => {
        if (value === provider) return;
        providerCredentials.current[provider] = {
            ...providerCredentials.current[provider],
            deviceId,
            merchantId,
            terminalId,
            secretKey,
            webhookUrl,
        };
        showProviderCredentials(value);
    };

    const applyCardPayments = (records, selected = provider) => {
        const next = {
            Kickback: emptyCardCredentials(),
            Payroc: emptyCardCredentials(),
        };
        (records || []).forEach((record) => {
            if (!next[record.provider]) return;
            next[record.provider] = {
                id: record.id,
                deviceId: record.deviceId || "",
                merchantId: record.processorMerchantId || "",
                terminalId: record.terminalId || "",
                secretKey: record.secretKey || "",
                webhookUrl: record.webhookUrl || "",
            };
        });
        providerCredentials.current = next;
        showProviderCredentials(selected, next[selected]);
        settings.session.baseline = { ...settings.session.draft };
    };

    useEffect(() => {
        if (!settings.storeId) return undefined;
        let active = true;
        getPosCardPayments(settings.storeId)
            .then((records) => {
                if (active) applyCardPayments(Array.isArray(records) ? records : [], "Kickback");
            })
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) return;
                if (active) alert(error?.message || "Unable to load card payment settings.");
            });
        return () => { active = false; };
    }, [settings.storeId]);

    const savePaymentSettings = useSaveAction(async () => {
        if (!settings.storeId) {
            alert("Open Card Payment Settings from a store before saving.");
            return;
        }

        if (!provider) {
            alert("Please select a payment gateway provider.");
            return;
        }

        if (!deviceId.trim()) {
            alert("Please enter Device ID.");
            return;
        }

        if (!merchantId.trim()) {
            alert("Please enter Merchant ID.");
            return;
        }

        if (provider === "Payroc" && !terminalId.trim()) {
            alert("Please enter Terminal ID.");
            return;
        }

        if (!secretKey.trim()) {
            alert("Please enter Secret Key.");
            return;
        }

        if (!webhookUrl.trim()) {
            alert("Please enter Webhook URL.");
            return;
        }

        const payload = {
            provider,
            deviceId: deviceId.trim(),
            processorMerchantId: merchantId.trim(),
            terminalId: provider === "Payroc" ? terminalId.trim() : "",
            secretKey: secretKey.trim(),
            webhookUrl: webhookUrl.trim(),
        };
        const saved = providerCredentials.current[provider];
        const record = saved?.id
            ? await updatePosCardPayments(settings.storeId, payload)
            : await createPosCardPayments(settings.storeId, payload);
        providerCredentials.current[provider] = {
            id: record.id,
            deviceId: record.deviceId || "",
            merchantId: record.processorMerchantId || "",
            terminalId: record.terminalId || "",
            secretKey: record.secretKey || "",
            webhookUrl: record.webhookUrl || "",
        };
        showProviderCredentials(provider);
        settings.session.baseline = { ...settings.session.draft };
        return true;
    });

    return (
        <div className="pos-panel card-payment-panel">
            <ConfigHeader />

            <div className="settings-form">

                {/* PAYMENT GATEWAY PROVIDER */}

                <div className="settings-row">
                    <div className="settings-label">
                        <label>
                            Payment Gateway Provider
                        </label>
                    </div>

                    <div className="settings-field">
                        <div className="radio-group">

                            <label>
                                <input
                                    type="radio"
                                    name="provider"
                                    value="Kickback"
                                    checked={
                                        provider === "Kickback"
                                    }
                                    onChange={(event) =>
                                        handleProviderChange(
                                            event.target.value
                                        )
                                    }
                                />

                                <span>
                                    Kickback
                                </span>
                            </label>

                            <label>
                                <input
                                    type="radio"
                                    name="provider"
                                    value="Payroc"
                                    checked={
                                        provider === "Payroc"
                                    }
                                    onChange={(event) =>
                                        handleProviderChange(
                                            event.target.value
                                        )
                                    }
                                />

                                <span>
                                    Payroc
                                </span>
                            </label>

                        </div>
                    </div>
                </div>


                {/* DEVICE ID */}

                <SettingInput
                    label="Device ID"
                    value={deviceId}
                    onChange={setDeviceId}
                    placeholder="Enter device ID"
                />


                {/* MERCHANT ID */}

                <SettingInput
                    label="Merchant ID"
                    value={merchantId}
                    onChange={setMerchantId}
                    placeholder="Enter merchant ID"
                />


                {/* TERMINAL ID - PAYROC ONLY */}

                {provider === "Payroc" && (
                    <SettingInput
                        label="Terminal ID"
                        value={terminalId}
                        onChange={setTerminalId}
                        placeholder="Enter terminal ID"
                    />
                )}


                {/* SECRET KEY */}

                <SettingInput
                    label="Secret Key"
                    value={secretKey}
                    onChange={setSecretKey}
                    placeholder="Enter secret key"
                    type="password"
                />


                {/* WEBHOOK URL */}

                <SettingInput
                    label="Webhook URL"
                    value={webhookUrl}
                    onChange={setWebhookUrl}
                    placeholder="Enter webhook URL"
                />


                {/* SAVE */}

                <div className="settings-actions pos-form-actions">
                    <button type="button" className="pc-button" onClick={() => settings.requestLeave(null)}>Cancel</button>
<button
                        type="button"
                        className="pos-primary-button"
                        onClick={savePaymentSettings}
                    >
                        Save Changes
                    </button>
                </div>

            </div>
        </div>
    );
}
