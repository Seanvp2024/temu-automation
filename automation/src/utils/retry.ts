import { randomDelay } from "./delay.js";

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * 带重试机制的异步操作执行器
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 2000, onRetry } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt > maxRetries) break;

      onRetry?.(lastError, attempt);

      // 指数退避 + 随机抖动
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await randomDelay(delay, delay * 1.5);
    }
  }

  throw lastError;
}
