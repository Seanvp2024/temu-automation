import fs from "fs";
import path from "path";

const DEFAULT_RUNTIME_SETTINGS = {
  operationDelay: 1500,
  maxRetries: 3,
  headless: false,
  autoLoginRetry: true,
  lowStockThreshold: 10,
  screenshotOnError: true,
};

let cachedSettings = null;
let cachedMtime = -1;

function getSettingsPath() {
  return path.join(
    process.env.APPDATA || "C:/Users/Administrator/AppData/Roaming",
    "temu-automation",
    "temu_app_settings.json"
  );
}

export function getRuntimeSettings() {
  const settingsPath = getSettingsPath();

  try {
    if (!fs.existsSync(settingsPath)) {
      cachedSettings = DEFAULT_RUNTIME_SETTINGS;
      cachedMtime = -1;
      return cachedSettings;
    }

    const stat = fs.statSync(settingsPath);
    if (cachedSettings && stat.mtimeMs === cachedMtime) {
      return cachedSettings;
    }

    const raw = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    cachedMtime = stat.mtimeMs;
    cachedSettings = {
      ...DEFAULT_RUNTIME_SETTINGS,
      ...(raw && typeof raw === "object" ? raw : {}),
    };
    return cachedSettings;
  } catch {
    cachedSettings = DEFAULT_RUNTIME_SETTINGS;
    cachedMtime = -1;
    return cachedSettings;
  }
}

export function getDelayScale() {
  const settings = getRuntimeSettings();
  const baseDelay = Number(settings.operationDelay) || DEFAULT_RUNTIME_SETTINGS.operationDelay;
  return Math.min(5, Math.max(0.2, baseDelay / DEFAULT_RUNTIME_SETTINGS.operationDelay));
}

export function getEffectiveHeadless(explicitHeadless) {
  if (typeof explicitHeadless === "boolean") return explicitHeadless;
  return !!getRuntimeSettings().headless;
}

export function getConfiguredMaxRetries() {
  const retries = Number(getRuntimeSettings().maxRetries);
  if (!Number.isFinite(retries)) return DEFAULT_RUNTIME_SETTINGS.maxRetries;
  return Math.min(10, Math.max(1, Math.round(retries)));
}

export function shouldAutoLoginRetry() {
  return !!getRuntimeSettings().autoLoginRetry;
}

export function shouldCaptureErrorScreenshots() {
  return !!getRuntimeSettings().screenshotOnError;
}
