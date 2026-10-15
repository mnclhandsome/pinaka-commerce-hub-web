import { loadStorePosConfiguration, saveStorePosConfiguration } from "../storePosConfiguration";

const NAME = "cash_denominations";

export function getPosCashDenominations(storeId) {
  return loadStorePosConfiguration(storeId, NAME);
}

export function createPosCashDenominations(storeId, payload) {
  return saveStorePosConfiguration(storeId, NAME, payload);
}

export function updatePosCashDenominations(storeId, payload) {
  return saveStorePosConfiguration(storeId, NAME, payload);
}
