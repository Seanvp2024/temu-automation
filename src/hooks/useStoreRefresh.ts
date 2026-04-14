import { useEffect, useRef } from "react";
import {
  ACTIVE_ACCOUNT_CHANGED_EVENT,
  STORE_VALUE_UPDATED_EVENT,
  STORE_VALUES_UPDATED_EVENT,
  storeUpdateTouchesKeys,
} from "../utils/multiStore";

type RefreshDependency = string | number | boolean | null | undefined;

type StoreUpdateDetail = {
  baseKey?: string | null;
  baseKeys?: string[] | null;
};

interface UseStoreRefreshOptions {
  load: () => void | Promise<void>;
  watchKeys?: readonly string[];
  enabled?: boolean;
  debounceMs?: number;
  reloadOnMount?: boolean;
  reloadOnAccountChange?: boolean;
  dependencies?: readonly RefreshDependency[];
}

function buildSignature(values: readonly RefreshDependency[]) {
  return values.map((value) => `${typeof value}:${String(value)}`).join("\u0001");
}

export function useStoreRefresh({
  load,
  watchKeys = [],
  enabled = true,
  debounceMs = 120,
  reloadOnMount = true,
  reloadOnAccountChange = true,
  dependencies = [],
}: UseStoreRefreshOptions) {
  const loadRef = useRef(load);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchKeysSignature = buildSignature(watchKeys);
  const dependencySignature = buildSignature(dependencies);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    if (!enabled) return;

    const runLoad = () => {
      void Promise.resolve()
        .then(() => loadRef.current())
        .catch(() => {});
    };

    const scheduleReload = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (debounceMs <= 0) {
        runLoad();
        return;
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        runLoad();
      }, debounceMs);
    };

    const handleActiveAccountChanged = () => {
      if (!reloadOnAccountChange) return;
      scheduleReload();
    };

    const handleStoreUpdated = (event: Event) => {
      if (watchKeys.length === 0) return;
      const detail = (event as CustomEvent<StoreUpdateDetail>)?.detail;
      if (!storeUpdateTouchesKeys(detail, watchKeys)) return;
      scheduleReload();
    };

    if (reloadOnMount) runLoad();
    if (reloadOnAccountChange) {
      window.addEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleActiveAccountChanged);
    }
    if (watchKeys.length > 0) {
      window.addEventListener(STORE_VALUE_UPDATED_EVENT, handleStoreUpdated as EventListener);
      window.addEventListener(STORE_VALUES_UPDATED_EVENT, handleStoreUpdated as EventListener);
    }

    return () => {
      if (reloadOnAccountChange) {
        window.removeEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleActiveAccountChanged);
      }
      if (watchKeys.length > 0) {
        window.removeEventListener(STORE_VALUE_UPDATED_EVENT, handleStoreUpdated as EventListener);
        window.removeEventListener(STORE_VALUES_UPDATED_EVENT, handleStoreUpdated as EventListener);
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    enabled,
    debounceMs,
    reloadOnMount,
    reloadOnAccountChange,
    watchKeysSignature,
    dependencySignature,
  ]);
}
