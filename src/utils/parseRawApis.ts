/**
 * 从 Worker 返回的原始 API 捕获数据 { apis: [{ path, data }, ...] } 中提取结构化数据
 * 各页面依赖这些解析函数拿到稳定字段，尽量避免接口轻微漂移后整页空白。
 */

type RawApiEntry = {
  path?: string;
  data?: any;
  rangeLabel?: string;
};

function getRawApis(data: any): RawApiEntry[] {
  if (Array.isArray(data?.apis)) return data.apis;
  if (Array.isArray(data?.data?.apis)) return data.data.apis;
  return [];
}

function unwrapApiPayload(entry: RawApiEntry | any): any {
  return entry?.data?.result ?? entry?.data?.data ?? entry?.data ?? entry?.result ?? entry ?? null;
}

function findApi(apis: RawApiEntry[], pattern: string): any {
  const matched = apis.find((item) => item?.path?.includes(pattern));
  return matched ? unwrapApiPayload(matched) : null;
}

function findAllApis(apis: RawApiEntry[], pattern: string): any[] {
  return apis
    .filter((item) => item?.path?.includes(pattern))
    .map((item) => unwrapApiPayload(item))
    .filter((item) => item !== null && item !== undefined);
}

function isRawApiFormat(data: any): boolean {
  return getRawApis(data).length > 0;
}

function toArray<T = any>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

function toStringValue(value: any): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

function toNumberValue(value: any, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function pickFirst<T>(...values: T[]): T | undefined {
  return values.find((value) => value !== null && value !== undefined && value !== "");
}

const CATEGORY_TEXT_KEYS = ["catName", "categoryName", "name", "label", "title", "text"] as const;

function cleanCategoryText(value: any): string {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return text && text !== "[object Object]" ? text : "";
}

function dedupeTexts(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const text = cleanCategoryText(value);
    if (!text || seen.has(text)) return false;
    seen.add(text);
    return true;
  });
}

function getCategoryKeyOrder(key: string): number {
  const catLevel = key.match(/^cat(\d+)$/i);
  if (catLevel) return Number(catLevel[1]);
  const nameLevel = key.match(/^(first|second|third|fourth|fifth)Category/i)?.[1]?.toLowerCase();
  if (nameLevel) {
    return ({ first: 1, second: 2, third: 3, fourth: 4, fifth: 5 } as Record<string, number>)[nameLevel] || 500;
  }
  if (/^leafCat$/i.test(key)) return 999;
  return 500;
}

function extractCategoryTexts(value: any, seen = new WeakSet<object>()): string[] {
  if (!value) return [];
  if (typeof value === "string") return dedupeTexts([value]);
  if (Array.isArray(value)) {
    return dedupeTexts(value.flatMap((item) => extractCategoryTexts(item, seen)));
  }
  if (typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);

  const objectValue = value as Record<string, any>;
  const orderedCategoryKeys = Object.keys(objectValue)
    .filter((key) => /^cat\d+$/i.test(key) || /^(first|second|third|fourth|fifth)Category/i.test(key) || /^leafCat$/i.test(key))
    .sort((a, b) => getCategoryKeyOrder(a) - getCategoryKeyOrder(b));
  const orderedCategoryTexts = dedupeTexts(
    orderedCategoryKeys.flatMap((key) => extractCategoryTexts(objectValue[key], seen)),
  );
  if (orderedCategoryTexts.length > 0) return orderedCategoryTexts;

  const nestedPathTexts = dedupeTexts(
    ["categories", "categoryPath", "categoryTree", "categoryNodeVOS", "path", "children", "list"]
      .flatMap((key) => extractCategoryTexts(objectValue[key], seen)),
  );
  const directTexts = dedupeTexts(
    CATEGORY_TEXT_KEYS
      .map((key) => cleanCategoryText(objectValue[key]))
      .filter(Boolean),
  );
  if (nestedPathTexts.length > 0 || directTexts.length > 0) {
    return dedupeTexts([...nestedPathTexts, ...directTexts]);
  }

  return dedupeTexts(
    Object.values(objectValue)
      .filter((nested) => nested && typeof nested === "object")
      .flatMap((nested) => extractCategoryTexts(nested, seen)),
  );
}

function normalizeCategoryPath(value: any): string {
  return extractCategoryTexts(value).join(" > ");
}

function normalizeCategoryLeaf(value: any): string {
  const parts = extractCategoryTexts(value);
  return parts[parts.length - 1] || "";
}

function formatFenPrice(value: any): string {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return toStringValue(value);
  return (num / 100).toFixed(2);
}

function normalizeSupplyStatus(value: any): string {
  if (typeof value === "number") {
    return (
      {
        0: "正常供货",
        1: "暂时无法供货",
        2: "永久停止供货",
      } as Record<number, string>
    )[value] || String(value);
  }
  return toStringValue(value);
}

function normalizeProductStatus(value: any): string {
  if (typeof value === "number") {
    return value === 0 ? "在售" : value === 1 ? "已下架" : String(value);
  }
  return toStringValue(value);
}

function normalizeSiteLabel(value: any): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") {
    if (value === 0) return "国内备货";
    return String(value);
  }

  const text = toStringValue(value).trim();
  if (!text) return "";
  if (/^(国内备货|国内站|中国站|cn|domestic|domestic_stock)$/i.test(text)) return "国内备货";
  if (/^(海外备货|国际站|global|overseas)$/i.test(text)) return "海外备货";
  return text;
}

function normalizeSalesSiteLabel(item: any, inventoryInfo: any = {}): string {
  const rawSite = pickFirst(
    item.siteName,
    item.siteLabel,
    item.siteTypeName,
    item.stockSiteName,
    item.stockSiteTypeName,
    item.inventoryRegionName,
    item.inventoryRegion,
    item.stationName,
    item.stationLabel,
    item.marketName,
    item.market,
    item.prepareSiteName,
    item.skcSiteStatusName,
    item.skcSiteStatus,
    inventoryInfo.siteName,
    inventoryInfo.siteLabel,
    inventoryInfo.siteTypeName,
    inventoryInfo.inventoryRegionName,
    inventoryInfo.inventoryRegion,
  );

  if (rawSite === 0 || rawSite === 1 || rawSite === "0" || rawSite === "1") return "国内备货";
  if (rawSite === 2 || rawSite === "2") return "海外备货";
  return normalizeSiteLabel(rawSite);
}

function normalizeTodaySalesValue(item: any): number {
  const quantityInfo = item?.skuQuantityTotalInfo || item?.skuQuantityTotalInfoVO || {};
  return toNumberValue(
    pickFirst(
      item.todaySaleVolume,
      item.todaySales,
      item.todaySaleNum,
      item.todaySaleQuantity,
      item.todayPaySaleVolume,
      quantityInfo.todaySaleVolume,
      item.todayPayNum,
      item.todayOrderNum,
      item.saleVolumeToday,
      item.curDaySaleVolume,
    ),
  );
}

