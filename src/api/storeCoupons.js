import { api, pendingStoreRead } from "./http";

const couponCache = new Map();

export function getStoreCoupons(merchantId, storeId, { refresh = false } = {}) {
  if (!merchantId || !storeId) return Promise.resolve([]);
  const key = `store-coupons:${merchantId}:${storeId}`;
  if (!refresh && couponCache.has(key)) return Promise.resolve(couponCache.get(key));
  if (refresh) couponCache.delete(key);
  return pendingStoreRead(key, async () => {
    const query = new URLSearchParams({
      merchantId: String(merchantId),
      storeId: String(storeId),
      page: "1",
      perPage: "100",
    });
    const response = await api.get(`/coupons?${query}`);
    const data = response?.data || response;
    if (data?.success === false) throw new Error(data.message || "Unable to load coupons.");
    if (!Array.isArray(data?.coupons)) throw new Error("Coupons API did not return a coupons array.");
    const unique = new Map();
    data.coupons.forEach((coupon) => {
      const id = coupon.id ?? coupon.couponId ?? coupon.coupon_id ?? coupon.code ?? coupon.coupon_code;
      if (id != null && !unique.has(String(id))) unique.set(String(id), coupon);
    });
    const rows = [...unique.values()];
    couponCache.set(key, rows);
    return rows;
  });
}

export function invalidateStoreCoupons(merchantId, storeId) {
  couponCache.delete(`store-coupons:${merchantId}:${storeId}`);
}
