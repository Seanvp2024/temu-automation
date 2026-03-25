import { useState, useEffect } from "react";
import { Table, Button, Space, Card, Row, Col, Statistic, notification, Tag, Input, Image, Result } from "antd";
import { SyncOutlined, SearchOutlined, ShopOutlined, EyeOutlined, ShoppingCartOutlined, UserOutlined, RiseOutlined, FallOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import { parseFluxData } from "../utils/parseRawApis";

interface FluxItem {
  key: number;
  goodsId: string;
  goodsName: string;
  imageUrl: string;
  spuId: string;
  category: string;
  categoryPath: string;
  exposeNum: number;
  exposeNumChange: number | null;
  clickNum: number;
  clickNumChange: number | null;
  detailVisitNum: number;
  detailVisitorNum: number;
  addToCartUserNum: number;
  collectUserNum: number;
  payGoodsNum: number;
  payOrderNum: number;
  buyerNum: number;
  searchExposeNum: number;
  searchClickNum: number;
  recommendExposeNum: number;
  recommendClickNum: number;
  clickPayRate: number;
  exposeClickRate: number;
  growDataText: string;
}

interface MallSummary {
  todayVisitors: number;
  todayBuyers: number;
  todayConversionRate: number;
  updateTime: string;
  trendList: Array<{ date: string; visitors: number; buyers: number; conversionRate: number }>;
}

export default function Analytics() {
  const [items, setItems] = useState<FluxItem[]>([]);
  const [summary, setSummary] = useState<MallSummary | null>(null);
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
    store?.get("temu_flux").then((raw: any) => {
      const data = parseFluxData(raw);
      if (data) {
        setSummary(data.summary || null);
        setItems(data.items || []);
      }
    });
  }, []);

  const renderChange = (val: number | null) => {
    if (val == null) return <span style={{ color: "#999" }}>-</span>;
    const pct = (val * 100).toFixed(1) + "%";
    if (val > 0) return <span style={{ color: "#52c41a", fontSize: 11 }}><RiseOutlined /> {pct}</span>;
    if (val < 0) return <span style={{ color: "#ff4d4f", fontSize: 11 }}><FallOutlined /> {pct}</span>;
    return <span style={{ color: "#999", fontSize: 11 }}>0%</span>;
  };

  const columns: ColumnsType<FluxItem> = [
    {
      title: "商品图片",
      dataIndex: "imageUrl",
      key: "imageUrl",
      width: 55,
      render: (url: string) =>
        url ? <Image src={url} width={42} height={42} style={{ objectFit: "cover", borderRadius: 4 }} fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" />
          : <div style={{ width: 42, height: 42, background: "#f0f0f0", borderRadius: 4 }} />,
    },
    {
      title: "商品信息",
      dataIndex: "goodsName",
      key: "goodsName",
      width: 260,
      ellipsis: true,
      fixed: "left",
      render: (text: string, record: FluxItem) => (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 2 }}>{text || "-"}</div>
          <div style={{ fontSize: 11, color: "#999" }}>
            SPU: {record.spuId}
            {record.category && <span> | {record.category}</span>}
          </div>
        </div>
      ),
    },
    {
      title: "曝光量",
      dataIndex: "exposeNum",
      key: "exposeNum",
      width: 100,
      sorter: (a, b) => a.exposeNum - b.exposeNum,
      render: (val: number, record: FluxItem) => (
        <div>
          <div style={{ fontWeight: 500, color: "#1890ff" }}>{val.toLocaleString()}</div>
          {renderChange(record.exposeNumChange)}
        </div>
      ),
    },
    {
      title: "点击量",
      dataIndex: "clickNum",
      key: "clickNum",
      width: 90,
      sorter: (a, b) => a.clickNum - b.clickNum,
      render: (val: number, record: FluxItem) => (
        <div>
          <div style={{ fontWeight: 500 }}>{val}</div>
          {renderChange(record.clickNumChange)}
        </div>
      ),
    },
    {
      title: "详情访问",
      dataIndex: "detailVisitorNum",
      key: "detailVisitorNum",
      width: 85,
      sorter: (a, b) => a.detailVisitorNum - b.detailVisitorNum,
      render: (val: number) => <span style={{ color: val > 0 ? "#1890ff" : "#999" }}>{val}</span>,
    },
    {
      title: "加购人数",
      dataIndex: "addToCartUserNum",
      key: "addToCartUserNum",
      width: 85,
      sorter: (a, b) => a.addToCartUserNum - b.addToCartUserNum,
      render: (val: number) => <span style={{ color: val > 0 ? "#fa8c16" : "#999", fontWeight: val > 0 ? 500 : 400 }}>{val}</span>,
    },
    {
      title: "支付件数",
      dataIndex: "payGoodsNum",
      key: "payGoodsNum",
      width: 85,
      sorter: (a, b) => a.payGoodsNum - b.payGoodsNum,
      render: (val: number) => <span style={{ color: val > 0 ? "#52c41a" : "#999", fontWeight: val > 0 ? 500 : 400 }}>{val}</span>,
    },
    {
      title: "买家数",
      dataIndex: "buyerNum",
      key: "buyerNum",
      width: 75,
      sorter: (a, b) => a.buyerNum - b.buyerNum,
      render: (val: number) => <span style={{ color: val > 0 ? "#52c41a" : "#999", fontWeight: val > 0 ? 500 : 400 }}>{val}</span>,
    },
    {
      title: "点击转化率",
      dataIndex: "exposeClickRate",
      key: "exposeClickRate",
      width: 95,
      sorter: (a, b) => a.exposeClickRate - b.exposeClickRate,
      render: (val: number) => <span style={{ color: val > 0.05 ? "#52c41a" : val > 0.02 ? "#fa8c16" : "#999" }}>{(val * 100).toFixed(2)}%</span>,
    },
    {
      title: "支付转化率",
      dataIndex: "clickPayRate",
      key: "clickPayRate",
      width: 95,
      sorter: (a, b) => a.clickPayRate - b.clickPayRate,
      render: (val: number) => <span style={{ color: val > 0.03 ? "#52c41a" : val > 0 ? "#fa8c16" : "#999" }}>{(val * 100).toFixed(2)}%</span>,
    },
    {
      title: "搜索曝光",
      dataIndex: "searchExposeNum",
      key: "searchExposeNum",
      width: 85,
      sorter: (a, b) => a.searchExposeNum - b.searchExposeNum,
      render: (val: number) => <span style={{ fontSize: 12 }}>{val}</span>,
    },
    {
      title: "推荐曝光",
      dataIndex: "recommendExposeNum",
      key: "recommendExposeNum",
      width: 85,
      sorter: (a, b) => a.recommendExposeNum - b.recommendExposeNum,
      render: (val: number) => <span style={{ fontSize: 12 }}>{val}</span>,
    },
    {
      title: "增长潜力",
      dataIndex: "growDataText",
      key: "growDataText",
      width: 85,
      render: (text: string) => {
        if (!text) return "-";
        return <Tag color="blue">{text}</Tag>;
      },
    },
  ];

  const handleSync = async () => {
    if (!api) {
      notification.warning({ message: "自动化模块未连接", description: "请在 Electron 环境中运行" });
      return;
    }

    setLoading(true);
    notification.info({
      key: "sync-flux",
      message: "正在同步流量数据",
      description: "正在从 Temu 卖家后台 API 抓取商品流量数据...",
      duration: 0,
    });

    try {
      const result = await api.scrapeFlux();
      const data = result.flux;

      const mallSummary = data.mallSummary || null;
      setSummary(mallSummary);

      const parsed: FluxItem[] = (data.goods || []).map((item: any, idx: number) => ({
        key: idx + 1,
        goodsId: item._goodsId || "",
        goodsName: item._goodsName || "",
        imageUrl: item._imageUrl || "",
        spuId: item._spuId || "",
        category: item._category || "",
        categoryPath: item._categoryPath || "",
        exposeNum: item._exposeNum || 0,
        exposeNumChange: item._exposeNumChange,
        clickNum: item._clickNum || 0,
        clickNumChange: item._clickNumChange,
        detailVisitNum: item._detailVisitNum || 0,
        detailVisitorNum: item._detailVisitorNum || 0,
        addToCartUserNum: item._addToCartUserNum || 0,
        collectUserNum: item._collectUserNum || 0,
        payGoodsNum: item._payGoodsNum || 0,
        payOrderNum: item._payOrderNum || 0,
        buyerNum: item._buyerNum || 0,
        searchExposeNum: item._searchExposeNum || 0,
        searchClickNum: item._searchClickNum || 0,
        recommendExposeNum: item._recommendExposeNum || 0,
        recommendClickNum: item._recommendClickNum || 0,
        clickPayRate: item._clickPayRate || 0,
        exposeClickRate: item._exposeClickRate || 0,
        growDataText: item._growDataText || "",
      }));

      setItems(parsed);
      store?.set("temu_flux", { summary: mallSummary, items: parsed, syncedAt: new Date().toLocaleString() });

      notification.success({
        key: "sync-flux",
        message: "同步完成",
        description: `获取到 ${parsed.length} 条商品流量数据`,
      });
    } catch (error: any) {
      notification.error({
        key: "sync-flux",
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
      item.goodsName.toLowerCase().includes(s) ||
      item.spuId.includes(s) ||
      item.goodsId.includes(s) ||
      item.category.toLowerCase().includes(s)
    );
  });

  // 计算汇总
  const totalExpose = items.reduce((s, i) => s + i.exposeNum, 0);
  const totalClick = items.reduce((s, i) => s + i.clickNum, 0);
  const totalPay = items.reduce((s, i) => s + i.payGoodsNum, 0);
  const totalBuyers = items.reduce((s, i) => s + i.buyerNum, 0);

  if (hasAccount === false) {
    return (
      <Result
        icon={<ShopOutlined style={{ color: "#fa8c16" }} />}
        title="请先绑定店铺"
        subTitle="绑定 Temu 店铺账号后，即可同步流量数据"
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
      {/* 店铺汇总 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic title="今日访客" value={summary?.todayVisitors || 0} prefix={<UserOutlined />} valueStyle={{ color: "#1890ff" }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="今日买家" value={summary?.todayBuyers || 0} prefix={<ShoppingCartOutlined />} valueStyle={{ color: "#52c41a" }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="今日转化率" value={(summary?.todayConversionRate || 0) * 100} suffix="%" precision={2} valueStyle={{ color: "#fa541c" }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="昨日总曝光" value={totalExpose} prefix={<EyeOutlined />} valueStyle={{ color: "#1890ff", fontSize: 20 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="昨日总点击" value={totalClick} valueStyle={{ color: "#fa8c16", fontSize: 20 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="昨日支付件数" value={totalPay} valueStyle={{ color: "#52c41a", fontSize: 20 }} />
          </Card>
        </Col>
      </Row>

      {/* 工具栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索商品名称/SPU/类目"
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
            同步流量数据
          </Button>
          {items.length > 0 && (
            <span style={{ color: "#999", fontSize: 13 }}>
              共 {items.length} 条数据
              {summary?.updateTime && <span> | 更新时间：{summary.updateTime}</span>}
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
        locale={{ emptyText: "暂无流量数据，请先点击「同步流量数据」" }}
        scroll={{ x: 1800 }}
        size="small"
      />
    </div>
  );
}