function normalizeProductSkuSummary(item: any) {
  const specList = toArray(item?.productSkuSpecList).map((spec: any) => ({
    parentSpecName: toStringValue(spec?.parentSpecName),
    specName: toStringValue(spec?.specName),
    unitSpecName: toStringValue(spec?.unitSpecName),
  }));

  const specText = specList
    .map((spec) => {
      const name = spec.parentSpecName || "规格";
      const value = spec.specName || spec.unitSpecName;
      return value ? `${name}: ${value}` : "";
    })
    .filter(Boolean)
    .join(" / ");

  return {
    productSkuId: toStringValue(pickFirst(item?.productSkuId, item?.skuId)),
    thumbUrl: toStringValue(pickFirst(item?.thumbUrl, item?.imageUrl, item?.mainImageUrl)),
    productSkuSpecList: specList,
    specText,
    specName: toStringValue(pickFirst(specList[0]?.specName, item?.specName)),
    extCode: toStringValue(pickFirst(item?.extCode, item?.skuExtCode, item?.skuCode)),
  };
}

function normalizeProductsFromList(items: any[], syncedAt = ""): any[] {
  return items.map((item: any) => {
    const categories = normalizeCategoryPath(
      pickFirst(
        item.categories,
        item.categoryPath,
        item.categoryTree,
        item.category,
        item.categoryName,
        item.leafCat,
      ),
    );
    const leafCategory = normalizeCategoryLeaf(
      pickFirst(
        item.leafCatName,
        item.leafCat,
        item.categoryName,
        item.category,
        item.categories,
        item.categoryPath,
        item.categoryTree,
      ),
    );
    const skuExtCodes = toArray(item.productSkuSummaries || item.skuList)
      .map((sku: any) => toStringValue(pickFirst(sku.extCode, sku.skuExtCode, sku.skuCode)))
      .filter(Boolean)
      .join(", ");
    const skuSummaries = toArray(item.productSkuSummaries || item.skuList).map(normalizeProductSkuSummary);

    return {
      title: toStringValue(pickFirst(item.productName, item.title, item.goodsName)),
      category: leafCategory || categories,
      categories,
      spuId: toStringValue(pickFirst(item.productId, item.spuId, item.productSpuId)),
      skcId: toStringValue(pickFirst(item.productSkcId, item.skcId, item.skcExtId)),
      goodsId: toStringValue(item.goodsId),
      sku: toStringValue(pickFirst(item.extCode, item.skuExtCode, item.skuCode, skuExtCodes)),
      extCode: toStringValue(pickFirst(item.extCode, item.skuExtCode, item.skuCode)),
      imageUrl: toStringValue(pickFirst(item.thumbUrl, item.mainImageUrl, item.goodsImageUrl, item.imageUrl)),
      siteLabel: normalizeSiteLabel(
        pickFirst(
          item.siteName,
          item.siteLabel,
          item.siteTypeName,
          item.stockSiteTypeName,
          item.skcSiteStatusName,
          item.skcSiteStatus,
        ),
      ),
      price: toStringValue(item.price),
      status: normalizeProductStatus(pickFirst(item.removeStatus, item.status)),
      removeStatus: pickFirst(item.removeStatus, item.status),
      productType: toStringValue(pickFirst(item.productTypeName, item.productType)),
      sourceType: toStringValue(pickFirst(item.sourceTypeName, item.sourceType)),
      totalSales: toNumberValue(pickFirst(item.productTotalSalesVolume, item.totalSales)),
      last7DaysSales: toNumberValue(pickFirst(item.last7DaysSalesVolume, item.lastSevenDaysSalesVolume, item.last7DaysSales)),
      skcStatus: item.skcStatus,
      skcSiteStatus: item.skcSiteStatus,
      flowLimitStatus: toStringValue(item.flowLimitStatus),
      skuSummaries,
      createdAt: pickFirst(item.createdAt, item.createTime),
      syncedAt,
    };
  });
}

export function parseProductCountSummary(raw: any) {
  const emptySummary = {
    totalCount: 0,
    onSaleCount: 0,
    notPublishedCount: 0,
    offSaleCount: 0,
  };

  if (!isRawApiFormat(raw)) return emptySummary;

  const apis = getRawApis(raw);
  const countResult = pickFirst(
    findApi(apis, "product/skc/countStatus"),
    findApi(apis, "countStatus"),
  );

  const countList = toArray(
    pickFirst(
      countResult?.skcTopStatusCountList,
      countResult?.countStatusList,
      countResult?.list,
    ),
  );

  if (countList.length === 0) return emptySummary;

  const summary = { ...emptySummary };
  countList.forEach((item: any) => {
    const status = String(
      pickFirst(
        item?.skcTopStatus,
        item?.status,
        item?.statusCode,
        item?.key,
      ) ?? "",
    );
    const count = toNumberValue(pickFirst(item?.count, item?.num, item?.value));
    if (status === "0") summary.totalCount = count;
    if (status === "100") summary.onSaleCount = count;
    if (status === "200") summary.notPublishedCount = count;
    if (status === "300") summary.offSaleCount = count;
  });

  if (!summary.totalCount) {
    summary.totalCount =
      summary.onSaleCount + summary.notPublishedCount + summary.offSaleCount;
  }

  return summary;
}

function dedupeByKey<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  items.forEach((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });
  return result;
}

