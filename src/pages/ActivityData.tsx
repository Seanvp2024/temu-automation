import { useState, useEffect } from "react";
import {
  Card,
  Col,
  Row,
  Statistic,
  Typography,
  Button,
  Space,
  Table,
  message,
  Spin,
  Tag,
  Image,
} from "antd";
import {
  SyncOutlined,
  FireOutlined,
  RiseOutlined,
  FallOutlined,
  ShoppingCartOutlined,
  EyeOutlined,
  TeamOutlined,
} from "@ant-design/icons";

const { Paragraph, Title, Text } = Typography;
const api = window.electronAPI?.automation;
const store = window.electronAPI?.store;

export default function ActivityData() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [lastSync, setLastSync] = useState("");

  useEffect(() => {
    store?.get("temu_activity_data").then((d: any) => {
      if (d) {
        setData(d);
        if (d.syncedAt) setLastSync(d.syncedAt);
      }
    });
  }, []);

  const handleSync = async () => {
    if (!api) { message.error("API 不可用"); return; }
    setLoading(true);
    try {
      const res = await api.scrapeActivity();
      const d = (res as any)?.activity || res;
      const syncedAt = new Date().toLocaleString("zh-CN");
      await store?.set("temu_activity_data", { ...d, syncedAt });
      setData(d);
      setLastSync(syncedAt);
      message.success("活动数据同步成功!");
    } catch (e: any) {
      message.error("同步失败: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const themes = data?.themes || [];
  const trend = data?.marketTrend?.trendVOList || [];
  const goods = data?.goodsDetail?.list || [];
  const monitor = data?.marketMonitor;

  const renderRatio = (v: number | null | undefined) => {
    if (v === null || v === undefined) return "-";
    const pct = (v * 100).toFixed(1);
    return (
      <span style={{ color: v > 0 ? "#52c41a" : v < 0 ? "#ff4d4f" : "#999" }}>
        {v > 0 ? <RiseOutlined /> : v < 0 ? <FallOutlined /> : null} {pct}%
      </span>
    );
  };

  const trendColumns = [
    { title: "日期", dataIndex: "statDate", key: "date" },
    { title: "活动商品数", dataIndex: "activityGoodsQuantity", key: "goods" },
    {
      title: "活动交易额(CNY)", dataIndex: "activityTransactionAmount", key: "amount",
      render: (v: number) => <span style={{ fontWeight: 600, color: "#52c41a" }}>¥{v?.toFixed(2)}</span>,
    },
    { title: "活动销量", dataIndex: "activitySales", key: "sales" },
    { title: "活动商品访客", dataIndex: "activityGoodsVisitorsNum", key: "visitors" },
    {
      title: "点击转化率", dataIndex: "visitorsClickConversionRate", key: "clickRate",
      render: (v: number) => v ? `${(v * 100).toFixed(2)}%` : "-",
    },
    {
      title: "支付转化率", dataIndex: "visitorsPayConversionRate", key: "payRate",
      render: (v: number) => v ? `${(v * 100).toFixed(2)}%` : "-",
    },
  ];

  const goodsColumns = [
    {
      title: "商品", key: "product", width: 300,
      render: (_: any, record: any) => (
        <Space>
          {record.goodsImageUrl && (
            <Image src={record.goodsImageUrl} width={40} height={40} style={{ borderRadius: 4, objectFit: "cover" }} />
          )}
          <div>
            <div style={{ fontSize: 12 }}>{record.goodsName?.substring(0, 35)}</div>
            <div style={{ fontSize: 11, color: "#999" }}>SPU: {record.spuId}</div>
          </div>
        </Space>
      ),
    },
    {
      title: "交易额(CNY)", dataIndex: "activityTransactionAmount", key: "amount",
      sorter: (a: any, b: any) => (a.activityTransactionAmount || 0) - (b.activityTransactionAmount || 0),
      render: (v: number) => <span style={{ fontWeight: 600, color: "#52c41a" }}>¥{v?.toFixed(2)}</span>,
    },
    {
      title: "销量", dataIndex: "activitySales", key: "sales",
      sorter: (a: any, b: any) => (a.activitySales || 0) - (b.activitySales || 0),
    },
    { title: "访客数", dataIndex: "activityGoodsVisitorsNum", key: "visitors" },
    {
      title: "点击转化率", dataIndex: "visitorsClickConversionRate", key: "cr",
      render: (v: number) => v ? `${(v * 100).toFixed(2)}%` : "-",
    },
  ];

  return (
    <Spin spinning={loading} tip="正在同步活动数据...">
      <div>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              <FireOutlined /> 活动数据
            </Title>
          </Col>
          <Col>
            <Space>
              {lastSync && <span style={{ color: "#999", fontSize: 12 }}>上次同步: {lastSync}</span>}
              <Button type="primary" icon={<SyncOutlined />} onClick={handleSync} loading={loading}>
                同步活动数据
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 市场监控概览 */}
        {monitor && (
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small">
                <Statistic title="日均活动商品数" value={monitor.dailyAvgGoodsQuantity || 0} prefix={<ShoppingCartOutlined />} />
                <div style={{ marginTop: 4 }}>{renderRatio(monitor.dailyAvgGoodsQuantityLinkRelativeRatio)}</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="活动交易额" value={monitor.activityTransactionAmount || 0} prefix="¥" valueStyle={{ color: "#52c41a" }} />
                <div style={{ marginTop: 4 }}>{renderRatio(monitor.activityTransactionAmountLinkRelativeRatio)}</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="活动销量" value={monitor.activitySales || 0} prefix={<RiseOutlined />} />
                <div style={{ marginTop: 4 }}>{renderRatio(monitor.activitySalesLinkRelativeRatio)}</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="活动商品访客" value={monitor.activityGoodsVisitorsNum || 0} prefix={<EyeOutlined />} />
                <div style={{ marginTop: 4 }}>{renderRatio(monitor.activityGoodsVisitorsNumLinkRelativeRatio)}</div>
              </Card>
            </Col>
          </Row>
        )}

        {/* 活动主题 */}
        {themes.length > 0 && (
          <Card title={`当前活动主题 (${themes.length})`} style={{ marginBottom: 16 }} size="small">
            <Space wrap>
              {themes.map((t: any, i: number) => {
                const now = Date.now();
                const active = now >= t.beginTime && now <= t.endTime;
                const endDate = new Date(t.endTime).toLocaleDateString("zh-CN");
                return (
                  <Tag key={i} color={active ? "blue" : "default"} style={{ padding: "4px 8px", fontSize: 12 }}>
                    {t.themeName?.substring(0, 30)} (截止 {endDate})
                  </Tag>
                );
              })}
            </Space>
          </Card>
        )}

        {/* 市场趋势 */}
        {trend.length > 0 && (
          <Card title="市场趋势" style={{ marginBottom: 16 }}>
            <Table
              dataSource={trend.map((item: any, idx: number) => ({ key: idx, ...item }))}
              columns={trendColumns}
              pagination={false}
              size="small"
            />
          </Card>
        )}

        {/* 商品活动详情 */}
        <Card title={`活动商品详情 (${goods.length} 个)`}>
          {goods.length > 0 ? (
            <Table
              dataSource={goods.map((item: any, idx: number) => ({ key: idx, ...item }))}
              columns={goodsColumns}
              pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
              size="small"
            />
          ) : (
            <Paragraph type="secondary">暂无活动商品数据，请先同步</Paragraph>
          )}
        </Card>
      </div>
    </Spin>
  );
}
