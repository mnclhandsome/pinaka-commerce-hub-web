import { api } from './http';
import { endpoints } from './endpoints';

const PAGE_LIMIT = 100;

// Response: { count, page, limit, data: [...] }. Reads every page so the
// screen can filter and paginate the full list locally.
export async function listStoreSafeDrops(storeId, { signal } = {}) {
  if (!storeId) return [];

  const records = [];
  const seen = new Set();
  for (let page = 1; ; page += 1) {
    const response = await api.get(
      `${endpoints.storeSafeDrops(storeId)}?page=${page}&limit=${PAGE_LIMIT}`,
      { signal, headers: { 'x-store-id': storeId } },
    );
    const rows = Array.isArray(response?.data) ? response.data : [];
    const fresh = rows.filter((row) => !seen.has(row.safe_drop_id));
    fresh.forEach((row) => { seen.add(row.safe_drop_id); records.push(row); });

    const total = Number(response?.count) || 0;
    if (!fresh.length || records.length >= total) break;
  }
  return records;
}
