/**
 * 跨页面通用的轻量数据转换 / 文本处理工具。
 *
 * 收录原则：实现在多个页面完全一致、无特殊业务假设的函数。
 * 若某个函数在某个页面需要特殊变体，请在那个页面内另建私有函数，不要扩展这里的通用版本。
 */

/** 把任意值转成数字；NaN / Infinity / 非数字 → 0 */
export function toSafeNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/** 算数平均；空数组返回 0 */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** 0~1 浮点 → 百分比文本，如 0.234 → "23%" */
export function formatPercentText(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

/**
 * 解析"评价数"文本：支持千分位逗号和 "1.2k" 这类缩写。
 * 示例：
 *   "1,234"  → 1234
 *   "1.2k"   → 1200
 *   "350+"   → 350
 *   undefined → 0
 */
export function parseReviewCountText(text: unknown): number {
  const raw = typeof text === "string" ? text.replace(/,/g, "") : "";
  const match = raw.match(/(\d+(?:\.\d+)?)(k)?/i);
  if (!match) return 0;
  const base = Number(match[1] || 0);
  if (!Number.isFinite(base)) return 0;
  return match[2] ? Math.round(base * 1000) : Math.round(base);
}

/** 从 unknown 错误里提取 message 字符串 */
export function getErrorMessage(error: unknown): string {
  return String((error as { message?: string })?.message || error || "");
}

/** 去掉 worker 错误前缀，如 "[YUNQI_AUTH_INVALID] xxx" → "xxx" */
export function stripWorkerErrorCode(message: string): string {
  return message.replace(/^\[[A-Z0-9_]+\]\s*/, "").trim();
}
