import type { Page } from "playwright";
import { createLogger } from "../utils/logger.js";
import { actionDelay, randomDelay } from "../utils/delay.js";
import { withRetry } from "../utils/retry.js";

const logger = createLogger("ProductScraper");

export interface ScrapedProduct {
  temuProductId?: string;
  title: string;
  sku: string;
  price: number;
  stock: number;
  status: string;
  category?: string;
  imageUrl?: string;
}

/**
 * 抓取商品列表数据
 */
export async function scrapeProducts(page: Page): Promise<ScrapedProduct[]> {
  logger.info("开始抓取商品列表");

  return withRetry(
    async () => {
      // 导航到商品管理页面
      // 注意：URL 需要根据 Temu 卖家后台实际路径调整
      await page.goto("https://seller.temu.com/product/list", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await actionDelay();

      // 等待商品列表加载
      await page.waitForSelector("table, [class*='product-list'], [class*='goods-list']", {
        timeout: 15000,
      });
      await randomDelay(1000, 2000);

      const products: ScrapedProduct[] = [];
      let hasNextPage = true;
      let pageNum = 1;

      while (hasNextPage) {
        logger.info(`正在抓取第 ${pageNum} 页`);

        // 提取当前页商品数据
        // 注意：选择器需要根据实际页面结构调整
        const pageProducts = await page.evaluate(() => {
          const rows = document.querySelectorAll(
            "table tbody tr, [class*='product-item'], [class*='goods-item']"
          );

          return Array.from(rows).map((row) => {
            const titleEl = row.querySelector(
              "[class*='title'], [class*='name'], td:nth-child(2)"
            );
            const skuEl = row.querySelector("[class*='sku'], td:nth-child(3)");
            const priceEl = row.querySelector("[class*='price'], td:nth-child(4)");
            const stockEl = row.querySelector("[class*='stock'], [class*='inventory'], td:nth-child(5)");
            const statusEl = row.querySelector("[class*='status'], td:nth-child(6)");
            const imgEl = row.querySelector("img");

            return {
              title: titleEl?.textContent?.trim() || "",
              sku: skuEl?.textContent?.trim() || "",
              price: parseFloat(priceEl?.textContent?.replace(/[^0-9.]/g, "") || "0"),
              stock: parseInt(stockEl?.textContent?.replace(/[^0-9]/g, "") || "0", 10),
              status: statusEl?.textContent?.trim() || "unknown",
              imageUrl: imgEl?.getAttribute("src") || undefined,
            };
          });
        });

        products.push(
          ...pageProducts.filter((p) => p.title).map((p) => ({
            ...p,
            temuProductId: undefined,
            category: undefined,
          }))
        );

        // 检查是否有下一页
        const nextButton = await page
          .locator(
            'button:has-text("下一页"), [class*="next"]:not([class*="disabled"]), .ant-pagination-next:not(.ant-pagination-disabled)'
          )
          .first();

        const isDisabled = await nextButton.isDisabled().catch(() => true);

        if (!isDisabled && (await nextButton.isVisible().catch(() => false))) {
          await nextButton.click();
          await actionDelay();
          await page.waitForLoadState("domcontentloaded");
          await randomDelay(1500, 3000);
          pageNum++;
        } else {
          hasNextPage = false;
        }
      }

      logger.info(`抓取完成，共 ${products.length} 件商品`);

      // 通知前端
      process.stdout.write(
        JSON.stringify({
          type: "products_scraped",
          data: products,
          total: products.length,
        }) + "\n"
      );

      return products;
    },
    {
      maxRetries: 2,
      onRetry: (error, attempt) => {
        logger.warn(`商品抓取失败，第 ${attempt} 次重试: ${error.message}`);
      },
    }
  );
}
