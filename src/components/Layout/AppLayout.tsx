import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Layout, Menu, Typography, Badge } from "antd";
import {
  DashboardOutlined,
  UserOutlined,
  ShoppingOutlined,
  OrderedListOutlined,
  BarChartOutlined,
  ScheduleOutlined,
  SettingOutlined,
  RocketOutlined,
  FundOutlined,
} from "@ant-design/icons";

const { Sider, Content, Header } = Layout;
const { Title } = Typography;

const menuItems = [
  {
    key: "/dashboard",
    icon: <DashboardOutlined />,
    label: "工作台",
  },
  {
    key: "/accounts",
    icon: <UserOutlined />,
    label: "账号管理",
  },
  {
    key: "/products",
    icon: <ShoppingOutlined />,
    label: "商品管理",
  },
  {
    key: "/sales",
    icon: <FundOutlined />,
    label: "销售管理",
  },
  {
    key: "/orders",
    icon: <OrderedListOutlined />,
    label: "订单管理",
  },
  {
    key: "/analytics",
    icon: <BarChartOutlined />,
    label: "数据分析",
  },
  {
    key: "/tasks",
    icon: <ScheduleOutlined />,
    label: "任务管理",
  },
  {
    key: "/settings",
    icon: <SettingOutlined />,
    label: "设置",
  },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        style={{
          borderRight: "1px solid #f0f0f0",
        }}
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <RocketOutlined
            style={{ fontSize: 24, color: "#f56a00", marginRight: collapsed ? 0 : 8 }}
          />
          {!collapsed && (
            <Title level={5} style={{ margin: 0, color: "#f56a00" }}>
              Temu 运营助手
            </Title>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            {menuItems.find((item) => item.key === location.pathname)?.label || "工作台"}
          </Title>
          <Badge status="default" text="未连接" />
        </Header>
        <Content
          style={{
            margin: 16,
            padding: 24,
            background: "#fff",
            borderRadius: 8,
            overflow: "auto",
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
