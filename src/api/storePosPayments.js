import { api } from './http';
 
const orderApiBase = (import.meta.env.VITE_ORDER_API_BASE_URL || '/connector/api/v1')
  .replace(/\/+$/, '');
 
export async function listStorePosPayments(storeId, { signal } = {}) {
  if (!storeId) return { payments: [] };
 
  const requestUrl = new URL(
    `${orderApiBase}/stores/${encodeURIComponent(storeId)}/pos/payment-records`,
    window.location.origin,
  ).toString();
  return api.get(
    requestUrl,
    { signal, headers: { 'x-store-id': storeId } },
  );
}
 
