/**
 * 人性化随机延迟，模拟真人操作节奏
 */
export function randomDelay(min: number = 800, max: number = 2500): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * 模拟打字延迟
 */
export function typingDelay(): Promise<void> {
  return randomDelay(50, 150);
}

/**
 * 页面操作间延迟
 */
export function actionDelay(): Promise<void> {
  return randomDelay(1000, 3000);
}

/**
 * 页面加载等待
 */
export function pageLoadDelay(): Promise<void> {
  return randomDelay(2000, 5000);
}
