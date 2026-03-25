import { useState, useEffect } from "react";
import { Table, Button, Tag, Space, Card, Input, notification, Result, Row, Col, Statistic } from "antd";
import { SyncOutlined, SearchOutlined, ExportOutlined, ShopOutlined, ShoppingCartOutlined, InboxOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import { parseOrdersData } from "../utils/parseRawApis";

interface PurchaseOrder {
  key: number;
  type: string;
  purchaseOrderNo: string;
  parentOrderNo: string;
  title: string;
  skcId: string;
  skuId: string;
  skuCode: string;
  attributes: string;
  quantity: number;
  status: string;
  amount: string;
  orderTime: string;
  warehouse: string;
  sellableDays: string;
  suggestDays: string;
  urgencyInfo: string;
  requiredShipTime: string;
  [key: string]: any;
}

export default function OrderList() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
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
    // 从本地恢复数据
    store?.get("temu_orders").then((raw: any) => {
      const data = parseOrdersData(raw);
      if (data && Array.isArray(data) && data.length > 0) {
        setOrders(data);
      }
    });
  }, []);

  const columns: ColumnsType<PurchaseOrder> = [
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 110,
      fixed: "left",
      render: (text: string) => {
        if (!text) return "-";
        const color = text.includes("紧急") ? "red" : "blue";
        return <Tag color={color}>{text}</Tag>;
      },
      filters: [
        { text: "紧急备货建议", value: "紧急备货建议" },
        { text: "普通备货建议", value: "普通备货建议" },
      ],
      onFilter: (value, record) => record.type === value,
    },
    {
      title: "备货单号",
      dataIndex: "purchaseOrderNo",
      key: "purchaseOrderNo",
      width: 160,
      render: (text: string) => <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 500 }}>{text || "-"}</span>,
    },
    {
      title: "商品名称",
      dataIndex: "title",
      key: "title",
      width: 280,
      ellipsis: true,
      render: (text: string, record: PurchaseOrder) => (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 2 }}>{text || "-"}</div>
          {record.attributes && (
            <div style={{ fontSize: 11, color: "#999" }}>属性：{record.attributes}</div>
          )}
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
      title: "SKU ID",
      dataIndex: "skuId",
      key: "skuId",
      width: 120,
      render: (text: string) => <span style={{ fontSize: 12, fontFamily: "monospace" }}>{text || "-"}</span>,
    },
    {
      title: "货号",
      dataIndex: "skuCode",
      key: "skuCode",
      width: 110,
      render: (text: string) => <span style={{ fontSize: 12 }}>{text || "-"}</span>,
    },
    {
      title: "申报价格",
      dataIndex: "amount",
      key: "amount",
      width: 90,
      render: (text: string) => <span style={{ color: "#fa541c", fontWeight: 500 }}>{text || "-"}</span>,
    },
    {
      title: "备货件数",
      dataIndex: "quantity",
      key: "quantity",
      width: 80,
      render: (val: number) => <span style={{ color: val > 0 ? "#1890ff" : "#999", fontWeight: 500 }}>{val || "-"}</span>,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 80,
      render: (status: string) => {
        if (!status) return <span style={{ color: "#999" }}>-</span>;
        const colorMap: Record<string, string> = { "待发货": "orange", "已发货": "blue", "已完成": "green", "已取消": "default" };
        return <Tag color={colorMap[status] || "default"}>{status}</Tag>;
      },
    },
    {
      title: "紧迫程度",
      dataIndex: "urgencyInfo",
      key: "urgencyInfo",
      width: 100,
      render: (text: string) => {
        if (!text) return "-";
        const color = text.includes("逾期") || text.includes("超时") ? "red" : "orange";
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: "可售/建议备货",
      key: "daysInfo",
      width: 130,
      render: (_: any, record: PurchaseOrder) => (
        <div style={{ fontSize: 12 }}>
          {record.sellableDays && <div>可售：<span style={{ color: parseFloat(record.sellableDays) <= 3 ? "#ff4d4f" : "#52c41a" }}>{record.sellableDays}</span></div>}
          {record.suggestDays && <div>建议备：{record.suggestDays}</div>}
        </div>
      ),
    },
    {
      title: "仓库",
      dataIndex: "warehouse",
      key: "warehouse",
      width: 150,
      ellipsis: true,
      render: (text: string) => <span style={{ fontSize: 12 }}>{text || "-"}</span>,
    },
    {
      title: "创建时间",
      dataIndex: "orderTime",
      key: "orderTime",
      width: 150,
      render: (text: string) => <span style={{ fontSize: 12 }}>{text || "-"}</span>,
    },
  ];

  const handleSync = async () => {
    if (!api) {
      notification.warning({ message: "自动化模块未连接", description: "请在 Electron 环境中运行" });
      return;
    }

    setLoading(true);
    notification.info({
      key: "sync-orders",
      message: "正在同步备货单",
      description: "正在从 Temu 卖家后台抓取备货单数据，可能需要几分钟...",
      duration: 0,
    });

    try {
      const result = await api.scrapeOrders();
      const rawOrders = result.orders || [];
      const parsed: PurchaseOrder[] = rawOrders.map((item: any, idx: number) => ({
        key: idx + 1,
        type: item._type || "",
        purchaseOrderNo: item._purchaseOrderNo || "",
        parentOrderNo: item._parentOrderNo || "",
        title: item._title || "",
        skcId: item._skcId || "",
        skuId: item._skuId || "",
        skuCode: item._skuCode || "",
        attributes: item._attributes || "",
        quantity: item._quantity || 0,
        status: item._status || "",
        amount: item._amount || "",
        orderTime: item._orderTime || "",
        warehouse: item._warehouse || "",
        sellableDays: item._sellableDays || "",
        suggestDays: item._suggestDays || "",
        urgencyInfo: item._urgencyInfo || "",
        requiredShipTime: item._requiredShipTime || "",
      }));

      setOrders(parsed);
      store?.set("temu_orders", parsed);

      notification.success({
        key: "sync-orders",
        message: "同步完成",
        description: `成功同步 ${parsed.length} 条备货单数据`,
      });
    } catch (error: any) {
      notification.error({
        key: "sync-orders",
        message: "同步失败",
        description: error?.message || "请确保已登录 Temu 卖家后台",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((item) => {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    return (
      item.purchaseOrderNo.toLowerCase().includes(s) ||
      item.title.toLowerCase().includes(s) ||
      item.skcId.includes(searchText) ||
      item.skuId.includes(searchText) ||
      item.skuCode.toLowerCase().includes(s) ||
      item.attributes.toLowerCase().includes(s)
    );
  });

  if (hasAccount === false) {
    return (
      <Result
        icon={<ShopOutlined style={{ color: "#fa8c16" }} />}
        title="请先绑定店铺"
        subTitle="绑定 Temu 店铺账号后，即可同步备货单数据"
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
      {/* 统计卡片 */}
      {orders.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic title="备货单总数" value={orders.length} prefix={<ShoppingCartOutlined />} valueStyle={{ color: "#1890ff" }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="待发货"
                value={orders.filter(o => ["待发货", "待确认", "待备货", "待审核"].includes(o.status)).length}
                prefix={<InboxOutlined />}
                valueStyle={{ color: "#fa8c16" }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="已发货/备货中"
                value={orders.filter(o => ["已发货", "部分发货", "备货中", "生产中", "审核中"].includes(o.status)).length}
                valueStyle={{ color: "#1890ff" }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="已完成"
                value={orders.filter(o => ["已完成", "已收货", "已入库", "已备货", "已确认"].includes(o.status)).length}
                valueStyle={{ color: "#52c41a" }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 工具栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索备货单号/商品名称/SPU/SKC/SKU"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 340 }}
            allowClear
          />
          <Button
            type="primary"
            icon={<SyncOutlined spin={loading} />}
            onClick={handleSync}
            loading={loading}
          >
            同步备货单
          </Button>
          <Button icon={<ExportOutlined />} disabled={orders.length === 0}>
            导出
          </Button>
          {orders.length > 0 && (
            <span style={{ color: "#999", fontSize: 13 }}>
              共 {orders.length} 条数据
            </span>
          )}
          {filteredOrders.length > 0 && filteredOrders.length !== orders.length && (
            <span style={{ color: "#999", fontSize: 13 }}>
              显示 {filteredOrders.length} / {orders.length} 条
            </span>
          )}
        </Space>
      </Card>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={filteredOrders}
        rowKey="key"
        loading={loading}
        pagination={{
          pageSize: 20,
          showTotal: (total) => `共 ${total} 条备货单`,
          showSizeChanger: true,
          pageSizeOptions: ["20", "50", "100"],
        }}
        locale={{ emptyText: "暂无备货单数据，请先登录账号后点击「同步备货单」" }}
        scroll={{ x: 1800 }}
        size="small"
      />
    </div>
  );
}
