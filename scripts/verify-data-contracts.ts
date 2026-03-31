import assert from "node:assert/strict";
import {
  parseDashboardData,
  parseFluxData,
  parseOrdersData,
  parseProductsData,
  parseSalesData,
  parseStoreData,
} from "../src/utils/parseRawApis.ts";

function verifyDashboardParser() {
  const raw = {
    syncedAt: "2026-03-31 10:00:00",
    apis: [
      {
        path: "/bg/swift/api/common/statistics/web/queryStatisticDataFullManaged",
        data: {
          result: {
            onSaleProductNumber: 12,
            sevenDaysSaleVolume: 34,
            thirtyDaysSaleVolume: 56,
            lackSkcNumber: 2,
            alreadySoldOutNumber: 1,
            aboutToSellOutNumber: 3,
            advicePrepareSkcNumber: 4,
            waitProductNumber: 5,
            highPriceLimitNumber: 6,
          },
        },
      },
      {
        path: "/bg/swift/api/common/statistics/queryIncomeRanking",
        data: {
          result: {
            pt: "2026-03-30",
            ranking: 8,
            mallPVRank: 9,
          },
        },
      },
      {
        path: "/api/merchant/front/finance/income-summary",
        data: {
          result: [{ date: "2026-03-30", incomeAmount: { digitalText: "123.45" } }],
        },
      },
    ],
  };

  const parsed = parseDashboardData(raw);
  assert.equal(parsed.statistics.onSaleProducts, 12);
  assert.equal(parsed.statistics.highPriceLimit, 6);
  assert.equal(parsed.ranking.overall, 8);
  assert.equal(parsed.income[0].amount, "123.45");
}

function verifyProductsParser() {
  const raw = {
    syncedAt: "2026-03-31 10:00:00",
    apis: [
      {
        path: "/product/skc/pageQuery?page=1",
        data: {
          result: {
            pageItems: [
              {
                productName: "清洁刷",
                productId: 1001,
                productSkcId: 2001,
                goodsId: 3001,
                categories: {
                  cat1: { catName: "家居" },
                  cat2: { catName: "清洁工具" },
                },
                leafCat: { catName: "刷具" },
                productSkuSummaries: [{ extCode: "SKU-A" }],
                thumbUrl: "https://example.com/a.png",
                removeStatus: 0,
                productTotalSalesVolume: 50,
                last7DaysSalesVolume: 12,
              },
            ],
          },
        },
      },
    ],
  };

  const parsed = parseProductsData(raw);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, "清洁刷");
  assert.equal(parsed[0].category, "刷具");
  assert.equal(parsed[0].categories, "家居 > 清洁工具");
  assert.equal(parsed[0].status, "在售");
  assert.equal(parsed[0].sku, "SKU-A");
}

function verifyOrdersParser() {
  const raw = {
    apis: [
      {
        path: "/querySubOrderList",
        data: {
          result: {
            subOrderForSupplierList: [
              {
                categoryType: 1,
                subPurchaseOrderSn: "PO-1",
                productName: "清洁刷",
                productSkcId: 2001,
                warehouseGroupName: "杭州仓",
                purchaseTime: "2026-03-31 10:00:00",
                skuQuantityDetailList: [
                  {
                    productSkuId: 5001,
                    skuExtCode: "SKU-A",
                    purchaseQuantity: 20,
                    supplierPrice: 1588,
                  },
                ],
              },
            ],
          },
        },
      },
    ],
  };

  const parsed = parseOrdersData(raw);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].purchaseOrderNo, "PO-1");
  assert.equal(parsed[0].amount, "15.88");
  assert.equal(parsed[0].type, "紧急备货建议");
}

function verifySalesParser() {
  const directRaw = {
    syncedAt: "2026-03-31 10:00:00",
    summary: { totalSkcNum: 1 },
    items: [
      {
        productName: "清洁刷",
        category: "家居",
        skcId: "2001",
        spuId: "1001",
        imageUrl: "https://example.com/a.png",
        skuList: [
          {
            skuId: "5001",
            skuName: "默认",
            skuCode: "SKU-A",
            price: 19.9,
            warehouseStock: 8,
            stockStatus: "正常",
          },
        ],
      },
    ],
  };

  const directParsed = parseSalesData(directRaw);
  assert.equal(directParsed.items.length, 1);
  assert.equal(directParsed.items[0].skuCode, "SKU-A");
  assert.equal(directParsed.items[0].warehouseStock, 8);

  const apiRaw = {
    syncedAt: "2026-03-31 10:00:00",
    apis: [
      {
        path: "/sales/management/listOverall",
        data: {
          result: {
            totalSkcNum: 2,
            subOrderList: [
              {
                productName: "清洁刷",
                productId: "1001",
                productSkcId: "2001",
                productSkcPicture: "https://example.com/a.png",
                category: "家居",
                stockStatus: "库存正常",
                supplyStatus: 0,
                skuQuantityDetailList: [
                  {
                    skuExtCode: "SKU-A",
                    supplierPrice: 1888,
                    todaySaleVolume: 2,
                    lastSevenDaysSaleVolume: 5,
                    lastThirtyDaysSaleVolume: 10,
                    totalSaleVolume: 30,
                    inventoryNumInfo: { warehouseInventoryNum: 9 },
                  },
                ],
              },
            ],
          },
        },
      },
    ],
  };

  const apiParsed = parseSalesData(apiRaw);
  assert.equal(apiParsed.summary.totalSkcNum, 2);
  assert.equal(apiParsed.items[0].price, "18.88");
  assert.equal(apiParsed.items[0].supplyStatus, "正常供货");
}

function verifyFluxParser() {
  const raw = {
    syncedAt: "2026-03-31 10:00:00",
    apis: [
      {
        path: "/api/seller/full/flow/analysis/mall/summary",
        data: {
          result: {
            todayTotalVisitorsNum: 120,
            todayPayBuyerNum: 8,
            todayConversionRate: 0.12,
            trendList: [
              {
                statDate: "2026-03-30",
                visitorsNum: 80,
                payBuyerNum: 6,
                conversionRate: 0.09,
              },
            ],
          },
        },
      },
      {
        path: "/api/seller/full/flow/analysis/goods/list",
        data: {
          result: {
            list: [
              {
                goodsId: "3001",
                goodsName: "清洁刷",
                productSpuId: "1001",
                goodsImageUrl: "https://example.com/a.png",
                category: "家居",
                exposeNum: 1000,
                clickNum: 120,
                buyerNum: 8,
                clickPayConversionRate: 0.1,
              },
            ],
          },
        },
      },
    ],
  };

  const parsed = parseFluxData(raw);
  assert.equal(parsed.summary.todayVisitors, 120);
  assert.equal(parsed.summary.trendList.length, 1);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].goodsId, "3001");
  assert.equal(parsed.items[0].clickPayRate, 0.1);
}

function verifyStoreDispatcher() {
  const raw = {
    apis: [
      {
        path: "/api/seller/full/flow/analysis/mall/summary",
        data: { result: { todayTotalVisitorsNum: 1, todayPayBuyerNum: 1, todayConversionRate: 1, trendList: [] } },
      },
      {
        path: "/api/seller/full/flow/analysis/goods/list",
        data: { result: { list: [] } },
      },
    ],
  };

  const parsed = parseStoreData("flux", raw);
  assert.equal(parsed.summary.todayVisitors, 1);
}

function main() {
  verifyDashboardParser();
  verifyProductsParser();
  verifyOrdersParser();
  verifySalesParser();
  verifyFluxParser();
  verifyStoreDispatcher();
  console.log("[ok] data contract parsers");
}

main();
