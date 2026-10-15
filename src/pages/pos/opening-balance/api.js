import { loadStorePosConfiguration, saveStorePosConfiguration } from "../storePosConfiguration";

const NAME = "opening_balance";

export function getPosOpeningBalance(storeId) {
  return loadStorePosConfiguration(storeId, NAME);
}

export function createPosOpeningBalance(storeId, payload) {
  return saveStorePosConfiguration(storeId, NAME, payload);
}

export function updatePosOpeningBalance(storeId, payload) {
  return saveStorePosConfiguration(storeId, NAME, payload);
}
