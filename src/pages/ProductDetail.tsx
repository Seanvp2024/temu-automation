import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Alert, Card, Tag, Tabs, Table, Descriptions, Image, Button, Spin, Typography } from "antd";
import {
  ArrowLeftOutlined, ShoppingOutlined, InboxOutlined,
  RiseOutlined, EyeOutlined, SafetyCertificateOutlined,
  BarChartOutlined, DatabaseOutlined, SyncOutlined,
} from "@ant-design/icons";
import {
  COLLECTION_DIAGNOSTICS_KEY,
  getCollectionDataIssue,
  normalizeCollectionDiagnostics,
  type CollectionDiagnostics,
} from "../utils/collectionDiagnostics";
import { parseProductsData, parseOrdersData, parseSalesData, parseFluxData } from "../utils/parseRawApis";
import { getFirstExistingStoreValue, getStoreValue, STORE_KEY_ALIASES } from "../utils/storeCompat";
import { ACTIVE_ACCOUNT_CHANGED_EVENT } from "../utils/multiStore";
import EmptyGuide from "../components/EmptyGuide";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";

const { Paragraph } = Typography;
const store = window.electronAPI?.store;
const STALE_LOAD_ERROR = "__product_detail_stale_load__";

interface ProductInfo {
  title: string;
  category: string;
  categories: string;
  spuId: string;
  skcId: string;
  goodsId: string;
  sku: string;
  imageUrl: string;
  status: string;
  totalSales: number;
  last7DaysSales: number;
  createdAt?: string;
  skcStatus?: number;
}

interface DetailDataSources {
  sales: boolean;
  orders: boolean;
  afterSales: boolean;
  flux: boolean;
  quality: boolean;
  checkup: boolean;
  goodsData: boolean;
}

const EMPTY_DATA_SOURCES: DetailDataSources = {
  sales: false,
  orders: false,
  afterSales: false,
  flux: false,
  quality: false,
  checkup: false,
  goodsData: false,
};

function findInRawStore(rawData: any, apiPathFragment: string): any {
  if (!rawData?.apis) return null;
  const api = rawData.apis.find((a: any) => a.path?.includes(apiPathFragment));
  return api?.data?.result || api?.data || null;
}

function safeRender(val: any): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "string") {
    const text = val.trim();
    return text || "-";
  }
  if (typeof val === "object") return JSON.stringify(val).slice(0, 100);
  return String(val);
}

function toNumberValue(value: any) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatRatePercent(value: any) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (!Number.isFinite(num)) return safeRender(value);
  const normalized = Math.abs(num) <= 1 ? num * 100 : num;
  return `${normalized.toFixed(2)}%`;
}

function formatPictureAuditStatus(value: any) {
  const raw = safeRender(value);
  if (raw === "-") return { label: "-", color: undefined as string | undefined };
  const labelMap: Record<string, { label: string; color?: string }> = {
    "0": { label: "未提交", color: "default" },
    "1": { label: "待审核", color: "warning" },
    "2": { label: "审核通过", color: "success" },
    "3": { label: "审核驳回", color: "error" },
    "4": { label: "审核中", color: "processing" },
  };
  return labelMap[raw] || { label: raw };
}

