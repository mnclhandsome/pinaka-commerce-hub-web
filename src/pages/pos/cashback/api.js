import { api } from "../../../api/http";
import { endpoints } from "../../../api/endpoints";

function normalizeCashback(response) {
  let record = response;
  for (let depth = 0; depth < 5 && record && typeof record === "object" && !Array.isArray(record); depth += 1) {
    const nested = record.cashback || record.settings || record.data || record.result;
    if (nested && typeof nested === "object") record = nested;
    else break;
  }
  const value = record?.configurationValue ?? record?.configuration_value;
  if (value && typeof value === "object" && !Array.isArray(value)) record = { ...record, ...value };
  if (record?.success === false) throw new Error(record.message || record.error || "Unable to save cashback settings.");
  if (!record || typeof record !== "object" || Array.isArray(record)) return record;
  const enabled = record.enabled ?? record.cashbackEnabled ?? record.cashback_enabled ?? record.isEnabled ?? record.is_enabled ?? false;
  const tiers = record.tiers ?? record.cashbackTiers ?? record.cashback_tiers ?? [];
  return {
    ...record,
    id: record.id || record.cashbackId || record.cashback_id || "saved-cashback-settings",
    enabled: typeof enabled === "string" ? /^(true|1|yes|enabled)$/i.test(enabled) : Boolean(enabled),
    maxCashback: record.maxCashback ?? record.max_cashback ?? record.maximumCashback ?? record.maximum_cashback ?? record.maxCashbackLimit ?? record.max_cashback_limit,
    tiers: Array.isArray(tiers) ? tiers.map((tier) => ({
      ...tier,
      from: tier.from ?? tier.fromAmount ?? tier.from_amount,
      to: tier.to ?? tier.toAmount ?? tier.to_amount,
      fee: tier.fee ?? tier.cashbackFee ?? tier.cashback_fee,
    })) : [],
  };
}

export function getPosCashback(storeId) {
  return api.get(endpoints.storeCashback(storeId)).then(normalizeCashback);
}

export function createPosCashback(storeId, payload) {
  return api.post(endpoints.storeCashback(storeId), payload).then(normalizeCashback);
}

export function updatePosCashback(storeId, payload) {
  return api.put(endpoints.storeCashback(storeId), payload).then(normalizeCashback);
}
