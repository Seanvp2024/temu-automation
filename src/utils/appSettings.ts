export const APP_SETTINGS_KEY = "temu_app_settings";

export interface AppSettings {
  operationDelay: number;
  maxRetries: number;
  headless: boolean;
  autoLoginRetry: boolean;
  lowStockThreshold: number;
  screenshotOnError: boolean;
  updateFeedUrl: string;
}

const LEGACY_UPDATE_FEED_URLS = new Set([
  "http://127.0.0.1:8765/releases/",
  "http://192.168.1.2:8765/releases/",
]);

function isGithubReleasePageUrl(value: string): boolean {
  return /^https?:\/\/github\.com\/[^/]+\/[^/]+\/releases(?:\/.*)?$/i.test(value);
}

function normalizeUpdateFeedUrl(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_APP_SETTINGS.updateFeedUrl;
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_APP_SETTINGS.updateFeedUrl;
  const normalized = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  if (LEGACY_UPDATE_FEED_URLS.has(normalized)) {
    return DEFAULT_APP_SETTINGS.updateFeedUrl;
  }
  if (isGithubReleasePageUrl(trimmed)) {
    return DEFAULT_APP_SETTINGS.updateFeedUrl;
  }
  return normalized;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  operationDelay: 1500,
  maxRetries: 3,
  headless: false,
  autoLoginRetry: true,
  lowStockThreshold: 10,
  screenshotOnError: true,
  updateFeedUrl: "",
};

export function normalizeAppSettings(raw: unknown): AppSettings {
  const data = (raw && typeof raw === "object") ? raw as Partial<AppSettings> : {};

  return {
    operationDelay: typeof data.operationDelay === "number" ? data.operationDelay : DEFAULT_APP_SETTINGS.operationDelay,
    maxRetries: typeof data.maxRetries === "number" ? data.maxRetries : DEFAULT_APP_SETTINGS.maxRetries,
    headless: typeof data.headless === "boolean" ? data.headless : DEFAULT_APP_SETTINGS.headless,
    autoLoginRetry: typeof data.autoLoginRetry === "boolean" ? data.autoLoginRetry : DEFAULT_APP_SETTINGS.autoLoginRetry,
    lowStockThreshold: typeof data.lowStockThreshold === "number" ? data.lowStockThreshold : DEFAULT_APP_SETTINGS.lowStockThreshold,
    screenshotOnError: typeof data.screenshotOnError === "boolean" ? data.screenshotOnError : DEFAULT_APP_SETTINGS.screenshotOnError,
    updateFeedUrl: normalizeUpdateFeedUrl(data.updateFeedUrl),
  };
}