function buildProductIdCandidates(id: string | undefined, product?: Partial<ProductInfo> | null) {
  return new Set(
    [
      id,
      product?.skcId,
      product?.spuId,
      product?.goodsId,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );
}

function matchesRecordByCandidateIds(record: any, fields: string[], candidates: Set<string>) {
  return fields.some((field) => candidates.has(String(record?.[field] || "").trim()));
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
  const nextText = String(next ?? "").trim();
  if (nextText) return nextText;
  return current ?? "";
}

function mergeSalesRows(rows: any[]) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows.reduce((acc: any, row: any, index: number) => {
    const first = index === 0;
    return {
      ...acc,
      title: acc.title || row.title || "",
      category: acc.category || row.category || "",
      skcId: acc.skcId || row.skcId || "",
      spuId: acc.spuId || row.spuId || "",
      goodsId: acc.goodsId || row.goodsId || "",
      imageUrl: acc.imageUrl || row.imageUrl || "",
      siteLabel: acc.siteLabel || row.siteLabel || "",
      skuCode: mergeTextValue(acc.skuCode, row.skuCode),
      skuId: mergeTextValue(acc.skuId, row.skuId),
      skuName: mergeTextValue(acc.skuName, row.skuName),
      hotTag: mergeTextValue(acc.hotTag, row.hotTag),
      stockStatus: acc.stockStatus || row.stockStatus || "",
      supplyStatus: acc.supplyStatus || row.supplyStatus || "",
      todaySales: first ? toNumberValue(row.todaySales) : acc.todaySales + toNumberValue(row.todaySales),
      last7DaysSales: first ? toNumberValue(row.last7DaysSales) : acc.last7DaysSales + toNumberValue(row.last7DaysSales),
      last30DaysSales: first ? toNumberValue(row.last30DaysSales) : acc.last30DaysSales + toNumberValue(row.last30DaysSales),
      totalSales: first ? toNumberValue(row.totalSales) : acc.totalSales + toNumberValue(row.totalSales),
      warehouseStock: first ? toNumberValue(row.warehouseStock) : acc.warehouseStock + toNumberValue(row.warehouseStock),
      adviceQuantity: first ? toNumberValue(row.adviceQuantity ?? row.suggestStock) : acc.adviceQuantity + toNumberValue(row.adviceQuantity ?? row.suggestStock),
      lackQuantity: first ? toNumberValue(row.lackQuantity) : acc.lackQuantity + toNumberValue(row.lackQuantity),
      occupyStock: first ? toNumberValue(row.occupyStock) : acc.occupyStock + toNumberValue(row.occupyStock),
      unavailableStock: first ? toNumberValue(row.unavailableStock) : acc.unavailableStock + toNumberValue(row.unavailableStock),
      warehouseGroup: mergeTextValue(acc.warehouseGroup, row.warehouseGroup),
      price: mergeTextValue(acc.price, row.price),
      availableSaleDays: mergeAvailableSaleDays(acc.availableSaleDays, row.availableSaleDays),
      asfScore: row.asfScore ?? acc.asfScore ?? "",
      buyerName: row.buyerName ?? acc.buyerName ?? "",
      buyerUid: row.buyerUid ?? acc.buyerUid ?? "",
      commentNum: Math.max(toNumberValue(acc.commentNum), toNumberValue(row.commentNum)),
      inBlackList: row.inBlackList === "是" ? "是" : (acc.inBlackList || row.inBlackList || ""),
      pictureAuditStatus: row.pictureAuditStatus ?? acc.pictureAuditStatus ?? "",
      qualityAfterSalesRate: row.qualityAfterSalesRate ?? acc.qualityAfterSalesRate ?? "",
      predictTodaySaleVolume: first ? toNumberValue(row.predictTodaySaleVolume) : acc.predictTodaySaleVolume + toNumberValue(row.predictTodaySaleVolume),
      sevenDaysSaleReference: first ? toNumberValue(row.sevenDaysSaleReference) : acc.sevenDaysSaleReference + toNumberValue(row.sevenDaysSaleReference),
    };
  }, {
    title: "",
    category: "",
    skcId: "",
    spuId: "",
    goodsId: "",
    imageUrl: "",
    siteLabel: "",
    skuCode: "",
    skuId: "",
    skuName: "",
    hotTag: "",
    stockStatus: "",
    supplyStatus: "",
    todaySales: 0,
    last7DaysSales: 0,
    last30DaysSales: 0,
    totalSales: 0,
    warehouseStock: 0,
    adviceQuantity: 0,
    lackQuantity: 0,
    occupyStock: 0,
    unavailableStock: 0,
    warehouseGroup: "",
    price: "",
    availableSaleDays: "",
    asfScore: "",
    buyerName: "",
    buyerUid: "",
    commentNum: 0,
    inBlackList: "",
    pictureAuditStatus: "",
    qualityAfterSalesRate: "",
    predictTodaySaleVolume: 0,
    sevenDaysSaleReference: 0,
  });
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [salesInfo, setSalesInfo] = useState<any>(null);
  const [salesRows, setSalesRows] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [afterSalesRecords, setAfterSalesRecords] = useState<any[]>([]);
  const [flowPriceInfo, setFlowPriceInfo] = useState<any>(null);
  const [retailPriceInfo, setRetailPriceInfo] = useState<any[]>([]);
  const [fluxItems, setFluxItems] = useState<any[]>([]);
  const [qualityInfo, setQualityInfo] = useState<any>(null);
  const [checkupInfo, setCheckupInfo] = useState<any>(null);
  const [goodsSalesData, setGoodsSalesData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [diagnostics, setDiagnostics] = useState<CollectionDiagnostics | null>(null);
  const [dataSources, setDataSources] = useState<DetailDataSources>(EMPTY_DATA_SOURCES);
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    void loadProduct();
    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [id]);

  useEffect(() => {
    const handleActiveAccountChanged = () => {
      void loadProduct();
    };
    window.addEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleActiveAccountChanged);
    return () => {
      window.removeEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleActiveAccountChanged);
    };
  }, [id]);

  const loadProduct = async () => {
    const requestId = ++loadRequestIdRef.current;
    const ensureCurrentRequest = () => {
      if (requestId !== loadRequestIdRef.current) {
        throw new Error(STALE_LOAD_ERROR);
      }
    };
    setLoading(true);
    setProduct(null);
    setSalesInfo(null);
    setSalesRows([]);
    setOrders([]);
    setAfterSalesRecords([]);
    setFlowPriceInfo(null);
    setRetailPriceInfo([]);
    setFluxItems([]);
    setQualityInfo(null);
    setCheckupInfo(null);
    setGoodsSalesData(null);
    setDataSources(EMPTY_DATA_SOURCES);
    try {
      setDiagnostics(normalizeCollectionDiagnostics(await getStoreValue(store, COLLECTION_DIAGNOSTICS_KEY)));
      ensureCurrentRequest();
      const nextSources: DetailDataSources = { ...EMPTY_DATA_SOURCES };
      let resolvedProduct: ProductInfo | null = null;
      let productIdCandidates = buildProductIdCandidates(id);
      let fallbackProduct: ProductInfo | null = null;

      // Load product by skcId
      const rawProducts = await getStoreValue(store, "temu_products");
      ensureCurrentRequest();
      if (rawProducts) {
        const products = parseProductsData(rawProducts);
        const found = products.find((p: any) => String(p.skcId) === id || String(p.spuId) === id || String(p.goodsId) === id);
        if (found) {
          resolvedProduct = found;
          productIdCandidates = buildProductIdCandidates(id, found);
          setProduct(found);
        }
      }

      // Load related sales data
      const rawSales = await getStoreValue(store, "temu_sales");
      ensureCurrentRequest();
      if (rawSales) {
        nextSources.sales = true;
        const sales = parseSalesData(rawSales);
        const matchedSalesRows = Array.isArray(sales?.items)
          ? sales.items.filter((item: any) => matchesRecordByCandidateIds(item, ["skcId", "spuId", "goodsId"], productIdCandidates))
          : [];
        if (matchedSalesRows.length > 0) {
          const mergedSalesInfo = mergeSalesRows(matchedSalesRows);
          setSalesRows(matchedSalesRows);
          setSalesInfo(mergedSalesInfo);
          if (!resolvedProduct) {
            fallbackProduct = {
              title: mergedSalesInfo?.title || "未命名商品",
              category: mergedSalesInfo?.category || "",
              categories: mergedSalesInfo?.category || "",
              spuId: String(mergedSalesInfo?.spuId || ""),
              skcId: String(mergedSalesInfo?.skcId || ""),
              goodsId: String(mergedSalesInfo?.goodsId || ""),
              sku: mergedSalesInfo?.skuCode || "",
              imageUrl: mergedSalesInfo?.imageUrl || "",
              status: "",
              totalSales: mergedSalesInfo?.totalSales || 0,
              last7DaysSales: mergedSalesInfo?.last7DaysSales || 0,
            };
          }
        }
      }

      // Load related orders
      const rawOrders = await getStoreValue(store, "temu_orders");
      ensureCurrentRequest();
      if (rawOrders) {
        nextSources.orders = true;
        const allOrders = parseOrdersData(rawOrders);
        const related = allOrders.filter((item: any) => matchesRecordByCandidateIds(item, ["skcId", "spuId"], productIdCandidates));
        setOrders(related);
        if (!resolvedProduct && !fallbackProduct && related.length > 0) {
          fallbackProduct = {
            title: related[0].title || "未命名商品",
            category: "",
            categories: "",
            spuId: "",
            skcId: String(related[0].skcId || ""),
            goodsId: "",
            sku: related[0].skuCode || "",
            imageUrl: "",
            status: "",
            totalSales: 0,
            last7DaysSales: 0,
          };
        }
      }

      // Load after-sales records
      const rawAfterSales = await getStoreValue(store, "temu_raw_afterSales");
      ensureCurrentRequest();
      if (rawAfterSales) {
        nextSources.afterSales = true;
        const result = findInRawStore(rawAfterSales, "queryPageV3");
        if (result) {
          const list = result?.pageItems || result?.list || (Array.isArray(result) ? result : []);
          const matched = list.filter((item: any) => matchesRecordByCandidateIds(item, ["productSkcId", "skcId", "goodsId", "productId"], productIdCandidates));
          setAfterSalesRecords(matched);
        }
      }

      // Load flow price / high price data
      const rawFlowPrice = await getStoreValue(store, "temu_raw_flowPrice");
      ensureCurrentRequest();
      if (rawFlowPrice) {
        const result = findInRawStore(rawFlowPrice, "highPriceFlowReduce") || findInRawStore(rawFlowPrice, "high/price");
        if (result) {
          const list = result?.pageItems || result?.list || (Array.isArray(result) ? result : []);
          const matched = list.find((item: any) => matchesRecordByCandidateIds(item, ["productSkcId", "skcId", "goodsId", "spuId"], productIdCandidates));
          if (matched) setFlowPriceInfo(matched);
        }
      }

      // Load retail price data
      const rawRetailPrice = await getStoreValue(store, "temu_raw_retailPrice");
      ensureCurrentRequest();
      if (rawRetailPrice) {
        const result = findInRawStore(rawRetailPrice, "suggestedPrice/pageQuery") || findInRawStore(rawRetailPrice, "suggestedPrice");
        if (result) {
          const list = result?.pageItems || result?.list || (Array.isArray(result) ? result : []);
          const matched = list.filter((item: any) => matchesRecordByCandidateIds(item, ["productSkcId", "skcId", "goodsId", "spuId"], productIdCandidates));
          setRetailPriceInfo(matched);
        }
      }

      // Load traffic/flux data
      const rawFlux = await getStoreValue(store, "temu_flux");
      ensureCurrentRequest();
      if (rawFlux) {
        nextSources.flux = true;
        const parsedFlux = parseFluxData(rawFlux);
        const candidateIds = new Set(
          [id, resolvedProduct?.goodsId, resolvedProduct?.spuId, resolvedProduct?.skcId]
            .map((value) => String(value || "").trim())
            .filter(Boolean),
        );
        const matchedFluxItems = Array.isArray(parsedFlux?.items)
          ? parsedFlux.items.filter((item: any) => (
              candidateIds.has(String(item.goodsId || ""))
              || candidateIds.has(String(item.spuId || ""))
            ))
          : [];
        setFluxItems(matchedFluxItems);
        if (!resolvedProduct && !fallbackProduct && matchedFluxItems.length > 0) {
          fallbackProduct = {
            title: matchedFluxItems[0].goodsName || "未命名商品",
            category: matchedFluxItems[0].category || "",
            categories: matchedFluxItems[0].category || "",
            spuId: String(matchedFluxItems[0].spuId || ""),
            skcId: "",
            goodsId: String(matchedFluxItems[0].goodsId || ""),
            sku: "",
            imageUrl: matchedFluxItems[0].imageUrl || "",
            status: "",
            totalSales: 0,
            last7DaysSales: 0,
          };
        }
      }

      // Load quality dashboard data
      const rawQuality = await getStoreValue(store, "temu_raw_qualityDashboard");
      ensureCurrentRequest();
      if (rawQuality) {
        nextSources.quality = true;
        const result = findInRawStore(rawQuality, "qualityMetrics/pageQuery");
        if (result?.pageItems) {
          const matched = result.pageItems.find((item: any) => matchesRecordByCandidateIds(item, ["productSkcId", "skcId"], productIdCandidates));
          if (matched) setQualityInfo(matched);
        }
      }

      // Load checkup data
      const rawCheckup = await getStoreValue(store, "temu_raw_checkup");
      ensureCurrentRequest();
      if (rawCheckup) {
        nextSources.checkup = true;
        const result = findInRawStore(rawCheckup, "check/product/list");
        if (result?.list) {
          const matched = result.list.find((item: any) => matchesRecordByCandidateIds(item, ["productSkcId", "skcId", "goodsId"], productIdCandidates));
          if (matched) setCheckupInfo(matched);
        }
      }

      // Load goods sales data
      const rawGoodsData = await getFirstExistingStoreValue(store, STORE_KEY_ALIASES.goodsData);
      ensureCurrentRequest();
      if (rawGoodsData) {
        nextSources.goodsData = true;
        const result = findInRawStore(rawGoodsData, "skc/sales/data");
        if (result?.skcSalesDataList) {
          const matched = result.skcSalesDataList.find((item: any) => matchesRecordByCandidateIds(item, ["skcExtId", "productSkcId", "skcId", "goodsId", "spuId"], productIdCandidates));
          if (matched) setGoodsSalesData(matched);
        }
      }

      if (!resolvedProduct && fallbackProduct) {
        setProduct(fallbackProduct);
      }
      setDataSources(nextSources);
    } catch (e) {
      if ((e as Error)?.message === STALE_LOAD_ERROR) {
        return;
      }
      console.error("加载商品详情失败", e);
      setDiagnostics(null);
      setDataSources(EMPTY_DATA_SOURCES);
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const renderTabEmpty = (title: string, description: string) => (
    <div style={{ paddingTop: 12 }}>
      <EmptyGuide
        icon={<DatabaseOutlined />}
        title={title}
        description={description}
        action={<Button onClick={() => navigate("/collect")}>前往采集</Button>}
      />
    </div>
  );

  if (loading) {
    return (
      <div className="dashboard-shell">
        <PageHeader
          compact
          eyebrow="商品详情"
          title="正在加载商品详情"
          subtitle="正在汇总销售、库存、流量和质量数据。"
          actions={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/products")}>返回商品列表</Button>}
        />
        <div className="app-panel" style={{ padding: 48, textAlign: "center" }}>
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="dashboard-shell">
        <PageHeader
          compact
          eyebrow="商品详情"
          title="没有找到对应商品"
          subtitle="可能还没有采集到该商品，或者当前账号下没有这条数据。"
          actions={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/products")}>返回商品列表</Button>}
        />
        <div className="app-panel">
          <EmptyGuide
            icon={<DatabaseOutlined />}
            title="商品未找到"
            description="可以先回到商品列表重新选择，或者重新执行商品列表与销售数据采集。"
            action={(
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                <Button type="primary" onClick={() => navigate("/products")}>返回商品列表</Button>
                <Button onClick={() => navigate("/collect")}>前往采集</Button>
              </div>
            )}
          />
        </div>
      </div>
    );
  }

  const p = product;
  const dataIssues = [
    getCollectionDataIssue(diagnostics, "sales", "销售数据", dataSources.sales),
    getCollectionDataIssue(diagnostics, "orders", "备货单数据", dataSources.orders),
    getCollectionDataIssue(diagnostics, "flux", "流量数据", dataSources.flux),
    getCollectionDataIssue(diagnostics, "afterSales", "售后数据", dataSources.afterSales),
    getCollectionDataIssue(diagnostics, "qualityDashboard", "质量数据", dataSources.quality),
    getCollectionDataIssue(diagnostics, "checkup", "体检数据", dataSources.checkup),
    getCollectionDataIssue(diagnostics, "goodsData", "销售明细", dataSources.goodsData),
  ].filter((issue): issue is string => Boolean(issue));

  const trafficSummary = {
    exposeNum: fluxItems.reduce((sum, item) => sum + toNumberValue(item.exposeNum), 0),
    clickNum: fluxItems.reduce((sum, item) => sum + toNumberValue(item.clickNum), 0),
    detailVisitNum: fluxItems.reduce((sum, item) => sum + toNumberValue(item.detailVisitNum), 0),
    buyerNum: fluxItems.reduce((sum, item) => sum + toNumberValue(item.buyerNum), 0),
  };
  const hasFulfillmentData = orders.length > 0 || afterSalesRecords.length > 0;
  const hasQualityData = Boolean(
    qualityInfo
    || checkupInfo
    || flowPriceInfo
    || retailPriceInfo.length > 0,
  );
  const pictureAuditStatus = formatPictureAuditStatus(salesInfo?.pictureAuditStatus);

  const tabItems = [
    {
      key: "overview",
      label: <span><ShoppingOutlined /> 概览</span>,
      children: (
        <div style={{ display: "grid", gap: 16 }}>
          <Card size="small" title="基本信息">
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="SPU ID">{p.spuId || "-"}</Descriptions.Item>
              <Descriptions.Item label="SKC ID">{p.skcId || "-"}</Descriptions.Item>
              <Descriptions.Item label="商品ID">{p.goodsId || "-"}</Descriptions.Item>
              <Descriptions.Item label="状态">{p.status ? <Tag color={p.status === "在售" ? "green" : "default"}>{p.status}</Tag> : "-"}</Descriptions.Item>
              <Descriptions.Item label="SKU货号">{p.sku || "-"}</Descriptions.Item>
              <Descriptions.Item label="类目">{p.category || "-"}</Descriptions.Item>
              {p.categories && <Descriptions.Item label="类目路径" span={2}>{p.categories}</Descriptions.Item>}
              {p.createdAt && <Descriptions.Item label="创建时间">{safeRender(p.createdAt)}</Descriptions.Item>}
              {p.skcStatus !== undefined && <Descriptions.Item label="SKC状态码">{safeRender(p.skcStatus)}</Descriptions.Item>}
            </Descriptions>
          </Card>

          <Card size="small" title="销售与库存">
            {salesInfo ? (
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="今日销量">{safeRender(salesInfo.todaySales)}</Descriptions.Item>
                <Descriptions.Item label="7日销量">{safeRender(salesInfo.last7DaysSales)}</Descriptions.Item>
                <Descriptions.Item label="30日销量">{safeRender(salesInfo.last30DaysSales)}</Descriptions.Item>
                <Descriptions.Item label="累计销量">{safeRender(salesInfo.totalSales)}</Descriptions.Item>
                <Descriptions.Item label="仓库库存">{safeRender(salesInfo.warehouseStock)}</Descriptions.Item>
                <Descriptions.Item label="建议备货量">{safeRender(salesInfo.adviceQuantity)}</Descriptions.Item>
                <Descriptions.Item label="缺货量">{safeRender(salesInfo.lackQuantity)}</Descriptions.Item>
                <Descriptions.Item label="可售天数">{safeRender(salesInfo.availableSaleDays)}</Descriptions.Item>
                <Descriptions.Item label="站点">{safeRender(salesInfo.siteLabel)}</Descriptions.Item>
                <Descriptions.Item label="热卖标签">{safeRender(salesInfo.hotTag)}</Descriptions.Item>
                <Descriptions.Item label="供货状态">
                  {salesInfo.supplyStatus ? <Tag color={salesInfo.supplyStatus === "正常供货" ? "green" : "orange"}>{salesInfo.supplyStatus}</Tag> : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="库存状态">{safeRender(salesInfo.stockStatus)}</Descriptions.Item>
                <Descriptions.Item label="申报价">{safeRender(salesInfo.price)}</Descriptions.Item>
                <Descriptions.Item label="SKU货号">{salesInfo.skuCode || p.sku || "-"}</Descriptions.Item>
                <Descriptions.Item label="SKU ID">{safeRender(salesInfo.skuId)}</Descriptions.Item>
                <Descriptions.Item label="SKU名称">{safeRender(salesInfo.skuName)}</Descriptions.Item>
                <Descriptions.Item label="预占库存">{safeRender(salesInfo.occupyStock)}</Descriptions.Item>
                <Descriptions.Item label="不可用库存">{safeRender(salesInfo.unavailableStock)}</Descriptions.Item>
                <Descriptions.Item label="仓组">{safeRender(salesInfo.warehouseGroup)}</Descriptions.Item>
                <Descriptions.Item label="ASF评分">{safeRender(salesInfo.asfScore)}</Descriptions.Item>
                <Descriptions.Item label="买手名称">{safeRender(salesInfo.buyerName)}</Descriptions.Item>
                <Descriptions.Item label="买手ID">{safeRender(salesInfo.buyerUid)}</Descriptions.Item>
                <Descriptions.Item label="评论数">{safeRender(salesInfo.commentNum)}</Descriptions.Item>
                <Descriptions.Item label="是否黑名单">
                  {salesInfo.inBlackList === "是" ? <Tag color="error">是</Tag> : salesInfo.inBlackList === "否" ? <Tag color="success">否</Tag> : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="图片审核状态">
                  {pictureAuditStatus.color ? <Tag color={pictureAuditStatus.color}>{pictureAuditStatus.label}</Tag> : pictureAuditStatus.label}
                </Descriptions.Item>
                <Descriptions.Item label="品质售后率">{formatRatePercent(salesInfo.qualityAfterSalesRate)}</Descriptions.Item>
                <Descriptions.Item label="预测今日销量">{safeRender(salesInfo.predictTodaySaleVolume)}</Descriptions.Item>
                <Descriptions.Item label="7日销量参考值">{safeRender(salesInfo.sevenDaysSaleReference)}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                暂无销售与库存数据，补采销售数据后会在这里展示销量、库存和供货字段。
              </Paragraph>
            )}
          </Card>

          {salesRows.length > 0 ? (
            <Card size="small" title="SKU销售明细">
              <Table
                dataSource={salesRows.map((row: any, index: number) => ({ ...row, key: `${row.skuId || row.skuCode || index}` }))}
                columns={[
                  { title: "SKU ID", dataIndex: "skuId", key: "skuId", render: (value: any) => safeRender(value) },
                  { title: "SKU名称", dataIndex: "skuName", key: "skuName", render: (value: any) => safeRender(value) },
                  { title: "SKU货号", dataIndex: "skuCode", key: "skuCode", render: (value: any) => safeRender(value) },
                  { title: "申报价", dataIndex: "price", key: "price", render: (value: any) => safeRender(value) },
                  { title: "仓库库存", dataIndex: "warehouseStock", key: "warehouseStock", render: (value: any) => safeRender(value) },
                  { title: "预占库存", dataIndex: "occupyStock", key: "occupyStock", render: (value: any) => safeRender(value) },
                  { title: "不可用库存", dataIndex: "unavailableStock", key: "unavailableStock", render: (value: any) => safeRender(value) },
                ]}
                size="small"
                pagination={salesRows.length > 10 ? { pageSize: 10 } : false}
              />
            </Card>
          ) : null}
        </div>
      ),
    },
    {
      key: "flux",
      label: <span><EyeOutlined /> 流量数据</span>,
      children: fluxItems.length > 0 ? (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <StatCard compact title="曝光量" value={trafficSummary.exposeNum} color="brand" trend="当前商品流量汇总" />
            <StatCard compact title="点击量" value={trafficSummary.clickNum} color="blue" trend="当前商品点击汇总" />
            <StatCard compact title="详情访问" value={trafficSummary.detailVisitNum} color="purple" trend="详情页访问总量" />
            <StatCard compact title="支付买家" value={trafficSummary.buyerNum} color="success" trend="已支付买家数" />
          </div>

          <Card size="small" title="流量数据">
            <Table
              dataSource={fluxItems.map((item: any, i: number) => ({ ...item, key: i }))}
              columns={[
                { title: "商品ID", dataIndex: "goodsId", key: "goodsId", render: (v: any) => safeRender(v) },
                { title: "曝光量", dataIndex: "exposeNum", key: "exposeNum", render: (v: any) => safeRender(v) },
                { title: "点击量", dataIndex: "clickNum", key: "clickNum", render: (v: any) => safeRender(v) },
                { title: "详情访问", dataIndex: "detailVisitNum", key: "detailVisitNum", render: (v: any) => safeRender(v) },
                { title: "加购人数", dataIndex: "addToCartUserNum", key: "addToCartUserNum", render: (v: any) => safeRender(v) },
                { title: "支付买家", dataIndex: "buyerNum", key: "buyerNum", render: (v: any) => safeRender(v) },
                { title: "支付件数", dataIndex: "payGoodsNum", key: "payGoodsNum", render: (v: any) => safeRender(v) },
                {
                  title: "点击支付转化率",
                  dataIndex: "clickPayRate",
                  key: "clickPayRate",
                  render: (v: any) => typeof v === "number" ? `${(v * 100).toFixed(2)}%` : safeRender(v),
                },
              ]}
              size="small"
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </div>
      ) : (
        renderTabEmpty("暂无流量数据", "执行流量采集后，这里会展示曝光、点击、访问和支付转化。")
      ),
    },
    {
      key: "fulfillment",
      label: <span><InboxOutlined /> 履约与售后</span>,
      children: hasFulfillmentData ? (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <StatCard compact title="备货单" value={orders.length} suffix="单" color="brand" trend="待跟进履约记录" />
            <StatCard compact title="退货记录" value={afterSalesRecords.length} suffix="条" color="danger" trend="售后与退货记录数" />
          </div>

          <Card size="small" title="备货单明细">
            {orders.length > 0 ? (
              <Table
                dataSource={orders.map((o: any, i: number) => ({ ...o, key: i }))}
                columns={[
                  { title: "备货单号", dataIndex: "purchaseOrderNo", key: "no", render: (v: string) => <span style={{ fontFamily: "monospace", fontSize: 12 }}>{v || "-"}</span> },
                  { title: "数量", dataIndex: "quantity", key: "qty" },
                  { title: "状态", dataIndex: "status", key: "status", render: (v: string) => <Tag>{v || "-"}</Tag> },
                  { title: "金额", dataIndex: "amount", key: "amount", render: (v: string) => v ? <span style={{ color: "#fa541c" }}>¥{v}</span> : "-" },
                  { title: "仓库", dataIndex: "warehouse", key: "warehouse", render: (v: string) => <span style={{ fontSize: 12 }}>{v || "-"}</span> },
                  { title: "下单时间", dataIndex: "orderTime", key: "orderTime", render: (v: string) => <span style={{ fontSize: 12 }}>{safeRender(v)}</span> },
                  { title: "类型", dataIndex: "type", key: "type", render: (v: string) => v ? <Tag>{v}</Tag> : "-" },
                ]}
                size="small"
                pagination={false}
              />
            ) : (
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>当前暂无备货单记录。</Paragraph>
            )}
          </Card>

          <Card size="small" title="售后 / 退货记录">
            {afterSalesRecords.length > 0 ? (
              <Table
                dataSource={afterSalesRecords.map((r: any, i: number) => ({ ...r, key: i }))}
                columns={[
                  { title: "售后单号", dataIndex: "afterSaleOrderSn", key: "sn", render: (v: any) => <span style={{ fontFamily: "monospace", fontSize: 12 }}>{safeRender(v)}</span> },
                  { title: "类型", dataIndex: "afterSaleType", key: "type", render: (v: any) => <Tag>{safeRender(v)}</Tag> },
                  { title: "状态", dataIndex: "status", key: "status", render: (v: any) => <Tag>{safeRender(v)}</Tag> },
                  { title: "原因", dataIndex: "reason", key: "reason", ellipsis: true, render: (v: any) => safeRender(v) },
                  { title: "数量", dataIndex: "quantity", key: "qty", render: (v: any) => safeRender(v) },
                  { title: "创建时间", dataIndex: "createTime", key: "createTime", render: (v: any) => safeRender(v) },
                ]}
                size="small"
                pagination={{ pageSize: 10 }}
              />
            ) : (
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>当前暂无售后与退货记录。</Paragraph>
            )}
          </Card>
        </div>
      ) : (
        renderTabEmpty("暂无履约与售后数据", "采集备货单和售后数据后，这里会自动汇总履约与退货情况。")
      ),
    },
    {
      key: "quality",
      label: <span><SafetyCertificateOutlined /> 质量与价格</span>,
      children: hasQualityData ? (
        <div style={{ display: "grid", gap: 16 }}>
          {qualityInfo ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <StatCard compact title="质量分" value={safeRender(qualityInfo.qualityScore)} color="brand" trend="当前商品质量分" />
              <StatCard compact title="平均分" value={safeRender(qualityInfo.avgScore)} color="blue" trend="同类平均水平" />
              <StatCard compact title="售后退货率" value={safeRender(qualityInfo.qltyAfsOrdrRate)} color="danger" trend="质量侧重点指标" />
              <StatCard compact title="建议零售价" value={retailPriceInfo.length} suffix="条" color="purple" trend="已采集价格建议数" />
            </div>
          ) : null}

          {qualityInfo && (
            <Card size="small" title="质量评分详情">
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="质量分">{safeRender(qualityInfo.qualityScore)}</Descriptions.Item>
                <Descriptions.Item label="平均分">{safeRender(qualityInfo.avgScore)}</Descriptions.Item>
                <Descriptions.Item label="售后退货率">{safeRender(qualityInfo.qltyAfsOrdrRate)}</Descriptions.Item>
                {Object.entries(qualityInfo)
                  .filter(([key]) => !["qualityScore", "avgScore", "qltyAfsOrdrRate", "productSkcId"].includes(key))
                  .slice(0, 12)
                  .map(([key, value]) => (
                    <Descriptions.Item key={key} label={key}>
                      {safeRender(value)}
                    </Descriptions.Item>
                  ))}
              </Descriptions>
            </Card>
          )}

          {checkupInfo && (
            <Card size="small" title="体检报告">
              <Descriptions size="small" column={2}>
                {Object.entries(checkupInfo).slice(0, 16).map(([key, value]) => (
                  <Descriptions.Item key={key} label={key}>
                    {safeRender(value)}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Card>
          )}

          <Card size="small" title="高价限流状态">
            {flowPriceInfo ? (
              <Descriptions size="small" column={2}>
                {Object.entries(flowPriceInfo).slice(0, 12).map(([key, value]) => (
                  <Descriptions.Item key={key} label={key}>
                    {safeRender(value)}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            ) : (
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>该商品暂未被高价限流。</Paragraph>
            )}
          </Card>

          <Card size="small" title="建议零售价">
            {retailPriceInfo.length > 0 ? (
              <Table
                dataSource={retailPriceInfo.map((r: any, i: number) => ({ ...r, key: i }))}
                columns={[
                  { title: "SKU", dataIndex: "skuId", key: "skuId", render: (v: any) => safeRender(v) },
                  { title: "当前价格", dataIndex: "currentPrice", key: "currentPrice", render: (v: any) => safeRender(v) },
                  { title: "建议价格", dataIndex: "suggestedPrice", key: "suggestedPrice", render: (v: any) => safeRender(v) },
                  { title: "站点", dataIndex: "siteCode", key: "siteCode", render: (v: any) => safeRender(v) },
                ]}
                size="small"
                pagination={false}
              />
            ) : (
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>暂无建议零售价数据。</Paragraph>
            )}
          </Card>
        </div>
      ) : (
        renderTabEmpty("暂无质量与价格数据", "采集质量、体检和价格数据后，这里会自动汇总评分、限流和价格建议。")
      ),
    },
    {
      key: "salesDetail",
      label: <span><BarChartOutlined /> 销售明细</span>,
      children: goodsSalesData ? (
        <Card size="small" title="SKC销售明细">
          <Descriptions size="small" column={2}>
            {Object.entries(goodsSalesData).slice(0, 20).map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                {safeRender(value)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Card>
      ) : (
        renderTabEmpty("暂无销售明细数据", "执行销售明细采集后，这里会展示更细的 SKC 维度指标。")
      ),
    },
  ];

  return (
    <div className="dashboard-shell">
      <PageHeader
        compact
        eyebrow="商品数据"
        title={p.title || "未命名商品"}
        subtitle={p.categories || p.category || "查看该商品的销售、流量、库存、售后与质量数据。"}
        meta={[
          p.skcId ? `SKC ${p.skcId}` : null,
          p.spuId ? `SPU ${p.spuId}` : null,
          p.status || "状态待同步",
          diagnostics?.syncedAt ? `最近采集 ${diagnostics.syncedAt}` : null,
        ].filter(Boolean)}
        actions={[
          <Button key="back" icon={<ArrowLeftOutlined />} onClick={() => navigate("/products")}>返回商品列表</Button>,
          <Button key="refresh" icon={<SyncOutlined />} onClick={() => void loadProduct()}>刷新详情</Button>,
        ]}
      />

      <div className="app-panel" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: p.imageUrl ? "88px minmax(0, 1fr)" : "minmax(0, 1fr)", gap: 16, alignItems: "center" }}>
          {p.imageUrl ? (
            <Image
              src={p.imageUrl}
              width={88}
              height={88}
              style={{ objectFit: "cover", borderRadius: 16 }}
              preview={false}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
            />
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <StatCard compact title="今日销量" value={salesInfo?.todaySales || 0} icon={<RiseOutlined />} color="success" trend="当天销量" />
            <StatCard compact title="7日销量" value={salesInfo?.last7DaysSales || p.last7DaysSales || 0} color="blue" trend="近 7 日销量" />
            <StatCard compact title="30日销量" value={salesInfo?.last30DaysSales || 0} color="purple" trend="近 30 日销量" />
            <StatCard compact title="仓库库存" value={salesInfo?.warehouseStock ?? "-"} color={toNumberValue(salesInfo?.warehouseStock) > 0 ? "brand" : "danger"} trend="当前仓库可售库存" />
            <StatCard compact title="支付买家" value={trafficSummary.buyerNum} color="neutral" trend="流量侧支付买家" />
            <StatCard compact title="退货记录" value={afterSalesRecords.length} suffix="条" color="danger" trend="当前售后记录数" />
          </div>
        </div>
      </div>

      {dataIssues.length > 0 && (
        <Alert
          className="friendly-alert"
          type="warning"
          showIcon
          message="部分详情数据还没有准备好"
          description={(
            <div className="friendly-alert__summary">
              {dataIssues.slice(0, 4).join("；")}
              {dataIssues.length > 4 ? `；另有 ${dataIssues.length - 4} 个数据源也需要补采。` : ""}
              <div className="friendly-alert__details">
                {diagnostics?.syncedAt ? `最近一次采集时间：${diagnostics.syncedAt}` : "建议回到数据采集页补齐该商品相关数据。"}
              </div>
            </div>
          )}
          action={<Button type="link" onClick={() => navigate("/collect")}>前往采集</Button>}
        />
      )}

      <div className="app-panel">
        <Tabs items={tabItems} defaultActiveKey="overview" />
      </div>
    </div>
  );
}
