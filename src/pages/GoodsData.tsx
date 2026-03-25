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
  DollarOutlined,
  RiseOutlined,
  WarningOutlined,
  ShoppingOutlined,
} from "@ant-design/icons";

const { Paragraph, Title } = Typography;
const api = window.electronAPI?.automation;
const store = window.electronAPI?.store;

export default function GoodsData() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [lastSync, setLastSync] = useState("");

  useEffect(() => {
    store?.get("temu_goods_data").then((d: any) => {
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
      const res = await api.scrapeGoodsData();
      const d = (res as any)?.goodsData || res;
      const syncedAt = new Date().toLocaleString("zh-CN");
      await store?.set("temu_goods_data", { ...d, syncedAt });
      setData(d);
      setLastSync(syncedAt);
      message.success("商品数据同步成功!");
    } catch (e: any) {
      message.error("同步失败: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const hp = data?.highPriceStats;
  const sales = data?.skcSalesData || [];

  const columns = [
    {
      title: "商品",
      key: "product",
      width: 300,
      render: (_: any, record: any) => {
        const info = record.productSkcBasicInfoVO || {};
        return (
          <Space>
            {info.productSkcPicture && (
              <Image src={info.productSkcPicture} width={50} height={50} style={{ objectFit: "cover", borderRadius: 4 }} />
            )}
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{info.productName?.substring(0, 40)}</div>
              <div style={{ fontSize: 11, color: "#999" }}>{info.category} | SKC: {info.productSkcId}</div>
            </div>
          </Space>
        );
      },
    },
    {
      title: "7日销量",
      dataIndex: ["salesDataVO", "sevenDaysSalesVolume"],
      key: "7d",
      sorter: (a: any, b: any) => (a.salesDataVO?.sevenDaysSalesVolume || 0) - (b.salesDataVO?.sevenDaysSalesVolume || 0),
      render: (v: number) => <span style={{ fontWeight: 600, color: v > 0 ? "#52c41a" : "#999" }}>{v || 0}</span>,
    },
    {
      title: "30日销量",
      dataIndex: ["salesDataVO", "thirtyDaysSalesVolume"],
      key: "30d",
      sorter: (a: any, b: any) => (a.salesDataVO?.thirtyDaysSalesVolume || 0) - (b.salesDataVO?.thirtyDaysSalesVolume || 0),
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v || 0}</span>,
    },
    {
      title: "GMV",
      dataIndex: ["salesDataVO", "sevenDaysGmv"],
      key: "gmv",
      render: (v: number) => v ? `¥${(v / 100).toFixed(2)}` : "-",
    },
    {
      title: "状态",
      dataIndex: ["productSkcBasicInfoVO", "selectStatus"],
      key: "status",
      render: (v: number) => {
        const map: Record<number, { text: string; color: string }> = {
          0: { text: "未选", color: "default" },
          1: { text: "在售", color: "green" },
          2: { text: "已下架", color: "red" },
        };
        const s = map[v] || { text: String(v), color: "default" };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
  ];

  return (
    <Spin spinning={loading} tip="正在同步商品数据...">
      <div>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              <ShoppingOutlined /> 商品数据中心
            </Title>
          </Col>
          <Col>
            <Space>
              {lastSync && <span style={{ color: "#999", fontSize: 12 }}>上次同步: {lastSync}</span>}
              <Button type="primary" icon={<SyncOutlined />} onClick={handleSync} loading={loading}>
                同步商品数据
              </Button>
            </Space>
          </Col>
        </Row>

        {hp && (
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card>
                <Statistic title="高价限制商品" value={hp.highPriceLimitNumber || 0} prefix={<WarningOutlined />} valueStyle={{ color: "#fa8c16" }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="已解除高价限制" value={hp.relieveHighPriceLimitNumber || 0} prefix={<DollarOutlined />} valueStyle={{ color: "#52c41a" }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="流量增长商品" value={hp.flowGrowthNumber || 0} prefix={<RiseOutlined />} valueStyle={{ color: "#1890ff" }} />
              </Card>
            </Col>
          </Row>
        )}

        <Card title={`SKC 销售数据 (${sales.length} 条)`}>
          {sales.length > 0 ? (
            <Table
              dataSource={sales.map((item: any, idx: number) => ({ key: idx, ...item }))}
              columns={columns}
              pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
              size="small"
              scroll={{ x: 800 }}
            />
          ) : (
            <Paragraph type="secondary">暂无数据，请先同步</Paragraph>
          )}
        </Card>
      </div>
    </Spin>
  );
}
