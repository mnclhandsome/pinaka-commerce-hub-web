import { loadStorePosConfiguration, saveStorePosConfiguration } from "../storePosConfiguration";

const NAME = "printer_settings";

export function getPrinterSettings(storeId) {
  return loadStorePosConfiguration(storeId, NAME);
}

export function savePrinterSettings(storeId, settings) {
  return saveStorePosConfiguration(storeId, NAME, settings);
}