function normalizeSalesFlatItem(item: any, syncedAt = "") {
  const quantityInfo = item.skuQuantityTotalInfo || item.skuQuantityTotalInfoVO || {};
  const inventoryInfo = item.inventoryNumInfo || item.inventoryInfo || quantityInfo.inventoryNumInfo || {};
  return {
    key: toStringValue(pickFirst(item.key, item.skuId, item.productSkcId, item.skcId, item.spuId)),
    title: toStringValue(pickFirst(item.productName, item.title, item.goodsName)),
    category: normalizeCategoryPath(pickFirst(item.category, item.categories, item.categoryTree)),
    skcId: toStringValue(pickFirst(item.productSkcId, item.skcId, item.skcExtId)),
    spuId: toStringValue(pickFirst(item.productId, item.spuId, item.productSpuId)),
    goodsId: toStringValue(item.goodsId),
    imageUrl: toStringValue(pickFirst(item.productSkcPicture, item.imageUrl, item.goodsImageUrl)),
    siteLabel: normalizeSalesSiteLabel(item, inventoryInfo),
    skuId: toStringValue(pickFirst(item.skuId, item.productSkuId)),
    skuName: toStringValue(pickFirst(item.skuName, item.name, item.skuAttributeName, item.attributeName)),
    todaySales: normalizeTodaySalesValue(item),
    last7DaysSales: toNumberValue(
      pickFirst(
        item.lastSevenDaysSaleVolume,
        item.last7DaysSales,
        item.last7DaySaleVolume,
        item.sevenDaysSaleVolume,
        item.nearSevenDaysSaleVolume,
        quantityInfo.lastSevenDaysSaleVolume,
      ),
    ),
    last30DaysSales: toNumberValue(
      pickFirst(
        item.lastThirtyDaysSaleVolume,
        item.last30DaysSales,
        item.last30DaySaleVolume,
        item.thirtyDaysSaleVolume,
        item.nearThirtyDaysSaleVolume,
        quantityInfo.lastThirtyDaysSaleVolume,
      ),
    ),
    totalSales: toNumberValue(
      pickFirst(
        item.totalSaleVolume,
        item.totalSales,
        item.accumulatedSaleVolume,
        item.historySaleVolume,
        quantityInfo.totalSaleVolume,
      ),
    ),
    warehouseStock: toNumberValue(pickFirst(
      inventoryInfo.availableInventoryNum,
      inventoryInfo.warehouseAvailableNum,
      inventoryInfo.canUseInventoryNum,
      inventoryInfo.usableInventoryNum,
      inventoryInfo.actualInventoryNum,
      inventoryInfo.warehouseInventoryNum,
      item.availableInventoryNum,
      item.warehouseStock,
    )),
    adviceQuantity: toNumberValue(pickFirst(item.adviceQuantity, item.suggestStock, quantityInfo.adviceQuantity)),
    lackQuantity: toNumberValue(pickFirst(item.lackQuantity, quantityInfo.lackQuantity)),
    occupyStock: toNumberValue(pickFirst(inventoryInfo.occupyInventoryNum, item.occupyStock)),
    unavailableStock: toNumberValue(pickFirst(inventoryInfo.unavailableInventoryNum, item.unavailableStock)),
    warehouseGroup: toStringValue(pickFirst(item.warehouseGroup, item.warehouseGroupName, inventoryInfo.warehouseGroup)),
    price: pickFirst(
      item.price,
      item.supplierPrice !== undefined ? formatFenPrice(item.supplierPrice) : "",
    ) || "",
    skuCode: toStringValue(pickFirst(item.skuExtCode, item.skuCode, item.extCode)),
    stockStatus: toStringValue(pickFirst(item.stockStatusName, item.stockStatus)),
    supplyStatus: normalizeSupplyStatus(pickFirst(item.supplyStatusName, item.supplyStatus)),
    hotTag: toStringValue(pickFirst(item.hotTag?.tagName, item.hotTag, item.hotSaleTag)),
    isAdProduct: item.isAdProduct ? "广告商品" : toStringValue(item.isAdProduct),
    availableSaleDays: pickFirst(item.availableSaleDays, quantityInfo.availableSaleDays, inventoryInfo.availableSaleDays, null),
    asfScore: item.asfScore ?? "",
    buyerName: toStringValue(item.buyerName),
    buyerUid: toStringValue(item.buyerUid),
    commentNum: toNumberValue(item.commentNum),
    inBlackList: item.inBlackList === undefined || item.inBlackList === null || item.inBlackList === ""
      ? ""
      : (item.inBlackList ? "是" : "否"),
    pictureAuditStatus: toStringValue(pickFirst(item.pictureAuditStatusName, item.pictureAuditStatus)),
    qualityAfterSalesRate: item.qualityAfterSalesRate ?? item.qualityAfterSalesRateValue ?? "",
    predictTodaySaleVolume: toNumberValue(pickFirst(item.predictTodaySaleVolume, quantityInfo.predictTodaySaleVolume)),
    sevenDaysSaleReference: toNumberValue(pickFirst(item.sevenDaysSaleReference, quantityInfo.sevenDaysSaleReference)),
    sevenDaysAddCartNum: toNumberValue(pickFirst(
      item.recentSevenDaysAddCartNum,
      item.sevenDaysAddCartNum,
      item.last7DaysAddCartNum,
      item.addCartNumLast7Days,
      quantityInfo.recentSevenDaysAddCartNum,
      quantityInfo.sevenDaysAddCartNum,
    )),
    syncedAt,
  };
}

function normalizeSalesItemsFromSkuList(items: any[], syncedAt = ""): any[] {
  return items.flatMap((item: any, itemIndex: number) =>
    toArray(item.skuList).map((sku: any, skuIndex: number) => {
      const quantityInfo = item.skuQuantityTotalInfo || item.skuQuantityTotalInfoVO || {};
      return {
        key: `${itemIndex}-${skuIndex}`,
        title: toStringValue(pickFirst(item.productName, item.title)),
        category: normalizeCategoryPath(item.category),
        skcId: toStringValue(pickFirst(item.skcId, item.productSkcId)),
        spuId: toStringValue(pickFirst(item.spuId, item.productId)),
        goodsId: toStringValue(item.goodsId),
        imageUrl: toStringValue(pickFirst(item.imageUrl, item.productSkcPicture)),
        siteLabel: normalizeSalesSiteLabel(sku, item),
        skuId: toStringValue(sku.skuId),
        skuName: toStringValue(pickFirst(sku.skuName, sku.name)),
        skuCode: toStringValue(pickFirst(sku.skuCode, sku.extCode, sku.skuExtCode)),
        todaySales: normalizeTodaySalesValue({ ...item, ...sku }),
        last7DaysSales: toNumberValue(
          pickFirst(
            sku.lastSevenDaysSaleVolume,
            sku.last7DaysSales,
            item.lastSevenDaysSaleVolume,
            item.last7DaysSales,
            quantityInfo.lastSevenDaysSaleVolume,
          ),
        ),
        last30DaysSales: toNumberValue(
          pickFirst(
            sku.lastThirtyDaysSaleVolume,
            sku.last30DaysSales,
            item.lastThirtyDaysSaleVolume,
            item.last30DaysSales,
            quantityInfo.lastThirtyDaysSaleVolume,
          ),
        ),
        totalSales: toNumberValue(
          pickFirst(
            sku.totalSaleVolume,
            sku.totalSales,
            item.totalSaleVolume,
            item.totalSales,
            quantityInfo.totalSaleVolume,
          ),
        ),
        price: toNumberValue(sku.price),
        warehouseStock: toNumberValue(sku.warehouseStock),
        adviceQuantity: toNumberValue(pickFirst(sku.adviceQuantity, sku.suggestStock, item.adviceQuantity, item.suggestStock, quantityInfo.adviceQuantity)),
        lackQuantity: toNumberValue(pickFirst(sku.lackQuantity, item.lackQuantity, quantityInfo.lackQuantity)),
        occupyStock: toNumberValue(sku.occupyStock),
        unavailableStock: toNumberValue(sku.unavailableStock),
        warehouseGroup: toStringValue(sku.warehouseGroup),
        suggestStock: toNumberValue(sku.suggestStock),
        stockStatus: toStringValue(sku.stockStatus),
        supplyStatus: normalizeSupplyStatus(pickFirst(sku.supplyStatusName, sku.supplyStatus, item.supplyStatusName, item.supplyStatus)),
        hotTag: toStringValue(pickFirst(sku.hotTag?.tagName, sku.hotTag, item.hotTag?.tagName, item.hotTag, item.hotSaleTag)),
        availableSaleDays: pickFirst(sku.availableSaleDays, item.availableSaleDays, quantityInfo.availableSaleDays, null),
        asfScore: item.asfScore ?? "",
        buyerName: toStringValue(item.buyerName),
        buyerUid: toStringValue(item.buyerUid),
        commentNum: toNumberValue(item.commentNum),
        inBlackList: item.inBlackList === undefined || item.inBlackList === null || item.inBlackList === ""
          ? ""
          : (item.inBlackList ? "是" : "否"),
        pictureAuditStatus: toStringValue(pickFirst(item.pictureAuditStatusName, item.pictureAuditStatus)),
        qualityAfterSalesRate: item.qualityAfterSalesRate ?? item.qualityAfterSalesRateValue ?? "",
        predictTodaySaleVolume: toNumberValue(pickFirst(sku.predictTodaySaleVolume, item.predictTodaySaleVolume, quantityInfo.predictTodaySaleVolume)),
        sevenDaysSaleReference: toNumberValue(pickFirst(sku.sevenDaysSaleReference, item.sevenDaysSaleReference, quantityInfo.sevenDaysSaleReference)),
        syncedAt,
      };
    }),
  );
}

function normalizeFluxTrendItem(item: any) {
  return {
    date: toStringValue(pickFirst(item.statDate, item.date)),
    visitors: toNumberValue(pickFirst(item.visitorsNum, item.visitors)),
    buyers: toNumberValue(pickFirst(item.payBuyerNum, item.buyers)),
    conversionRate: toNumberValue(item.conversionRate),
  };
}

