import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Empty, Input, Segmented, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { FRONTEND_LOG_STORE_KEY, clearFrontendLogs, type FrontendLogEntry } from "../utils/frontendLogger";

const { Text } = Typography;
const store = window.electronAPI?.store;

type LevelFilter = "all" | "log" | "info" | "warn" | "error";

function levelLabel(level: FrontendLogEntry["level"] | LevelFilter) {
  switch (level) {
    case "log":
      return "日志";
    case "info":
      return "信息";
    case "warn":
      return "警告";
    case "error":
      return "错误";
    default:
      return "全部";
  }
}

function explainMessage(log: FrontendLogEntry) {
  const message = log.message || "";
  if (message.includes("[antd: Spin]") && message.includes("tip")) {
    return "Ant Design 的 Spin 组件提示文案只能用于嵌套加载或全屏加载，这是一条界面用法警告，不是业务失败。";
  }
  if (log.source === "unhandledrejection") {
    return "有一个 Promise 异常没有被捕获，建议顺着这条日志继续定位调用链。";
  }
  if (log.source === "window-error") {
    return "这是页面运行时异常，通常会直接影响当前功能。";
  }
  return "";
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString("zh-CN", { hour12: false });
}

function levelColor(level: FrontendLogEntry["level"]) {
  switch (level) {
    case "error":
      return "error";
    case "warn":
      return "warning";
    case "info":
      return "processing";
    default:
      return "default";
  }
}

function sourceLabel(source: FrontendLogEntry["source"]) {
  switch (source) {
    case "window-error":
      return "页面异常";
    case "unhandledrejection":
      return "Promise异常";
    default:
      return "Console";
  }
}

export default function Logs() {
  const [logs, setLogs] = useState<FrontendLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await store?.get?.(FRONTEND_LOG_STORE_KEY);
      setLogs(Array.isArray(data) ? data.slice().reverse() : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();

    const handleLog = (event: WindowEventMap["temu-frontend-log"]) => {
      setLogs((prev) => [event.detail, ...prev].slice(0, 500));
    };

    window.addEventListener("temu-frontend-log", handleLog as EventListener);
    return () => {
      window.removeEventListener("temu-frontend-log", handleLog as EventListener);
    };
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (levelFilter !== "all" && log.level !== levelFilter) return false;
      if (!searchText) return true;
      const needle = searchText.toLowerCase();
      return (
        log.message.toLowerCase().includes(needle) ||
        log.source.toLowerCase().includes(needle) ||
        log.level.toLowerCase().includes(needle)
      );
    });
  }, [logs, levelFilter, searchText]);

  const columns: ColumnsType<FrontendLogEntry> = [
    {
      title: "时间",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 180,
      render: (value: number) => <Text style={{ fontFamily: "Consolas, monospace", fontSize: 12 }}>{formatTime(value)}</Text>,
    },
    {
      title: "级别",
      dataIndex: "level",
      key: "level",
      width: 90,
      render: (value: FrontendLogEntry["level"]) => <Tag color={levelColor(value)}>{levelLabel(value)}</Tag>,
    },
    {
      title: "来源",
      dataIndex: "source",
      key: "source",
      width: 120,
      render: (value: FrontendLogEntry["source"]) => <Tag>{sourceLabel(value)}</Tag>,
    },
    {
      title: "内容",
      dataIndex: "message",
      key: "message",
      render: (value: string) => (
        <div>
          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "Consolas, monospace", fontSize: 12 }}>
            {value}
          </div>
        </div>
      ),
    },
    {
      title: "中文说明",
      key: "explanation",
      width: 360,
      render: (_: unknown, record: FrontendLogEntry) => {
        const explanation = explainMessage(record);
        return explanation ? <span style={{ fontSize: 12, color: "#666" }}>{explanation}</span> : <span style={{ color: "#bbb" }}>-</span>;
      },
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message="前端日志页"
        description="这里记录 renderer 侧的 console、页面异常和未处理的 Promise 异常。日志默认保留最近 500 条。"
        style={{ borderRadius: 12 }}
      />

      <Card style={{ borderRadius: 12 }}>
        <Space wrap>
          <Input.Search
            allowClear
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="搜索日志内容"
            style={{ width: 280 }}
          />
          <Segmented<LevelFilter>
            value={levelFilter}
            onChange={(value) => setLevelFilter(value)}
            options={[
              { label: "全部", value: "all" },
              { label: "日志", value: "log" },
              { label: "信息", value: "info" },
              { label: "警告", value: "warn" },
              { label: "错误", value: "error" },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={loadLogs} loading={loading}>
            刷新
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={async () => {
              await clearFrontendLogs();
              setLogs([]);
              message.success("前端日志已清空");
            }}
          >
            清空日志
          </Button>
          <Text type="secondary">共 {filteredLogs.length} 条</Text>
        </Space>
      </Card>

      <Card style={{ borderRadius: 12 }}>
        {filteredLogs.length > 0 ? (
          <Table
            rowKey="id"
            loading={loading}
            dataSource={filteredLogs}
            columns={columns}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            scroll={{ x: 1000 }}
          />
        ) : (
          <Empty description="暂无前端日志" style={{ padding: "40px 0" }} />
        )}
      </Card>
    </Space>
  );
}
