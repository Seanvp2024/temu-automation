import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Image, Input, Select, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  AppstoreOutlined,
  EyeOutlined,
  PictureOutlined,
  RiseOutlined,
  SearchOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import EmptyGuide from "../components/EmptyGuide";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import {
  parseOrdersData,
  parseProductCountSummary,
  parseProductsData,
  parseSalesData,
} from "../utils/parseRawApis";
import {
  COLLECTION_DIAGNOSTICS_KEY,
  getCollectionDataIssue,
  normalizeCollectionDiagnostics,
  type CollectionDiagnostics,
} from "../utils/collectionDiagnostics";
import { getStoreValue } from "../utils/storeCompat";
import { ACTIVE_ACCOUNT_CHANGED_EVENT, STORE_VALUE_UPDATED_EVENT } from "../utils/multiStore";

const store = window.electronAPI?.store;

type StatusFilter = "all" | "在售" | "已下架" | "other";

type ProductSkuSpec = {
  parentSpecName: string;
  specName: string;
  unitSpecName: string;
};

type ProductSkuSummary = {
  productSkuId: string;
  thumbUrl: string;
  productSkuSpecList: ProductSkuSpec[];
  specText: string;
  specName: string;
  extCode: string;
};

interface ProductItem {
  title: string;
  category: string;
  categories: string;
  spuId: string;
  skcId: string;
  goodsId: string;
  sku: string;
  extCode: string;
  skuId: string;
  skuName: string;
  imageUrl: string;
  siteLabel: string;
  productType: string;
  sourceType: string;
  removeStatus: string;
  status: string;
  skcSiteStatus: string;
  flowLimitStatus: string;
  skuSummaries: ProductSkuSummary[];
  todaySales: number;
  last30DaysSales: number;
  totalSales: number;
  last7DaysSales: number;
  syncedAt: string;
  warehouseStock: number;
  occupyStock: number;
  unavailableStock: number;
  lackQuantity: number;
  price: string | number;
  stockStatus: string;
  supplyStatus: string;
  pendingOrderCount: number;
  hotTag?: string;
  availableSaleDays?: string | number | null;
  asfScore?: string | number;
  buyerName?: string;
  buyerUid?: string;
  commentNum?: number;
  inBlackList?: string;
  pictureAuditStatus?: string;
  qualityAfterSalesRate?: string | number;
  predictTodaySaleVolume?: number;
  sevenDaysSaleReference?: number;
  hasSalesSnapshot?: boolean;
}

interface ProductSourceState {
  products: boolean;
  sales: boolean;
  orders: boolean;
}

interface ProductCountSummary {
  totalCount: number;
  onSaleCount: number;
  notPublishedCount: number;
  offSaleCount: number;
}

const EMPTY_SOURCES: ProductSourceState = {
  products: false,
  sales: false,
  orders: false,
};

const EMPTY_COUNT_SUMMARY: ProductCountSummary = {
  totalCount: 0,
  onSaleCount: 0,
  notPublishedCount: 0,
  offSaleCount: 0,
};

const EMPTY_IMAGE_FALLBACK =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

function normalizeLookupValue(value: string) {
  return (value || "").replace(/\s+/g, "").trim().toLowerCase();
}

function normalizeImageUrl(value: unknown): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeImageUrl(item);
      if (normalized) return normalized;
    }
    return "";
  }

  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw || raw === "null" || raw === "undefined" || raw === "[object Object]") return "";
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("data:image/")) return raw;
  const remoteMatch = raw.match(/https?:\/\/[^\s"'\\]+/i);
  return remoteMatch?.[0] || raw;
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function formatTextValue(value: unknown) {
  const text = normalizeText(value);
  return text || "-";
}

function formatSourceType(value: unknown) {
  const text = normalizeText(value);
  const sourceTypeMap: Record<string, string> = {
    "0": "普通发布",
  };
  if (!text) return "-";
  return sourceTypeMap[text] || `来源类型 ${text}`;
}

function toNumberValue(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeStatusText(value: unknown) {
  const text = normalizeText(value);
  const statusMap: Record<string, string> = {
    "0": "在售",
    "1": "已下架",
    "100": "在售",
    "200": "未发布到站点",
    "300": "已下架/已终止",
  };
  return statusMap[text] || text;
}

function getPrimaryCategory(product: ProductItem) {
  return product.category || product.categories || "";
}

function formatSyncedAt(value?: string | null) {
  return value ? `最近同步：${value}` : "等待首次采集";
}

function renderSnapshotField(label: string, value: unknown, accent = false) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <div style={{ fontSize: 12, color: "var(--color-text-sec)" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: accent ? 700 : 500, color: accent ? "var(--color-brand)" : "var(--color-text)" }}>
        {formatTextValue(value)}
      </div>
    </div>
  );
}

function hasMeaningfulSnapshotValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return true;
  const text = String(value).trim();
  return Boolean(text);
}

function buildLookupKeys(source: Partial<ProductItem>) {
  const titleKey = normalizeLookupValue(source.title || "");
  const idKeys = [
    source.skcId ? `skc:${source.skcId}` : "",
    source.goodsId ? `goods:${source.goodsId}` : "",
    source.spuId ? `spu:${source.spuId}` : "",
  ].filter(Boolean);

  if (idKeys.length > 0) return idKeys;
  return titleKey ? [`title:${titleKey}`] : [];
}

