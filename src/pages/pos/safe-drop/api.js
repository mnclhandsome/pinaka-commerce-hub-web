import { loadStorePosConfiguration, saveStorePosConfiguration } from "../storePosConfiguration";

const NAME = "safe_and_safe_drop";

export function getPosSafeDrop(storeId) {
  return loadStorePosConfiguration(storeId, NAME);
}

export function createPosSafeDrop(storeId, payload) {
  return saveStorePosConfiguration(storeId, NAME, payload);
}

export function updatePosSafeDrop(storeId, payload) {
  return saveStorePosConfiguration(storeId, NAME, payload);
}
