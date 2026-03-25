import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import App from "./App";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#e55b00",
          colorSuccess: "#00b96b",
          colorWarning: "#faad14",
          colorError: "#ff4d4f",
          colorInfo: "#1677ff",
          borderRadius: 8,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
          fontSize: 14,
          colorBgContainer: "#ffffff",
          colorBgLayout: "#f0f2f5",
          controlHeight: 36,
        },
        components: {
          Card: {
            paddingLG: 20,
            borderRadiusLG: 12,
          },
          Table: {
            borderRadiusLG: 10,
            headerBg: "#fafafa",
            headerColor: "#595959",
            fontSize: 13,
          },
          Tag: {
            borderRadiusSM: 4,
          },
          Button: {
            borderRadius: 8,
            controlHeight: 36,
            controlHeightLG: 44,
          },
          Menu: {
            itemBorderRadius: 8,
            itemMarginInline: 8,
            itemHeight: 44,
          },
          Statistic: {
            titleFontSize: 13,
            contentFontSize: 28,
          },
          Tabs: {
            cardGutter: 4,
          },
        },
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
);
