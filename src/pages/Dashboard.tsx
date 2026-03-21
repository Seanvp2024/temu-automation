import { Card, Col, Row, Statistic, Empty, Typography } from "antd";
import {
  ShoppingOutlined,
  OrderedListOutlined,
  DollarOutlined,
  RiseOutlined,
} from "@ant-design/icons";

const { Paragraph } = Typography;

export default function Dashboard() {
  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic
              title="在售商品"
              value={0}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: "#f56a00" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日订单"
              value={0}
              prefix={<OrderedListOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日销售额"
              value={0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="转化率"
              value={0}
              prefix={<RiseOutlined />}
              suffix="%"
              precision={1}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }} title="快速开始">
        <Empty
          description={
            <div>
              <Paragraph>欢迎使用 Temu 自动化运营工具</Paragraph>
              <Paragraph type="secondary">
                请先前往「账号管理」添加您的 Temu 卖家账号，然后开始同步数据
              </Paragraph>
            </div>
          }
        />
      </Card>
    </div>
  );
}
