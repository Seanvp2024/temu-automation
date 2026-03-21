import { Card, Row, Col, Empty } from "antd";

export default function Analytics() {
  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="销售趋势">
            <Empty description="同步数据后可查看图表" />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="商品排行">
            <Empty description="同步数据后可查看图表" />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="订单分布">
            <Empty description="同步数据后可查看图表" />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="流量分析">
            <Empty description="同步数据后可查看图表" />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
