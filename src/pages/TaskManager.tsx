import { useState } from "react";
import { Table, Tag, Switch, Card, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";

const { Text } = Typography;

interface TaskConfig {
  id: string;
  name: string;
  description: string;
  interval: string;
  enabled: boolean;
  lastRun?: string;
  status: "idle" | "running" | "error";
}

const defaultTasks: TaskConfig[] = [
  {
    id: "sync_products",
    name: "同步商品",
    description: "定时从 Temu 后台同步商品列表数据",
    interval: "每 30 分钟",
    enabled: false,
    status: "idle",
  },
  {
    id: "sync_orders",
    name: "同步订单",
    description: "定时从 Temu 后台同步订单数据",
    interval: "每 15 分钟",
    enabled: false,
    status: "idle",
  },
  {
    id: "stock_alert",
    name: "库存预警",
    description: "检测低库存商品并发送提醒",
    interval: "每 1 小时",
    enabled: false,
    status: "idle",
  },
  {
    id: "sync_analytics",
    name: "数据报表",
    description: "同步销售数据和流量报表",
    interval: "每 2 小时",
    enabled: false,
    status: "idle",
  },
];

export default function TaskManager() {
  const [tasks, setTasks] = useState<TaskConfig[]>(defaultTasks);

  const toggleTask = (id: string, enabled: boolean) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled } : t))
    );
  };

  const columns: ColumnsType<TaskConfig> = [
    { title: "任务名称", dataIndex: "name", key: "name", width: 120 },
    { title: "说明", dataIndex: "description", key: "description" },
    { title: "执行频率", dataIndex: "interval", key: "interval", width: 120 },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => {
        const map: Record<string, { color: string; text: string }> = {
          idle: { color: "default", text: "空闲" },
          running: { color: "processing", text: "运行中" },
          error: { color: "error", text: "错误" },
        };
        const s = map[status] || map.idle;
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: "上次执行",
      dataIndex: "lastRun",
      key: "lastRun",
      width: 160,
      render: (text: string) => text || <Text type="secondary">未执行</Text>,
    },
    {
      title: "启用",
      key: "enabled",
      width: 80,
      render: (_, record) => (
        <Switch
          checked={record.enabled}
          onChange={(checked) => toggleTask(record.id, checked)}
        />
      ),
    },
  ];

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Text type="secondary">
          配置自动化任务，开启后将按设定频率自动执行。请先在「账号管理」中登录账号。
        </Text>
      </Card>
      <Table
        columns={columns}
        dataSource={tasks}
        rowKey="id"
        pagination={false}
      />
    </div>
  );
}
