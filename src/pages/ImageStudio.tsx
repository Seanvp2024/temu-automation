import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Space, Spin, Tag, Tooltip, Typography, message } from "antd";
import { ReloadOutlined, ExportOutlined, ThunderboltOutlined } from "@ant-design/icons";

type ImageStudioStatus = {
  status: string;
  message: string;
  url: string;
  projectPath: string;
  port: number;
  ready: boolean;
};

const { Text } = Typography;
const imageStudioAPI = window.electronAPI?.imageStudio;

const FALLBACK_STATUS: ImageStudioStatus = {
  status: "idle",
  message: "AI 出图服务未启动",
  url: "http://127.0.0.1:3210",
  projectPath: "",
  port: 3210,
  ready: false,
};

export default function ImageStudio() {
  const [status, setStatus] = useState<ImageStudioStatus>(FALLBACK_STATUS);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const refreshStatus = async (ensure = false) => {
    setActionLoading(ensure);
    try {
      if (!imageStudioAPI) throw new Error("当前环境不支持 AI 出图服务");
      const nextStatus = ensure
        ? await imageStudioAPI.ensureRunning()
        : await imageStudioAPI.getStatus();
      setStatus(nextStatus);
    } catch (error) {
      setStatus({
        ...FALLBACK_STATUS,
        status: "error",
        message: error instanceof Error ? error.message : "AI 出图服务启动失败",
      });
    } finally {
      setLoading(false);
      setActionLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus(true);
    const timer = window.setInterval(() => { refreshStatus(false).catch(() => {}); }, 8000);
    return () => window.clearInterval(timer);
  }, []);

  const handleRestart = async () => {
    setActionLoading(true);
    try {
      if (!imageStudioAPI) throw new Error("当前环境不支持 AI 出图服务");
      const nextStatus = await imageStudioAPI.restart();
      setStatus(nextStatus);
      message.success("AI 出图服务已重启");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "重启失败");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenExternal = async () => {
    try {
      if (!imageStudioAPI) throw new Error("当前环境不支持");
      await imageStudioAPI.openExternal();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "打开失败");
    }
  };

  // 服务就绪 → 直接全屏 iframe，无多余 UI
  if (status.ready && !loading) {
    return (
      <div style={{ margin: -24, position: "relative" }}>
        {/* 悬浮工具栏 */}
        <div style={{
          position: "absolute", top: 12, right: 16, zIndex: 10,
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(255,255,255,0.92)", borderRadius: 8,
          padding: "4px 10px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: "#52c41a" }} />
          <Text type="secondary" style={{ fontSize: 12 }}>就绪</Text>
          <Tooltip title="重启服务">
            <Button type="text" size="small" icon={<ThunderboltOutlined />} onClick={handleRestart} loading={actionLoading} />
          </Tooltip>
          <Tooltip title="在浏览器中打开">
            <Button type="text" size="small" icon={<ExportOutlined />} onClick={handleOpenExternal} />
          </Tooltip>
        </div>
        <iframe
          src={`${status.url}?_t=${Date.now()}`}
          title="AI 出图工作台"
          style={{
            width: "100%",
            height: "calc(100vh - 108px)",
            border: "none",
            display: "block",
          }}
        />
      </div>
    );
  }

  // 加载中 / 启动中 / 错误状态
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 20 }}>
      {(loading || status.status === "starting") ? (
        <>
          <Spin size="large" />
          <Text type="secondary">{status.message || "正在启动 AI 出图服务…"}</Text>
        </>
      ) : status.status === "error" ? (
        <>
          <Alert
            type="error"
            showIcon
            message="AI 出图服务启动失败"
            description={status.message}
            style={{ maxWidth: 500 }}
          />
          <Space>
            <Button type="primary" icon={<ReloadOutlined />} onClick={() => refreshStatus(true)} loading={actionLoading}>
              重新启动
            </Button>
            <Button icon={<ExportOutlined />} onClick={handleOpenExternal}>
              浏览器打开
            </Button>
          </Space>
        </>
      ) : (
        <>
          <Empty description="AI 出图服务未启动" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          <Button type="primary" icon={<ReloadOutlined />} onClick={() => refreshStatus(true)} loading={actionLoading}>
            启动服务
          </Button>
        </>
      )}
    </div>
  );
}
