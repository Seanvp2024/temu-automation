export interface CompetitorProductLike {
  title?: string;
  titleZh?: string;
  price?: number;
  priceText?: string;
  marketPrice?: number | null;
  dailySales?: number;
  weeklySales?: number;
  monthlySales?: number;
  totalSales?: number;
  weeklySalesPercentage?: number;
  monthlySalesPercentage?: number;
  score?: number;
  reviewCount?: number;
  commentNumTips?: string;
  videoUrl?: string;
  wareHouseType?: number;
  mall?: string;
  mallScore?: number | null;
  mallTotalGoods?: number | null;
  brand?: string;
  createdAt?: string;
  productUrl?: string;
  url?: string;
  goodsId?: string;
  imageUrl?: string;
  imageUrls?: string[];
  adRecords?: Array<{ time?: string; type?: string }>;
  tags?: string[];
  labels?: string[];
}

export interface KeywordPoolItem {
  id: string;
  keyword: string;
  keywordType: string;
  wareHouseType: number;
  updatedAt: string;
  totalFound: number;
  competitionLabel: string;
  marketVerdict: string;
  opportunityScore: number;
  recommendedPriceBand: string;
  primaryNeed: string;
  entryFocus: string;
  nextAction: string;
  videoRate: number;
  top10SalesShare: number;
}

export interface MarketInsight {
  keyword: string;
  keywordType: string;
  totalProducts: number;
  averagePrice: number;
  medianPrice: number;
  totalMonthlySales: number;
  top10SalesShare: number;
  videoRate: number;
  medianScore: number;
  medianReviewCount: number;
  competitionLabel: string;
  marketVerdict: string;
  opportunityScore: number;
  recommendedPriceBand: string;
  recommendedBandReason: string;
  lowPriceBand: string;
  midPriceBand: string;
  highPriceBand: string;
  primaryNeed: string;
  entryFocus: string;
  warehouseInsight: string;
  nextAction: string;
}

export interface NormalizedMyProduct {
  id: string;
  title: string;
  price: number;
  dailySales: number;
  weeklySales: number;
  monthlySales: number;
  score: number;
  reviewCount: number;
  hasVideo: boolean;
  category: string;
  status: string;
}

export interface TrackedSignal {
  tags: string[];
  trafficSource: string;
  weakness: string;
  responseAction: string;
  priority: "P0" | "P1" | "P2";
  winningHook: string;
}

export interface ComparisonRow {
  key: string;
  keyword: string;
  competitorTitle: string;
  competitorUrl: string;
  goodsId: string;
  currentPrice: string;
  dailySales: number;
  weeklySales: number;
  monthlySales: number;
  score: number;
  reviewCount: number;
  winningHook: string;
  hasVideo: boolean;
  tags: string;
  weakness: string;
  trafficSource: string;
  gap: string;
  responseAction: string;
  priority: "P0" | "P1" | "P2";
}

export interface ExecutionReport {
  id: string;
  generatedAt: string;
  myProductTitle: string;
  competitorCount: number;
  marketInsight: MarketInsight;
  comparisonRows: ComparisonRow[];
  summary: {
    canCompete: string;
    winAngle: string;
    immediateFocus: string;
    keywordDecision: string;
    nextProductDirection: string;
  };
  whyCompetitorsWin: string[];
  immediateActions: string[];
  weeklyActions: string[];
  sourcingActions: string[];
  dailyChecklist: string[];
  weeklyChecklist: string[];
  monthlyChecklist: string[];
}

const ATTRIBUTE_KEYWORDS = [
  "waterproof", "portable", "mini", "large", "small", "cotton", "silicone", "metal", "wood", "usb", "wireless",
  "防水", "便携", "迷你", "大号", "小号", "硅胶", "金属", "木质", "无线", "充电", "加厚", "ins",
];

const SCENE_KEYWORDS = [
  "kitchen", "bathroom", "travel", "outdoor", "car", "desk", "bedroom", "office", "camping",
  "厨房", "浴室", "旅行", "户外", "车载", "桌面", "卧室", "办公室", "露营", "居家",
];

