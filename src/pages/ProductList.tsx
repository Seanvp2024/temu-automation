import { useState, useEffect } from "react";
import { Alert, Table, Button, Space, Tag, Input, Card, Result, Image, Row, Col, Statistic } from "antd";
import { SyncOutlined, SearchOutlined, ShopOutlined, EyeOutlined, RiseOutlined, ShoppingCartOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import { parseProductsData, parseSalesData, parseOrdersData } from "../utils/parseRawApis";
import {
  COLLECTION_DIAGNOSTICS_KEY,
  getCollectionDataIssue,
  normalizeCollectionDiagnostics,
  type CollectionDiagnostics,
} from "../utils/collectionDiagnostics";
import { getStoreValue } from "../utils/storeCompat";
import { ACTIVE_ACCOUNT_CHANGED_EVENT } from "../utils/multiStore";

const store = window.electronAPI?.store;

interface ProductItem {
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
  syncedAt: string;
  stockStatus: string;
  supplyStatus: string;
  pendingOrderCount: number;
}

interface ProductSourceState {
  products: boolean;
  sales: boolean;
  orders: boolean;
}

const EMPTY_SOURCES: ProductSourceState = {
  products: false,
  sales: false,
  orders: false,
};

function normalizeLookupValue(value: string) {
  return (value || "").replace(/\s+/g, "").trim().toLowerCase().slice(0, 30);
}

function buildLookupKeys(source: Partial<ProductItem>) {
  const titleKey = normalizeLookupValue(source.title || "");
  return [
    source.skcId ? `skc:${source.skcId}` : "",
    source.goodsId ? `goods:${source.goodsId}` : "",
    source.spuId ? `spu:${source.spuId}` : "",
    titleKey ? `title:${titleKey}` : "",
  ].filter(Boolean);
}

export default function ProductList() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [diagnostics, setDiagnostics] = useState<CollectionDiagnostics | null>(null);
  const [sourceState, setSourceState] = useState<ProductSourceState>(EMPTY_SOURCES);
  const navigate = useNavigate();

  useEffect(() => {
    loadProducts();
    const handleActiveAccountChanged = () => {
      void loadProducts();
    };
    window.addEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleActiveAccountChanged);
    return () => {
      window.removeEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleActiveAccountChanged);
    };
  }, []);

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
      const salesItems = Array.isArray(parsedSales?.items) ? parsedSales.items : [];
      const parsedOrders = parseOrdersData(rawOrders);

      setSourceState({
        products: parsedProducts.length > 0,
        sales: salesItems.length > 0,
        orders: parsedOrders.length > 0,
      });

      const lookup = new Map<string, ProductItem>();

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

        const product: ProductItem = {
          title: source.title || "",
          category: source.category || "",
          categories: source.categories || "",
          spuId: source.spuId || "",
          skcId: source.skcId || "",
          goodsId: source.goodsId || "",
          sku: source.sku || "",
          imageUrl: source.imageUrl || "",
          status: source.status || "",
          totalSales: source.totalSales || 0,
          last7DaysSales: source.last7DaysSales || 0,
          syncedAt: source.syncedAt || "",
          stockStatus: source.stockStatus || "",
          supplyStatus: source.supplyStatus || "",
          pendingOrderCount: source.pendingOrderCount || 0,
        };
        register(product);
        return product;
      };

      parsedProducts.forEach((item: any) => {
        const product = ensureProduct({
          title: item.title || "",
          category: item.category || "",
          categories: item.categories || "",
          spuId: String(item.spuId || ""),
          skcId: String(item.skcId || ""),
          goodsId: String(item.goodsId || ""),
          sku: item.sku || "",
          imageUrl: item.imageUrl || "",
          status: item.status || "",
          totalSales: item.totalSales || 0,
          last7DaysSales: item.last7DaysSales || 0,
          syncedAt: item.syncedAt || "",
        });
        product.title = item.title || product.title;
        product.category = item.category || product.category;
        product.categories = item.categories || product.categories;
        product.spuId = String(item.spuId || "") || product.spuId;
        product.skcId = String(item.skcId || "") || product.skcId;
        product.goodsId = String(item.goodsId || "") || product.goodsId;
        product.sku = item.sku || product.sku;
        product.imageUrl = item.imageUrl || product.imageUrl;
        product.status = item.status || product.status;
        product.totalSales = item.totalSales || product.totalSales;
        product.last7DaysSales = item.last7DaysSales || product.last7DaysSales;
        product.syncedAt = item.syncedAt || product.syncedAt;
        register(product);
      });

      salesItems.forEach((item: any) => {
        const product = ensureProduct({
          title: item.title || "",
          category: item.category || "",
          spuId: String(item.spuId || ""),
          skcId: String(item.skcId || ""),
          sku: item.skuCode || "",
          imageUrl: item.imageUrl || "",
          totalSales: item.totalSales || 0,
          last7DaysSales: item.last7DaysSales || 0,
          syncedAt: parsedSales?.syncedAt || "",
          stockStatus: item.stockStatus || "",
          supplyStatus: item.supplyStatus || "",
        });
        product.title = product.title || item.title || "";
        product.category = product.category || item.category || "";
        product.spuId = product.spuId || String(item.spuId || "");
        product.skcId = product.skcId || String(item.skcId || "");
        product.sku = product.sku || item.skuCode || "";
        product.imageUrl = product.imageUrl || item.imageUrl || "";
        product.totalSales = item.totalSales || product.totalSales || 0;
        product.last7DaysSales = item.last7DaysSales || product.last7DaysSales || 0;
        product.syncedAt = product.syncedAt || parsedSales?.syncedAt || "";
        product.stockStatus = item.stockStatus || product.stockStatus;
        product.supplyStatus = item.supplyStatus || product.supplyStatus;
        register(product);
      });

      parsedOrders.forEach((item: any) => {
        const product = ensureProduct({
          title: item.title || "",
          skcId: String(item.skcId || ""),
          sku: item.skuCode || "",
          pendingOrderCount: 0,
        });
        product.title = product.title || item.title || "";
        product.skcId = product.skcId || String(item.skcId || "");
        product.sku = product.sku || item.skuCode || "";
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
    } catch (e) {
      console.error("加载商品失败", e);
      setProducts([]);
      setDiagnostics(null);
      setSourceState(EMPTY_SOURCES);
    } finally {
      setLoading(false);
    }
  };

  if (hasAccount === false && !loading && products.length === 0) {
    return (
      <Result
        icon={<ShopOutlined style={{ color: "#fa8c16" }} />}
        title="请先绑定店铺"
        subTitle="绑定 Temu 店铺账号后，即可查看商品数据"
        extra={<Button type="primary" onClick={() => navigate("/accounts")}>前往绑定店铺</Button>}
      />
    );
  }

  const filteredProducts = products.filter((p) => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return (
      (p.title || "").toLowerCase().includes(s) ||
      (p.skcId || "").includes(s) ||
      (p.goodsId || "").includes(s) ||
      (p.spuId || "").includes(s) ||
      (p.category || "").toLowerCase().includes(s) ||
      (p.sku || "").toLowerCase().includes(s)
    );
  });

  const totalProducts = products.length;
  const total7dSales = products.reduce((sum, product) => sum + (product.last7DaysSales || 0), 0);
  const totalSales = products.reduce((sum, product) => sum + (product.totalSales || 0), 0);
  const onSaleCount = products.filter((product) => product.status === "在售").length;

  const dataIssues = [
    getCollectionDataIssue(diagnostics, "products", "商品列表", sourceState.products),
    getCollectionDataIssue(diagnostics, "sales", "销售数据", sourceState.sales),
    getCollectionDataIssue(diagnostics, "orders", "备货单数据", sourceState.orders),
  ].filter((issue): issue is string => Boolean(issue));

  const columns: ColumnsType<ProductItem> = [
    {
      title: "商品图片",
      dataIndex: "imageUrl",
      key: "imageUrl",
      width: 65,
      render: (url: string) =>
        url ? (
          <Image
            src={url}
            width={50}
            height={50}
            style={{ objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
            preview={false}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
          />
        ) : (
          <div style={{ width: 50, height: 50, background: "#f0f0f0", borderRadius: 4, flexShrink: 0 }} />
        ),
    },
    {
      title: "商品名称",
      dataIndex: "title",
      key: "title",
      width: 250,
      ellipsis: true,
      fixed: "left",
      render: (text: string, record: ProductItem) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
            {text || "-"}
          </div>
          {record.category && (
            <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{record.category}</div>
          )}
        </div>
      ),
    },
    {
      title: "SKC ID",
      dataIndex: "skcId",
      key: "skcId",
      width: 120,
      render: (value: string) => <span style={{ fontSize: 11, fontFamily: "monospace" }}>{value || "-"}</span>,
    },
    {
      title: "总销量",
      dataIndex: "totalSales",
      key: "totalSales",
      width: 80,
      sorter: (a, b) => a.totalSales - b.totalSales,
      render: (value: number) => <span style={{ fontWeight: value > 0 ? 600 : 400, color: value > 0 ? "#722ed1" : "#999" }}>{value}</span>,
    },
    {
      title: "7日销量",
      dataIndex: "last7DaysSales",
      key: "last7DaysSales",
      width: 80,
      sorter: (a, b) => (a.last7DaysSales || 0) - (b.last7DaysSales || 0),
      render: (value: number) => <span style={{ fontWeight: value > 0 ? 500 : 400, color: value > 0 ? "#52c41a" : "#999" }}>{value ?? "-"}</span>,
    },
    {
      title: "库存状态",
      dataIndex: "stockStatus",
      key: "stockStatus",
      width: 90,
      render: (value: string) => {
        if (!value) return <span style={{ color: "#999" }}>-</span>;
        return <Tag>{value}</Tag>;
      },
    },
    {
      title: "备货状态",
      dataIndex: "supplyStatus",
      key: "supplyStatus",
      width: 110,
      render: (value: string) => {
        if (!value) return <span style={{ color: "#999" }}>-</span>;
        const color = value === "正常供货" ? "#00b96b" : value.includes("停止") ? "red" : "orange";
        return <Tag color={color}>{value}</Tag>;
      },
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 80,
      filters: [
        { text: "在售", value: "在售" },
        { text: "已下架", value: "已下架" },
      ],
      onFilter: (value, record) => record.status === value,
      render: (value: string) => value ? <Tag color={value === "在售" ? "#00b96b" : "default"}>{value}</Tag> : "-",
    },
    {
      title: "备货单",
      dataIndex: "pendingOrderCount",
      key: "pendingOrderCount",
      width: 70,
      sorter: (a, b) => a.pendingOrderCount - b.pendingOrderCount,
      render: (value: number) => value > 0 ? <Tag color="blue">{value} 单</Tag> : <span style={{ color: "#999" }}>-</span>,
    },
    {
      title: "操作",
      key: "action",
      width: 90,
      fixed: "right",
      render: (_: any, record: ProductItem) => (
        <Button type="link" size="small" style={{ color: "#e55b00", fontWeight: 500 }} onClick={() => navigate(`/products/${record.skcId || record.goodsId || record.spuId}`)}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      {hasAccount === false && products.length > 0 && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message="当前没有绑定账号，正在展示本地历史数据"
          description="如果你希望拿到最新商品状态，请先重新绑定店铺账号后再执行一键采集。"
        />
      )}

      {dataIssues.length > 0 && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message="商品数据不完整"
          description={[
            dataIssues.slice(0, 3).join("；"),
            diagnostics?.syncedAt ? `最近一次采集时间：${diagnostics.syncedAt}` : "",
          ].filter(Boolean).join(" ")}
        />
      )}

      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card size="small" className="stat-card" style={{ background: "#fff7f0" }}><Statistic title="商品总数" value={totalProducts} prefix={<ShopOutlined />} valueStyle={{ color: "#e55b00" }} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small" className="stat-card" style={{ background: "#f6ffed" }}><Statistic title="在售商品" value={onSaleCount} prefix={<ShoppingCartOutlined />} valueStyle={{ color: "#00b96b" }} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small" className="stat-card" style={{ background: "#f0f5ff" }}><Statistic title="7日总销量" value={total7dSales} prefix={<RiseOutlined />} valueStyle={{ color: "#1677ff" }} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small" className="stat-card" style={{ background: "#f9f0ff" }}><Statistic title="累计总销量" value={totalSales} prefix={<EyeOutlined />} valueStyle={{ color: "#722ed1" }} /></Card>
        </Col>
      </Row>

      <Card size="small" style={{ borderRadius: 12, border: "1px solid #f0f0f0", marginBottom: 20 }}>
        <Space>
          <Input
            placeholder="搜索商品名称/SKC/SPU/货号"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            style={{ width: 320, borderRadius: 8 }}
            allowClear
          />
          <Button icon={<SyncOutlined />} type="primary" loading={loading} onClick={loadProducts}>
            刷新数据
          </Button>
          {products.length > 0 && (
            <span style={{ color: "#999", fontSize: 13 }}>
              共 {products.length} 个商品
              {filteredProducts.length !== products.length && ` (显示 ${filteredProducts.length})`}
            </span>
          )}
        </Space>
      </Card>

      <div style={{ borderRadius: 12, overflow: "hidden" }}>
        <Table
          dataSource={filteredProducts.map((product, index) => ({ ...product, key: product.skcId || product.goodsId || product.spuId || index }))}
          columns={columns}
          size="small"
          loading={loading}
          bordered={false}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 个商品` }}
          scroll={{ x: 1300 }}
          locale={{ emptyText: "暂无商品数据，请先执行一键采集中的商品列表、销售数据或备货单数据" }}
        />
      </div>
    </div>
  );
}