function normalizeFluxSummary(summaryRaw: any) {
  if (!summaryRaw) return null;
  return {
    todayVisitors: toNumberValue(pickFirst(summaryRaw.todayTotalVisitorsNum, summaryRaw.todayVisitors)),
    todayBuyers: toNumberValue(pickFirst(summaryRaw.todayPayBuyerNum, summaryRaw.todayBuyers)),
    todayConversionRate: toNumberValue(summaryRaw.todayConversionRate),
    updateTime: toStringValue(summaryRaw.updateTime),
    trendList: toArray(summaryRaw.trendList).map(normalizeFluxTrendItem),
  };
}

const FLUX_RANGE_PRIORITY = ["今日", "近7日", "近30日", "本周", "本月", "昨日"];

function normalizeFluxRangeLabel(label: any) {
  const text = toStringValue(label);
  return text || "今日";
}

function getFluxRangePriority(label: string) {
  const index = FLUX_RANGE_PRIORITY.indexOf(label);
  return index >= 0 ? index : FLUX_RANGE_PRIORITY.length + 1;
}

function getFluxItemIdentityKeys(source: any) {
  return Array.from(new Set([
    toStringValue(source?.goodsId) ? `goods:${toStringValue(source?.goodsId)}` : "",
    toStringValue(pickFirst(source?.productSkcId, source?.skcId, source?.goodsSkcId)) ? `skc:${toStringValue(pickFirst(source?.productSkcId, source?.skcId, source?.goodsSkcId))}` : "",
    toStringValue(pickFirst(source?.productSkuId, source?.skuId)) ? `sku:${toStringValue(pickFirst(source?.productSkuId, source?.skuId))}` : "",
    toStringValue(pickFirst(source?.productSpuId, source?.spuId, source?.productId)) ? `spu:${toStringValue(pickFirst(source?.productSpuId, source?.spuId, source?.productId))}` : "",
    toStringValue(pickFirst(source?.goodsName, source?.productName, source?.title)) ? `title:${toStringValue(pickFirst(source?.goodsName, source?.productName, source?.title)).toLowerCase()}` : "",
  ].filter(Boolean)));
}

function pickLatestFluxDetailRecord(detailResult: any) {
  const records = toArray(detailResult?.list);
  if (records.length === 0) return detailResult || null;
  return [...records].sort((left: any, right: any) =>
    toStringValue(right?.statDate).localeCompare(toStringValue(left?.statDate))
  )[0];
}

// 汇总 goods/detail 返回的每日明细 list，把数值字段求和而不是只取最近一天，
// 这样 KPI 卡、转化漏斗显示的就是"区间汇总"而不是"最新单日"，与 Temu 后台关键指标一致。
function sumFluxDetailRecords(detailResult: any) {
  const records = toArray(detailResult?.list);
  if (records.length === 0) return null;
  const numericKeys = [
    "exposeNum", "goodsExposeNum",
    "clickNum", "goodsClickNum",
    "goodsDetailVisitNum", "detailVisitNum",
    "goodsDetailVisitorNum", "detailVisitorNum",
    "addToCartUserNum", "collectUserNum",
    "buyerNum", "payBuyerNum", "payGoodsNum", "payOrderNum",
    "searchExposeNum", "searchClickNum", "searchPayGoodsNum", "searchPayOrderNum",
    "recommendExposeNum", "recommendClickNum", "recommendPayGoodsNum", "recommendPayOrderNum",
  ];
  const sum: Record<string, number> = {};
  for (const key of numericKeys) sum[key] = 0;
  for (const r of records) {
    for (const key of numericKeys) {
      sum[key] += toNumberValue(r?.[key]);
    }
  }
  return sum;
}

function mergeFluxItemDetail(item: any, detailResult: any, trendResult: any) {
  const latestDetail = pickLatestFluxDetailRecord(detailResult);
  const sumDetail = sumFluxDetailRecords(detailResult);
  // 优先使用 sumDetail（区间汇总）覆盖 item，保持 KPI 口径与 Temu 后台"关键指标分析"一致；
  // 若没有 daily list，则回退到 latestDetail 单行 / item 原值。
  return {
    ...item,
    dataDate: toStringValue(pickFirst(latestDetail?.statDate, trendResult?.pt)),
    updateTime: toStringValue(pickFirst(detailResult?.updateAt, detailResult?.updateTime)),
    exposeNum: sumDetail
      ? (sumDetail.exposeNum || sumDetail.goodsExposeNum || toNumberValue(item.exposeNum))
      : toNumberValue(item.exposeNum),
    clickNum: sumDetail
      ? (sumDetail.clickNum || sumDetail.goodsClickNum || toNumberValue(item.clickNum))
      : toNumberValue(item.clickNum),
    detailVisitNum: sumDetail
      ? (sumDetail.goodsDetailVisitNum || sumDetail.detailVisitNum || toNumberValue(item.detailVisitNum))
      : toNumberValue(item.detailVisitNum),
    detailVisitorNum: sumDetail
      ? (sumDetail.goodsDetailVisitorNum || sumDetail.detailVisitorNum || toNumberValue(item.detailVisitorNum))
      : toNumberValue(pickFirst(latestDetail?.goodsDetailVisitorNum, item.detailVisitorNum)),
    addToCartUserNum: sumDetail
      ? (sumDetail.addToCartUserNum || toNumberValue(item.addToCartUserNum))
      : toNumberValue(item.addToCartUserNum),
    collectUserNum: sumDetail
      ? (sumDetail.collectUserNum || toNumberValue(item.collectUserNum))
      : toNumberValue(pickFirst(latestDetail?.collectUserNum, item.collectUserNum)),
    payOrderNum: sumDetail
      ? (sumDetail.payOrderNum || toNumberValue(item.payOrderNum))
      : toNumberValue(pickFirst(latestDetail?.payOrderNum, item.payOrderNum)),
    payGoodsNum: sumDetail
      ? (sumDetail.payGoodsNum || toNumberValue(item.payGoodsNum))
      : toNumberValue(pickFirst(latestDetail?.payGoodsNum, item.payGoodsNum)),
    buyerNum: sumDetail
      ? (sumDetail.buyerNum || sumDetail.payBuyerNum || toNumberValue(item.buyerNum))
      : toNumberValue(pickFirst(latestDetail?.buyerNum, item.buyerNum)),
    searchExposeNum: sumDetail
      ? (sumDetail.searchExposeNum || toNumberValue(item.searchExposeNum))
      : toNumberValue(pickFirst(latestDetail?.searchExposeNum, item.searchExposeNum)),
    searchClickNum: sumDetail
      ? (sumDetail.searchClickNum || toNumberValue(item.searchClickNum))
      : toNumberValue(pickFirst(latestDetail?.searchClickNum, item.searchClickNum)),
    searchPayGoodsNum: sumDetail
      ? (sumDetail.searchPayGoodsNum || toNumberValue(item.searchPayGoodsNum))
      : toNumberValue(latestDetail?.searchPayGoodsNum),
    recommendExposeNum: sumDetail
      ? (sumDetail.recommendExposeNum || toNumberValue(item.recommendExposeNum))
      : toNumberValue(pickFirst(latestDetail?.recommendExposeNum, item.recommendExposeNum)),
    recommendClickNum: sumDetail
      ? (sumDetail.recommendClickNum || toNumberValue(item.recommendClickNum))
      : toNumberValue(pickFirst(latestDetail?.recommendClickNum, item.recommendClickNum)),
    recommendPayGoodsNum: sumDetail
      ? (sumDetail.recommendPayGoodsNum || toNumberValue(item.recommendPayGoodsNum))
      : toNumberValue(latestDetail?.recommendPayGoodsNum),
    trendExposeNum: toNumberValue(trendResult?.goodsExposeNum),
    trendExposeNumChange: pickFirst(trendResult?.goodsExposeNumLinkRelative, trendResult?.goodsExposeNumChange, null),
    trendPayOrderNum: toNumberValue(trendResult?.payOrderNum),
    trendPayOrderNumChange: pickFirst(trendResult?.payOrderNumLinkRelative, trendResult?.payOrderNumChange, null),
    rawFluxDetail: detailResult || null,
    rawFluxTrend: trendResult || null,
  };
}

