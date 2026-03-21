import { useState, useEffect } from "react";
import { Table, Button, Space, Tag, Input, Select, Card, message, notification, Image } from "antd";
import { SyncOutlined, SearchOutlined, ExportOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

interface Product {
  id: number;
  title: string;
  sku: string;
  spuId: string;
  skcId: string;
  skuId: string;
  productCode: string;
  category: string;
  attributes: string;
  price: string;
  stock: string;
  status: string;
  warehouse: string;
  stockMode: string;
  imageUrl?: string;
  syncedAt?: string;
}

const statusColorMap: Record<string, string> = {
  "在售": "green",
  "已上架": "green",
  "已生效": "green",
  "待生效": "orange",
  "审核中": "orange",
  "待审核": "orange",
  "已下架": "default",
  "已驳回": "red",
  "已停售": "red",
  "缺货": "red",
};

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const api = window.electronAPI?.automation;
  const store = window.electronAPI?.store;

  // 启动时从文件加载商品数据
  useEffect(() => {
    store?.get("temu_products").then((data: Product[] | null) => {
      if (data && Array.isArray(data) && data.length > 0) {
        setProducts(data);
        console.log(`[ProductList] 从文件恢复 ${data.length} 件商品`);
      }
    });
  }, []);

  const columns: ColumnsType<Product> = [
    {
      title: "商品图片",
      dataIndex: "imageUrl",
      key: "imageUrl",
      width: 70,
      render: (url: string) =>
        url ? (
          <Image src={url} width={50} height={50} style={{ objectFit: "cover", borderRadius: 4 }} fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" />
        ) : (
          <div style={{ width: 50, height: 50, background: "#f0f0f0", borderRadius: 4 }} />
        ),
    },
    {
      title: "商品名称",
      dataIndex: "title",
      key: "title",
      width: 260,
      ellipsis: true,
      fixed: "left",
      render: (text: string, record: Product) => (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 2 }}>{text || "-"}</div>
          {record.category && (
            <div style={{ fontSize: 11, color: "#999" }}>类目：{record.category}</div>
          )}
        </div>
      ),
    },
    {
      title: "SPU ID",
      dataIndex: "spuId",
      key: "spuId",
      width: 120,
      render: (text: string) => <span style={{ fontSize: 12, fontFamily: "monospace" }}>{text || "-"}</span>,
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
      dataIndex: "productCode",
      key: "productCode",
      width: 110,
      render: (text: string) => <span style={{ fontSize: 12 }}>{text || "-"}</span>,
    },
    {
      title: "价格",
      dataIndex: "price",
      key: "price",
      width: 90,
      render: (text: string) => <span style={{ color: "#fa541c", fontWeight: 500 }}>{text || "-"}</span>,
    },
    {
      title: "库存",
      dataIndex: "stock",
      key: "stock",
      width: 80,
      render: (text: string) => {
        if (!text || text === "-" || text === "0") return <span style={{ color: "#999" }}>-</span>;
        return <span style={{ color: "#1890ff", fontWeight: 500 }}>{text}</span>;
      },
    },
    {
      title: "仓组",
      dataIndex: "warehouse",
      key: "warehouse",
      width: 100,
      render: (text: string) => <span style={{ fontSize: 12 }}>{text || "-"}</span>,
    },
    {
      title: "备货模式",
      dataIndex: "stockMode",
      key: "stockMode",
      width: 90,
      render: (text: string) => {
        if (!text) return "-";
        const colorMap: Record<string, string> = { "国内备货": "blue", "JIT": "purple", "海外仓": "cyan", "VMI": "geekblue" };
        return <Tag color={colorMap[text] || "default"}>{text}</Tag>;
      },
    },
    {
      title: "商品属性",
      dataIndex: "attributes",
      key: "attributes",
      width: 180,
      ellipsis: true,
      render: (text: string) => <span style={{ fontSize: 12, color: "#666" }}>{text || "-"}</span>,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 90,
      render: (status: string) => {
        if (!status || status === "unknown") return <Tag>未知</Tag>;
        return <Tag color={statusColorMap[status] || "default"}>{status}</Tag>;
      },
    },
  ];

  const handleSync = async () => {
    if (!api) {
      message.warning("自动化模块未连接（请在 Electron 环境中运行）");
      return;
    }

    setLoading(true);
    notification.info({
      key: "sync-products",
      message: "正在同步商品",
      description: "正在从 Temu Seller Central 抓取商品数据，可能需要几分钟...",
      duration: 0,
    });

    try {
      const result = await api.scrapeProducts();
      const now = new Date().toLocaleString();
      const scraped = (result.products || []).map((p: any, i: number) => ({
        id: i + 1,
        title: p.title || "",
        sku: p.sku || p.skcId || "",
        spuId: p.spuId || "",
        skcId: p.skcId || "",
        skuId: p.skuId || "",
        productCode: p.productCode || "",
        category: p.category || "",
        attributes: p.attributes || "",
        price: p.price || "",
        stock: p.stock || "",
        status: p.status || "unknown",
        warehouse: p.warehouse || "",
        stockMode: p.stockMode || "",
        imageUrl: p.imageUrl || "",
        syncedAt: now,
      }));

      setProducts(scraped);
      store?.set("temu_products", scraped);
      notification.success({
        key: "sync-products",
        message: "同步完成",
        description: `成功同步 ${scraped.length} 件商品`,
      });
    } catch (error: any) {
      notification.error({
        key: "sync-products",
        message: "同步失败",
        description: error?.message || "请确保已登录 Temu 卖家后台",
      });
    } finally {
      setLoading(false);
    }
  };

  // 统计各状态数量
  const statusCounts: Record<string, number> = {};
  products.forEach(p => {
    const s = p.status || "unknown";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  const filteredProducts = products.filter((p) => {
    const matchSearch =
      !searchText ||
      p.title.toLowerCase().includes(searchText.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchText.toLowerCase()) ||
      p.spuId.includes(searchText) ||
      p.skcId.includes(searchText) ||
      (p.skuId || "").includes(searchText) ||
      p.productCode.toLowerCase().includes(searchText.toLowerCase());
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      {/* 统计卡片 */}
      {products.length > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space size={24}>
            <span>总商品数：<strong style={{ color: "#1890ff", fontSize: 18 }}>{products.length}</strong></span>
            {Object.entries(statusCounts).map(([status, count]) => (
              <span key={status}>
                <Tag color={statusColorMap[status] || "default"}>{status}</Tag>
                <strong>{count}</strong>
              </span>
            ))}
          </Space>
        </Card>
      )}

      {/* 工具栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索商品名称/SPU/SKC/SKU/货号"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Select
            placeholder="商品状态"
            style={{ width: 140 }}
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            options={Object.entries(statusCounts).map(([status, count]) => ({
              label: `${status} (${count})`,
              value: status,
            }))}
          />
          <Button
            type="primary"
            icon={<SyncOutlined spin={loading} />}
            onClick={handleSync}
            loading={loading}
          >
            同步商品
          </Button>
          <Button icon={<ExportOutlined />} disabled={products.length === 0}>
            导出
          </Button>
          {filteredProducts.length > 0 && (
            <span style={{ color: "#999", fontSize: 13 }}>
              显示 {filteredProducts.length} / {products.length} 件商品
            </span>
          )}
        </Space>
      </Card>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={filteredProducts}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 20,
          showTotal: (total) => `共 ${total} 件商品`,
          showSizeChanger: true,
          pageSizeOptions: ["20", "50", "100"],
        }}
        locale={{ emptyText: "暂无商品数据，请先登录账号后点击「同步商品」" }}
        scroll={{ x: 1600 }}
        size="small"
      />
    </div>
  );
}
