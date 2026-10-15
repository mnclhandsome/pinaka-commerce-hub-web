import { api } from "../../api/http";
import { endpoints } from "../../api/endpoints";
import { getStoredUser } from "../../auth/tokenStore";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function currentUserId() {
  const user = getStoredUser();
  const id = user?.id || user?.userId || user?.sub || "";
  return UUID.test(id) ? id : undefined;
}

function asRecord(response) {
  const value = response?.configurationValue;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { id: response.id, ...value };
  }
  return value ?? response;
}

export function loadStorePosConfiguration(storeId, configurationName) {
  return api
    .get(endpoints.storePosConfigurationItem(storeId, configurationName))
    .then(asRecord);
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
    .then(asRecord);
}
