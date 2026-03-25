import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import path from "path";
import fs from "fs";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("BrowserManager");

export interface BrowserConfig {
  headless?: boolean;
  viewport?: { width: number; height: number };
  slowMo?: number;
}

const DEFAULT_CONFIG: BrowserConfig = {
  headless: false,
  viewport: { width: 1366, height: 768 },
  slowMo: 50,
};

let browser: Browser | null = null;
let browserContext: BrowserContext | null = null;
let cookiePath: string = "";

function getCookiePath(accountId: string): string {
  const dir = path.join(
    process.env.APPDATA || path.join(process.env.USERPROFILE || "C:/Users/Administrator", "AppData/Roaming"),
    "temu-automation",
    "cookies"
  );
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${accountId}.json`);
}

/**
 * 启动浏览器（使用 launch + 手动 Cookie 管理）
 */
export async function launchBrowser(
  accountId: string,
  config: Partial<BrowserConfig> = {}
): Promise<BrowserContext> {
  if (browserContext && browser) {
    logger.info("浏览器已在运行，复用现有实例");
    return browserContext;
  }

  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  cookiePath = getCookiePath(accountId);

  logger.info("启动浏览器...");

  try {
    browser = await chromium.launch({
      headless: mergedConfig.headless,
      slowMo: mergedConfig.slowMo,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
      ],
    });

    browserContext = await browser.newContext({
      viewport: mergedConfig.viewport,
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    });

    // 注入反检测脚本
    await browserContext.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "languages", {
        get: () => ["zh-CN", "zh", "en-US", "en"],
      });
    });

    // 恢复已保存的 Cookie
    if (fs.existsSync(cookiePath)) {
      try {
        const cookies = JSON.parse(fs.readFileSync(cookiePath, "utf-8"));
        await browserContext.addCookies(cookies);
        logger.info("已恢复保存的 Cookie");
      } catch {
        logger.warn("Cookie 文件损坏，忽略");
      }
    }

    logger.info("浏览器启动成功");
    return browserContext;
  } catch (error) {
    logger.error("浏览器启动失败", error);
    throw error;
  }
}

/**
 * 保存当前 Cookie 到文件
 */
export async function saveCookies(): Promise<void> {
  if (browserContext && cookiePath) {
    try {
      const cookies = await browserContext.cookies();
      fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
      logger.info("Cookie 已保存");
    } catch (e) {
      logger.warn("保存 Cookie 失败", e);
    }
  }
}

/**
 * 获取当前浏览器上下文
 */
export function getContext(): BrowserContext | null {
  return browserContext;
}

/**
 * 创建新页面
 */
export async function newPage(): Promise<Page> {
  if (!browserContext) {
    throw new Error("浏览器未启动，请先调用 launchBrowser");
  }
  return browserContext.newPage();
}

/**
 * 关闭浏览器
 */
export async function closeBrowser(): Promise<void> {
  if (browserContext) {
    await saveCookies();
  }
  if (browser) {
    logger.info("关闭浏览器");
    await browser.close();
    browser = null;
    browserContext = null;
  }
}
