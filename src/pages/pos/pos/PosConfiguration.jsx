import { useEffect, useMemo, useRef, useState } from "react";
import "../../styles/pos-configuration.css";
import { ApiError } from "../../api/http";
import { CashRegisterIcon, PosSettingsContext, SettingsChangeDialog, snapshotKey } from "./shared";
import { OpeningBalanceSettings } from "./opening-balance/OpeningBalanceSettings";
import { TaxConfiguration } from "./currency-tax/TaxConfiguration";
import { CashbackSettings } from "./cashback/CashbackSettings";
import { ServiceChargeSettings } from "./service-charges/ServiceChargeSettings";
import { DenominationSettings } from "./cash-denominations/DenominationSettings";
import { PaymentSettings } from "./card-payments/PaymentSettings";
import { RegisterConfiguration, registerRows } from "./cash-registers/RegisterConfiguration";
import { MappingConfiguration, mappingRows } from "./terminal-mappings/MappingConfiguration";
import { SafeConfiguration } from "./safe-drop/SafeConfiguration";
import { getPosCashRegisters } from "./cash-registers/api";
import { getPosTerminalMappings } from "./terminal-mappings/api";
//
const configurationCards = [
    {
        id: "currency-tax",
        icon: "gear",
        iconClass: "blue",
        title: "Currency & Taxes",
        description: "Set your store currency and tax configuration.",
        component: "tax",
        enabled: true,
    },
    {
        id: "service",
        icon: "bell",
        iconClass: "purple",
        title: "Service Charges",
        description: "Configure dine-in, delivery and large party service charges.",
        component: "service",
        enabled: true,
    },
    {
        id: "cashback",
        icon: "gift",
        iconClass: "pink",
        title: "Cashback Settings",
        description: "Set cashback rules and denominations.",
        component: "cashback",
        enabled: true,
    },
    {
        id: "opening-balance",
        icon: "cash-stack",
        iconClass: "green",
        title: "Opening Balance",
        description: "Configure opening balance rules and shift settings.",
        component: "opening-balance",
        enabled: true,
    },
    {
        id: "cash-denominations",
        icon: "cash-stack",
        iconClass: "yellow",
        title: "Cash Denominations",
        description: "Manage denominations for cash counting.",
        component: "cash-denominations",
        enabled: true,
    },
    {
        id: "cash-register",
        icon: "cash-register",
        iconClass: "blue",
        title: "Cash Register Settings",
        description: "Configure registers, cash in/out and limits.",
        component: "cash-register",
        enabled: true,
    },
    {
        id: "safe-drop",
        icon: "shield-check",
        iconClass: "purple",
        title: "Safe & Safe Drop",
        description: "Configure safe and drop rules.",
        component: "safe-drop",
        enabled: true,
    },
    {
        id: "card-payments",
        icon: "credit-card",
        iconClass: "pink",
        title: "Card Payment Settings",
        description: "Manage card payment terminals and processor settings.",
        component: "payments",
        enabled: true,
    },
    {
        id: "terminal-mapping",
        icon: "display",
        iconClass: "green",
        title: "Terminal and Register Mapping",
        description: "Map devices to registers and locations.",
        component: "terminal-mapping",
        enabled: true,
    },
];

const initialRegisters = [
    { id: "reg-1", name: "REG-01", pos: "SUNMI-D3-001", maxCash: "500", safeDrop: true, status: "Active" },
    { id: "reg-2", name: "REG-02", pos: "SUNMI-D3-002", maxCash: "500", safeDrop: true, status: "Active" },
    { id: "reg-3", name: "REG-03", pos: "SUNMI-D3-003", maxCash: "300", safeDrop: false, status: "Inactive" },
];
const initialMappings = initialRegisters.map((register, index) => ({
    id: `mapping-${index + 1}`, registerId: register.id,
    terminal: index < 2 ? `LANE3000-00${index + 1}` : "",
    printer: `STAR-0${index + 1}`, drawer: `DRAWER-0${index + 1}`,
    status: index < 2 ? "Active" : "Setup",
}));
const initialSafeSettings = {
    enabled: true, primarySafe: "SAFE-01", dropEnabled: true,
    threshold: "400", minimum: "100", maximum: "1000", managerApproval: true,
    cashierInitiated: true, reasonRequired: true, tubeSize: "", tubes: [], drops: [],
};

