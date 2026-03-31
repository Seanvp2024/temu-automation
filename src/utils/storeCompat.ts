import {
  ACCOUNT_SCOPED_BASE_KEYS,
  ACTIVE_ACCOUNT_ID_KEY,
  buildScopedStoreKey,
} from "./multiStore";

type StoreLike = {
  get: (key: string) => Promise<any>;
} | undefined;

export const STORE_KEY_ALIASES = {
  performance: ["temu_raw_performance", "temu_performance"],
  soldout: ["temu_raw_soldout", "temu_soldout"],
  delivery: ["temu_raw_delivery", "temu_delivery"],
  goodsData: ["temu_raw_goodsData", "temu_goods_data"],
  marketingActivity: ["temu_raw_marketingActivity", "temu_marketing_activity"],
  fluxUS: ["temu_raw_fluxUS", "temu_flux_us"],
  fluxEU: ["temu_raw_fluxEU", "temu_flux_eu"],
  qcDetail: ["temu_raw_qcDetail", "temu_qc_detail"],
} as const;

export async function getStoreValue(store: StoreLike, key: string) {
  if (!store) return null;

  if (ACCOUNT_SCOPED_BASE_KEYS.includes(key as typeof ACCOUNT_SCOPED_BASE_KEYS[number])) {
    const activeAccountId = await store.get(ACTIVE_ACCOUNT_ID_KEY);
    if (typeof activeAccountId === "string" && activeAccountId.trim()) {
      const scopedValue = await store.get(buildScopedStoreKey(activeAccountId, key));
      if (scopedValue !== null && scopedValue !== undefined) {
        return scopedValue;
      }
    }
  }

  return await store.get(key);
}

export async function getFirstExistingStoreValue(
  store: StoreLike,
  keys: readonly string[],
) {
  if (!store) return null;

  for (const key of keys) {
    const value = await getStoreValue(store, key);
    if (value !== null && value !== undefined) {
      return value;
    }
  }

  return null;
}
