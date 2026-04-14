import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import EmptyGuide from "../components/EmptyGuide";
import {
  FRONTEND_LOG_STORE_KEY,
  clearFrontendLogs,
  type FrontendLogEntry,
} from "../utils/frontendLogger";

const { Text } = Typography;
const store = window.electronAPI?.store;

type LevelFilter = "all" | "log" | "info" | "warn" | "error";

function levelLabel(level: FrontendLogEntry["level"] | LevelFilter) {
  switch (level) {
    case "log":
      return "记录";
    case "info":
      return "信息";
    case "warn":
      return "提醒";
    case "error":
      return "异常";
    default:
      return "全部";
  }
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
      return "请求异常";
    default:
      return "应用记录";
  }
}

function explainMessage(log: FrontendLogEntry) {
  const rawMessage = log.message || "";
  if (rawMessage.includes("[antd: Spin]") && rawMessage.includes("tip")) {
    return "这是界面加载提示的用法提醒，通常不会影响主要功能。";
  }
  if (log.source === "unhandledrejection") {
    return "这条记录表示某次请求或异步处理没有顺利完成，建议先看同一时间段的操作。";
  }
  if (log.source === "window-error") {
    return "这条记录表示页面运行过程中出现异常，可能会影响当前功能。";
  }
  return "";
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString("zh-CN", { hour12: false });
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
    void loadLogs();

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
      if (!searchText.trim()) return true;
      const keyword = searchText.trim().toLowerCase();
      return (
        log.message.toLowerCase().includes(keyword)
        || log.source.toLowerCase().includes(keyword)
        || log.level.toLowerCase().includes(keyword)
      );
    });
  }, [levelFilter, logs, searchText]);

  const errorCount = logs.filter((log) => log.level === "error").length;
  const warnCount = logs.filter((log) => log.level === "warn").length;
  const latestTime = logs[0]?.timestamp ? formatTime(logs[0].timestamp) : "--";

  const columns: ColumnsType<FrontendLogEntry> = [
    {
      title: "时间",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 158,
      render: (value: number) => (
        <Text style={{ fontFamily: "Consolas, monospace", fontSize: 13 }}>
          {formatTime(value)}
        </Text>
      ),
    },
    {
      title: "级别",
      dataIndex: "level",
      key: "level",
      width: 88,
      render: (value: FrontendLogEntry["level"]) => <Tag color={levelColor(value)}>{levelLabel(value)}</Tag>,
    },
    {
      title: "来源",
      dataIndex: "source",
      key: "source",
      width: 110,
      render: (value: FrontendLogEntry["source"]) => <Tag>{sourceLabel(value)}</Tag>,
    },
    {
      title: "内容",
      dataIndex: "message",
      key: "message",
      render: (value: string) => (
        <div className="app-log-message app-log-message--clamp">{value}</div>
      ),
    },
    {
      title: "说明",
      key: "explanation",
      width: 260,
      render: (_: unknown, record: FrontendLogEntry) => {
        const explanation = explainMessage(record);
        return explanation ? (
          <span style={{ fontSize: 13, color: "var(--color-text-sec)" }}>{explanation}</span>
        ) : (
          <span style={{ color: "#bbb" }}>-</span>
        );
      },
    },
  ];

  return (
    <div className="dashboard-shell">
      <PageHeader
        compact
        eyebrow="运行记录"
        title="日志中心"
        subtitle="这里集中展示应用运行中的提醒与异常，方便快速回看最近发生了什么。"
        meta={[
          `${logs.length} 条记录`,
          errorCount > 0 ? `${errorCount} 条异常` : "当前无异常",
          warnCount > 0 ? `${warnCount} 条提醒` : "提醒较少",
        ]}
      />

      <div className="app-form-grid">
        <StatCard compact title="异常数量" value={errorCount} color="danger" trend="优先查看会影响页面使用的问题" />
        <StatCard compact title="提醒数量" value={warnCount} color="brand" trend="用于查看界面和流程中的温和提醒" />
        <StatCard compact title="最近一条" value={latestTime} color="blue" trend={logs[0]?.source ? `来源：${sourceLabel(logs[0].source)}` : "等待新的运行记录"} />
      </div>

      <Alert
        className="friendly-alert"
        type="info"
        showIcon
        message="这里会记录应用运行中的提醒与异常"
        description="默认保留最近 500 条。列表里先显示摘要，展开后可以查看完整内容和更易理解的说明。"
      />

      <div className="app-panel">
        <div className="app-toolbar app-toolbar--logs">
          <Input.Search
            allowClear
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="搜索记录内容 / 来源 / 级别"
          />
          <Segmented<LevelFilter>
            value={levelFilter}
            onChange={(value) => setLevelFilter(value)}
            options={[
              { label: "全部", value: "all" },
              { label: "记录", value: "log" },
              { label: "信息", value: "info" },
              { label: "提醒", value: "warn" },
              { label: "异常", value: "error" },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void loadLogs()} loading={loading}>
            刷新
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={async () => {
              await clearFrontendLogs();
              setLogs([]);
              message.success("运行记录已清空");
            }}
          >
            清空
          </Button>
          <div className="app-toolbar__count">共 {filteredLogs.length} 条</div>
        </div>
      </div>

      <div className="app-panel">
        {filteredLogs.length > 0 ? (
          <Table
            rowKey="id"
            size="small"
            loading={loading}
            dataSource={filteredLogs}
            columns={columns}
            pagination={{ pageSize: 24, showSizeChanger: true }}
            scroll={{ x: 920 }}
            expandable={{
              expandRowByClick: true,
              rowExpandable: (record) => Boolean(record.message || explainMessage(record)),
              expandedRowRender: (record) => (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <div>
                    <Text strong>完整内容</Text>
                    <div className="app-log-message" style={{ marginTop: 8 }}>{record.message}</div>
                  </div>
                  {explainMessage(record) ? (
                    <div>
                      <Text strong>说明</Text>
                      <div style={{ marginTop: 8, fontSize: 13, color: "var(--color-text-sec)", lineHeight: 1.7 }}>
                        {explainMessage(record)}
                      </div>
                    </div>
                  ) : null}
                </Space>
              ),
            }}
          />
        ) : (
          <EmptyGuide title="暂无运行记录" description="这里会自动收集最近的页面提醒与异常。" />
        )}
      </div>
    </div>
  );
}