export default function PosConfiguration({ merchantId, storeId, store } = {}) {
    const [registers, setRegisters] = useState(() => (storeId ? [] : initialRegisters));
    const [mappings, setMappings] = useState(() => (storeId ? [] : initialMappings));
    const [safeSettings, setSafeSettings] = useState(initialSafeSettings);
    const [selectedConfig, setSelectedConfig] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (!storeId) return undefined;
        let active = true;
        getPosCashRegisters(storeId)
            .then((record) => {
                if (active && record?.registers) setRegisters(registerRows(record.registers));
            })
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) return;
            });
        getPosTerminalMappings(storeId)
            .then((record) => {
                if (active && record?.mappings) setMappings(mappingRows(record.mappings));
            })
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) return;
            });
        return () => { active = false; };
    }, [storeId]);


    const [storeCurrency, setStoreCurrency] = useState(store?.currency || "USD");
    const savedScreens = useRef({});
    const [pendingLeave, setPendingLeave] = useState(null);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState("");
    const saveLock = useRef(false);
    const session = useMemo(() => ({ saved: savedScreens.current[selectedConfig] || {}, baseline: {}, draft: {}, resets: {}, save: null, editorDirty: null, resetEditor: null }), [selectedConfig]);
    const isDirty = () => snapshotKey(session.draft) !== snapshotKey(session.baseline) || !!session.editorDirty?.();
    const leave = (target) => { setPendingLeave(null); setNotice(""); setSelectedConfig(target); };
    const discardChanges = () => {
        session.draft = { ...session.baseline };
        Object.values(session.resets).forEach((reset) => reset());
        session.resetEditor?.();
        setPendingLeave(null);
        setNotice("Unsaved changes discarded.");
    };
    const requestLeave = (target = null) => {
        if (saveLock.current) return;
        if (isDirty()) setPendingLeave({ target });
        else leave(target);
    };
    const saveChanges = async () => {
        if (saveLock.current || !session.save) return;
        saveLock.current = true; setBusy(true);
        try {
            if (await session.save() !== true) { setPendingLeave(null); return; }
            // Newer screens already save through their existing parent setters.
            if (!["cash-register", "terminal-mapping", "safe-drop"].includes(selectedConfig)) savedScreens.current[selectedConfig] = { ...session.draft };
            if (selectedConfig === "tax") setStoreCurrency(session.draft.currency);
            session.baseline = { ...session.draft };
            setPendingLeave(null);
            setNotice("Changes are updated.");
        } catch (error) {
            setPendingLeave(null);
            alert(error?.message || "Unable to save changes. Please try again.");
        } finally { saveLock.current = false; setBusy(false); }
    };
    useEffect(() => {
        const preventLoss = (event) => { if (isDirty() || saveLock.current) { event.preventDefault(); event.returnValue = ""; } };
        window.addEventListener("beforeunload", preventLoss);
        return () => window.removeEventListener("beforeunload", preventLoss);
    }, [session]);
    const currencySymbol = new Intl.NumberFormat("en", { style: "currency", currency: storeCurrency, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((part) => part.type === "currency").value;
    const settings = { session, currency: storeCurrency, currencySymbol, merchantId, storeId, requestLeave, saveChanges, clearNotice: () => setNotice(""), card: configurationCards.find((card) => card.component === selectedConfig) };

    const filteredCards = configurationCards.filter((card) => {
        const search = searchQuery.trim().toLowerCase();

        if (!search) {
            return true;
        }

        return (
            card.title.toLowerCase().includes(search) ||
            card.description.toLowerCase().includes(search)
        );
    });

    const renderSelectedContent = () => {
        switch (selectedConfig) {
            case "tax":
                return <TaxConfiguration />;

            case "service":
                return <ServiceChargeSettings />;

            case "cashback":
                return <CashbackSettings />;

            case "opening-balance":
                return <OpeningBalanceSettings />;

            case "cash-denominations":
                return <DenominationSettings key="cash" section="cash" />;

            case "safe-drop":
                return <SafeConfiguration value={safeSettings} onSave={setSafeSettings} onBack={() => requestLeave(null)} />;

            case "payments":
                return <PaymentSettings />;

            case "cash-register":
                return <RegisterConfiguration value={registers} mappings={mappings} onSave={setRegisters} onBack={() => requestLeave(null)} />;

            case "terminal-mapping":
                return <MappingConfiguration value={mappings} registers={registers} onSave={setMappings} onBack={() => requestLeave(null)} onManageRegisters={() => requestLeave("cash-register")} />;

            default:
                return null;
        }
    };

    if (selectedConfig) {
    return (
        <PosSettingsContext.Provider value={settings}>
        <div className="page-content pos-page-content">

            <div className="pos-config-detail-header">

                <button
                    type="button"
                    className="pos-back-button"
                    onClick={() => requestLeave(null)}
                >
                    <i className="bi bi-arrow-left" />
                    <span>Back to POS Configuration</span>
                </button>

            </div>

            <div className="pos-config-detail-card">
                <fieldset className="pos-screen-lock" disabled={busy} aria-busy={busy}>{renderSelectedContent()}</fieldset>
            </div>
            {notice && <div className="pos-update-notice" role="status">{notice}</div>}

        </div>
        {pendingLeave && <SettingsChangeDialog busy={busy} onSave={saveChanges} onDiscard={discardChanges} onStay={() => setPendingLeave(null)} />}
        </PosSettingsContext.Provider>
    );
}

    return (
        <div className="page-content pos-page-content">
            <div className="page-header pos-config-page-header">
                <div>
                    <h1>POS Configuration</h1>
                    <p>
                        Configure point-of-sale settings for your merchant stores.
                    </p>
                </div>

                <div className="pos-config-search">
                    <i className="bi bi-search" />

                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) =>
                            setSearchQuery(event.target.value)
                        }
                        placeholder="Search configuration..."
                        aria-label="Search configuration"
                    />
                </div>
            </div>

            <div className="pos-config-card pos-config-cards-container">
                <div className="pos-config-cards-grid">
                    {filteredCards.map((card) => (
                        <button
                            key={card.id}
                            type="button"
                            disabled={!card.enabled}
                            className={`pos-config-option-card ${
                                card.enabled ? "" : "disabled"
                            }`}
                            onClick={() => {
                                if (card.enabled) {
                                    setSelectedConfig(card.component);
                                }
                            }}
                        >
                            <div
                                className={`pos-config-option-icon ${card.iconClass}`}
                            >
                                {card.icon === "cash-register" ? <CashRegisterIcon /> : <i className={`bi bi-${card.icon}`} />}
                            </div>

                            <div className="pos-config-option-content">
                                <h3>{card.title}</h3>
                                <p>{card.description}</p>
                            </div>

                            <i className="bi bi-chevron-right pos-config-option-arrow" />
                        </button>
                    ))}
                </div>

                {filteredCards.length === 0 && (
                    <div className="pos-config-no-results">
                        <i className="bi bi-search" />
                        <h3>No configuration found</h3>
                        <p>
                            Try searching with a different configuration name.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

