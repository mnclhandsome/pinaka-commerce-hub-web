import { loadStorePosConfiguration, saveStorePosConfiguration } from "../storePosConfiguration";

const NAME = "cash_register_settings";

export function getPosCashRegisters(storeId) {
  return loadStorePosConfiguration(storeId, NAME);
}

export function createPosCashRegisters(storeId, payload) {
  return saveStorePosConfiguration(storeId, NAME, payload);
}

export function updatePosCashRegisters(storeId, payload) {
  return saveStorePosConfiguration(storeId, NAME, payload);
}
