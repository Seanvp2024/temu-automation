import {
  ACCOUNT_SCOPED_BASE_KEYS,
  ACTIVE_ACCOUNT_ID_KEY,
  buildScopedStoreKey,
} from "./multiStore";

type StoreLike = {
  get: (key: string) => Promise<any>;
  getMany?: (keys: string[]) => Promise<Record<string, any>>;
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

export async function getStoreValues(store: StoreLike, keys: readonly string[]) {
  const result = Object.fromEntries(keys.map((key) => [key, null])) as Record<string, any>;
  if (!store || keys.length === 0) return result;

  const uniqueKeys = Array.from(new Set(keys));
  const scopedKeys = uniqueKeys.filter((key) =>
    ACCOUNT_SCOPED_BASE_KEYS.includes(key as typeof ACCOUNT_SCOPED_BASE_KEYS[number]),
  );

  if (store.getMany) {
    const baseValues = await store.getMany(
      scopedKeys.length > 0
        ? [ACTIVE_ACCOUNT_ID_KEY, ...uniqueKeys]
        : uniqueKeys,
    );
    const activeAccountId = typeof baseValues?.[ACTIVE_ACCOUNT_ID_KEY] === "string" && baseValues[ACTIVE_ACCOUNT_ID_KEY].trim()
      ? baseValues[ACTIVE_ACCOUNT_ID_KEY]
      : null;

    let scopedValues: Record<string, any> = {};
    if (activeAccountId && scopedKeys.length > 0) {
      const requestedScopedKeys = scopedKeys.map((key) => buildScopedStoreKey(activeAccountId, key));
      scopedValues = await store.getMany(requestedScopedKeys);
    }

    for (const key of uniqueKeys) {
      if (activeAccountId && scopedKeys.includes(key)) {
        const scopedValue = scopedValues?.[buildScopedStoreKey(activeAccountId, key)];
        result[key] = scopedValue !== null && scopedValue !== undefined ? scopedValue : (baseValues?.[key] ?? null);
      } else {
        result[key] = baseValues?.[key] ?? null;
      }
    }
    return result;
  }

  let activeAccountId: string | null = null;
  if (scopedKeys.length > 0) {
    const rawActiveAccountId = await store.get(ACTIVE_ACCOUNT_ID_KEY);
    activeAccountId = typeof rawActiveAccountId === "string" && rawActiveAccountId.trim() ? rawActiveAccountId : null;
  }

  for (const key of uniqueKeys) {
    if (activeAccountId && scopedKeys.includes(key)) {
      const scopedValue = await store.get(buildScopedStoreKey(activeAccountId, key));
      if (scopedValue !== null && scopedValue !== undefined) {
        result[key] = scopedValue;
        continue;
      }
    }
    result[key] = await store.get(key);
  }

  return result;
}

export async function getStoreValue(store: StoreLike, key: string) {
  const values = await getStoreValues(store, [key]);
  return values[key] ?? null;
}

export async function getFirstExistingStoreValue(
  store: StoreLike,
  keys: readonly string[],
) {
  const values = await getStoreValues(store, keys);
  for (const key of keys) {
    const value = values[key];
    if (value !== null && value !== undefined) {
      return value;
    }
  }

  return null;
}
