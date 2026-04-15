/**
 * 通用重试包装：指数退避 + 错误分类
 *
 * 用于云启 / Worker / Temu 后台等不稳定 API 调用：
 *   - 默认 3 次尝试（首次 + 2 次重试），间隔 600ms / 1500ms（指数退避 + 随机抖动）
 *   - 401/403/鉴权失效（YUNQI_AUTH_INVALID）/ 显式 `unsupported` 直接抛出，不重试
 *   - 调用方拿到的 error 已经是最后一次失败的原始 error，便于上游识别
 *
 * 使用：
 *   const result = await withRetry(() => competitor.search({...}), { label: "search" });
 */

export interface WithRetryOptions {
  /** 最大尝试次数（含首次），默认 3 */
  attempts?: number;
  /** 基础延迟（ms），每次重试乘以 2，默认 600 */
  baseDelay?: number;
  /** 自定义"是否应放弃重试"的判定，返回 true 表示不重试直接抛出 */
  shouldGiveUp?: (error: unknown) => boolean;
  /** 每次重试前回调（可用于上报、Toast）；attempt 从 1 起算 */
  onRetry?: (error: unknown, attempt: number) => void;
  /** 调试标签 */
  label?: string;
}

const DEFAULT_NON_RETRYABLE_PATTERNS = [
  /YUNQI_AUTH_INVALID/i,
  /unsupported/i,
  /\b401\b/,
  /\b403\b/,
  /鉴权/,
  /未登录/,
  /not\s*matched/i,
];

function defaultShouldGiveUp(error: unknown): boolean {
  const msg = String((error as any)?.message ?? error ?? "");
  return DEFAULT_NON_RETRYABLE_PATTERNS.some((re) => re.test(msg));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  task: () => Promise<T>,
  options: WithRetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelay = Math.max(0, options.baseDelay ?? 600);
  const shouldGiveUp = options.shouldGiveUp ?? defaultShouldGiveUp;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
      if (shouldGiveUp(error)) break;
      options.onRetry?.(error, attempt);
      const jitter = Math.floor(Math.random() * 200);
      await sleep(baseDelay * Math.pow(2, attempt - 1) + jitter);
    }
  }
  throw lastError;
}
