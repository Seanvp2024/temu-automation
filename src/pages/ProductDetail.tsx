import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Row, Col, Statistic, Tag, Tabs, Table, Descriptions, Image, Button, Empty, Spin, Typography, Space } from "antd";
import {
  ArrowLeftOutlined, ShoppingOutlined, LineChartOutlined, InboxOutlined,
  DollarOutlined, RiseOutlined, WarningOutlined, CustomerServiceOutlined,
  EyeOutlined, SafetyCertificateOutlined, BarChartOutlined,
} from "@ant-design/icons";
import { parseProductsData, parseOrdersData, parseSalesData } from "../utils/parseRawApis";

const { Title, Paragraph } = Typography;
const store = window.electronAPI?.store;

interface ProductInfo {
  title: string;
  category: string;
  categories: string;
  spuId: string;
  skcId: string;
  goodsId: string;
  sku: string;
  imageUrl: string;
  status: string;
  totalSales: number;
  last7DaysSales: number;
  createdAt?: string;
  skcStatus?: number;
}

function findInRawStore(rawData: any, apiPathFragment: string): any {
  if (!rawData?.apis) return null;
  const api = rawData.apis.find((a: any) => a.path?.includes(apiPathFragment));
  return api?.data?.result || api?.data || null;
}

function safeRender(val: any): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "object") return JSON.stringify(val).slice(0, 100);
  return String(val);
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [salesInfo, setSalesInfo] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [afterSalesRecords, setAfterSalesRecords] = useState<any[]>([]);
  const [flowPriceInfo, setFlowPriceInfo] = useState<any>(null);
  const [retailPriceInfo, setRetailPriceInfo] = useState<any[]>([]);
  const [fluxItems, setFluxItems] = useState<any[]>([]);
  const [qualityInfo, setQualityInfo] = useState<any>(null);
  const [checkupInfo, setCheckupInfo] = useState<any>(null);
  const [goodsSalesData, setGoodsSalesData] = useState<any>(null);
  const [marketingActivities, setMarketingActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    setLoading(true);
    try {
      // Load product by skcId
      const rawProducts = await store?.get("temu_products");
      if (rawProducts) {
        const products = parseProductsData(rawProducts);
        const found = products.find((p: any) => String(p.skcId) === id || String(p.spuId) === id || String(p.goodsId) === id);
        if (found) setProduct(found);
      }

      // Load related sales data
      const rawSales = await store?.get("temu_sales");
      if (rawSales) {
        const sales = parseSalesData(rawSales);
        const salesItem = sales?.items?.find((s: any) => String(s.skcId) === id);
        if (salesItem) setSalesInfo(salesItem);
      }

      // Load related orders
      const rawOrders = await store?.get("temu_orders");
      if (rawOrders) {
        const allOrders = parseOrdersData(rawOrders);
        const related = allOrders.filter((o: any) => String(o.skcId) === id);
        setOrders(related);
      }

      // Load after-sales records
      const rawAfterSales = await store?.get("temu_raw_afterSales");
      if (rawAfterSales) {
        const result = findInRawStore(rawAfterSales, "queryPageV3");
        if (result) {
          const list = result?.pageItems || result?.list || (Array.isArray(result) ? result : []);
          const matched = list.filter((r: any) => String(r.productSkcId) === id || String(r.skcId) === id);
          setAfterSalesRecords(matched);
        }
      }

      // Load flow price / high price data
      const rawFlowPrice = await store?.get("temu_raw_flowPrice");
      if (rawFlowPrice) {
        const result = findInRawStore(rawFlowPrice, "highPriceFlowReduce") || findInRawStore(rawFlowPrice, "high/price");
        if (result) {
          const list = result?.pageItems || result?.list || (Array.isArray(result) ? result : []);
          const matched = list.find((r: any) => String(r.productSkcId) === id || String(r.skcId) === id);
          if (matched) setFlowPriceInfo(matched);
        }
      }

      // Load retail price data
      const rawRetailPrice = await store?.get("temu_raw_retailPrice");
      if (rawRetailPrice) {
        const result = findInRawStore(rawRetailPrice, "suggestedPrice/pageQuery") || findInRawStore(rawRetailPrice, "suggestedPrice");
        if (result) {
          const list = result?.pageItems || result?.list || (Array.isArray(result) ? result : []);
          const matched = list.filter((r: any) => String(r.productSkcId) === id || String(r.skcId) === id);
          setRetailPriceInfo(matched);
        }
      }

      // Load traffic/flux data
      const rawFlux = await store?.get("temu_flux");
      if (rawFlux?.items) {
        const productFlux = rawFlux.items.map((day: any) => {
          const prod = day.products?.find((p: any) => String(p.goodsId) === id || String(p.productSkcId) === id);
          return prod ? { date: day.date, ...prod } : null;
        }).filter(Boolean);
        setFluxItems(productFlux);
      }

      // Load quality dashboard data
      const rawQuality = await store?.get("temu_raw_qualityDashboard");
      if (rawQuality) {
        const result = findInRawStore(rawQuality, "qualityMetrics/pageQuery");
        if (result?.pageItems) {
          const matched = result.pageItems.find((r: any) => String(r.productSkcId) === id);
          if (matched) setQualityInfo(matched);
        }
      }

      // Load checkup data
      const rawCheckup = await store?.get("temu_raw_checkup");
      if (rawCheckup) {
        const result = findInRawStore(rawCheckup, "check/product/list");
        if (result?.list) {
          const matched = result.list.find((r: any) => String(r.productSkcId) === id);
          if (matched) setCheckupInfo(matched);
        }
      }

      // Load goods sales data
      const rawGoodsData = await store?.get("temu_goods_data");
      if (rawGoodsData) {
        const result = findInRawStore(rawGoodsData, "skc/sales/data");
        if (result?.skcSalesDataList) {
          const matched = result.skcSalesDataList.find((r: any) => String(r.skcExtId) === id);
          if (matched) setGoodsSalesData(matched);
        }
      }

      // Load marketing activity data
      const rawMarketing = await store?.get("temu_marketing_activity");
      if (rawMarketing) {
        const result = findInRawStore(rawMarketing, "activity/list");
        if (result?.activityList) {
          setMarketingActivities(result.activityList);
        }
      }
    } catch (e) {
      console.error("加载商品详情失败", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>;
  }

  if (!product) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/products")} style={{ marginBottom: 16 }}>返回商品列表</Button>
        <Empty description="商品未找到" />
      </div>
    );
  }

  const p = product;

  const tabItems = [
    {
      key: "basic",
      label: <span><ShoppingOutlined /> 基本信息</span>,
      children: (
        <div>
          <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
            <Col span={6}><Card size="small"><Statistic title="总销量" value={p.totalSales || 0} valueStyle={{ color: "#722ed1" }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="7日销量" value={p.last7DaysSales || 0} valueStyle={{ color: "#1890ff" }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="备货单" value={orders.length} suffix="单" valueStyle={{ color: orders.length > 0 ? "#1890ff" : "#999" }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="供货价" value={salesInfo?.price || "-"} prefix={salesInfo?.price ? "¥" : ""} valueStyle={{ color: "#fa541c" }} /></Card></Col>
          </Row>

          <Card size="small" title="商品信息" style={{ marginBottom: 16 }}>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="SPU ID">{p.spuId || "-"}</Descriptions.Item>
              <Descriptions.Item label="SKC ID">{p.skcId || "-"}</Descriptions.Item>
              <Descriptions.Item label="商品ID">{p.goodsId || "-"}</Descriptions.Item>
              <Descriptions.Item label="状态">{p.status ? <Tag color={p.status === "在售" ? "green" : "default"}>{p.status}</Tag> : "-"}</Descriptions.Item>
              <Descriptions.Item label="SKU货号">{p.sku || "-"}</Descriptions.Item>
              <Descriptions.Item label="类目">{p.category || "-"}</Descriptions.Item>
              {p.categories && <Descriptions.Item label="类目路径" span={2}>{p.categories}</Descriptions.Item>}
              {p.createdAt && <Descriptions.Item label="创建时间">{safeRender(p.createdAt)}</Descriptions.Item>}
              {p.skcStatus !== undefined && <Descriptions.Item label="SKC状态码">{safeRender(p.skcStatus)}</Descriptions.Item>}
            </Descriptions>
          </Card>
        </div>
      ),
    },
    {
      key: "flux",
      label: <span><EyeOutlined /> 流量数据</span>,
      children: fluxItems.length > 0 ? (
        <Card size="small" title="每日流量数据">
          <Table
            dataSource={fluxItems.map((item: any, i: number) => ({ ...item, key: i }))}
            columns={[
              { title: "日期", dataIndex: "date", key: "date", render: (v: any) => safeRender(v) },
              { title: "曝光量", dataIndex: "exposeNum", key: "exposeNum", render: (v: any) => safeRender(v) },
              { title: "点击量", dataIndex: "clickNum", key: "clickNum", render: (v: any) => safeRender(v) },
              { title: "详情访问", dataIndex: "detailVisit", key: "detailVisit", render: (v: any) => safeRender(v) },
              { title: "加购人数", dataIndex: "addCartNum", key: "addCartNum", render: (v: any) => safeRender(v) },
              { title: "支付人数", dataIndex: "payNum", key: "payNum", render: (v: any) => safeRender(v) },
            ]}
            size="small"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      ) : (
        <Empty description="暂无流量数据" style={{ marginTop: 40 }} />
      ),
    },
    {
      key: "sales",
      label: <span><DollarOutlined /> 销售数据</span>,
      children: salesInfo ? (
        <div>
          <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
            <Col span={6}><Card size="small"><Statistic title="今日销量" value={salesInfo.todaySales || 0} prefix={<RiseOutlined />} valueStyle={{ color: "#52c41a" }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="近7日销量" value={salesInfo.last7DaysSales || 0} valueStyle={{ color: "#1890ff" }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="近30日销量" value={salesInfo.last30DaysSales || 0} valueStyle={{ color: "#722ed1" }} /></Card></Col>
            <Col span={6}><Card size="small"><Statistic title="累计总销量" value={salesInfo.totalSales || 0} valueStyle={{ color: "#f56a00" }} /></Card></Col>
          </Row>
          <Card size="small" title="库存与备货" style={{ marginBottom: 16 }}>
            <Row gutter={[12, 12]}>
              <Col span={6}><Statistic title="仓库库存" value={salesInfo.warehouseStock || 0} valueStyle={{ color: salesInfo.warehouseStock > 0 ? "#52c41a" : "#ff4d4f" }} /></Col>
              <Col span={6}><Statistic title="建议备货量" value={salesInfo.adviceQuantity || 0} valueStyle={{ color: salesInfo.adviceQuantity > 0 ? "#fa8c16" : "#999" }} /></Col>
              <Col span={6}><Statistic title="缺货量" value={salesInfo.lackQuantity || 0} valueStyle={{ color: salesInfo.lackQuantity > 0 ? "#ff4d4f" : "#52c41a" }} /></Col>
              <Col span={6}><Statistic title="可售天数" value={salesInfo.availableSaleDays ?? "-"} valueStyle={{ color: "#1890ff" }} /></Col>
            </Row>
          </Card>
          <Card size="small" title="供货信息">
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="供货状态">{salesInfo.supplyStatus ? <Tag color={salesInfo.supplyStatus === "正常供货" ? "green" : "orange"}>{salesInfo.supplyStatus}</Tag> : "-"}</Descriptions.Item>
              <Descriptions.Item label="库存状态">{safeRender(salesInfo.stockStatus) || "-"}</Descriptions.Item>
              <Descriptions.Item label="供货价">{salesInfo.price ? `¥${salesInfo.price}` : "-"}</Descriptions.Item>
              <Descriptions.Item label="SKU货号">{salesInfo.skuCode || "-"}</Descriptions.Item>
              <Descriptions.Item label="热销标签">{salesInfo.hotTag || "-"}</Descriptions.Item>
              <Descriptions.Item label="广告商品">{salesInfo.isAdProduct || "-"}</Descriptions.Item>
            </Descriptions>
          </Card>
        </div>
      ) : <Empty description="暂无销售数据，请执行一键采集" style={{ marginTop: 40 }} />,
    },
    {
      key: "salesDetail",
      label: <span><BarChartOutlined /> 销售明细</span>,
      children: goodsSalesData ? (
        <Card size="small" title="SKC销售明细">
          <Descriptions size="small" column={2}>
            {Object.entries(goodsSalesData).slice(0, 20).map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                {safeRender(value)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Card>
      ) : (
        <Empty description="暂无销售明细数据" style={{ marginTop: 40 }} />
      ),
    },
    {
      key: "orders",
      label: <span><InboxOutlined /> 库存/备货 ({orders.length})</span>,
      children: orders.length > 0 ? (
        <Card size="small" title="备货单明细">
          <Table
            dataSource={orders.map((o: any, i: number) => ({ ...o, key: i }))}
            columns={[
              { title: "备货单号", dataIndex: "purchaseOrderNo", key: "no", render: (v: string) => <span style={{ fontFamily: "monospace", fontSize: 12 }}>{v || "-"}</span> },
              { title: "数量", dataIndex: "quantity", key: "qty" },
              { title: "状态", dataIndex: "status", key: "status", render: (v: string) => <Tag>{v || "-"}</Tag> },
              { title: "金额", dataIndex: "amount", key: "amount", render: (v: string) => v ? <span style={{ color: "#fa541c" }}>¥{v}</span> : "-" },
              { title: "仓库", dataIndex: "warehouse", key: "warehouse", render: (v: string) => <span style={{ fontSize: 12 }}>{v || "-"}</span> },
              { title: "下单时间", dataIndex: "orderTime", key: "orderTime", render: (v: string) => <span style={{ fontSize: 12 }}>{safeRender(v)}</span> },
              { title: "类型", dataIndex: "type", key: "type", render: (v: string) => v ? <Tag>{v}</Tag> : "-" },
            ]}
            size="small"
            pagination={false}
          />
        </Card>
      ) : (
        <Empty description="暂无备货单数据" />
      ),
    },
    {
      key: "afterSales",
      label: <span><CustomerServiceOutlined /> 退货记录 ({afterSalesRecords.length})</span>,
      children: afterSalesRecords.length > 0 ? (
        <Card size="small" title="售后/退货记录">
          <Table
            dataSource={afterSalesRecords.map((r: any, i: number) => ({ ...r, key: i }))}
            columns={[
              { title: "售后单号", dataIndex: "afterSaleOrderSn", key: "sn", render: (v: any) => <span style={{ fontFamily: "monospace", fontSize: 12 }}>{safeRender(v)}</span> },
              { title: "类型", dataIndex: "afterSaleType", key: "type", render: (v: any) => <Tag>{safeRender(v)}</Tag> },
              { title: "状态", dataIndex: "status", key: "status", render: (v: any) => <Tag>{safeRender(v)}</Tag> },
              { title: "原因", dataIndex: "reason", key: "reason", ellipsis: true, render: (v: any) => safeRender(v) },
              { title: "数量", dataIndex: "quantity", key: "qty", render: (v: any) => safeRender(v) },
              { title: "创建时间", dataIndex: "createTime", key: "createTime", render: (v: any) => safeRender(v) },
            ]}
            size="small"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      ) : (
        <Empty description="暂无退货记录" />
      ),
    },
    {
      key: "quality",
      label: <span><SafetyCertificateOutlined /> 质量评分</span>,
      children: (qualityInfo || checkupInfo) ? (
        <div>
          {qualityInfo && (
            <Card size="small" title="质量评分详情" style={{ marginBottom: 16 }}>
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="质量分">{safeRender(qualityInfo.qualityScore)}</Descriptions.Item>
                <Descriptions.Item label="平均分">{safeRender(qualityInfo.avgScore)}</Descriptions.Item>
                <Descriptions.Item label="售后退货率">{safeRender(qualityInfo.qltyAfsOrdrRate)}</Descriptions.Item>
                {Object.entries(qualityInfo)
                  .filter(([key]) => !["qualityScore", "avgScore", "qltyAfsOrdrRate", "productSkcId"].includes(key))
                  .slice(0, 12)
                  .map(([key, value]) => (
                    <Descriptions.Item key={key} label={key}>
                      {safeRender(value)}
                    </Descriptions.Item>
                  ))}
              </Descriptions>
            </Card>
          )}
          {checkupInfo && (
            <Card size="small" title="体检报告">
              <Descriptions size="small" column={2}>
                {Object.entries(checkupInfo).slice(0, 16).map(([key, value]) => (
                  <Descriptions.Item key={key} label={key}>
                    {safeRender(value)}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Card>
          )}
        </div>
      ) : (
        <Empty description="暂无质量数据" style={{ marginTop: 40 }} />
      ),
    },
    {
      key: "price",
      label: <span><WarningOutlined /> 价格/限流</span>,
      children: (
        <div>
          <Card size="small" title="高价限流状态" style={{ marginBottom: 16 }}>
            {flowPriceInfo ? (
              <Descriptions size="small" column={2}>
                {Object.entries(flowPriceInfo).slice(0, 12).map(([key, value]) => (
                  <Descriptions.Item key={key} label={key}>
                    {safeRender(value)}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            ) : (
              <Paragraph type="secondary">该商品暂未被高价限流</Paragraph>
            )}
          </Card>
          <Card size="small" title="建议零售价">
            {retailPriceInfo.length > 0 ? (
              <Table
                dataSource={retailPriceInfo.map((r: any, i: number) => ({ ...r, key: i }))}
                columns={[
                  { title: "SKU", dataIndex: "skuId", key: "skuId", render: (v: any) => safeRender(v) },
                  { title: "当前价格", dataIndex: "currentPrice", key: "currentPrice", render: (v: any) => safeRender(v) },
                  { title: "建议价格", dataIndex: "suggestedPrice", key: "suggestedPrice", render: (v: any) => safeRender(v) },
                  { title: "站点", dataIndex: "siteCode", key: "siteCode", render: (v: any) => safeRender(v) },
                ]}
                size="small"
                pagination={false}
              />
            ) : (
              <Paragraph type="secondary">暂无建议零售价数据</Paragraph>
            )}
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/products")}>返回</Button>
        {p.imageUrl && (
          <Image src={p.imageUrl} width={64} height={64} style={{ objectFit: "cover", borderRadius: 8 }}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" />
        )}
        <div>
          <Title level={4} style={{ margin: 0 }}>{p.title}</Title>
          <Space size={8} style={{ marginTop: 4 }}>
            {p.skcId && <Tag>SKC: {p.skcId}</Tag>}
            {p.status && <Tag color={p.status === "在售" ? "green" : "default"}>{p.status}</Tag>}
          </Space>
        </div>
      </div>

      <Tabs items={tabItems} defaultActiveKey="basic" />
    </div>
  );
}