function buildFluxDetailLookup(apis: any[]) {
  const detailByIdentity = new Map<string, any>();
  const trendByIdentity = new Map<string, any>();

  apis.forEach((api) => {
    const path = toStringValue(api?.path);
    const identityKeys = getFluxItemIdentityKeys(api?.fluxIdentity || {});
    if (identityKeys.length === 0) return;
    const result = pickFirst(api?.data?.result, api?.data);
    if (!result) return;

    const targetMap = path.includes("goods/detail")
      ? detailByIdentity
      : path.includes("goods/trend")
        ? trendByIdentity
        : null;
    if (!targetMap) return;

    identityKeys.forEach((key) => targetMap.set(key, result));
  });

  return { detailByIdentity, trendByIdentity };
}

function buildFluxRangeDataset(apis: any[], syncedAt = "", allApis: any[] = []) {
  const { detailByIdentity, trendByIdentity } = buildFluxDetailLookup(apis);
  const mallSummary = normalizeFluxSummary(findApi(apis, "mall/summary"));
  const fluxResults = findAllApis(apis, "goods/list");
  const items = fluxResults.flatMap((result) =>
    normalizeFluxItems(
      toArray(pickFirst(result?.list, result?.pageItems, result?.items)),
    ),
  ).map((item) => {
    const identityKeys = getFluxItemIdentityKeys(item);
    const detailResult = identityKeys.map((key) => detailByIdentity.get(key)).find(Boolean);
    const trendResult = identityKeys.map((key) => trendByIdentity.get(key)).find(Boolean);
    return mergeFluxItemDetail(item, detailResult, trendResult);
  });

  // 当没有 mall/summary（如欧区/美区）时，从 goods/list 聚合汇总 + 从 daily cache 构建趋势
  const summary = mallSummary || buildFallbackFluxSummary(items, allApis);

  return {
    summary,
    items,
    syncedAt,
  };
}

/** 从 goods/list 聚合指标 + __flux_product_daily_cache__ 构建 trendList，作为无 mall/summary 时的兜底 */
function buildFallbackFluxSummary(items: any[], allApis: any[]) {
  if (items.length === 0 && allApis.length === 0) return null;

  // 聚合 goods/list 的指标
  let totalVisitors = 0;
  let totalBuyers = 0;
  for (const item of items) {
    totalVisitors += toNumberValue(pickFirst(item.detailVisitorNum, item.detailVisitNum, item.goodsDetailVisitorNum));
    totalBuyers += toNumberValue(pickFirst(item.buyerNum, item.payBuyerNum));
  }

  // 从 __flux_product_daily_cache__ 构建每日趋势
  const trendList: any[] = [];
  const dailyCacheApi = allApis.find((a: any) => a.path === "__flux_product_daily_cache__");
  if (dailyCacheApi?.data?.result) {
    const products = dailyCacheApi.data.result;
    const dayMap: Record<string, { visitors: number; buyers: number }> = {};
    for (const product of Object.values(products) as any[]) {
      const stationEntries = Object.values(product?.stations || {}) as any[];
      for (const station of stationEntries) {
        for (const day of toArray(station?.daily)) {
          const date = toStringValue(day?.date);
          if (!date) continue;
          if (!dayMap[date]) dayMap[date] = { visitors: 0, buyers: 0 };
          dayMap[date].visitors += toNumberValue(pickFirst(day.detailVisitorNum, day.detailVisitNum));
          dayMap[date].buyers += toNumberValue(day.buyerNum);
        }
      }
    }
    const sortedDates = Object.keys(dayMap).sort();
    for (const date of sortedDates) {
      const d = dayMap[date];
      trendList.push({
        date,
        visitors: d.visitors,
        buyers: d.buyers,
        conversionRate: d.visitors > 0 ? d.buyers / d.visitors : 0,
      });
    }
  }

  if (totalVisitors === 0 && totalBuyers === 0 && trendList.length === 0) return null;

  return {
    todayVisitors: totalVisitors,
    todayBuyers: totalBuyers,
    todayConversionRate: totalVisitors > 0 ? totalBuyers / totalVisitors : 0,
    updateTime: "",
    trendList,
  };
}

function pickFluxPrimaryRangeLabel(
  summaryByRange: Record<string, any>,
  itemsByRange: Record<string, any[]>,
  preferredLabel = "",
) {
  const preferred = normalizeFluxRangeLabel(preferredLabel);
  const labels = Array.from(new Set([
    ...Object.keys(summaryByRange || {}),
    ...Object.keys(itemsByRange || {}),
  ])).sort((left, right) => getFluxRangePriority(left) - getFluxRangePriority(right));

  if (preferred && (summaryByRange?.[preferred] || itemsByRange?.[preferred]?.length)) {
    return preferred;
  }

  return labels.find((label) => Array.isArray(itemsByRange?.[label]) && itemsByRange[label].length > 0)
    || labels.find((label) => Boolean(summaryByRange?.[label]))
    || preferred
    || "今日";
}

function normalizeFluxItems(items: any[]): any[] {
  return items.map((item: any, index: number) => ({
    key: toStringValue(pickFirst(item.key, item.goodsId, `${index}`)),
    goodsId: toStringValue(item.goodsId),
    skcId: toStringValue(pickFirst(item.productSkcId, item.skcId, item.goodsSkcId)),
    skuId: toStringValue(pickFirst(item.productSkuId, item.skuId)),
    goodsName: toStringValue(pickFirst(item.goodsName, item.productName, item.title)),
    imageUrl: toStringValue(pickFirst(item.goodsImageUrl, item.imageUrl, item.mainImageUrl)),
    spuId: toStringValue(pickFirst(item.productSpuId, item.spuId, item.productId)),
    category: normalizeCategoryPath(pickFirst(item.category, item.categories)),
    exposeNum: toNumberValue(item.exposeNum),
    exposeNumChange: pickFirst(item.exposeNumLinkRelative, item.exposeNumChange, null),
    clickNum: toNumberValue(item.clickNum),
    clickNumChange: pickFirst(item.clickNumLinkRelative, item.clickNumChange, null),
    detailVisitNum: toNumberValue(pickFirst(item.goodsDetailVisitNum, item.detailVisitNum)),
    detailVisitorNum: toNumberValue(pickFirst(item.goodsDetailVisitorNum, item.detailVisitorNum)),
    addToCartUserNum: toNumberValue(item.addToCartUserNum),
    collectUserNum: toNumberValue(item.collectUserNum),
    payGoodsNum: toNumberValue(item.payGoodsNum),
    payOrderNum: toNumberValue(item.payOrderNum),
    buyerNum: toNumberValue(item.buyerNum),
    dataDate: toStringValue(item.dataDate),
    updateTime: toStringValue(item.updateTime),
    searchExposeNum: toNumberValue(item.searchExposeNum),
    searchClickNum: toNumberValue(item.searchClickNum),
    searchPayGoodsNum: toNumberValue(item.searchPayGoodsNum),
    recommendExposeNum: toNumberValue(item.recommendExposeNum),
    recommendClickNum: toNumberValue(item.recommendClickNum),
    recommendPayGoodsNum: toNumberValue(item.recommendPayGoodsNum),
    trendExposeNum: toNumberValue(item.trendExposeNum),
    trendExposeNumChange: pickFirst(item.trendExposeNumChange, null),
    trendPayOrderNum: toNumberValue(item.trendPayOrderNum),
    trendPayOrderNumChange: pickFirst(item.trendPayOrderNumChange, null),
    clickPayRate: toNumberValue(pickFirst(item.clickPayConversionRate, item.clickPayRate)),
    exposeClickRate: toNumberValue(pickFirst(item.exposeClickConversionRate, item.exposeClickRate)),
    growDataText: toStringValue(item.growDataText),
  }));
}

