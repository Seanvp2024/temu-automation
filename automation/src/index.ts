/**
 * Temu 自动化模块入口
 * 作为 Tauri sidecar 进程运行，通过 stdin/stdout JSON 协议与主进程通信
 */
import { launchBrowser, closeBrowser, newPage } from "./browser/manager.js";
import { ensureLoggedIn } from "./auth/login.js";
import { scrapeProducts } from "./tasks/productScraper.js";
import { scrapeOrders } from "./tasks/orderScraper.js";
import { createLogger } from "./utils/logger.js";
import * as readline from "readline";

const logger = createLogger("Main");

interface Command {
  id: string;
  action: string;
  params?: Record<string, unknown>;
}

interface Response {
  id: string;
  type: "result" | "error";
  data?: unknown;
  message?: string;
}

function sendResponse(response: Response) {
  process.stdout.write(JSON.stringify(response) + "\n");
}

async function handleCommand(command: Command): Promise<void> {
  const { id, action, params = {} } = command;

  try {
    switch (action) {
      case "launch_browser": {
        const accountId = params.accountId as string;
        const headless = params.headless as boolean | undefined;
        await launchBrowser(accountId, { headless });
        sendResponse({ id, type: "result", data: { status: "launched" } });
        break;
      }

      case "login": {
        const page = await newPage();
        const email = params.email as string;
        const password = params.password as string;
        const success = await ensureLoggedIn(page, email, password);
        sendResponse({ id, type: "result", data: { success } });
        break;
      }

      case "scrape_products": {
        const page = await newPage();
        const products = await scrapeProducts(page);
        sendResponse({ id, type: "result", data: { products } });
        await page.close();
        break;
      }

      case "scrape_orders": {
        const page = await newPage();
        const orders = await scrapeOrders(page);
        sendResponse({ id, type: "result", data: { orders } });
        await page.close();
        break;
      }

      case "close_browser": {
        await closeBrowser();
        sendResponse({ id, type: "result", data: { status: "closed" } });
        break;
      }

      case "ping": {
        sendResponse({ id, type: "result", data: { status: "pong" } });
        break;
      }

      default:
        sendResponse({ id, type: "error", message: `未知命令: ${action}` });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`命令执行失败: ${action}`, errorMsg);
    sendResponse({ id, type: "error", message: errorMsg });
  }
}

// 监听 stdin 接收命令
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", async (line) => {
  try {
    const command: Command = JSON.parse(line.trim());
    await handleCommand(command);
  } catch (error) {
    logger.error("解析命令失败", error);
  }
});

// 优雅退出
process.on("SIGINT", async () => {
  logger.info("收到退出信号，正在清理...");
  await closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeBrowser();
  process.exit(0);
});

logger.info("Temu 自动化模块已启动，等待命令...");
