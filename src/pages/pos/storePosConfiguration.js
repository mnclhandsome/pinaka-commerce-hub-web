import { api } from "../../api/http";
import { endpoints } from "../../api/endpoints";
import { getStoredUser } from "../../auth/tokenStore";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function currentUserId() {
  const user = getStoredUser();
  const id = user?.id || user?.userId || user?.sub || "";
  return UUID.test(id) ? id : undefined;
}

function parseConfigurationValue(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function asRecord(response, storeId, configurationName) {
  let row = response;
  for (let depth = 0; depth < 5 && row && typeof row === "object" && !Array.isArray(row); depth += 1) {
    const nested = row.storePosConfiguration || row.store_pos_configuration || row.configuration || row.data || row.result;
    if (nested && typeof nested === "object") row = nested;
    else break;
  }

  const value = parseConfigurationValue(row?.configurationValue ?? row?.configuration_value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      ...value,
      id: value.id || row.id || row.configurationId || row.configuration_id || `${storeId}:${configurationName}`,
    };
  }

  if (row && typeof row === "object" && !Array.isArray(row)) {
    const {
      success, message, error, data, result, configuration,
      storePosConfiguration, store_pos_configuration,
      configurationValue, configuration_value,
      ...record
    } = row;
    if (Object.keys(record).length) {
      return {
        ...record,
        id: record.id || record.configurationId || record.configuration_id || `${storeId}:${configurationName}`,
      };
    }
  }
  return value ?? row;
}

export function loadStorePosConfiguration(storeId, configurationName) {
  return api
    .get(endpoints.storePosConfigurationItem(storeId, configurationName))
    .then((response) => asRecord(response, storeId, configurationName));
}

export function saveStorePosConfiguration(storeId, configurationName, configurationValue) {
  const createdBy = currentUserId();
  return api
    .put(endpoints.storePosConfiguration, {
      storeId,
      configurationName,
      configurationValue,
      ...(createdBy ? { createdBy } : {}),
    })
    .then((response) => asRecord(response, storeId, configurationName));
}