// ============ Dashboard 仪表盘 ============
export function parseDashboardData(raw: any): any {
  if (!isRawApiFormat(raw)) return raw;
  const apis = getRawApis(raw);

  const statsRaw = findApi(apis, "queryStatisticDataFullManaged");
  const statistics = statsRaw ? {
    onSaleProducts: toNumberValue(statsRaw.onSaleProductNumber),
    sevenDaysSales: toNumberValue(statsRaw.sevenDaysSaleVolume),
    thirtyDaysSales: toNumberValue(statsRaw.thirtyDaysSaleVolume),
    lackSkcNumber: toNumberValue(statsRaw.lackSkcNumber),
    alreadySoldOut: toNumberValue(pickFirst(statsRaw.alreadySoldOutNumber, statsRaw.sellOutNum)),
    aboutToSellOut: toNumberValue(pickFirst(statsRaw.aboutToSellOutNumber, statsRaw.aboutToSellOut)),
    advicePrepareSkcNumber: toNumberValue(statsRaw.advicePrepareSkcNumber),
    waitProductNumber: toNumberValue(statsRaw.waitProductNumber),
    highPriceLimit: toNumberValue(pickFirst(statsRaw.adjustPrice, statsRaw.highPriceLimitNumber)),
  } : undefined;

  const rankRaw = findApi(apis, "queryIncomeRanking");
  const ranking = rankRaw ? {
    date: toStringValue(rankRaw.pt),
    overall: pickFirst(rankRaw.ranking, undefined),
    pvRank: pickFirst(rankRaw.mallPVRank, undefined),
    richnessRank: pickFirst(rankRaw.mallGoodsRichnessRank, undefined),
    saleOutRate: pickFirst(rankRaw.mallSaleOutRateRank, undefined),
  } : undefined;

  const incomeRaw = findApi(apis, "income-summary");
  const income = Array.isArray(incomeRaw) ? incomeRaw.map((item: any) => ({
    date: toStringValue(item.date),
    amount: toStringValue(pickFirst(item.incomeAmount?.digitalText, item.incomeAmount?.fullText, item.amount, "0")),
  })) : undefined;

  const productStatusRaw = findApi(apis, "queryProductStatusCount");
  const productStatusArr = toArray(productStatusRaw?.productSkcStatusAggregation);
  const productStatus = productStatusArr.length > 0
    ? productStatusArr.reduce((acc: any, item: any) => {
        const statusMap: Record<number, string> = {
          1: "toSubmit",
          3: "rejected",
          7: "notListed",
          9: "onSale",
          10: "soldOut",
          11: "offShelf",
          12: "inReview",
          13: "toConfirm",
          14: "banned",
          15: "other",
        };
        const key = statusMap[item.selectStatus] || `status_${item.selectStatus}`;
        acc[key] = toNumberValue(item.count);
        return acc;
      }, {})
    : undefined;

  const saleAnalysis = findApi(apis, "analysis/total");

  return { ...raw, statistics, ranking, income, productStatus, saleAnalysis, syncedAt: raw.syncedAt };
}

// ============ Products 商品列表 ============
export function parseProductsData(raw: any): any[] {
  if (Array.isArray(raw)) {
    return normalizeProductsFromList(raw);
  }
  if (Array.isArray(raw?.items)) {
    return normalizeProductsFromList(raw.items, raw.syncedAt || "");
  }
  if (!isRawApiFormat(raw)) return [];

  const apis = getRawApis(raw);
  const productResults = findAllApis(apis, "product/skc/pageQuery");
  const products = productResults.flatMap((result) =>
    normalizeProductsFromList(
      toArray(result?.pageItems).length > 0 ? result.pageItems : toArray(result?.list),
      raw.syncedAt || "",
    ),
  );

  return dedupeByKey(products, (item) => [item.skcId, item.goodsId, item.spuId, item.title].filter(Boolean).join("|"));
}

// ============ Orders 备货单 ============
export function parseOrdersData(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (!isRawApiFormat(raw)) return [];

  const apis = getRawApis(raw);
  const orderResults = findAllApis(apis, "querySubOrderList");
  const allOrders: any[] = [];

  orderResults.forEach((result) => {
    const items = toArray(
      pickFirst(
        result?.subOrderForSupplierList,
        result?.pageItems,
        result?.list,
      ),
    );

    items.forEach((item: any) => {
      const firstSku = pickFirst(
        toArray(item.skuQuantityDetailList)[0],
        toArray(item.skuQuantityDetailForSupplierList)[0],
        item.skuInfo,
      ) || {};

      allOrders.push({
        key: allOrders.length + 1,
        type: typeof item.categoryType === "number"
          ? (item.categoryType === 1 ? "紧急备货建议" : item.categoryType === 2 ? "普通备货建议" : String(item.categoryType))
          : toStringValue(item.categoryType),
        purchaseOrderNo: toStringValue(pickFirst(item.subPurchaseOrderSn, item.purchaseOrderNo, item.originalPurchaseOrderSn)),
        parentOrderNo: toStringValue(item.originalPurchaseOrderSn),
        title: toStringValue(pickFirst(item.productName, item.title)),
        skcId: toStringValue(pickFirst(item.productSkcId, item.skcId)),
        skuId: toStringValue(pickFirst(firstSku.productSkuId, firstSku.skuId)),
        skuCode: toStringValue(pickFirst(firstSku.skuExtCode, firstSku.skuCode)),
        quantity: toNumberValue(pickFirst(firstSku.purchaseQuantity, item.skuQuantityTotalInfo?.totalPurchaseQuantity)),
        status: typeof item.status === "number"
          ? ({ 1: "待发货", 2: "已发货", 3: "已完成", 4: "已取消", 5: "部分发货" } as Record<number, string>)[item.status] || String(item.status)
          : toStringValue(item.status),
        amount: firstSku.supplierPrice !== undefined ? formatFenPrice(firstSku.supplierPrice) : "",
        warehouse: toStringValue(item.warehouseGroupName),
        orderTime: toStringValue(pickFirst(item.purchaseTime, item.orderTime)),
        urgencyInfo: toStringValue(item.urgencyType),
        attributes: toStringValue(pickFirst(firstSku.className, firstSku.attribute)),
      });
    });
  });

  return allOrders;
}

