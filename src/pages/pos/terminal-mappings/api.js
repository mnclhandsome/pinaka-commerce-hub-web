import { loadStorePosConfiguration, saveStorePosConfiguration } from "../storePosConfiguration";

const NAME = "terminal_register_mapping";

export function getPosTerminalMappings(storeId) {
  return loadStorePosConfiguration(storeId, NAME);
}

export function createPosTerminalMappings(storeId, payload) {
  return saveStorePosConfiguration(storeId, NAME, payload);
}

export function updatePosTerminalMappings(storeId, payload) {
  return saveStorePosConfiguration(storeId, NAME, payload);
}
