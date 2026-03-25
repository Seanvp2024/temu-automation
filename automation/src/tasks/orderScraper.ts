import type { Page } from "playwright";
import { createLogger } from "../utils/logger.js";
import { actionDelay, randomDelay } from "../utils/delay.js";
import { withRetry } from "../utils/retry.js";

const logger = createLogger("OrderScraper");

export interface ScrapedOrder {
  orderId: string;
  productTitle: string;
  quantity: number;
  amount: number;
  status: string;
  orderTime: string;
}

/**
 * 抓取订单列表数据
 */
export async function scrapeOrders(page: Page): Promise<ScrapedOrder[]> {
  logger.info("开始抓取订单列表");

  return withRetry(
    async () => {
      await page.goto("https://seller.temu.com/order/list", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await actionDelay();

      await page.waitForSelector("table, [class*='order-list']", {
        timeout: 15000,
      });
      await randomDelay(1000, 2000);

      const orders = await page.evaluate(() => {
        const rows = document.querySelectorAll(
          "table tbody tr, [class*='order-item']"
        );

        return Array.from(rows).map((row) => {
          const cells = row.querySelectorAll("td");
          const orderIdEl = row.querySelector("[class*='order-id'], td:first-child");
          const titleEl = row.querySelector("[class*='product'], td:nth-child(2)");
          const qtyEl = row.querySelector("[class*='quantity'], td:nth-child(3)");
          const amountEl = row.querySelector("[class*='amount'], [class*='price'], td:nth-child(4)");
          const statusEl = row.querySelector("[class*='status'], td:nth-child(5)");
          const timeEl = row.querySelector("[class*='time'], [class*='date'], td:nth-child(6)");

          return {
            orderId: orderIdEl?.textContent?.trim() || "",
            productTitle: titleEl?.textContent?.trim() || "",
            quantity: parseInt(qtyEl?.textContent?.replace(/[^0-9]/g, "") || "1", 10),
            amount: parseFloat(amountEl?.textContent?.replace(/[^0-9.]/g, "") || "0"),
            status: statusEl?.textContent?.trim() || "unknown",
            orderTime: timeEl?.textContent?.trim() || "",
          };
        });
      });

      const validOrders = orders.filter((o) => o.orderId);
      logger.info(`抓取完成，共 ${validOrders.length} 个订单`);

      process.stdout.write(
        JSON.stringify({
          type: "orders_scraped",
          data: validOrders,
          total: validOrders.length,
        }) + "\n"
      );

      return validOrders;
    },
    {
      maxRetries: 2,
      onRetry: (error, attempt) => {
        logger.warn(`订单抓取失败，第 ${attempt} 次重试: ${error.message}`);
      },
    }
  );
}