// ============ Sales 销售管理 ============
export function parseSalesData(raw: any): any {
  if (Array.isArray(raw?.items) && raw.items.some((item: any) => Array.isArray(item?.skuList))) {
    return {
      summary: raw.summary || {},
      items: normalizeSalesItemsFromSkuList(raw.items, raw.syncedAt),
      syncedAt: raw.syncedAt,
    };
  }

  if (Array.isArray(raw?.items)) {
    return {
      summary: raw.summary || {},
      items: raw.items.map((item: any) => {
        const normalized: any = normalizeSalesFlatItem(item, raw.syncedAt);
        if (item.rawItem) normalized.rawItem = item.rawItem;
        if (item.rawFirstSku) normalized.rawFirstSku = item.rawFirstSku;
        if (item.trendDaily) normalized.trendDaily = item.trendDaily;
        return normalized;
      }),
      syncedAt: raw.syncedAt,
    };
  }

  if (!isRawApiFormat(raw)) return { summary: {}, items: [] };
  const apis = getRawApis(raw);

  // 聚合全部分页 (listOverall 已分页采集)
  const allOverallRaws = [
    ...findAllApis(apis, "listOverall"),
    ...findAllApis(apis, "sales/management/overall"),
  ].filter(Boolean);
  const overallRaw = allOverallRaws[0] || {};

  // summary 透传 listOverall 顶层所有非数组/非对象的统计字段，再 + 显式补齐
  const summary: any = {};
  for (const [k, v] of Object.entries(overallRaw)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) || typeof v === "object") continue;
    summary[k] = v;
  }
  // 显式确保 UI 用到的字段为数字
  const explicitNumKeys = [
    "saleOutSkcNum", "soonSaleOutSkcNum", "adviceStockSkcNum", "completelySoldOutSkcNum",
    "adSkcNum", "shortageSkcNum", "totalSkcNum", "addedToSiteSkcNum",
    "lackNum", "recommendProduceNum", "priceAdjustingSkcNum",
    "waitFirstPurchaseSkcNum", "firstPurchaseNotShippedSkcNum",
    "saleOutSkuNum", "shortageSkuNum", "totalSkuNum",
  ];
  for (const k of explicitNumKeys) {
    summary[k] = toNumberValue((overallRaw as any)[k] ?? summary[k]);
  }

  // 跨所有分页合并 items
  const itemSources: any[] = [];
  for (const r of allOverallRaws) {
    itemSources.push(
      ...toArray(r?.subOrderList),
      ...toArray(r?.pageItems),
      ...toArray(r?.list),
    );
  }

  // 收集所有"销售趋势"弹窗 API 响应（querySkuSalesNumber），按 prodSkuId 分组
  const trendPoints = findAllApis(apis, "querySkuSalesNumber").flatMap((r: any) => toArray(r));
  const trendBySkuId = new Map<string, Array<{ date: string; salesNumber: number; isPredict: any; soldOut: any }>>();
  for (const p of trendPoints) {
    const k = String(p?.prodSkuId ?? "");
    if (!k) continue;
    if (!trendBySkuId.has(k)) trendBySkuId.set(k, []);
    trendBySkuId.get(k)!.push({
      date: String(p.date || ""),
      salesNumber: toNumberValue(p.salesNumber),
      isPredict: p.isPredict,
      soldOut: p.soldOut,
    });
  }
  // 按日期排序
  for (const arr of trendBySkuId.values()) {
    arr.sort((a, b) => a.date.localeCompare(b.date));
  }
  const items = itemSources.map((item: any) => {
    const firstSku = pickFirst(
      toArray(item.skuQuantityDetailList)[0],
      toArray(item.skuQuantityDetailForSupplierList)[0],
      item.skuInfo,
      item,
    ) || {};
    const normalized = normalizeSalesFlatItem(
      {
        ...item,
        ...firstSku,
        productSkcPicture: pickFirst(item.productSkcPicture, item.imageUrl),
      },
      raw.syncedAt,
    );
    // 把整条原始 item + firstSku 挂出去，前端展开行直接渲染全部字段
    (normalized as any).rawItem = item;
    (normalized as any).rawFirstSku = firstSku;
    // 关联日销量趋势：以 firstSku.productSkuId 为主，匹配不到再试 skuQuantityDetailList 里所有 sku
    const skuIds = new Set<string>();
    if (firstSku?.productSkuId) skuIds.add(String(firstSku.productSkuId));
    for (const s of toArray(item.skuQuantityDetailList)) {
      if (s?.productSkuId) skuIds.add(String(s.productSkuId));
    }
    const trendDaily: Array<{ date: string; salesNumber: number }> = [];
    for (const id of skuIds) {
      const arr = trendBySkuId.get(id);
      if (arr) trendDaily.push(...arr);
    }
    if (trendDaily.length > 0) {
      // 同一日期合并多 SKU 求和
      const byDate = new Map<string, number>();
      for (const p of trendDaily) {
        byDate.set(p.date, (byDate.get(p.date) || 0) + p.salesNumber);
      }
      (normalized as any).trendDaily = Array.from(byDate.entries())
        .map(([date, salesNumber]) => ({ date, salesNumber }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }
    return normalized;
  });

  return { summary, items, syncedAt: raw.syncedAt };
}

// ============ Flux 流量分析 ============
export function parseFluxData(raw: any): any {
  if (raw?.summary !== undefined && raw?.items !== undefined && !raw?.apis) {
    const summaryByRange = Object.entries(raw?.summaryByRange || {}).reduce<Record<string, any>>((accumulator, [label, value]) => {
      accumulator[normalizeFluxRangeLabel(label)] = normalizeFluxSummary(value);
      return accumulator;
    }, {});
    const itemsByRange = Object.entries(raw?.itemsByRange || {}).reduce<Record<string, any[]>>((accumulator, [label, value]) => {
      accumulator[normalizeFluxRangeLabel(label)] = normalizeFluxItems(toArray(value));
      return accumulator;
    }, {});
    const availableRanges = Array.from(new Set([
      ...Object.keys(summaryByRange),
      ...Object.keys(itemsByRange),
      ...toArray(raw?.availableRanges).map((label: any) => normalizeFluxRangeLabel(label)),
    ])).sort((left, right) => getFluxRangePriority(left) - getFluxRangePriority(right));
    const primaryRangeLabel = pickFluxPrimaryRangeLabel(summaryByRange, itemsByRange, raw?.primaryRangeLabel);

    return {
      summary: summaryByRange[primaryRangeLabel] || normalizeFluxSummary(raw.summary),
      items: itemsByRange[primaryRangeLabel] || normalizeFluxItems(toArray(raw.items)),
      syncedAt: raw.syncedAt,
      summaryByRange,
      itemsByRange,
      availableRanges,
      primaryRangeLabel,
    };
  }

  if (!isRawApiFormat(raw)) return { summary: null, items: [] };
  const apis = getRawApis(raw);
  const apisByRange = apis.reduce<Record<string, any[]>>((accumulator, api) => {
    const rangeLabel = normalizeFluxRangeLabel(api?.rangeLabel);
    if (!accumulator[rangeLabel]) accumulator[rangeLabel] = [];
    accumulator[rangeLabel].push(api);
    return accumulator;
  }, {});

  const availableRanges = Object.keys(apisByRange).filter((label) => !label.startsWith("__")).sort((left, right) => getFluxRangePriority(left) - getFluxRangePriority(right));
  const summaryByRange = availableRanges.reduce<Record<string, any>>((accumulator, label) => {
    accumulator[label] = buildFluxRangeDataset(apisByRange[label] || [], raw.syncedAt, apis).summary;
    return accumulator;
  }, {});
  const itemsByRange = availableRanges.reduce<Record<string, any[]>>((accumulator, label) => {
    accumulator[label] = buildFluxRangeDataset(apisByRange[label] || [], raw.syncedAt, apis).items;
    return accumulator;
  }, {});
  const primaryRangeLabel = pickFluxPrimaryRangeLabel(summaryByRange, itemsByRange, raw?.meta?.rangeLabel);

  return {
    summary: summaryByRange[primaryRangeLabel] || null,
    items: itemsByRange[primaryRangeLabel] || [],
    syncedAt: raw.syncedAt,
    summaryByRange,
    itemsByRange,
    availableRanges,
    primaryRangeLabel,
  };
}

// ============ 商品数据 — 每日流量提取 ============
/**
 * 从 temu_raw_goodsData 原始 API 数据中提取每日流量趋势。
 * goods-analysis 页面可能捕获多种 API，此函数尝试多种匹配策略：
 * 1. 包含 trendList / dailyList 的 goods/list 或 goods/trend 类 API
 * 2. 包含日期字段 (day/date/statDate) 的数组数据
 * 返回: { dailyItems: [{ date, goodsId, goodsName, exposeNum, clickNum, ... }], products: [...] }
 */
export function parseGoodsAnalysisDailyData(raw: any): { dailyItems: any[]; products: any[] } {
  const empty = { dailyItems: [], products: [] };
  if (!raw) return empty;
  if (!isRawApiFormat(raw)) return empty;

  const apis = getRawApis(raw);
  const dailyItems: any[] = [];
  const productsMap = new Map<string, any>();

  // 策略1: 查找 goods/list / goods/trend 类 API (flow analysis)
  const flowApis = apis.filter((api) => {
    const p = api?.path || "";
    return p.includes("goods/list") || p.includes("goods/trend") || p.includes("goods/daily")
      || p.includes("goodsAnalysis") || p.includes("goods_analysis")
      || p.includes("skc/flow") || p.includes("skc/trend");
  });

  for (const api of flowApis) {
    const payload = unwrapApiPayload(api);
    if (!payload) continue;

    // 查找包含日期的列表数据
    const lists = [
      payload.trendList, payload.dailyList, payload.dateList,
      payload.list, payload.pageItems, payload.items, payload.dataList,
    ].filter(Array.isArray);

    for (const list of lists) {
      for (const item of list) {
        const date = item.day || item.date || item.statDate || item.dateStr || "";
        if (!date) continue;

        // 如果 item 中嵌套了 goodsList，展开
        if (Array.isArray(item.goodsList || item.productList || item.list)) {
          const inner = item.goodsList || item.productList || item.list;
          for (const g of inner) {
            const goodsId = String(g.goodsId || g.productSkcId || g.skcId || g.spuId || "");
            if (!goodsId) continue;
            dailyItems.push(normalizeGoodsDailyItem(date, g));
            if (!productsMap.has(goodsId)) {
              productsMap.set(goodsId, { goodsId, goodsName: g.goodsName || g.productName || "", imageUrl: g.goodsImageUrl || g.imageUrl || "" });
            }
          }
        } else {
          // item 本身就是某商品的某天数据
          const goodsId = String(item.goodsId || item.productSkcId || item.skcId || item.spuId || "");
          if (goodsId) {
            dailyItems.push(normalizeGoodsDailyItem(date, item));
            if (!productsMap.has(goodsId)) {
              productsMap.set(goodsId, { goodsId, goodsName: item.goodsName || item.productName || "", imageUrl: item.goodsImageUrl || item.imageUrl || "" });
            }
          }
        }
      }
    }
  }

  // 策略2: 如果策略1没找到，遍历所有 API 寻找日期+流量字段
  if (dailyItems.length === 0) {
    for (const api of apis) {
      const payload = unwrapApiPayload(api);
      if (!payload) continue;
      const candidates = [payload, ...(Array.isArray(payload) ? payload : [])];
      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== "object") continue;
        const lists = Object.values(candidate).filter(Array.isArray) as any[][];
        for (const list of lists) {
          if (list.length === 0) continue;
          const sample = list[0];
          if (!sample || typeof sample !== "object") continue;
          const hasDate = sample.day || sample.date || sample.statDate || sample.dateStr;
          const hasFlow = sample.exposeNum !== undefined || sample.clickNum !== undefined
            || sample.visitNum !== undefined || sample.buyerNum !== undefined;
          if (hasDate && hasFlow) {
            for (const item of list) {
              const date = item.day || item.date || item.statDate || item.dateStr || "";
              const goodsId = String(item.goodsId || item.productSkcId || item.skcId || item.spuId || "");
              if (date && goodsId) {
                dailyItems.push(normalizeGoodsDailyItem(date, item));
                if (!productsMap.has(goodsId)) {
                  productsMap.set(goodsId, { goodsId, goodsName: item.goodsName || item.productName || "", imageUrl: item.goodsImageUrl || item.imageUrl || "" });
                }
              }
            }
          }
        }
      }
    }
  }

  dailyItems.sort((a, b) => a.date.localeCompare(b.date));

  return { dailyItems, products: Array.from(productsMap.values()) };
}

