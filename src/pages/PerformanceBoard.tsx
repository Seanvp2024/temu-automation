import { useState, useEffect } from "react";
import {
  Card,
  Col,
  Row,
  Statistic,
  Typography,
  Button,
  Space,
  message,
  Spin,
  Tag,
  Descriptions,
  Progress,
} from "antd";
import {
  SyncOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CarOutlined,
} from "@ant-design/icons";

const { Paragraph, Title, Text } = Typography;
const api = window.electronAPI?.automation;
const store = window.electronAPI?.store;

export default function PerformanceBoard() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [lastSync, setLastSync] = useState("");

  useEffect(() => {
    store?.get("temu_performance").then((d: any) => {
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
      const res = await api.scrapePerformance();
      const d = (res as any)?.performance || res;
      const syncedAt = new Date().toLocaleString("zh-CN");
      await store?.set("temu_performance", { ...d, syncedAt });
      setData(d);
      setLastSync(syncedAt);
      message.success("履约数据同步成功!");
    } catch (e: any) {
      message.error("同步失败: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const purchase = data?.purchasePerformance;
  const stock = data?.getStockPerformance;
  const time = data?.platformTimePerformance;

  const abs = purchase?.abstractInfo;

  const renderRate = (val: number | null | undefined, suffix = "%") => {
    if (val === null || val === undefined) return <Text type="secondary">-</Text>;
    const pct = typeof val === "number" ? (val * 100).toFixed(1) : val;
    return <span style={{ fontWeight: 600 }}>{pct}{suffix}</span>;
  };

  const renderDayOnDay = (val: number | null | undefined) => {
    if (val === null || val === undefined) return <Text type="secondary">-</Text>;
    const pct = (val * 100).toFixed(1);
    const color = val > 0 ? "#52c41a" : val < 0 ? "#ff4d4f" : "#999";
    return <span style={{ color }}>{val > 0 ? "+" : ""}{pct}%</span>;
  };

  const getScoreZone = (score: number) => {
    if (!abs) return { text: "未知", color: "default" };
    if (score >= abs.excellentZoneStart) return { text: "优秀", color: "green" };
    if (score >= abs.wellZoneStart) return { text: "良好", color: "blue" };
    if (score >= abs.ordinaryZoneStart) return { text: "一般", color: "orange" };
    return { text: "待改善", color: "red" };
  };

  return (
    <Spin spinning={loading} tip="正在同步履约数据...">
      <div>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              <TrophyOutlined /> 履约看板
            </Title>
          </Col>
          <Col>
            <Space>
              {lastSync && <span style={{ color: "#999", fontSize: 12 }}>上次同步: {lastSync}</span>}
              <Button type="primary" icon={<SyncOutlined />} onClick={handleSync} loading={loading}>
                同步履约数据
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 综合评分 */}
        {abs && (
          <Card title="备货绩效评分" style={{ marginBottom: 16 }}>
            <Row gutter={[24, 16]} align="middle">
              <Col span={8} style={{ textAlign: "center" }}>
                <Progress
                  type="circle"
                  percent={abs.supplierAvgScore || 0}
                  format={(p) => {
                    const zone = getScoreZone(p || 0);
                    return (
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>{p?.toFixed(1)}</div>
                        <Tag color={zone.color}>{zone.text}</Tag>
                      </div>
                    );
                  }}
                  size={120}
                  strokeColor={abs.supplierAvgScore >= 95 ? "#52c41a" : abs.supplierAvgScore >= 80 ? "#1890ff" : "#ff4d4f"}
                />
                <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600 }}>供应商综合评分</div>
              </Col>
              <Col span={16}>
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="优秀区间">{abs.excellentZoneStart} - {abs.excellentZoneEnd}</Descriptions.Item>
                  <Descriptions.Item label="良好区间">{abs.wellZoneStart} - {abs.wellZoneEnd}</Descriptions.Item>
                  <Descriptions.Item label="一般区间">{abs.ordinaryZoneStart} - {abs.ordinaryZoneEnd}</Descriptions.Item>
                  <Descriptions.Item label="待改善区间">{abs.badZoneStart} - {abs.badZoneEnd}</Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
          </Card>
        )}

        {/* 到仓绩效 */}
        {stock && (
          <Card
            title={<span><CarOutlined /> 到仓绩效</span>}
            style={{ marginBottom: 16 }}
            extra={
              stock.calDateZoneTimeStampBegin && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(stock.calDateZoneTimeStampBegin).toLocaleDateString("zh-CN")} ~{" "}
                  {new Date(stock.calDateZoneTimeStampEnd).toLocaleDateString("zh-CN")}
                </Text>
              )
            }
          >
            <Row gutter={[16, 16]}>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="5日到仓率" value={stock.in5dGetStockRate !== null ? (stock.in5dGetStockRate * 100).toFixed(1) : "-"} suffix="%" />
                  <div style={{ marginTop: 4 }}>环比: {renderDayOnDay(stock.prePositionYardIn5dGetStockRate)}</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="首次到仓时间(h)" value={stock.firstGetStockTime !== null ? stock.firstGetStockTime : "-"} />
                  <div style={{ marginTop: 4 }}>环比: {renderDayOnDay(stock.dayOnDayFirstGetStockTimeRate)}</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="平均到仓时间(h)" value={stock.avgGetStockTime !== null ? stock.avgGetStockTime : "-"} />
                  <div style={{ marginTop: 4 }}>环比: {renderDayOnDay(stock.dayOnDayAvgGetStockTimeRate)}</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="到仓完成率" value={stock.getStockFinishRate !== null ? (stock.getStockFinishRate * 100).toFixed(1) : "-"} suffix="%" />
                  <div style={{ marginTop: 4 }}>环比: {renderDayOnDay(stock.dayOnDayGetStockFinishRate)}</div>
                </Card>
              </Col>
            </Row>
          </Card>
        )}

        {/* 备货时效 */}
        {time && (
          <Card title={<span><ClockCircleOutlined /> 备货时效</span>} style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="二次备货次数" value={time.joinPlatformTwicePurchaseCount || 0} />
                  <div style={{ marginTop: 4 }}>环比: {renderDayOnDay(time.dayOnDayJoinPlatformTwicePurchaseRate)}</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="创建发货单耗时(h)" value={time.createDeliveryOrderCostAvgTime || 0} />
                  <div style={{ marginTop: 4 }}>环比: {renderDayOnDay(time.dayOnDayCreateDeliveryOrderCostAvgTimeRate)}</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="绑定快递耗时(h)" value={time.bindExpressCostAvgTime || 0} />
                  <div style={{ marginTop: 4 }}>环比: {renderDayOnDay(time.dayOnDayBindExpressCostAvgTimeRate)}</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="揽收到仓耗时(h)" value={time.collectExpressCostAvgTime || 0} />
                  <div style={{ marginTop: 4 }}>环比: {renderDayOnDay(time.dayOnDayCollectExpressCostAvgTimeRate)}</div>
                </Card>
              </Col>
            </Row>
          </Card>
        )}

        {!purchase && !stock && !time && (
          <Card>
            <Paragraph type="secondary">暂无履约数据，请先点击同步按钮获取</Paragraph>
          </Card>
        )}
      </div>
    </Spin>
  );
}
