import { useState, useEffect } from "react";
import { Table, Button, Space, Tag, Input, Card, Result, message, Image, Row, Col, Statistic } from "antd";
import { SyncOutlined, SearchOutlined, ShopOutlined, EyeOutlined, RiseOutlined, ShoppingCartOutlined, WarningOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import { parseProductsData, parseSalesData, parseOrdersData } from "../utils/parseRawApis";

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
  // merged from sales
  stockStatus: string;
  supplyStatus: string;
  // merged from orders
  pendingOrderCount: number;
}

export default function ProductList() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    store?.get("temu_accounts").then((data: any[] | null) => {
      if (data && Array.isArray(data) && data.length > 0) {
        setHasAccount(true);
        loadProducts();
      } else {
        setHasAccount(false);
      }
    });
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const [rawProducts, rawSales, rawOrders] = await Promise.all([
        store?.get("temu_products"),
        store?.get("temu_sales"),
        store?.get("temu_orders"),
      ]);

      // Build sales lookup by skcId
      const salesMap = new Map<string, any>();
      if (rawSales) {
        const sales = parseSalesData(rawSales);
        if (sales?.items && Array.isArray(sales.items)) {
          for (const item of sales.items) {
            if (item.skcId) salesMap.set(String(item.skcId), item);
          }
        }
      }

      // Build orders count lookup by skcId
      const ordersCountMap = new Map<string, number>();
      if (rawOrders) {
        const orders = parseOrdersData(rawOrders);
        if (Array.isArray(orders)) {
          for (const o of orders) {
            if (o.skcId) {
              const key = String(o.skcId);
              ordersCountMap.set(key, (ordersCountMap.get(key) || 0) + 1);
            }
          }
        }
      }

      if (rawProducts) {
        const parsed = parseProductsData(rawProducts);
        if (Array.isArray(parsed)) {
          const merged: ProductItem[] = parsed.map((p: any) => {
            const skcId = String(p.skcId || "");
            const salesItem = salesMap.get(skcId);
            return {
              ...p,
              stockStatus: salesItem?.stockStatus || "",
              supplyStatus: salesItem?.supplyStatus || "",
              pendingOrderCount: ordersCountMap.get(skcId) || 0,
            };
          });
          setProducts(merged);
        }
      }
    } catch (e) {
      console.error("加载商品失败", e);
    } finally {
      setLoading(false);
    }
  };

  if (hasAccount === false) {
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
      p.title.toLowerCase().includes(s) ||
      p.skcId.includes(s) ||
      p.goodsId.includes(s) ||
      p.spuId.includes(s) ||
      p.category.toLowerCase().includes(s) ||
      p.sku.toLowerCase().includes(s)
    );
  });

  // 汇总统计
  const totalProducts = products.length;
  const total7dSales = products.reduce((s, p) => s + (p.last7DaysSales || 0), 0);
  const totalSales = products.reduce((s, p) => s + (p.totalSales || 0), 0);
  const onSaleCount = products.filter((p) => p.status === "在售").length;

  const columns: ColumnsType<ProductItem> = [
    {
      title: "商品图片",
      dataIndex: "imageUrl",
      key: "imageUrl",
      width: 65,
      render: (url: string) =>
        url ? (
          <Image src={url} width={50} height={50} style={{ objectFit: "cover", borderRadius: 8, flexShrink: 0 }} preview={false}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" />
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
          <div style={{ fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
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
      render: (v: string) => <span style={{ fontSize: 11, fontFamily: "monospace" }}>{v || "-"}</span>,
    },
    {
      title: "总销量",
      dataIndex: "totalSales",
      key: "totalSales",
      width: 80,
      sorter: (a, b) => a.totalSales - b.totalSales,
      render: (v: number) => <span style={{ fontWeight: v > 0 ? 600 : 400, color: v > 0 ? "#722ed1" : "#999" }}>{v}</span>,
    },
    {
      title: "7日销量",
      dataIndex: "last7DaysSales",
      key: "last7DaysSales",
      width: 80,
      sorter: (a, b) => (a.last7DaysSales || 0) - (b.last7DaysSales || 0),
      render: (v: number) => <span style={{ fontWeight: v > 0 ? 500 : 400, color: v > 0 ? "#52c41a" : "#999" }}>{v ?? "-"}</span>,
    },
    {
      title: "库存状态",
      dataIndex: "stockStatus",
      key: "stockStatus",
      width: 90,
      render: (v: string) => {
        if (!v) return <span style={{ color: "#999" }}>-</span>;
        return <Tag>{v}</Tag>;
      },
    },
    {
      title: "备货状态",
      dataIndex: "supplyStatus",
      key: "supplyStatus",
      width: 110,
      render: (v: string) => {
        if (!v) return <span style={{ color: "#999" }}>-</span>;
        const color = v === "正常供货" ? "#00b96b" : v.includes("停止") ? "red" : "orange";
        return <Tag color={color}>{v}</Tag>;
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
      render: (v: string) => v ? <Tag color={v === "在售" ? "#00b96b" : "default"}>{v}</Tag> : "-",
    },
    {
      title: "备货单",
      dataIndex: "pendingOrderCount",
      key: "pendingOrderCount",
      width: 70,
      sorter: (a, b) => a.pendingOrderCount - b.pendingOrderCount,
      render: (v: number) => v > 0 ? <Tag color="blue">{v} 单</Tag> : <span style={{ color: "#999" }}>-</span>,
    },
    {
      title: "操作",
      key: "action",
      width: 90,
      fixed: "right",
      render: (_: any, record: ProductItem) => (
        <Button type="link" size="small" style={{ color: "#e55b00", fontWeight: 500 }} onClick={() => navigate(`/products/${record.skcId}`)}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      {/* 顶部统计 */}
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

      {/* 搜索和操作 */}
      <Card size="small" style={{ borderRadius: 12, border: "1px solid #f0f0f0", marginBottom: 20 }}>
        <Space>
          <Input
            placeholder="搜索商品名称/SKC/SPU/货号"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
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

      {/* 商品表格 */}
      <div style={{ borderRadius: 12, overflow: "hidden" }}>
        <Table
          dataSource={filteredProducts.map((p, i) => ({ ...p, key: p.skcId || i }))}
          columns={columns}
          size="small"
          loading={loading}
          bordered={false}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 个商品` }}
          scroll={{ x: 1300 }}
          locale={{ emptyText: "暂无商品数据，请先执行「一键采集」" }}
        />
      </div>
    </div>
  );
}
