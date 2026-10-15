import { loadStorePosConfiguration, saveStorePosConfiguration } from "../storePosConfiguration";

const NAME = "service_charges";

export function getPosServiceCharges(storeId) {
  return loadStorePosConfiguration(storeId, NAME);
}

export function createPosServiceCharges(storeId, payload) {
  return saveStorePosConfiguration(storeId, NAME, payload);
}

export function updatePosServiceCharges(storeId, payload) {
  return saveStorePosConfiguration(storeId, NAME, payload);
}