function getLatestSyncedAt(products: ProductItem[], diagnostics: CollectionDiagnostics | null) {
  if (diagnostics?.syncedAt) return diagnostics.syncedAt;
  for (const product of products) {
    if (product.syncedAt) return product.syncedAt;
  }
  return "";
}

function mergeTextValue(current: unknown, next: unknown) {
  const values = [current, next]
    .flatMap((value) => String(value ?? "").split(/\s*[,/|]\s*/))
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(values)).join(" / ");
}

function mergeAvailableSaleDays(current: unknown, next: unknown) {
  const currentNum = Number(current);
  const nextNum = Number(next);
  if (Number.isFinite(currentNum) && Number.isFinite(nextNum)) return Math.max(currentNum, nextNum);
  if (Number.isFinite(nextNum)) return nextNum;
  return normalizeText(next) || normalizeText(current);
}

function normalizeSkuSummaryList(value: unknown): ProductSkuSummary[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();

  return value
    .map((item: any) => {
      const specList: ProductSkuSpec[] = Array.isArray(item?.productSkuSpecList)
        ? item.productSkuSpecList.map((spec: any) => ({
            parentSpecName: normalizeText(spec?.parentSpecName),
            specName: normalizeText(spec?.specName),
            unitSpecName: normalizeText(spec?.unitSpecName),
          }))
        : [];

      const specText = normalizeText(item?.specText)
        || specList
          .map((spec) => {
            const label = spec.parentSpecName || "规格";
            const valueText = spec.specName || spec.unitSpecName;
            return valueText ? `${label}: ${valueText}` : "";
          })
          .filter(Boolean)
          .join(" / ");

      return {
        productSkuId: normalizeText(item?.productSkuId),
        thumbUrl: normalizeImageUrl(item?.thumbUrl),
        productSkuSpecList: specList,
        specText,
        specName: normalizeText(item?.specName || specList[0]?.specName),
        extCode: normalizeText(item?.extCode),
      };
    })
    .filter((item) => {
      const key = [item.productSkuId, item.extCode, item.specText].filter(Boolean).join("|");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildSearchIndex(product: ProductItem) {
  const skuTexts = product.skuSummaries.flatMap((sku) => [
    sku.productSkuId,
    sku.extCode,
    sku.specText,
    ...sku.productSkuSpecList.map((spec: ProductSkuSpec) => spec.specName),
  ]);

  return [
    product.title,
    product.skcId,
    product.goodsId,
    product.spuId,
    product.sku,
    product.extCode,
    product.productType,
    product.sourceType,
    product.removeStatus,
    product.skcSiteStatus,
    product.flowLimitStatus,
    product.siteLabel,
    product.category,
    product.categories,
    product.skuId,
    product.skuName,
    product.hotTag,
    product.buyerName,
    product.buyerUid,
    ...skuTexts,
  ]
    .map((item) => normalizeLookupValue(String(item || "")))
    .filter(Boolean)
    .join(" ");
}

function renderStatusTag(text: string, color: "default" | "success" | "warning" | "error" = "default") {
  if (!text) return <Tag>待同步</Tag>;
  return <Tag color={color}>{text}</Tag>;
}

export default function ProductList() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [salesSummary, setSalesSummary] = useState<any>(null);
  const [countSummary, setCountSummary] = useState<ProductCountSummary>(EMPTY_COUNT_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [diagnostics, setDiagnostics] = useState<CollectionDiagnostics | null>(null);
  const [sourceState, setSourceState] = useState<ProductSourceState>(EMPTY_SOURCES);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    void loadProducts();
    const handleActiveAccountChanged = () => {
      void loadProducts();
    };
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const handleStoreValueUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ baseKey?: string | null }>)?.detail;
      if (!detail?.baseKey || !["temu_products", "temu_sales", "temu_orders", COLLECTION_DIAGNOSTICS_KEY].includes(detail.baseKey)) {
        return;
      }
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        void loadProducts();
      }, 120);
    };
    window.addEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleActiveAccountChanged);
    window.addEventListener(STORE_VALUE_UPDATED_EVENT, handleStoreValueUpdated as EventListener);
    return () => {
      window.removeEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleActiveAccountChanged);
      window.removeEventListener(STORE_VALUE_UPDATED_EVENT, handleStoreValueUpdated as EventListener);
      if (reloadTimer) clearTimeout(reloadTimer);
    };
  }, []);

  useEffect(() => {
    if (location.pathname === "/products") {
      void loadProducts();
    }
  }, [location.pathname]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const [accounts, rawProducts, rawSales, rawOrders, diagnosticsRaw] = await Promise.all([
        store?.get("temu_accounts"),
        getStoreValue(store, "temu_products"),
        getStoreValue(store, "temu_sales"),
        getStoreValue(store, "temu_orders"),
        getStoreValue(store, COLLECTION_DIAGNOSTICS_KEY),
      ]);

      setHasAccount(Array.isArray(accounts) && accounts.length > 0);
      setDiagnostics(normalizeCollectionDiagnostics(diagnosticsRaw));

      const parsedProducts = parseProductsData(rawProducts);
      const parsedSales = parseSalesData(rawSales);
      const parsedOrders = parseOrdersData(rawOrders);
      const productCounts = parseProductCountSummary(rawProducts);
      const salesItems = Array.isArray(parsedSales?.items) ? parsedSales.items : [];

      setSalesSummary(parsedSales?.summary || null);
      setCountSummary(productCounts);
      setSourceState({
        products: parsedProducts.length > 0,
        sales: salesItems.length > 0,
        orders: parsedOrders.length > 0,
      });

      const lookup = new Map<string, ProductItem>();
      const salesMergedProducts = new WeakSet<ProductItem>();

      const register = (product: ProductItem) => {
        buildLookupKeys(product).forEach((key) => {
          lookup.set(key, product);
        });
      };

      const findExisting = (source: Partial<ProductItem>) => {
        const keys = buildLookupKeys(source);
        for (const key of keys) {
          const found = lookup.get(key);
          if (found) return found;
        }
        return null;
      };

      const ensureProduct = (source: Partial<ProductItem>) => {
        const existing = findExisting(source);
        if (existing) return existing;

        const skuSummaries = normalizeSkuSummaryList(source.skuSummaries);
        const product: ProductItem = {
          title: source.title || "",
          category: source.category || "",
          categories: source.categories || "",
          spuId: source.spuId || "",
          skcId: source.skcId || "",
          goodsId: source.goodsId || "",
          sku: source.sku || "",
          extCode: source.extCode || "",
          skuId: source.skuId || "",
          skuName: source.skuName || "",
          imageUrl: normalizeImageUrl(source.imageUrl) || skuSummaries[0]?.thumbUrl || "",
          siteLabel: source.siteLabel || "",
          productType: source.productType || "",
          sourceType: source.sourceType || "",
          removeStatus: source.removeStatus || "",
          status: source.status || "",
          skcSiteStatus: source.skcSiteStatus || "",
          flowLimitStatus: source.flowLimitStatus || "",
          skuSummaries,
          todaySales: source.todaySales || 0,
          last30DaysSales: source.last30DaysSales || 0,
          totalSales: source.totalSales || 0,
          last7DaysSales: source.last7DaysSales || 0,
          syncedAt: source.syncedAt || "",
          warehouseStock: source.warehouseStock || 0,
          occupyStock: source.occupyStock || 0,
          unavailableStock: source.unavailableStock || 0,
          lackQuantity: source.lackQuantity || 0,
          price: source.price || "",
          stockStatus: source.stockStatus || "",
          supplyStatus: source.supplyStatus || "",
          pendingOrderCount: source.pendingOrderCount || 0,
          hotTag: source.hotTag || "",
          availableSaleDays: source.availableSaleDays ?? "",
          asfScore: source.asfScore,
          buyerName: source.buyerName || "",
          buyerUid: source.buyerUid || "",
          commentNum: source.commentNum ?? 0,
          inBlackList: source.inBlackList || "",
          pictureAuditStatus: source.pictureAuditStatus || "",
          qualityAfterSalesRate: source.qualityAfterSalesRate ?? "",
          predictTodaySaleVolume: source.predictTodaySaleVolume ?? 0,
          sevenDaysSaleReference: source.sevenDaysSaleReference ?? 0,
          hasSalesSnapshot: Boolean(source.hasSalesSnapshot),
        };
        register(product);
        return product;
      };

      parsedProducts.forEach((item: any) => {
        const normalizedSkuSummaries = normalizeSkuSummaryList(item.skuSummaries);
        const product = ensureProduct({
          title: item.title || "",
          category: item.category || "",
          categories: item.categories || "",
          spuId: normalizeText(item.spuId),
          skcId: normalizeText(item.skcId),
          goodsId: normalizeText(item.goodsId),
          sku: item.sku || "",
          extCode: item.extCode || "",
          imageUrl: normalizeImageUrl(item.imageUrl),
          siteLabel: item.siteLabel || "",
          productType: item.productType || "",
          sourceType: item.sourceType || "",
          removeStatus: normalizeText(item.removeStatus),
          status: item.status || "",
          skcSiteStatus: normalizeText(item.skcSiteStatus),
          flowLimitStatus: normalizeText(item.flowLimitStatus),
          skuSummaries: normalizedSkuSummaries,
          todaySales: item.todaySales || 0,
          totalSales: item.totalSales || 0,
          last7DaysSales: item.last7DaysSales || 0,
          syncedAt: item.syncedAt || "",
        });

        product.title = item.title || product.title;
        product.category = item.category || product.category;
        product.categories = item.categories || product.categories;
        product.spuId = normalizeText(item.spuId) || product.spuId;
        product.skcId = normalizeText(item.skcId) || product.skcId;
        product.goodsId = normalizeText(item.goodsId) || product.goodsId;
        product.sku = item.sku || product.sku;
        product.extCode = item.extCode || product.extCode || product.sku;
        product.imageUrl = normalizeImageUrl(item.imageUrl) || product.imageUrl || normalizedSkuSummaries[0]?.thumbUrl || "";
        product.siteLabel = item.siteLabel || product.siteLabel;
        product.productType = item.productType || product.productType;
        product.sourceType = item.sourceType || product.sourceType;
        product.removeStatus = normalizeText(item.removeStatus) || product.removeStatus;
        product.status = item.status || product.status;
        product.skcSiteStatus = normalizeText(item.skcSiteStatus) || product.skcSiteStatus;
        product.flowLimitStatus = normalizeText(item.flowLimitStatus) || product.flowLimitStatus;
        product.skuSummaries = normalizeSkuSummaryList([
          ...product.skuSummaries,
          ...normalizedSkuSummaries,
        ]);
        product.todaySales = toNumberValue(item.todaySales) || product.todaySales;
        product.totalSales = toNumberValue(item.totalSales) || product.totalSales;
        product.last7DaysSales = toNumberValue(item.last7DaysSales) || product.last7DaysSales;
        product.syncedAt = item.syncedAt || product.syncedAt;
        register(product);
      });

      salesItems.forEach((item: any) => {
        const product = ensureProduct({
          title: item.title || "",
          category: item.category || "",
          spuId: normalizeText(item.spuId),
          skcId: normalizeText(item.skcId),
          goodsId: normalizeText(item.goodsId),
          sku: item.skuCode || "",
          extCode: item.skuCode || "",
          skuId: normalizeText(item.skuId),
          skuName: item.skuName || "",
          imageUrl: normalizeImageUrl(item.imageUrl),
          siteLabel: item.siteLabel || "",
          todaySales: item.todaySales || 0,
          last30DaysSales: item.last30DaysSales || 0,
          totalSales: item.totalSales || 0,
          last7DaysSales: item.last7DaysSales || 0,
          warehouseStock: item.warehouseStock || 0,
          occupyStock: item.occupyStock || 0,
          unavailableStock: item.unavailableStock || 0,
          lackQuantity: item.lackQuantity || 0,
          price: item.price || "",
          syncedAt: parsedSales?.syncedAt || "",
          stockStatus: item.stockStatus || "",
          supplyStatus: item.supplyStatus || "",
          hotTag: item.hotTag || "",
          availableSaleDays: item.availableSaleDays ?? "",
          asfScore: item.asfScore,
          buyerName: item.buyerName || "",
          buyerUid: item.buyerUid || "",
          commentNum: item.commentNum ?? 0,
          inBlackList: item.inBlackList || "",
          pictureAuditStatus: item.pictureAuditStatus || "",
          qualityAfterSalesRate: item.qualityAfterSalesRate ?? "",
          predictTodaySaleVolume: item.predictTodaySaleVolume ?? 0,
          sevenDaysSaleReference: item.sevenDaysSaleReference ?? 0,
          hasSalesSnapshot: true,
        });

        const firstSalesRow = !salesMergedProducts.has(product);
        if (firstSalesRow) salesMergedProducts.add(product);

        product.title = product.title || item.title || "";
        product.category = product.category || item.category || "";
        product.spuId = product.spuId || normalizeText(item.spuId);
        product.skcId = product.skcId || normalizeText(item.skcId);
        product.goodsId = product.goodsId || normalizeText(item.goodsId);
        product.sku = mergeTextValue(product.sku, item.skuCode);
        product.extCode = mergeTextValue(product.extCode, item.skuCode || item.extCode);
        product.skuId = mergeTextValue(product.skuId, item.skuId);
        product.skuName = mergeTextValue(product.skuName, item.skuName);
        product.imageUrl = product.imageUrl || normalizeImageUrl(item.imageUrl);
        product.siteLabel = product.siteLabel || item.siteLabel || "";
        product.todaySales = firstSalesRow ? toNumberValue(item.todaySales) : product.todaySales + toNumberValue(item.todaySales);
        product.last7DaysSales = firstSalesRow ? toNumberValue(item.last7DaysSales) : product.last7DaysSales + toNumberValue(item.last7DaysSales);
        product.last30DaysSales = firstSalesRow ? toNumberValue(item.last30DaysSales) : product.last30DaysSales + toNumberValue(item.last30DaysSales);
        product.totalSales = firstSalesRow ? toNumberValue(item.totalSales) : product.totalSales + toNumberValue(item.totalSales);
        product.warehouseStock = firstSalesRow ? toNumberValue(item.warehouseStock) : product.warehouseStock + toNumberValue(item.warehouseStock);
        product.occupyStock = firstSalesRow ? toNumberValue(item.occupyStock) : product.occupyStock + toNumberValue(item.occupyStock);
        product.unavailableStock = firstSalesRow ? toNumberValue(item.unavailableStock) : product.unavailableStock + toNumberValue(item.unavailableStock);
        product.lackQuantity = firstSalesRow ? toNumberValue(item.lackQuantity) : product.lackQuantity + toNumberValue(item.lackQuantity);
        product.price = mergeTextValue(product.price, item.price);
        product.syncedAt = parsedSales?.syncedAt || product.syncedAt;
        product.stockStatus = item.stockStatus || product.stockStatus;
        product.supplyStatus = item.supplyStatus || product.supplyStatus;
        product.hotTag = mergeTextValue(product.hotTag, item.hotTag);
        product.availableSaleDays = mergeAvailableSaleDays(product.availableSaleDays, item.availableSaleDays);
        product.asfScore = item.asfScore ?? product.asfScore ?? "";
        product.buyerName = item.buyerName ?? product.buyerName ?? "";
        product.buyerUid = item.buyerUid ?? product.buyerUid ?? "";
        product.commentNum = Math.max(toNumberValue(product.commentNum), toNumberValue(item.commentNum));
        product.inBlackList = item.inBlackList || product.inBlackList || "";
        product.pictureAuditStatus = item.pictureAuditStatus ?? product.pictureAuditStatus ?? "";
        product.qualityAfterSalesRate = item.qualityAfterSalesRate ?? product.qualityAfterSalesRate ?? "";
        product.predictTodaySaleVolume = firstSalesRow
          ? toNumberValue(item.predictTodaySaleVolume)
          : (product.predictTodaySaleVolume ?? 0) + toNumberValue(item.predictTodaySaleVolume);
        product.sevenDaysSaleReference = firstSalesRow
          ? toNumberValue(item.sevenDaysSaleReference)
          : (product.sevenDaysSaleReference ?? 0) + toNumberValue(item.sevenDaysSaleReference);
        product.hasSalesSnapshot = true;
        register(product);
      });

      parsedOrders.forEach((item: any) => {
        const product = ensureProduct({
          title: item.title || "",
          skcId: normalizeText(item.skcId),
          sku: item.skuCode || "",
          extCode: item.skuCode || "",
          imageUrl: normalizeImageUrl(item.imageUrl),
          pendingOrderCount: 0,
        });
        product.title = product.title || item.title || "";
        product.skcId = product.skcId || normalizeText(item.skcId);
        product.sku = product.sku || item.skuCode || "";
        product.extCode = product.extCode || item.skuCode || "";
        product.imageUrl = product.imageUrl || normalizeImageUrl(item.imageUrl);
        product.pendingOrderCount += 1;
        register(product);
      });

      const mergedProducts: ProductItem[] = [];
      const seen = new Set<ProductItem>();
      for (const item of lookup.values()) {
        if (seen.has(item)) continue;
        seen.add(item);
        if (!item.title && !item.skcId && !item.goodsId && !item.spuId) continue;
        mergedProducts.push(item);
      }

      mergedProducts.sort((a, b) => {
        if ((b.totalSales || 0) !== (a.totalSales || 0)) return (b.totalSales || 0) - (a.totalSales || 0);
        if ((b.last7DaysSales || 0) !== (a.last7DaysSales || 0)) return (b.last7DaysSales || 0) - (a.last7DaysSales || 0);
        return (a.title || "").localeCompare(b.title || "", "zh-CN");
      });

      setProducts(mergedProducts);
    } catch (error) {
      console.error("加载商品失败", error);
      setProducts([]);
      setSalesSummary(null);
      setCountSummary(EMPTY_COUNT_SUMMARY);
      setDiagnostics(null);
      setSourceState(EMPTY_SOURCES);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const keyword = normalizeLookupValue(searchText);
    return products.filter((product) => {
      const matchKeyword = !keyword || buildSearchIndex(product).includes(keyword);
      const statusText = product.status || normalizeStatusText(product.removeStatus);
      const matchStatus =
        statusFilter === "all"
        || (statusFilter === "other" ? !["在售", "已下架"].includes(statusText || "") : statusText === statusFilter);
      return matchKeyword && matchStatus;
    });
  }, [products, searchText, statusFilter]);

  const totalProducts = countSummary.totalCount || products.length;
  const total7dSales = products.reduce((sum, product) => sum + (product.last7DaysSales || 0), 0);
  const totalSales = products.reduce((sum, product) => sum + (product.totalSales || 0), 0);
  const onSaleCount = countSummary.onSaleCount || products.filter((product) => (product.status || "") === "在售").length;
  const latestSyncedAt = getLatestSyncedAt(products, diagnostics);
  const salesAttachedCount = products.filter((product) => product.hasSalesSnapshot).length;

  const dataIssues = [
    getCollectionDataIssue(diagnostics, "products", "商品列表", sourceState.products),
    getCollectionDataIssue(diagnostics, "sales", "销售数据", sourceState.sales),
    getCollectionDataIssue(diagnostics, "orders", "备货单数据", sourceState.orders),
  ].filter((issue): issue is string => Boolean(issue));

  const columns: ColumnsType<ProductItem> = [
    {
      title: "商品信息",
      dataIndex: "title",
      key: "product",
      width: 360,
      fixed: "left",
      render: (_: string, record: ProductItem) => {
        const displayImageUrl = normalizeImageUrl(record.imageUrl);
        return (
          <div className="product-list-product-cell">
            <div className={`product-list-product-thumb${displayImageUrl ? "" : " product-list-product-thumb--empty"}`}>
              {displayImageUrl ? (
                <Image
                  src={displayImageUrl}
                  width={72}
                  height={72}
                  className="product-list-product-thumb-image"
                  preview={{ mask: "查看大图" }}
                  fallback={EMPTY_IMAGE_FALLBACK}
                />
              ) : (
                <PictureOutlined />
              )}
            </div>
            <div className="product-list-product-meta">
              <Tooltip title={record.title || "-"}>
                <div className="app-line-clamp-2 product-list-product-title">{record.title || "未命名商品"}</div>
              </Tooltip>
              <div className="app-table-meta">
                {getPrimaryCategory(record) ? <Tag color="default">{getPrimaryCategory(record)}</Tag> : null}
                {record.siteLabel ? <Tag color="orange">{record.siteLabel}</Tag> : null}
                {record.sourceType ? <Tag color="blue">{record.sourceType}</Tag> : null}
                {record.hasSalesSnapshot ? <Tag color="green">销售字段</Tag> : null}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: "核心标识",
      key: "ids",
      width: 280,
      render: (_: string, record: ProductItem) => (
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontFamily: "Consolas, monospace", fontSize: 12 }}>SPU ID: {formatTextValue(record.spuId)}</div>
          <div style={{ fontFamily: "Consolas, monospace", fontSize: 12 }}>SKC ID: {formatTextValue(record.skcId)}</div>
          <div style={{ fontFamily: "Consolas, monospace", fontSize: 12 }}>货号/extCode: {formatTextValue(record.extCode || record.sku)}</div>
          {record.goodsId ? (
            <div style={{ fontFamily: "Consolas, monospace", fontSize: 12, color: "#8c8c8c" }}>Goods ID: {record.goodsId}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: "分类与类型",
      key: "categoryType",
      width: 260,
      render: (_: string, record: ProductItem) => (
        <div style={{ display: "grid", gap: 6 }}>
          <Tooltip title={record.categories || "-"}>
            <div style={{ fontSize: 12, color: "var(--color-text-sec)" }}>商品分类：{record.category || "-"}</div>
          </Tooltip>
          <div style={{ fontSize: 12, color: "var(--color-text-sec)" }}>商品类型：{formatTextValue(record.productType)}</div>
          <div style={{ fontSize: 12, color: "var(--color-text-sec)" }}>来源类型：{formatSourceType(record.sourceType)}</div>
        </div>
      ),
    },
    {
      title: "站点与状态",
      key: "statusSite",
      width: 260,
      render: (_: string, record: ProductItem) => (
        <div style={{ display: "grid", gap: 8 }}>
          <div className="app-table-meta">
            {renderStatusTag(record.status || normalizeStatusText(record.removeStatus), record.status === "在售" ? "success" : "default")}
            {renderStatusTag(normalizeStatusText(record.skcSiteStatus))}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-sec)" }}>removeStatus：{formatTextValue(record.removeStatus)}</div>
          <div style={{ fontSize: 12, color: "var(--color-text-sec)" }}>skcSiteStatus：{formatTextValue(record.skcSiteStatus)}</div>
          <div style={{ fontSize: 12, color: "var(--color-text-sec)" }}>flowLimitStatus：{formatTextValue(record.flowLimitStatus)}</div>
        </div>
      ),
    },
    {
      title: "SKU 信息",
      key: "skuSummaries",
      width: 380,
      render: (_: string, record: ProductItem) => {
        const skuList = record.skuSummaries.slice(0, 2);
        return (
          <div style={{ display: "grid", gap: 8 }}>
            {skuList.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--color-text-sec)" }}>暂无 SKU 明细</div>
            ) : (
              skuList.map((sku) => (
                <div key={`${sku.productSkuId}-${sku.extCode}`} style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {sku.thumbUrl ? (
                      <Image src={sku.thumbUrl} width={28} height={28} preview={false} fallback={EMPTY_IMAGE_FALLBACK} />
                    ) : (
                      <Tag>无图</Tag>
                    )}
                    <div style={{ fontFamily: "Consolas, monospace", fontSize: 12 }}>
                      SKU ID: {formatTextValue(sku.productSkuId)}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-sec)" }}>规格：{formatTextValue(sku.specText || sku.specName)}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-sec)" }}>extCode：{formatTextValue(sku.extCode)}</div>
                </div>
              ))
            )}
            {record.skuSummaries.length > 2 ? (
              <Tag color="blue">其余 {record.skuSummaries.length - 2} 个 SKU 已折叠</Tag>
            ) : null}
          </div>
        );
      },
    },
    {
      title: "销量",
      key: "sales",
      width: 240,
      sorter: (a, b) => (a.totalSales || 0) - (b.totalSales || 0),
      render: (_: string, record: ProductItem) => (
        <div style={{ display: "grid", gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--color-text-sec)" }}>今日销量</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-brand)" }}>{record.todaySales || 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--color-text-sec)" }}>30日销量</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-blue)" }}>{record.last30DaysSales || 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--color-text-sec)" }}>预测今日销量</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>{record.predictTodaySaleVolume || 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--color-text-sec)" }}>7日销量参考</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>{record.sevenDaysSaleReference || 0}</div>
          </div>
        </div>
      ),
    },
    {
      title: "库存与可售",
      key: "inventory",
      width: 260,
      render: (_: string, record: ProductItem) => (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {renderSnapshotField("仓库库存", record.warehouseStock, true)}
            {renderSnapshotField("缺货数量", record.lackQuantity, true)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {renderSnapshotField("预占库存", record.occupyStock)}
            {renderSnapshotField("不可用库存", record.unavailableStock)}
          </div>
          {renderSnapshotField("可售天数", record.availableSaleDays)}
        </div>
      ),
    },
    {
      title: "销售字段快照",
      key: "salesSnapshot",
      width: 340,
      render: (_: string, record: ProductItem) => (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {renderSnapshotField("申报价", record.price, true)}
            {renderSnapshotField("热卖标签", record.hotTag)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {renderSnapshotField("SKU ID", record.skuId)}
            {renderSnapshotField("SKU名称", record.skuName)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {renderSnapshotField("货号", record.extCode || record.sku)}
            {renderSnapshotField("ASF评分", record.asfScore)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {renderSnapshotField("买手", record.buyerName)}
            {renderSnapshotField("买手ID", record.buyerUid)}
          </div>
        </div>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 110,
      fixed: "right",
      render: (_: string, record: ProductItem) => (
        <div className="app-table-actions">
          <Button
            type="link"
            style={{ padding: 0, color: "var(--color-brand)", fontWeight: 600 }}
            onClick={() => navigate(`/products/${record.skcId || record.goodsId || record.spuId}`)}
          >
            查看详情
          </Button>
        </div>
      ),
    },
  ];

  const renderExpandedRow = (record: ProductItem) => {
    const baseFields = [
      { label: "商品标题", value: record.title, accent: true },
      { label: "商品分类", value: record.category || record.categories },
      { label: "商品站点", value: record.siteLabel },
      { label: "商品来源", value: formatSourceType(record.sourceType) },
      { label: "SKC ID", value: record.skcId },
      { label: "SPU ID", value: record.spuId },
      { label: "商品主图", value: record.imageUrl },
    ];

    const salesInventoryFields = [
      { label: "今日销量", value: record.todaySales, accent: true },
      { label: "30日销量", value: record.last30DaysSales, accent: true },
      { label: "仓库库存", value: record.warehouseStock },
      { label: "缺货数量", value: record.lackQuantity },
      { label: "预占库存", value: record.occupyStock },
      { label: "不可用库存", value: record.unavailableStock },
      { label: "可售天数", value: record.availableSaleDays },
      { label: "预测今日销量", value: record.predictTodaySaleVolume },
      { label: "7日销量参考", value: record.sevenDaysSaleReference },
    ];

    const salesExtraFields = [
      { label: "申报价", value: record.price, accent: true },
      { label: "SKU货号", value: record.extCode || record.sku },
      { label: "SKU ID", value: record.skuId },
      { label: "SKU名称", value: record.skuName },
      { label: "热卖标签", value: record.hotTag },
      { label: "ASF评分", value: record.asfScore },
      { label: "买手名称", value: record.buyerName },
      { label: "买手ID", value: record.buyerUid },
      { label: "评论数", value: record.commentNum },
      { label: "黑名单", value: record.inBlackList },
      { label: "图片审核状态", value: record.pictureAuditStatus },
      { label: "品质售后率", value: record.qualityAfterSalesRate },
    ];

    const hasSalesDetails = Boolean(record.hasSalesSnapshot);

    return (
      <div
        style={{
          display: "grid",
          gap: 12,
          padding: "4px 0",
        }}
      >
        {!hasSalesDetails ? (
          <Alert
            type="info"
            showIcon
            message="当前商品还没有匹配到销售管理字段"
            description="这条商品基础信息已经加载成功，但销售管理页里的销量、库存、买手和 SKU 字段暂时没有匹配到。通常是因为当前销售缓存和商品缓存不是同一批采集数据，重新采集“商品列表 + 销售数据”后会更完整。"
          />
        ) : null}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: hasSalesDetails ? "repeat(auto-fit, minmax(240px, 1fr))" : "minmax(280px, 1fr)",
            gap: 12,
          }}
        >
          <div className="app-surface" style={{ padding: 12, borderRadius: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>基础信息</div>
            <div style={{ display: "grid", gap: 10 }}>
              {baseFields.map((field) => (
                <div key={field.label}>
                  {renderSnapshotField(field.label, field.value, field.accent)}
                </div>
              ))}
            </div>
          </div>
          {hasSalesDetails ? (
            <div className="app-surface" style={{ padding: 12, borderRadius: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>销量与库存</div>
              <div style={{ display: "grid", gap: 10 }}>
                {salesInventoryFields.map((field) => (
                  <div key={field.label}>
                    {renderSnapshotField(field.label, field.value, field.accent)}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {hasSalesDetails ? (
            <div className="app-surface" style={{ padding: 12, borderRadius: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>销售补充信息</div>
              <div style={{ display: "grid", gap: 10 }}>
                {salesExtraFields.map((field) => (
                  <div key={field.label}>
                    {renderSnapshotField(field.label, field.value, field.accent)}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const emptyState = !loading && products.length === 0;
  const filteredEmptyState = !loading && products.length > 0 && filteredProducts.length === 0;

  return (
    <div className="dashboard-shell">
      <PageHeader
        compact
        eyebrow="商品数据"
        title="商品管理"
        subtitle="集中查看商品基础资料，并联动展示销售管理里的销量、库存、买手和 SKU 字段。"
        meta={[
          formatSyncedAt(latestSyncedAt),
          totalProducts > 0 ? `${totalProducts} 个商品` : "等待首次采集",
          `在售中 ${onSaleCount}`,
          salesAttachedCount > 0 ? `已接入销售字段 ${salesAttachedCount} 条` : "等待销售字段",
          hasAccount === false ? "本地历史数据" : null,
        ].filter(Boolean)}
        actions={(
          <Button type="primary" icon={<SyncOutlined />} loading={loading} onClick={loadProducts}>
            刷新数据
          </Button>
        )}
      />
      {hasAccount === false && products.length > 0 ? (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message="当前没有绑定账号，正在展示本地历史数据"
          description="如果你需要最新状态，先重新绑定店铺账号，再执行一次数据采集即可。"
        />
      ) : null}

      {dataIssues.length > 0 ? (
        <Alert
          className="friendly-alert"
          type="warning"
          showIcon
          message="部分商品数据还没有准备好"
          description={(
            <div className="friendly-alert__summary">
              {dataIssues.slice(0, 3).join("；")}
              {dataIssues.length > 3 ? `；另有 ${dataIssues.length - 3} 个数据源也需要补采。` : ""}
              <div className="friendly-alert__details">
                可以直接前往数据采集页执行“商品列表 / 销售数据 / 备货单”三项采集。
              </div>
            </div>
          )}
          action={(
            <Button type="link" onClick={() => navigate("/collect")}>
              前往采集
            </Button>
          )}
        />
      ) : null}

      {emptyState ? (
        <div className="app-panel">
          <EmptyGuide
            icon={<AppstoreOutlined />}
            title={hasAccount === false ? "先绑定店铺账号" : "先执行一次数据采集"}
            description={
              hasAccount === false
                ? "绑定 Temu 店铺账号后，商品列表会自动汇总商品、销量和库存数据。"
                : "执行商品列表、销售数据和备货单采集后，这里会自动出现统计卡、筛选工具和商品表格。"
            }
            action={(
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                {hasAccount === false ? (
                  <Button type="primary" onClick={() => navigate("/accounts")}>前往绑定店铺</Button>
                ) : (
                  <Button type="primary" onClick={() => navigate("/collect")}>前往数据采集</Button>
                )}
                <Button onClick={loadProducts}>重新检查</Button>
              </div>
            )}
          />
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <StatCard compact title="商品总数" value={totalProducts} icon={<ShopOutlined />} color="brand" trend="countStatus + 商品列表" />
            <StatCard compact title="在售中数量" value={onSaleCount} icon={<ShoppingCartOutlined />} color="success" trend="Temu 商品列表页 countStatus" />
            <StatCard compact title="未发布到站点" value={countSummary.notPublishedCount} icon={<ShopOutlined />} color="blue" trend="商品列表页状态统计" />
            <StatCard compact title="已下架/已终止" value={countSummary.offSaleCount} icon={<EyeOutlined />} color="purple" trend="商品列表页状态统计" />
            <StatCard compact title="7日总销量" value={total7dSales} icon={<RiseOutlined />} color="blue" trend={`累计销量 ${totalSales}`} />
            <StatCard compact title="销售字段已接入" value={salesAttachedCount} icon={<ShoppingCartOutlined />} color="success" trend="已合并销售管理字段" />
          </div>

          <div className="app-panel" style={{ marginBottom: 16 }}>
            <div className="app-panel__title">
              <div>
                <div className="app-panel__title-main">筛选</div>
                <div className="app-panel__title-sub">按关键词和状态快速定位商品。</div>
              </div>
            </div>
            <div
              className="app-toolbar"
              style={{ gridTemplateColumns: "minmax(260px, 1.4fr) minmax(160px, 0.7fr) auto auto" }}
            >
              <Input
                allowClear
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                prefix={<SearchOutlined />}
                placeholder="搜索商品名称 / SPU / SKC / SKU / SKU ID / 买手 / 热卖标签"
              />
              <Select
                value={statusFilter}
                onChange={(value) => setStatusFilter(value)}
                options={[
                  { label: "全部状态", value: "all" },
                  { label: "在售", value: "在售" },
                  { label: "已下架", value: "已下架" },
                  { label: "其他状态", value: "other" },
                ]}
              />
              <Button icon={<SyncOutlined />} onClick={loadProducts} loading={loading}>
                刷新当前页
              </Button>
              <div className="app-toolbar__count">
                显示 {filteredProducts.length} / {products.length}
              </div>
            </div>
          </div>

          <div className="app-panel">
            <div className="app-panel__title">
              <div>
                <div className="app-panel__title-main">商品列表</div>
                <div className="app-panel__title-sub">已接入商品基础字段和销售管理字段；行内展示快照，展开后可查看 title、category、销量、库存、买手、审核和 SKU 全字段。</div>
              </div>
            </div>
            {filteredEmptyState ? (
              <EmptyGuide
                icon={<SearchOutlined />}
                title="没有符合当前筛选条件的商品"
                description="可以清空关键词或切回全部状态，快速回到完整商品列表。"
                action={(
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                    <Button type="primary" onClick={() => { setSearchText(""); setStatusFilter("all"); }}>
                      清空筛选
                    </Button>
                    <Button onClick={loadProducts}>重新检查</Button>
                  </div>
                )}
              />
            ) : (
              <Table
                rowKey={(record, index) => record.skcId || record.goodsId || record.spuId || `${record.title}-${index}`}
                dataSource={filteredProducts}
                columns={columns}
                expandable={{
                  expandedRowRender: renderExpandedRow,
                  rowExpandable: (record) => record.hasSalesSnapshot || Boolean(record.skcId || record.spuId || record.goodsId),
                }}
                size="small"
                loading={loading}
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  pageSizeOptions: [20, 50, 100],
                  showTotal: (total) => `共 ${total} 个商品`,
                }}
                scroll={{ x: 2360 }}
                locale={{ emptyText: "暂无商品数据" }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