const PAIN_KEYWORDS = [
  "anti", "repair", "clean", "organizer", "storage", "odor", "noise", "fix",
  "防", "修复", "清洁", "收纳", "除味", "降噪", "去污", "防滑", "防漏",
];

const BUNDLE_KEYWORDS = [
  "set", "kit", "bundle", "pack", "piece", "pcs", "combo", "gift",
  "套装", "组合", "赠", "礼盒", "多件", "套", "件套",
];

function toNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getReviewCount(product: CompetitorProductLike) {
  if (toNumber(product.reviewCount) > 0) return toNumber(product.reviewCount);
  const text = toText(product.commentNumTips);
  if (!text) return 0;
  const match = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)(k)?/i);
  if (!match) return 0;
  const base = Number(match[1] || 0);
  if (!Number.isFinite(base)) return 0;
  return match[2] ? Math.round(base * 1000) : Math.round(base);
}

function getSalesSignal(product: CompetitorProductLike) {
  const monthly = toNumber(product.monthlySales);
  if (monthly > 0) return monthly;
  const weekly = toNumber(product.weeklySales);
  if (weekly > 0) return weekly * 4;
  const daily = toNumber(product.dailySales);
  if (daily > 0) return daily * 30;
  return toNumber(product.totalSales);
}

function formatBand(min: number, max: number) {
  const safeMin = Math.max(0, round(min, 2));
  const safeMax = Math.max(safeMin, round(max, 2));
  return `$${safeMin.toFixed(2)} - $${safeMax.toFixed(2)}`;
}

