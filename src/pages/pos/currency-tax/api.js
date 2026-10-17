import { api } from "../../../api/http";
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

const taxClassPath = (storeId, slug) => `/stores/${encodeURIComponent(storeId)}/tax-classes${slug === undefined ? "" : `/${encodeURIComponent(slug)}`}`;
export function createStoreTaxClass(storeId, payload) {
  return api.post(taxClassPath(storeId), payload);
}
export function updateStoreTaxClass(storeId, slug, payload) {
  return api.put(taxClassPath(storeId, slug), payload);
}
export function deleteStoreTaxClass(storeId, slug) {
  return api.delete(taxClassPath(storeId, slug));
}

export function updateStoreTaxSettings(storeId, taxEnabled) {
  return api.put(`/stores/${encodeURIComponent(storeId)}/tax-classes/settings`, { taxEnabled });
}
