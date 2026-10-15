import { loadStorePosConfiguration, saveStorePosConfiguration } from "../storePosConfiguration";

const NAME = "currency_taxes";

export function getPosCurrencyTax(storeId) {
  return loadStorePosConfiguration(storeId, NAME);
}

export function createPosCurrencyTax(storeId, payload) {
  return saveStorePosConfiguration(storeId, NAME, payload);
}

export function updatePosCurrencyTax(storeId, payload) {
  return saveStorePosConfiguration(storeId, NAME, payload);
}
