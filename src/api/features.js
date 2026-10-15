import { api, pendingStoreRead } from "./http";

const path = (id) => `/features/${encodeURIComponent(id)}`;

// The collection contains both snake_case and camelCase feature examples.
// Normalize either response shape for the existing screens.
const normalize = (item = {}) => {
  const featureType = item.feature_type ?? item.featureType ?? "";
  const category =
    item.category ??
    item.feature_category ??
    item.featureCategory ??
    featureType;
  const code = item.feature_code ?? item.featureCode ?? item.featureKey ?? "";
  const status = String(item.status || "ACTIVE").toUpperCase();

  return {
    ...item,
    id: item.id ?? item.feature_id ?? item.featureId,
    code,
    feature_code: code,
    name: item.name ?? item.feature_name ?? item.featureName ?? "",
    description: item.description || "",
    category,
    feature_type: featureType || category,
    status: status === "ACTIVE" ? "Active" : "Inactive",
    created_at: item.created_at ?? item.createdAt ?? null,
    updated_at: item.updated_at ?? item.updatedAt ?? null,
    icon: "bi-diamond",
    tone: "purple",
  };
};

const payload = (form) => ({
  name: (form.name || "").trim(),
  description: (form.description || "").trim(),
  feature_type: (form.category || "").trim(),
  status: String(form.status || "ACTIVE").toUpperCase(),
});

const unwrapFeature = (response) =>
  normalize(response?.feature || response?.data?.feature || response?.data || response);

export const getFeature = async (id) => unwrapFeature(await pendingStoreRead(`feature:${id}`, () => api.get(path(id))));

export const listFeatures = async () => {
  const response = await pendingStoreRead("features-list", () => api.get("/features"));
  const list = Array.isArray(response?.features)
    ? response.features
    : Array.isArray(response?.data?.features)
      ? response.data.features
      : Array.isArray(response?.data)
        ? response.data
        : [];
  return list.map(normalize);
};

export const createFeature = async (form) => unwrapFeature(await api.post("/features", payload(form)));

// The Features-folder collection uses PATCH for partial updates.
export const updateFeature = async (id, form) => unwrapFeature(await api.patch(path(id), payload(form)));

export const setFeatureStatus = async (id, status) =>
  unwrapFeature(await api.patch(`${path(id)}/status`, { status: String(status).toUpperCase() }));

export const deleteFeature = (id) => api.delete(path(id));
