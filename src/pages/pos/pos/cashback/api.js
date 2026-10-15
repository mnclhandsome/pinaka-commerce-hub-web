import { loadStorePosConfiguration, saveStorePosConfiguration } from "../storePosConfiguration";

const NAME = "cashback_settings";

export function getPosCashback(storeId) {
  return loadStorePosConfiguration(storeId, NAME);
}

export function createPosCashback(storeId, payload) {
  return saveStorePosConfiguration(storeId, NAME, payload);
}

export function updatePosCashback(storeId, payload) {
  return saveStorePosConfiguration(storeId, NAME, payload);
}