function normalizeGoodsDailyItem(date: string, item: any) {
  return {
    date: String(date),
    goodsId: String(item.goodsId || item.productSkcId || item.skcId || item.spuId || ""),
    goodsName: String(item.goodsName || item.productName || ""),
    exposeNum: toNumberValue(item.exposeNum),
    clickNum: toNumberValue(item.clickNum),
    detailVisitNum: toNumberValue(pickFirst(item.goodsDetailVisitNum, item.detailVisitNum, item.visitNum)),
    detailVisitorNum: toNumberValue(pickFirst(item.goodsDetailVisitorNum, item.detailVisitorNum, item.visitorNum)),
    addToCartUserNum: toNumberValue(item.addToCartUserNum),
    collectUserNum: toNumberValue(item.collectUserNum),
    buyerNum: toNumberValue(item.buyerNum),
    payGoodsNum: toNumberValue(item.payGoodsNum),
    payOrderNum: toNumberValue(item.payOrderNum),
    searchExposeNum: toNumberValue(item.searchExposeNum),
    searchClickNum: toNumberValue(item.searchClickNum),
    recommendExposeNum: toNumberValue(item.recommendExposeNum),
    recommendClickNum: toNumberValue(item.recommendClickNum),
    clickPayRate: toNumberValue(pickFirst(item.clickPayConversionRate, item.clickPayRate)),
    exposeClickRate: toNumberValue(pickFirst(item.exposeClickConversionRate, item.exposeClickRate)),
  };
}

// ============ 统一解析入口 ============
export function parseStoreData(key: string, raw: any): any {
  if (!raw || !isRawApiFormat(raw)) return raw;

  switch (key) {
    case "dashboard":
      return parseDashboardData(raw);
    case "products":
      return parseProductsData(raw);
    case "orders":
      return parseOrdersData(raw);
    case "sales":
      return parseSalesData(raw);
    case "flux":
      return parseFluxData(raw);
    default:
      return raw;
  }
}
