import { useState, useEffect } from "react";
import { Table, Button, Space, Card, Row, Col, Statistic, notification, Tag, Input, Image, Result } from "antd";
import { SyncOutlined, SearchOutlined, ShopOutlined, ShoppingCartOutlined, WarningOutlined, StopOutlined, FireOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import { parseSalesData } from "../utils/parseRawApis";

interface SalesItem {
  key: number;
  title: string;
  category: string;
  skcId: string;
  skuId: string;
  skuCode: string;
  className: string;
  price: string;
  imageUrl: string;
  todaySales: number;
  last7DaysSales: number;
  last30DaysSales: number;
  totalSales: number;
  warehouseStock: number;
  waitReceiveNum: number;
  waitDeliveryNum: number;
  availableSaleDays: number | null;
  adviceQuantity: number;
  lackQuantity: number;
  purchaseConfig: string;
  warehouseGroup: string;
  stockStatus: string;
  supplyStatus: string;
  hotTag: string;
  isAdProduct: string;
  productId: string;
  inCartNumber: number;
  commentNum: number;
}

interface SalesSummary {
  saleOutSkcNum: number;
  soonSaleOutSkcNum: number;
  adviceStockSkcNum: number;
  completelySoldOutSkcNum: number;
  adSkcNum: number;
  shortageSkcNum: number;
}

export default function SalesManagement() {
  const [items, setItems] = useState<SalesItem[]>([]);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);

  const navigate = useNavigate();
  const api = window.electronAPI?.automation;
  const store = window.electronAPI?.store;

  useEffect(() => {
    store?.get("temu_accounts").then((accounts: any) => {
      if (!accounts || (Array.isArray(accounts) && accounts.length === 0)) {
        setHasAccount(false);
      } else {
        setHasAccount(true);
      }
    });
    store?.get("temu_sales").then((raw: any) => {
      const data = parseSalesData(raw);
      if (data) {
        setSummary(data.summary || null);
        setItems(data.items || []);
      }
    });
  }, []);

  const columns: ColumnsType<SalesItem> = [
    {
      title: "商品图片",
      dataIndex: "imageUrl",
      key: "imageUrl",
      width: 60,
      render: (url: string) =>
        url ? (
          <Image src={url} width={45} height={45} style={{ objectFit: "cover", borderRadius: 4 }} fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" />
        ) : (
          <div style={{ width: 45, height: 45, background: "#f0f0f0", borderRadius: 4 }} />
        ),
    },
    {
      title: "商品名称",
      dataIndex: "title",
      key: "title",
      width: 260,
      ellipsis: true,
      fixed: "left",
      render: (text: string, record: SalesItem) => (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 2 }}>{text || "-"}</div>
          <div style={{ fontSize: 11, color: "#999" }}>
            {record.category && <span>类目：{record.category}</span>}
            {record.hotTag && <Tag color="red" style={{ marginLeft: 4, fontSize: 10 }}>{record.hotTag}</Tag>}
            {record.isAdProduct && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>{record.isAdProduct}</Tag>}
          </div>
        </div>
      ),
    },
    {
      title: "SKC ID",
      dataIndex: "skcId",
      key: "skcId",
      width: 120,
      render: (text: string) => <span style={{ fontSize: 12, fontFamily: "monospace" }}>{text || "-"}</span>,
    },
    {
      title: "SKU/规格",
      key: "skuInfo",
      width: 150,
      render: (_: any, record: SalesItem) => (
        <div style={{ fontSize: 12 }}>
          <div style={{ fontFamily: "monospace" }}>{record.skuId || "-"}</div>
          {record.className && <div style={{ color: "#666" }}>{record.className}</div>}
          {record.skuCode && <div style={{ color: "#999" }}>货号：{record.skuCode}</div>}
        </div>
      ),
    },
    {
      title: "申报价格",
      dataIndex: "price",
      key: "price",
      width: 90,
      render: (text: string) => <span style={{ color: "#fa541c", fontWeight: 500 }}>{text || "-"}</span>,
    },
    {
      title: "今日销量",
      dataIndex: "todaySales",
      key: "todaySales",
      width: 80,
      sorter: (a, b) => a.todaySales - b.todaySales,
      render: (val: number) => <span style={{ color: val > 0 ? "#52c41a" : "#999", fontWeight: val > 0 ? 500 : 400 }}>{val}</span>,
    },
    {
      title: "7天销量",
      dataIndex: "last7DaysSales",
      key: "last7DaysSales",
      width: 80,
      sorter: (a, b) => a.last7DaysSales - b.last7DaysSales,
      render: (val: number) => <span style={{ color: val > 0 ? "#52c41a" : "#999", fontWeight: val > 0 ? 500 : 400 }}>{val}</span>,
    },
    {
      title: "30天销量",
      dataIndex: "last30DaysSales",
      key: "last30DaysSales",
      width: 85,
      sorter: (a, b) => a.last30DaysSales - b.last30DaysSales,
      render: (val: number) => <span style={{ color: val > 0 ? "#52c41a" : "#999", fontWeight: val > 0 ? 500 : 400 }}>{val}</span>,
    },
    {
      title: "总销量",
      dataIndex: "totalSales",
      key: "totalSales",
      width: 80,
      sorter: (a, b) => a.totalSales - b.totalSales,
      render: (val: number) => <span style={{ color: val > 0 ? "#1890ff" : "#999", fontWeight: val > 0 ? 500 : 400 }}>{val}</span>,
    },
    {
      title: "仓库库存",
      dataIndex: "warehouseStock",
      key: "warehouseStock",
      width: 85,
      sorter: (a, b) => a.warehouseStock - b.warehouseStock,
      render: (val: number) => <span style={{ color: val > 0 ? "#1890ff" : "#ff4d4f", fontWeight: 500 }}>{val}</span>,
    },
    {
      title: "待收货",
      dataIndex: "waitReceiveNum",
      key: "waitReceiveNum",
      width: 75,
      render: (val: number) => <span style={{ color: val > 0 ? "#fa8c16" : "#999" }}>{val}</span>,
    },
    {
      title: "可售天数",
      dataIndex: "availableSaleDays",
      key: "availableSaleDays",
      width: 85,
      sorter: (a, b) => (a.availableSaleDays || 0) - (b.availableSaleDays || 0),
      render: (val: number | null) => {
        if (val == null) return <span style={{ color: "#999" }}>-</span>;
        const color = val <= 3 ? "#ff4d4f" : val <= 7 ? "#fa8c16" : "#52c41a";
        return <span style={{ color, fontWeight: 500 }}>{val.toFixed(1)}天</span>;
      },
    },
    {
      title: "建议备货",
      dataIndex: "adviceQuantity",
      key: "adviceQuantity",
      width: 85,
      render: (val: number) => <span style={{ color: val > 0 ? "#fa541c" : "#999", fontWeight: val > 0 ? 500 : 400 }}>{val || "-"}</span>,
    },
    {
      title: "备货配置",
      dataIndex: "purchaseConfig",
      key: "purchaseConfig",
      width: 90,
      render: (text: string) => <span style={{ fontSize: 12 }}>{text || "-"}</span>,
    },
    {
      title: "仓组",
      dataIndex: "warehouseGroup",
      key: "warehouseGroup",
      width: 110,
      ellipsis: true,
      render: (text: string) => <span style={{ fontSize: 12 }}>{text || "-"}</span>,
    },
    {
      title: "供货状态",
      dataIndex: "supplyStatus",
      key: "supplyStatus",
      width: 110,
      render: (status: string) => {
        if (!status) return "-";
        const colorMap: Record<string, string> = {
          "正常供货": "green",
          "暂时无法供货": "orange",
          "永久停止供货": "red",
        };
        return <Tag color={colorMap[status] || "default"}>{status}</Tag>;
      },
      filters: [
        { text: "正常供货", value: "正常供货" },
        { text: "暂时无法供货", value: "暂时无法供货" },
        { text: "永久停止供货", value: "永久停止供货" },
      ],
      onFilter: (value, record) => record.supplyStatus === value,
    },
    {
      title: "购物车",
      dataIndex: "inCartNumber",
      key: "inCartNumber",
      width: 75,
      sorter: (a, b) => a.inCartNumber - b.inCartNumber,
      render: (val: number) => <span style={{ color: val > 0 ? "#1890ff" : "#999" }}>{val}</span>,
    },
  ];

  const handleSync = async () => {
    if (!api) {
      notification.warning({ message: "自动化模块未连接", description: "请在 Electron 环境中运行" });
      return;
    }

    setLoading(true);
    notification.info({
      key: "sync-sales",
      message: "正在同步销售数据",
      description: "正在从 Temu 卖家后台 API 抓取销售管理数据...",
      duration: 0,
    });

    try {
      const result = await api.scrapeSales();
      const data = result.sales;
      const summaryData = data.summary || {};
      setSummary(summaryData);

      const parsed: SalesItem[] = (data.items || []).map((item: any, idx: number) => ({
        key: idx + 1,
        title: item._title || "",
        category: item._category || "",
        skcId: item._skcId || "",
        skuId: item._skuId || "",
        skuCode: item._skuCode || "",
        className: item._className || "",
        price: item._price || "",
        imageUrl: item._imageUrl || "",
        todaySales: item._todaySales || 0,
        last7DaysSales: item._last7DaysSales || 0,
        last30DaysSales: item._last30DaysSales || 0,
        totalSales: item._totalSales || 0,
        warehouseStock: item._warehouseStock || 0,
        waitReceiveNum: item._waitReceiveNum || 0,
        waitDeliveryNum: item._waitDeliveryNum || 0,
        availableSaleDays: item._availableSaleDays,
        adviceQuantity: item._adviceQuantity || 0,
        lackQuantity: item._lackQuantity || 0,
        purchaseConfig: item._purchaseConfig || "",
        warehouseGroup: item._warehouseGroup || "",
        stockStatus: item._stockStatus || "",
        supplyStatus: item._supplyStatus || "",
        hotTag: item._hotTag || "",
        isAdProduct: item._isAdProduct || "",
        productId: item._productId || "",
        inCartNumber: item._inCartNumber || 0,
        commentNum: item._commentNum || 0,
      }));

      setItems(parsed);
      store?.set("temu_sales", { summary: summaryData, items: parsed, syncedAt: new Date().toLocaleString() });

      notification.success({
        key: "sync-sales",
        message: "同步完成",
        description: `获取到 ${parsed.length} 条销售数据`,
      });
    } catch (error: any) {
      notification.error({
        key: "sync-sales",
        message: "同步失败",
        description: error?.message || "请确保已登录 Temu 卖家后台",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return (
      item.title.toLowerCase().includes(s) ||
      item.skcId.includes(s) ||
      item.skuId.includes(s) ||
      item.skuCode.toLowerCase().includes(s) ||
      item.className.toLowerCase().includes(s)
    );
  });

  if (hasAccount === false) {
    return (
      <Result
        icon={<ShopOutlined style={{ color: "#fa8c16" }} />}
        title="请先绑定店铺"
        subTitle="绑定 Temu 店铺账号后，即可同步销售数据"
        extra={
          <Button type="primary" onClick={() => navigate("/accounts")}>
            前往绑定店铺
          </Button>
        }
      />
    );
  }

  return (
    <div>
      {/* 汇总指标卡片 */}
      {summary && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Card size="small">
              <Statistic title="商品总数" value={items.length} prefix={<ShoppingCartOutlined />} valueStyle={{ color: "#1890ff" }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="售罄" value={summary.saleOutSkcNum || 0} prefix={<StopOutlined />} valueStyle={{ color: "#ff4d4f" }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="即将售罄" value={summary.soonSaleOutSkcNum || 0} prefix={<WarningOutlined />} valueStyle={{ color: "#fa8c16" }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="建议备货" value={summary.adviceStockSkcNum || 0} valueStyle={{ color: "#fa541c" }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="完全售罄" value={summary.completelySoldOutSkcNum || 0} valueStyle={{ color: "#999" }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="广告商品" value={summary.adSkcNum || 0} prefix={<FireOutlined />} valueStyle={{ color: "#722ed1" }} />
            </Card>
          </Col>
        </Row>
      )}

      {/* 工具栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索商品名称/SKC/SKU/货号"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 320 }}
            allowClear
          />
          <Button
            type="primary"
            icon={<SyncOutlined spin={loading} />}
            onClick={handleSync}
            loading={loading}
          >
            同步销售数据
          </Button>
          {items.length > 0 && (
            <span style={{ color: "#999", fontSize: 13 }}>
              共 {items.length} 条数据
            </span>
          )}
          {filteredItems.length > 0 && filteredItems.length !== items.length && (
            <span style={{ color: "#999", fontSize: 13 }}>
              显示 {filteredItems.length} / {items.length} 条
            </span>
          )}
        </Space>
      </Card>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={filteredItems}
        rowKey="key"
        loading={loading}
        pagination={{
          pageSize: 20,
          showTotal: (total) => `共 ${total} 条`,
          showSizeChanger: true,
          pageSizeOptions: ["20", "50", "100"],
        }}
        locale={{ emptyText: "暂无销售数据，请先登录后点击「同步销售数据」" }}
        scroll={{ x: 2200 }}
        size="small"
      />
    </div>
  );
}
