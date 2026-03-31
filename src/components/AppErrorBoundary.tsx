import React from "react";
import { Alert, Button, Card, Space, Typography } from "antd";

const { Paragraph, Text, Title } = Typography;

interface State {
  error?: Error;
}

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f6f8fb" }}>
        <Card style={{ width: "100%", maxWidth: 760, borderRadius: 16 }}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Title level={3} style={{ margin: 0 }}>
              应用启动失败
            </Title>

            <Alert
              type="error"
              showIcon
              message="前端渲染时发生异常"
              description="这不是正常页面状态。请把下方错误信息和桌面日志一起反馈给维护人员。"
            />

            <Paragraph style={{ marginBottom: 0 }}>
              <Text strong>错误信息：</Text>
            </Paragraph>
            <Paragraph copyable style={{ whiteSpace: "pre-wrap", marginTop: -8 }}>
              {this.state.error.stack || this.state.error.message}
            </Paragraph>

            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              主进程日志位置：<Text code>%APPDATA%\\temu-automation\\desktop-main.log</Text>
            </Paragraph>

            <Space>
              <Button type="primary" onClick={this.handleReload}>
                重新加载
              </Button>
            </Space>
          </Space>
        </Card>
      </div>
    );
  }
}