function hasKeyword(title: string, keywords: string[]) {
  const lower = title.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function dedupe(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

export function autoClassifyKeyword(keyword: string) {
  const normalized = toText(keyword).toLowerCase();
  if (!normalized) return "核心大词";
  if (hasKeyword(normalized, PAIN_KEYWORDS)) return "痛点词";
  if (hasKeyword(normalized, SCENE_KEYWORDS)) return "场景词";
  if (hasKeyword(normalized, ATTRIBUTE_KEYWORDS)) return "属性词";
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length >= 3 || normalized.length >= 12) return "精准长尾词";
  return "核心大词";
}

function getCompetitionLabel(pressureScore: number) {
  if (pressureScore >= 68) return "红海硬卷盘";
  if (pressureScore >= 42) return "中度竞争盘";
  return "有机会切入盘";
}

function getPrimaryNeed(products: CompetitorProductLike[], videoRate: number, medianScoreValue: number, bundleRate: number) {
  const prices = products.map((product) => toNumber(product.price)).filter((price) => price > 0);
  const tightPriceBand = prices.length > 4 && percentile(prices, 0.75) - percentile(prices, 0.25) <= Math.max(3, average(prices) * 0.25);
  if (tightPriceBand) return "价格";
  if (videoRate >= 0.55) return "功能";
  if (bundleRate >= 0.3) return "套装";
  if (medianScoreValue >= 4.6) return "信任";
  return "外观";
}

function getEntryFocus(primaryNeed: string, verdict: string, videoRate: number) {
  if (verdict === "红海硬卷盘" && primaryNeed === "价格") {
    return "避开大词，切更细长尾和差异化规格";
  }
  if (primaryNeed === "功能" || videoRate >= 0.55) {
    return "优先补功能演示视频和场景素材";
  }
  if (primaryNeed === "信任") {
    return "先补评价、评分和详情页背书";
  }
  if (primaryNeed === "套装") {
    return "用套装/赠品组合拉高转化";
  }
  return "先重做首图卖点，再测价格带";
}

export function buildMarketInsight(keyword: string, products: CompetitorProductLike[], wareHouseType = 0): MarketInsight {
  const usableProducts = products.filter((product) => toNumber(product.price) > 0);
  const salesSorted = [...products].sort((left, right) => getSalesSignal(right) - getSalesSignal(left));
  const topProducts = salesSorted.slice(0, Math.min(10, salesSorted.length));
  const prices = usableProducts.map((product) => toNumber(product.price));
  const totalMonthlySales = products.reduce((sum, product) => sum + getSalesSignal(product), 0);
  const top10Sales = topProducts.reduce((sum, product) => sum + getSalesSignal(product), 0);
  const top10SalesShare = totalMonthlySales > 0 ? top10Sales / totalMonthlySales : topProducts.length / Math.max(1, products.length);
  const videoRate = topProducts.length > 0
    ? topProducts.filter((product) => Boolean(toText(product.videoUrl))).length / topProducts.length
    : 0;
  const scores = topProducts.map((product) => toNumber(product.score)).filter((score) => score > 0);
  const reviewCounts = topProducts.map((product) => getReviewCount(product)).filter((count) => count > 0);
  const bundleRate = topProducts.length > 0
    ? topProducts.filter((product) => hasKeyword(toText(product.title || product.titleZh), BUNDLE_KEYWORDS)).length / topProducts.length
    : 0;

  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const lowerBoundary = prices.length > 0 ? percentile(prices, 0.33) : 0;
  const upperBoundary = prices.length > 0 ? percentile(prices, 0.66) : 0;
  const bandDefinitions = [
    { key: "low", min: minPrice, max: lowerBoundary, label: formatBand(minPrice, lowerBoundary || minPrice) },
    { key: "mid", min: lowerBoundary, max: upperBoundary, label: formatBand(lowerBoundary || minPrice, upperBoundary || lowerBoundary || minPrice) },
    { key: "high", min: upperBoundary, max: maxPrice, label: formatBand(upperBoundary || maxPrice, maxPrice) },
  ];

  const bandSummaries = bandDefinitions.map((band) => {
    const bandItems = usableProducts.filter((product) => {
      const price = toNumber(product.price);
      if (band.key === "high") return price >= band.min;
      return price >= band.min && price <= band.max;
    });
    const bandSales = bandItems.reduce((sum, product) => sum + getSalesSignal(product), 0);
    const countShare = bandItems.length / Math.max(1, usableProducts.length);
    const salesShare = totalMonthlySales > 0 ? bandSales / totalMonthlySales : 0;
    const score = salesShare * 100 - countShare * 45 + (bandItems.some((product) => toNumber(product.weeklySalesPercentage) > 20) ? 10 : 0);
    return {
      ...band,
      count: bandItems.length,
      sales: bandSales,
      score,
    };
  });
  const recommendedBand = [...bandSummaries].sort((left, right) => right.score - left.score)[0] || bandSummaries[0];

  const pressureScore = clamp(
    (Math.min(products.length, 50) / 50) * 38 +
    top10SalesShare * 30 +
    (median(scores) >= 4.55 ? 12 : 0) +
    (videoRate >= 0.6 ? 12 : 0) +
    (median(reviewCounts) >= 300 ? 8 : 0),
    10,
    95,
  );
  const marketVerdict = getCompetitionLabel(pressureScore);
  const primaryNeed = getPrimaryNeed(products, videoRate, median(scores), bundleRate);
  const entryFocus = getEntryFocus(primaryNeed, marketVerdict, videoRate);
  const recommendedBandReason = recommendedBand
    ? `该价格带的销量承接更强，商品拥挤度相对更低。`
    : "先补充更多竞品样本后再判断价格带。";
  const warehouseLabel = wareHouseType === 1 ? "半托管" : "全托管";
  const warehouseInsight = top10SalesShare >= 0.55
    ? `${warehouseLabel}头部集中度较高，建议先从同履约模式切入。`
    : `${warehouseLabel}市场还存在分散空间，可以先做细分词测试。`;

  return {
    keyword,
    keywordType: autoClassifyKeyword(keyword),
    totalProducts: products.length,
    averagePrice: round(average(prices)),
    medianPrice: round(median(prices)),
    totalMonthlySales,
    top10SalesShare,
    videoRate,
    medianScore: round(median(scores)),
    medianReviewCount: Math.round(median(reviewCounts)),
    competitionLabel: pressureScore >= 68 ? "高竞争" : pressureScore >= 42 ? "中竞争" : "可切入",
    marketVerdict,
    opportunityScore: clamp(Math.round(100 - pressureScore + (recommendedBand?.score || 0) / 3), 18, 92),
    recommendedPriceBand: recommendedBand?.label || "-",
    recommendedBandReason,
    lowPriceBand: bandSummaries[0]?.label || "-",
    midPriceBand: bandSummaries[1]?.label || "-",
    highPriceBand: bandSummaries[2]?.label || "-",
    primaryNeed,
    entryFocus,
    warehouseInsight,
    nextAction: `${entryFocus}，优先测试 ${recommendedBand?.label || "当前主价格带"}。`,
  };
}

export function normalizeMyProduct(product: Record<string, unknown> | null | undefined): NormalizedMyProduct {
  const source = product || {};
  return {
    id: toText(source.productSkcId || source.skcId || source.id || source.goodsId || source.productId),
    title: toText(source.productName || source.title || source.goodsName || source.name) || "未命名商品",
    price: toNumber(source.retailPrice || source.price || source.suggestedPrice || source.minPrice),
    dailySales: toNumber(source.todaySales || source.dailySales || source.predictTodaySaleVolume),
    weeklySales: toNumber(source.last7DaysSales || source.weeklySales || source.sevenDaysSaleReference),
    monthlySales: toNumber(source.last30DaysSales || source.monthlySales || source.totalSales),
    score: toNumber(source.avgScore || source.score || source.qualityScore),
    reviewCount: toNumber(source.commentNum || source.reviewCount),
    hasVideo: Boolean(source.videoUrl || source.videoCount || source.hasVideo),
    category: toText(source.category || source.categories || source.catName),
    status: toText(source.status || source.removeStatus || source.skcSiteStatus),
  };
}

function inferTrafficSource(tags: string[], product: CompetitorProductLike) {
  if (tags.includes("活动投流型")) return "活动 / 投流";
  if (tags.includes("视频驱动型")) return "视频转化";
  if (tags.includes("低价冲量型")) return "价格引流";
  if (tags.includes("高评分信任型")) return "搜索 + 评价";
  if (toNumber(product.mallTotalGoods) >= 200) return "店铺矩阵";
  return "自然搜索";
}

function inferWeakness(product: CompetitorProductLike, averagePrice: number, averageMonthlySales: number) {
  if (!toText(product.videoUrl)) return "视频素材弱，靠价格或评价承接。";
  if (toNumber(product.score) > 0 && toNumber(product.score) < 4.3) return "评分门槛一般，信任成本偏高。";
  if (toNumber(product.price) >= averagePrice * 1.15 && getSalesSignal(product) < averageMonthlySales * 0.9) {
    return "高价位承接偏弱，容易被低价款切走。";
  }
  if (toNumber(product.monthlySalesPercentage) < 0 || toNumber(product.weeklySalesPercentage) < 0) {
    return "近阶段动销回落，需要继续监控。";
  }
  return "评论内容未拉取，建议补看低星评论和问答。";
}

function inferWinningHook(tags: string[]) {
  if (tags.includes("低价冲量型")) return "低价切入 + 快速承接";
  if (tags.includes("视频驱动型")) return "视频演示 + 功能理解";
  if (tags.includes("高评分信任型")) return "高评分背书 + 信任成交";
  if (tags.includes("套装/赠品拉单型")) return "套装组合 + 提升客单";
  if (tags.includes("高颜值转化型")) return "首图风格化 + 强展示";
  return "标题卖点承接";
}

export function buildTrackedSignals(
  product: CompetitorProductLike,
  peers: CompetitorProductLike[],
  myProduct?: NormalizedMyProduct,
): TrackedSignal {
  const averagePrice = average(peers.map((item) => toNumber(item.price)).filter((price) => price > 0));
  const averageMonthlySales = average(peers.map((item) => getSalesSignal(item)).filter((sales) => sales > 0));
  const reviewCount = getReviewCount(product);
  const title = toText(product.title || product.titleZh);
  const tags: string[] = [];

  if (toNumber(product.price) > 0 && averagePrice > 0 && toNumber(product.price) <= averagePrice * 0.9 && getSalesSignal(product) >= averageMonthlySales * 0.9) {
    tags.push("低价冲量型");
  }
  if (toNumber(product.score) >= 4.6 || reviewCount >= 300) {
    tags.push("高评分信任型");
  }
  if (toText(product.videoUrl)) {
    tags.push("视频驱动型");
  }
  if (hasKeyword(title, BUNDLE_KEYWORDS)) {
    tags.push("套装/赠品拉单型");
  }
  if (
    (toNumber(product.marketPrice) > 0 && toNumber(product.price) > 0 && toNumber(product.marketPrice) >= toNumber(product.price) * 1.18) ||
    toNumber(product.weeklySalesPercentage) >= 25 ||
    (product.adRecords?.length || 0) > 0
  ) {
    tags.push("活动投流型");
  }
  if (toNumber(product.price) >= averagePrice * 1.05 && toNumber(product.score) >= 4.4 && toText(product.videoUrl)) {
    tags.push("高颜值转化型");
  }

  const finalTags = dedupe(tags).slice(0, 3);
  const trafficSource = inferTrafficSource(finalTags, product);
  const weakness = inferWeakness(product, averagePrice, averageMonthlySales);

  const actionCandidates = [
    myProduct && myProduct.price > 0 && toNumber(product.price) > 0 && myProduct.price >= toNumber(product.price) * 1.1
      ? "先测低价 SKU 或限时促销，避免价格带错位。"
      : "",
    finalTags.includes("视频驱动型") && !myProduct?.hasVideo
      ? "优先补 1 条功能演示视频精品。"
      : "",
    finalTags.includes("高评分信任型")
      ? "补评价、评分背书和详情页信任要素。"
      : "",
    finalTags.includes("套装/赠品拉单型")
      ? "测试套装 / 赠品组合，放大客单理由。"
      : "",
    finalTags.includes("高颜值转化型")
      ? "重做首图风格和卖点排序。"
      : "",
    finalTags.includes("活动投流型")
      ? "同步观察活动节奏和价格波动，必要时跟进报名。"
      : "",
  ].filter(Boolean);

  const priorityScore =
    getSalesSignal(product) * 0.001 +
    (toNumber(product.weeklySalesPercentage) > 20 ? 12 : 0) +
    (finalTags.includes("活动投流型") ? 10 : 0) +
    (finalTags.includes("视频驱动型") ? 8 : 0);
  const priority = priorityScore >= 22 ? "P0" : priorityScore >= 10 ? "P1" : "P2";

  return {
    tags: finalTags.length > 0 ? finalTags : ["待人工判断"],
    trafficSource,
    weakness,
    responseAction: actionCandidates[0] || "继续跟踪价格、销量和素材变化。",
    priority,
    winningHook: inferWinningHook(finalTags),
  };
}

function buildGapSummary(myProduct: NormalizedMyProduct, competitor: CompetitorProductLike, signal: TrackedSignal) {
  const parts: string[] = [];
  if (myProduct.price > 0 && toNumber(competitor.price) > 0) {
    const diff = ((myProduct.price - toNumber(competitor.price)) / Math.max(0.01, toNumber(competitor.price))) * 100;
    if (diff >= 10) parts.push(`价格高出 ${round(diff, 1)}%`);
    else if (diff <= -10) parts.push(`价格低 ${round(Math.abs(diff), 1)}%`);
  }
  if (myProduct.monthlySales > 0 && getSalesSignal(competitor) > 0 && myProduct.monthlySales < getSalesSignal(competitor) * 0.6) {
    parts.push("动销弱于对手");
  }
  if (signal.tags.includes("视频驱动型") && !myProduct.hasVideo) {
    parts.push("视频素材落后");
  }
  if (signal.tags.includes("高评分信任型") && myProduct.score > 0 && myProduct.score < toNumber(competitor.score)) {
    parts.push("信任门槛偏弱");
  }
  return parts.length > 0 ? parts.join(" / ") : "差距可控，重点看素材与价格承接。";
}

export function buildComparisonRows(
  myProduct: NormalizedMyProduct,
  competitors: CompetitorProductLike[],
  marketInsight: MarketInsight,
): ComparisonRow[] {
  return competitors.map((competitor, index) => {
    const signal = buildTrackedSignals(competitor, competitors, myProduct);
    const reviewCount = getReviewCount(competitor);
    return {
      key: `${toText(competitor.goodsId || competitor.url || competitor.productUrl)}-${index}`,
      keyword: marketInsight.keyword,
      competitorTitle: toText(competitor.title || competitor.titleZh) || "未命名竞品",
      competitorUrl: toText(competitor.url || competitor.productUrl),
      goodsId: toText(competitor.goodsId),
      currentPrice: toNumber(competitor.marketPrice) > 0
        ? `${toText(competitor.priceText) || `$${toNumber(competitor.price).toFixed(2)}`} / 划线 $${round(toNumber(competitor.marketPrice)).toFixed(2)}`
        : (toText(competitor.priceText) || `$${toNumber(competitor.price).toFixed(2)}`),
      dailySales: toNumber(competitor.dailySales),
      weeklySales: toNumber(competitor.weeklySales),
      monthlySales: toNumber(competitor.monthlySales),
      score: round(toNumber(competitor.score)),
      reviewCount,
      winningHook: signal.winningHook,
      hasVideo: Boolean(toText(competitor.videoUrl)),
      tags: signal.tags.join(" / "),
      weakness: signal.weakness,
      trafficSource: signal.trafficSource,
      gap: buildGapSummary(myProduct, competitor, signal),
      responseAction: signal.responseAction,
      priority: signal.priority,
    };
  }).sort((left, right) => {
    const priorityOrder = { P0: 0, P1: 1, P2: 2 };
    const priorityDiff = priorityOrder[left.priority] - priorityOrder[right.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return right.monthlySales - left.monthlySales;
  });
}

function uniqueFirst(items: string[], limit = 5) {
  return dedupe(items).slice(0, limit);
}

export function buildExecutionReport(
  myProduct: NormalizedMyProduct,
  competitors: CompetitorProductLike[],
  marketInsight: MarketInsight,
): ExecutionReport {
  const comparisonRows = buildComparisonRows(myProduct, competitors, marketInsight);
  const competitorPrices = competitors.map((competitor) => toNumber(competitor.price)).filter((price) => price > 0);
  const averageCompetitorPrice = average(competitorPrices);
  const tagCount = comparisonRows.reduce<Record<string, number>>((accumulator, row) => {
    row.tags.split(" / ").filter(Boolean).forEach((tag) => {
      accumulator[tag] = (accumulator[tag] || 0) + 1;
    });
    return accumulator;
  }, {});
  const whyCompetitorsWin = uniqueFirst(
    Object.entries(tagCount)
      .sort((left, right) => right[1] - left[1])
      .map(([tag]) => {
        if (tag === "低价冲量型") return "对手通过更激进的价格带快速拿量。";
        if (tag === "视频驱动型") return "对手用视频把功能和使用场景讲清楚了。";
        if (tag === "高评分信任型") return "对手在评分和评论门槛上更有信任优势。";
        if (tag === "活动投流型") return "对手在活动节奏或投流上更主动。";
        if (tag === "套装/赠品拉单型") return "对手通过套装组合强化了购买理由。";
        return "对手在卖点表达上更完整。";
      }),
  );

  const immediateActions = uniqueFirst([
    comparisonRows.find((row) => row.priority === "P0")?.responseAction || "",
    comparisonRows.some((row) => row.hasVideo) && !myProduct.hasVideo ? "补 1 条功能演示视频精品，优先解决点击和转化承接。" : "",
    myProduct.price > 0 && averageCompetitorPrice > 0 && myProduct.price > averageCompetitorPrice * 1.08
      ? `价格先回到 ${marketInsight.recommendedPriceBand} 附近测试，再决定是否继续抢大词。`
      : "",
    marketInsight.primaryNeed === "外观" ? "重做首图和前 3 张图的卖点排序，先把点击率拉上来。" : "",
    marketInsight.primaryNeed === "信任" ? "补评分背书、评价摘要和详情页信任要素。" : "",
  ]);

  const weeklyActions = uniqueFirst([
    "做 2-3 套主图 / 短视频 AB 方案，验证点击与转化。",
    `围绕 ${marketInsight.recommendedPriceBand} 做价格带测试，确认最优承接位。`,
    comparisonRows.some((row) => row.tags.includes("套装/赠品拉单型")) ? "补套装 / 赠品版本，验证客单与转化提升。" : "",
    "更新当前商品的对比样本，剔除失速商品并补充新起量款。",
    "复盘当前商品的关键词，判断哪些词继续打、哪些词转成长尾词。",
  ]);

  const sourcingActions = uniqueFirst([
    marketInsight.marketVerdict === "红海硬卷盘" ? "放弃硬卷大词，切入更细长尾和差异化规格。" : "",
    comparisonRows.some((row) => row.tags.includes("套装/赠品拉单型")) ? "找供应链做套装、赠品或组合规格。" : "",
    myProduct.price > 0 && averageCompetitorPrice > 0 && myProduct.price > averageCompetitorPrice * 1.15
      ? "重做规格或包装，把成本压回可竞争价格带。"
      : "",
    "从高销量竞品反推周边扩品和相邻人群需求。",
  ]);

  const canCompete = marketInsight.marketVerdict === "红海硬卷盘" && myProduct.price > averageCompetitorPrice * 1.08
    ? "不建议硬碰，先切长尾词或做差异化版本。"
    : marketInsight.marketVerdict === "有机会切入盘"
      ? "可以切入，优先抢推荐价格带和素材空档。"
      : "谨慎切入，先小规模测价格与素材。";
  const winAngle = marketInsight.primaryNeed === "价格"
    ? "用更稳的价格带 + 更清晰的首图，避免直接打高竞争大词。"
    : marketInsight.primaryNeed === "功能"
      ? "用视频和场景化素材把功能卖点讲透。"
      : marketInsight.primaryNeed === "信任"
        ? "补评分、评价和详情页背书，先建立信任门槛。"
        : marketInsight.primaryNeed === "套装"
          ? "用套装 / 赠品组合增强购买理由。"
          : "靠首图风格和卖点排序抢点击，再用价格带承接。";
  const keywordDecision = marketInsight.marketVerdict === "红海硬卷盘"
    ? `这个词继续打，但默认转成更细长尾；主词只做观察不硬碰。`
    : `这个词可以继续打，重点验证 ${marketInsight.recommendedPriceBand} 的承接效率。`;
  const nextProductDirection = comparisonRows.some((row) => row.tags.includes("套装/赠品拉单型"))
    ? "优先开发套装、组合装和相邻配件 SKU。"
    : marketInsight.primaryNeed === "功能"
      ? "优先扩功能更明确、场景更清晰的 SKU。"
      : "优先扩更细长尾词下的差异化规格。";

  return {
    id: `report_${Date.now()}`,
    generatedAt: new Date().toISOString(),
    myProductTitle: myProduct.title,
    competitorCount: competitors.length,
    marketInsight,
    comparisonRows,
    summary: {
      canCompete,
      winAngle,
      immediateFocus: immediateActions[0] || marketInsight.nextAction,
      keywordDecision,
      nextProductDirection,
    },
    whyCompetitorsWin,
    immediateActions,
    weeklyActions,
    sourcingActions,
    dailyChecklist: uniqueFirst([
      "盯 Top 10 竞品价格、销量、视频和活动变化。",
      "记录突然爆量、突然降价、突然加视频的商品。",
      "优先跟进 P0 竞品的价格和素材动作。",
    ], 3),
    weeklyChecklist: uniqueFirst([
      "更新关键词池和竞品池，淘汰掉队款、补新爆款。",
      "输出本周该降价、该改图、该停词的动作清单。",
      "复盘 A/B 素材测试和价格带测试结果。",
    ], 3),
    monthlyChecklist: uniqueFirst([
      "复盘价格带迁移和新爆款共性。",
      "判断下月是继续卷主词，还是转长尾词和新规格。",
      "根据竞品结构决定下一批选品和供应链方向。",
    ], 3),
  };
}
