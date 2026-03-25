import type { Page } from "playwright";
import { createLogger } from "../utils/logger.js";
import { randomDelay, actionDelay } from "../utils/delay.js";
import { withRetry } from "../utils/retry.js";
import { saveCookies } from "../browser/manager.js";

const logger = createLogger("Login");

const TEMU_SELLER_URL = "https://seller.temu.com";
const TEMU_LOGIN_URL = "https://seller.temu.com/login";

/**
 * 检查当前是否已登录
 */
export async function checkLoginStatus(page: Page): Promise<boolean> {
  try {
    await page.goto(TEMU_SELLER_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
    await randomDelay(2000, 4000);

    const currentUrl = page.url();

    if (!currentUrl.includes("login")) {
      logger.info("登录态有效");
      return true;
    }

    logger.info("登录态已过期");
    return false;
  } catch (error) {
    logger.error("检查登录态失败", error);
    return false;
  }
}

/**
 * 执行登录操作（手机号 + 密码）
 */
export async function performLogin(
  page: Page,
  phone: string,
  password: string
): Promise<boolean> {
  return withRetry(
    async () => {
      logger.info(`开始登录: ${phone}`);

      await page.goto(TEMU_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
      await actionDelay();

      // 尝试切换到「密码登录」标签（Temu 可能默认验证码登录）
      try {
        const passwordTab = await page.locator(
          'text=密码登录, text=账号密码登录, [class*="tab"]:has-text("密码")'
        ).first();
        if (await passwordTab.isVisible({ timeout: 3000 })) {
          await passwordTab.click();
          await randomDelay(500, 1000);
        }
      } catch {
        logger.info("未找到密码登录标签，可能已在密码登录模式");
      }

      // 查找手机号输入框
      const phoneInput = await page.waitForSelector(
        'input[type="tel"], input[name="phone"], input[name="mobile"], input[placeholder*="手机"], input[placeholder*="号码"], input[placeholder*="phone"]',
        { timeout: 10000 }
      );

      if (!phoneInput) {
        throw new Error("未找到手机号输入框");
      }

      // 清空并输入手机号（逐字输入，模拟人工）
      await phoneInput.click();
      await randomDelay(200, 500);
      await phoneInput.fill("");
      for (const char of phone) {
        await phoneInput.type(char, { delay: Math.random() * 100 + 50 });
      }
      await actionDelay();

      // 输入密码
      const passwordInput = await page.waitForSelector(
        'input[type="password"], input[name="password"]',
        { timeout: 5000 }
      );

      if (!passwordInput) {
        throw new Error("未找到密码输入框");
      }

      await passwordInput.click();
      await randomDelay(200, 500);
      await passwordInput.fill("");
      for (const char of password) {
        await passwordInput.type(char, { delay: Math.random() * 100 + 50 });
      }
      await actionDelay();

      // 点击登录按钮
      const loginButton = await page.waitForSelector(
        'button[type="submit"], button:has-text("登录"), button:has-text("Login"), button:has-text("Sign In")',
        { timeout: 5000 }
      );

      if (!loginButton) {
        throw new Error("未找到登录按钮");
      }

      await loginButton.click();

      // 等待登录结果
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      await randomDelay(3000, 5000);

      // 检查是否登录成功
      const currentUrl = page.url();
      if (currentUrl.includes("login")) {
        // 检查是否有验证码
        const hasCaptcha = await page
          .locator('[class*="captcha"], [class*="verify"], [class*="slider"], iframe[src*="captcha"]')
          .first()
          .isVisible()
          .catch(() => false);

        if (hasCaptcha) {
          logger.warn("检测到验证码，需要人工介入");
          process.stdout.write(
            JSON.stringify({
              type: "captcha_required",
              message: "检测到验证码，请在弹出的浏览器中手动完成验证",
            }) + "\n"
          );

          // 等待用户手动处理验证码（最多等 2 分钟）
          await page.waitForURL((url) => !url.toString().includes("login"), {
            timeout: 120000,
          });
        } else {
          // 检查错误提示
          const errorMsg = await page
            .locator('[class*="error"], [class*="alert"], [class*="tip"], [class*="toast"]')
            .first()
            .textContent()
            .catch(() => null);

          if (errorMsg) {
            logger.warn(`登录提示: ${errorMsg}`);
          }
          throw new Error(errorMsg || "登录失败，请检查账号密码");
        }
      }

      logger.info("登录成功");
      await saveCookies();
      return true;
    },
    {
      maxRetries: 2,
      baseDelay: 3000,
      onRetry: (error, attempt) => {
        logger.warn(`登录失败，第 ${attempt} 次重试: ${error.message}`);
      },
    }
  );
}

/**
 * 确保已登录状态（检查 → 如未登录则自动登录）
 */
export async function ensureLoggedIn(
  page: Page,
  phone: string,
  password: string
): Promise<boolean> {
  const isLoggedIn = await checkLoginStatus(page);

  if (isLoggedIn) {
    return true;
  }

  return performLogin(page, phone, password);
}
