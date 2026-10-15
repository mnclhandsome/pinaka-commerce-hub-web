import { ApiError } from "../../../api/http";
import { loadStorePosConfiguration, saveStorePosConfiguration } from "../storePosConfiguration";

const NAME = "card_payment_settings";

function paymentsFrom(record) {
  if (Array.isArray(record?.cardPayments)) return record.cardPayments;
  if (record?.provider) return [record];
  return [];
}

export async function getPosCardPayments(storeId) {
  const record = await loadStorePosConfiguration(storeId, NAME);
  return paymentsFrom(record);
}

async function saveCardPayment(storeId, payload) {
  let current = [];
  try {
    current = await getPosCardPayments(storeId);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }
  const cardPayments = [
    ...current.filter((item) => item.provider !== payload.provider),
    payload,
  ];
  const saved = await saveStorePosConfiguration(storeId, NAME, { cardPayments });
  const match = paymentsFrom(saved).find((item) => item.provider === payload.provider) || payload;
  return { id: saved.id, ...match };
}

export function createPosCardPayments(storeId, payload) {
  return saveCardPayment(storeId, payload);
}

export function updatePosCardPayments(storeId, payload) {
  return saveCardPayment(storeId, payload);
}
