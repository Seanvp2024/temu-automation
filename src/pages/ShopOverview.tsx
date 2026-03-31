import { useState, useEffect } from "react";
import {
  Alert,
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Tabs,
  Descriptions,
  Progress,
  Typography,
  Space,
  Empty,
  Spin,
  Segmented,
} from "antd";
import { parseDashboardData, parseFluxData } from "../utils/parseRawApis";
import {
  COLLECTION_DIAGNOSTICS_KEY,
  getCollectionDataIssue,
  normalizeCollectionDiagnostics,
  type CollectionDiagnostics,
} from "../utils/collectionDiagnostics";
import { getFirstExistingStoreValue, getStoreValue, STORE_KEY_ALIASES } from "../utils/storeCompat";
import { ACTIVE_ACCOUNT_CHANGED_EVENT } from "../utils/multiStore";

const { Title, Text } = Typography;

const store = window.electronAPI?.store;

// 安全渲染值：对象转 JSON，null 显示 "-"
function safeVal(val: any): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "object") return JSON.stringify(val).slice(0, 100);
  return String(val);
}

// 格式化金额
function formatAmount(val: any): string {
  if (val === null || val === undefined) return "-";
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return num.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// 从 raw store（apis 数组格式）中查找匹配路径的 API 数据
function findInRawStore(rawData: any, apiPathFragment: string): any {
  if (!rawData?.apis) return null;
  const api = rawData.apis.find((a: any) => a.path?.includes(apiPathFragment));
  return api?.data?.result || api?.data || null;
}

function deepFindObjectByKeys(rawData: any, keys: string[]): any {
  const queue = [rawData];
  const seen = new Set<any>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    if (keys.every((key) => key in current)) {
      return current;
    }

    if (Array.isArray(current)) {
      current.forEach((item) => queue.push(item));
      continue;
    }

    Object.values(current).forEach((value) => {
      if (value && typeof value === "object") queue.push(value);
    });
  }

  return null;
}

function extractFluxSummary(rawData: any) {
  if (!rawData) return null;
  if (rawData?.summary?.trendList || rawData?.summary?.todayVisitors !== undefined || rawData?.summary?.todayBuyers !== undefined) {
    return rawData.summary;
  }
  const summary = findInRawStore(rawData, "mall/summary");
  if (!summary) return null;
  return {
    todayVisitors: summary.todayTotalVisitorsNum ?? summary.todayVisitors ?? 0,
    todayBuyers: summary.todayPayBuyerNum ?? summary.todayBuyers ?? 0,
    todayConversionRate: summary.todayConversionRate ?? 0,
    trendList: Array.isArray(summary.trendList)
      ? summary.trendList.map((item: any) => ({
          date: item.statDate || item.date || "",
          visitors: item.visitorsNum ?? item.visitors ?? 0,
          buyers: item.payBuyerNum ?? item.buyers ?? 0,
          conversionRate: item.conversionRate ?? 0,
        }))
      : [],
  };
}

const ShopOverview: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<any>(null);
  const [flux, setFlux] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [soldout, setSoldout] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const [quality, setQuality] = useState<any>(null);
  const [govern, setGovern] = useState<any>(null);
  const [marketing, setMarketing] = useState<any>(null);
  const [adsHome, setAdsHome] = useState<any>(null);
  const [fluxUS, setFluxUS] = useState<any>(null);
  const [fluxEU, setFluxEU] = useState<any>(null);
  const [fluxRegion, setFluxRegion] = useState<string>("global");
  const [qualityEU, setQualityEU] = useState<any>(null);
  const [qualityRegion, setQualityRegion] = useState<string>("global");
  const [checkup, setCheckup] = useState<any>(null);
  const [qcDetail, setQcDetail] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<CollectionDiagnostics | null>(null);

  useEffect(() => {
    loadAllData();
    const handleActiveAccountChanged = () => {
      void loadAllData();
    };
    window.addEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleActiveAccountChanged);
    return () => {
      window.removeEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleActiveAccountChanged);
    };
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setDashboard(null);
    setFlux(null);
    setPerformance(null);
    setSoldout(null);
    setDelivery(null);
    setQuality(null);
    setGovern(null);
    setMarketing(null);
    setAdsHome(null);
    setFluxUS(null);
    setFluxEU(null);
    setQualityEU(null);
    setCheckup(null);
    setQcDetail(null);
    try {
      const [
        dashRaw, fluxRaw, perfRaw, soldoutRaw, deliveryRaw,
        qualityRaw, governRaw, marketingRaw, adsRaw,
        fluxUSRaw, fluxEURaw, qualityEURaw, checkupRaw, qcDetailRaw, diagnosticsRaw,
      ] = await Promise.all([
        getStoreValue(store, "temu_dashboard"),
        getStoreValue(store, "temu_flux"),
        getFirstExistingStoreValue(store, STORE_KEY_ALIASES.performance),
        getFirstExistingStoreValue(store, STORE_KEY_ALIASES.soldout),
        getFirstExistingStoreValue(store, STORE_KEY_ALIASES.delivery),
        getStoreValue(store, "temu_raw_qualityDashboard"),
        getStoreValue(store, "temu_raw_governDashboard"),
        getFirstExistingStoreValue(store, STORE_KEY_ALIASES.marketingActivity),
        getStoreValue(store, "temu_raw_adsHome"),
        getFirstExistingStoreValue(store, STORE_KEY_ALIASES.fluxUS),
        getFirstExistingStoreValue(store, STORE_KEY_ALIASES.fluxEU),
        getStoreValue(store, "temu_raw_qualityDashboardEU"),
        getStoreValue(store, "temu_raw_checkup"),
        getFirstExistingStoreValue(store, STORE_KEY_ALIASES.qcDetail),
        getStoreValue(store, COLLECTION_DIAGNOSTICS_KEY),
      ]);

      if (dashRaw) setDashboard(parseDashboardData(dashRaw));
      if (fluxRaw) setFlux(parseFluxData(fluxRaw));
      if (perfRaw) setPerformance(perfRaw);
      if (soldoutRaw) setSoldout(soldoutRaw);
      if (deliveryRaw) setDelivery(deliveryRaw);
      if (qualityRaw) setQuality(qualityRaw);
      if (governRaw) setGovern(governRaw);
      if (marketingRaw) setMarketing(marketingRaw);
      if (adsRaw) setAdsHome(adsRaw);
      if (fluxUSRaw) setFluxUS(fluxUSRaw);
      if (fluxEURaw) setFluxEU(fluxEURaw);
      if (qualityEURaw) setQualityEU(qualityEURaw);
      if (checkupRaw) setCheckup(checkupRaw);
      if (qcDetailRaw) setQcDetail(qcDetailRaw);
      setDiagnostics(normalizeCollectionDiagnostics(diagnosticsRaw));
    } catch (e) {
      console.error("加载店铺概览数据失败", e);
      setDiagnostics(null);
    } finally {
      setLoading(false);
    }
  };

  // ========== 数据提取 ==========

  const stats = dashboard?.statistics;
  const ranking = dashboard?.ranking;
  const income = dashboard?.income;

  // 流量数据 - 根据区域切换
  const getRegionFlux = () => {
    if (fluxRegion === "us") {
      const summary = extractFluxSummary(fluxUS);
      if (!summary) return { summary: null, trendList: [], yesterday: null };
      const trendList = summary.trendList || [];
      return {
        summary,
        trendList,
        yesterday: trendList.length >= 2 ? trendList[trendList.length - 2] : null,
      };
    }
    if (fluxRegion === "eu") {
      const summary = extractFluxSummary(fluxEU);
      if (!summary) return { summary: null, trendList: [], yesterday: null };
      const trendList = summary.trendList || [];
      return {
        summary,
        trendList,
        yesterday: trendList.length >= 2 ? trendList[trendList.length - 2] : null,
      };
    }
    // global
    const fluxSummary = flux?.summary || null;
    const trendList = fluxSummary?.trendList || [];
    return {
      summary: fluxSummary,
      trendList,
      yesterday: trendList.length >= 2 ? trendList[trendList.length - 2] : null,
    };
  };
  const regionFlux = getRegionFlux();
  const fluxSummary = regionFlux.summary;
  const fluxTrendList = regionFlux.trendList;
  const yesterdayFlux = regionFlux.yesterday;

  // 质量数据 - 根据区域切换
  const currentQuality = qualityRegion === "eu" ? qualityEU : quality;
  const qualityMetrics = findInRawStore(currentQuality, "qualityMetrics/query");
  const qualityScoreList = findInRawStore(currentQuality, "qualityScore/count");

  // 履约数据
  const perfAbstract = performance?.purchasePerformance?.abstractInfo
    || deepFindObjectByKeys(performance, ["supplierAvgScore", "excellentZoneStart", "excellentZoneEnd"])
    || null;

  // 售罄数据
  const soldoutOverview = soldout?.overview?.todayTotal
    || deepFindObjectByKeys(soldout, ["soonSellOutNum", "sellOutNum", "sellOutLossNum"])
    || null;

  // 物流发货
  const deliverySummary = delivery?.forwardSummary?.result
    || delivery?.forwardSummary
    || deepFindObjectByKeys(delivery, ["stagingCount", "forwardCount", "expiredCount"])
    || null;

  // 合规数据
  const complianceBoard = findInRawStore(govern, "compliance/dashBoard/main_page");
  const realPictureTodo = findInRawStore(govern, "realPicture/todoList/query");

  // 营销活动
  const marketingStats = findInRawStore(marketing, "activity/statistics");
  const marketingTodo = findInRawStore(marketing, "activity/todo");

  // 广告数据
  const adsCount = findInRawStore(adsHome, "coconut/message_box/count");

  const dataIssues = [
    getCollectionDataIssue(diagnostics, "dashboard", "店铺概览", Boolean(dashboard)),
    getCollectionDataIssue(diagnostics, "flux", "流量分析", Boolean(flux || fluxUS || fluxEU)),
    getCollectionDataIssue(diagnostics, "qualityDashboard", "质量看板", Boolean(quality || qualityEU)),
    getCollectionDataIssue(diagnostics, "performance", "履约表现", Boolean(perfAbstract)),
    getCollectionDataIssue(diagnostics, "marketingActivity", "营销活动", Boolean(marketing)),
    getCollectionDataIssue(diagnostics, "delivery", "发货数据", Boolean(deliverySummary)),
    getCollectionDataIssue(diagnostics, "soldout", "售罄分析", Boolean(soldoutOverview)),
    getCollectionDataIssue(diagnostics, "checkup", "店铺体检", Boolean(checkup)),
    getCollectionDataIssue(diagnostics, "qcDetail", "抽检结果", Boolean(qcDetail)),
  ].filter((issue): issue is string => Boolean(issue));

  // ========== Tab 1: 数据概览 ==========
  const renderOverviewTab = () => (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {/* 核心统计 */}
      <Card
        title={<div className="section-title">核心数据</div>}
        style={{ borderRadius: 12, border: "1px solid #f0f0f0" }}
      >
        <Row gutter={[16, 16]}>
          <Col span={4}>
            <Card className="stat-card stat-orange" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #e55b00" }}>
              <Statistic title="在售商品" value={safeVal(stats?.onSaleProducts)} valueStyle={{ color: "#e55b00", fontSize: 32, fontWeight: 700 }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card stat-blue" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #1677ff" }}>
              <Statistic title="备货单" value={safeVal(dashboard?.productStatus?.toSubmit)} valueStyle={{ color: "#1677ff", fontSize: 32, fontWeight: 700 }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card stat-green" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #00b96b" }}>
              <Statistic title="7日销量" value={safeVal(stats?.sevenDaysSales)} valueStyle={{ color: "#00b96b", fontSize: 32, fontWeight: 700 }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card stat-green" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #00b96b" }}>
              <Statistic title="30日销量" value={safeVal(stats?.thirtyDaysSales)} valueStyle={{ color: "#00b96b", fontSize: 32, fontWeight: 700 }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card stat-purple" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #722ed1" }}>
              <Statistic title="今日访客" value={safeVal(fluxSummary?.todayVisitors)} valueStyle={{ color: "#722ed1", fontSize: 32, fontWeight: 700 }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card stat-purple" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #722ed1" }}>
              <Statistic title="今日买家" value={safeVal(fluxSummary?.todayBuyers)} valueStyle={{ color: "#722ed1", fontSize: 32, fontWeight: 700 }} />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 预警统计 */}
      <Card
        title={<div className="section-title">预警信息</div>}
        style={{ borderRadius: 12, border: "1px solid #f0f0f0", marginTop: 24 }}
      >
        <Row gutter={[16, 16]}>
          <Col span={4}>
            <Card className="stat-card warn-card stat-red" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #ff4d4f" }}>
              <Statistic title="缺货SKC" value={safeVal(stats?.lackSkcNumber)} valueStyle={{ color: "#ff4d4f", fontSize: 32, fontWeight: 700 }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card warn-card stat-red" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #ff4d4f" }}>
              <Statistic title="售罄商品" value={safeVal(stats?.alreadySoldOut)} valueStyle={{ color: "#ff4d4f", fontSize: 32, fontWeight: 700 }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card warn-card stat-gold" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #faad14" }}>
              <Statistic title="即将售罄" value={safeVal(stats?.aboutToSellOut)} valueStyle={{ color: "#d48806", fontSize: 32, fontWeight: 700 }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card stat-gold" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #faad14" }}>
              <Statistic title="建议备货" value={safeVal(stats?.advicePrepareSkcNumber)} valueStyle={{ color: "#d48806", fontSize: 32, fontWeight: 700 }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card stat-orange" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #e55b00" }}>
              <Statistic title="待处理" value={safeVal(stats?.waitProductNumber)} valueStyle={{ color: "#e55b00", fontSize: 32, fontWeight: 700 }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card warn-card stat-red" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #ff4d4f" }}>
              <Statistic title="高价限制" value={safeVal(stats?.highPriceLimit)} valueStyle={{ color: "#ff4d4f", fontSize: 32, fontWeight: 700 }} />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 近期收入 */}
      <Card
        title={<div className="section-title">近期收入</div>}
        style={{ borderRadius: 12, border: "1px solid #f0f0f0", marginTop: 24 }}
      >
        {Array.isArray(income) && income.length > 0 ? (
          <div style={{ borderRadius: 12, overflow: "hidden" }}>
            <Table
              dataSource={income.map((item: any, idx: number) => ({
                key: idx,
                date: safeVal(item.date),
                amount: item.amount,
              }))}
              columns={[
                { title: "日期", dataIndex: "date", key: "date" },
                {
                  title: "收入",
                  dataIndex: "amount",
                  key: "amount",
                  render: (val: any) => (
                    <span style={{ borderLeft: "3px solid #00b96b", paddingLeft: 8, fontWeight: 500 }}>
                      {formatAmount(val)}
                    </span>
                  ),
                },
              ]}
              bordered={false}
              pagination={false}
              size="small"
            />
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无收入数据" />
        )}
      </Card>

      {/* 店铺排名 */}
      <Card
        title={<div className="section-title">店铺排名</div>}
        style={{ borderRadius: 12, border: "1px solid #f0f0f0", marginTop: 24 }}
      >
        {ranking ? (
          <Row gutter={[24, 20]} justify="center">
            <Col span={6} style={{ textAlign: "center" }}>
              <div style={{ display: "inline-block", padding: 12, borderRadius: "50%", background: "#f0f5ff" }}>
                <Progress
                  type="circle"
                  percent={ranking.overall ? Math.min(100, ranking.overall) : 0}
                  format={() => safeVal(ranking.overall)}
                  size={90}
                />
              </div>
              <div style={{ marginTop: 10 }}>
                <Text strong>综合排名</Text>
              </div>
            </Col>
            <Col span={6} style={{ textAlign: "center" }}>
              <div style={{ display: "inline-block", padding: 12, borderRadius: "50%", background: "#f6ffed" }}>
                <Progress
                  type="circle"
                  percent={ranking.pvRank ? Math.min(100, ranking.pvRank) : 0}
                  format={() => safeVal(ranking.pvRank)}
                  size={90}
                />
              </div>
              <div style={{ marginTop: 10 }}>
                <Text strong>PV排名</Text>
              </div>
            </Col>
            <Col span={6} style={{ textAlign: "center" }}>
              <div style={{ display: "inline-block", padding: 12, borderRadius: "50%", background: "#f9f0ff" }}>
                <Progress
                  type="circle"
                  percent={ranking.richnessRank ? Math.min(100, ranking.richnessRank) : 0}
                  format={() => safeVal(ranking.richnessRank)}
                  size={90}
                />
              </div>
              <div style={{ marginTop: 10 }}>
                <Text strong>商品丰富度</Text>
              </div>
            </Col>
            <Col span={6} style={{ textAlign: "center" }}>
              <div style={{ display: "inline-block", padding: 12, borderRadius: "50%", background: "#fff7f0" }}>
                <Progress
                  type="circle"
                  percent={ranking.saleOutRate ? Math.min(100, ranking.saleOutRate) : 0}
                  format={() => safeVal(ranking.saleOutRate)}
                  size={90}
                />
              </div>
              <div style={{ marginTop: 10 }}>
                <Text strong>售罄率排名</Text>
              </div>
            </Col>
          </Row>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无排名数据" />
        )}
      </Card>
    </Space>
  );

  // ========== Tab 2: 流量分析 ==========
  const renderFluxTab = () => (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {/* 区域切换 */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Segmented
          value={fluxRegion}
          onChange={(v) => setFluxRegion(v as string)}
          options={[
            { label: "🌍 全球", value: "global" },
            { label: "🇺🇸 美国", value: "us" },
            { label: "🇪🇺 欧盟", value: "eu" },
          ]}
          style={{ borderRadius: 8 }}
        />
      </div>

      <Card
        title={<div className="section-title">流量概览{fluxRegion === "us" ? "（美国）" : fluxRegion === "eu" ? "（欧盟）" : ""}</div>}
        style={{ borderRadius: 12, border: "1px solid #f0f0f0" }}
      >
        <Row gutter={[20, 20]}>
          <Col span={4}>
            <Card className="stat-card" size="small" style={{ borderRadius: 10, background: "#f9f0ff" }}>
              <Statistic
                title="今日访客"
                value={safeVal(fluxSummary?.todayVisitors)}
                valueStyle={{ color: "#722ed1" }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card" size="small" style={{ borderRadius: 10, background: "#f9f0ff" }}>
              <Statistic
                title="今日买家"
                value={safeVal(fluxSummary?.todayBuyers)}
                valueStyle={{ color: "#722ed1" }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card stat-green" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #00b96b" }}>
              <Statistic
                title="今日转化率"
                value={fluxSummary?.todayConversionRate ? (fluxSummary.todayConversionRate * 100).toFixed(2) : "-"}
                suffix="%"
                valueStyle={{ color: "#00b96b", fontSize: 32, fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card stat-blue" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #1677ff" }}>
              <Statistic
                title="昨日访客"
                value={yesterdayFlux?.visitors ?? "-"}
                valueStyle={{ color: "#1677ff", fontSize: 32, fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card stat-blue" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #1677ff" }}>
              <Statistic
                title="昨日买家"
                value={yesterdayFlux?.buyers ?? "-"}
                valueStyle={{ color: "#1677ff", fontSize: 32, fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card className="stat-card stat-orange" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #e55b00" }}>
              <Statistic
                title="昨日转化率"
                value={yesterdayFlux?.conversionRate ? (yesterdayFlux.conversionRate * 100).toFixed(2) : "-"}
                suffix="%"
                valueStyle={{ color: "#e55b00", fontSize: 32, fontWeight: 700 }}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Card
        title={<div className="section-title">流量趋势</div>}
        style={{ borderRadius: 12, border: "1px solid #f0f0f0", marginTop: 24 }}
      >
        {fluxTrendList.length > 0 ? (
          <div style={{ borderRadius: 12, overflow: "hidden" }}>
            <Table
              dataSource={fluxTrendList.map((item: any, idx: number) => ({
                key: idx,
                ...item,
              }))}
              columns={[
                { title: "日期", dataIndex: "date", key: "date", width: 120 },
                { title: "访客数", dataIndex: "visitors", key: "visitors", render: (v: number) => <span style={{ color: "#1677ff", fontWeight: 600 }}>{v?.toLocaleString() ?? "-"}</span> },
                { title: "买家数", dataIndex: "buyers", key: "buyers", render: (v: number) => <span style={{ color: "#00b96b", fontWeight: 600 }}>{v?.toLocaleString() ?? "-"}</span> },
                { title: "转化率", dataIndex: "conversionRate", key: "conversionRate", render: (v: number) => <span style={{ color: "#e55b00", fontWeight: 600 }}>{v ? (v * 100).toFixed(2) + "%" : "-"}</span> },
              ]}
              bordered={false}
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无流量趋势数据" />
        )}
      </Card>
    </Space>
  );

  // ========== Tab 3: 质量与履约 ==========
  const scoreEnumMap: Record<number, { label: string; color: string }> = {
    1: { label: "优秀", color: "#00b96b" },
    2: { label: "良好", color: "#1677ff" },
    3: { label: "一般", color: "#faad14" },
    4: { label: "较差", color: "#ff4d4f" },
    5: { label: "极差", color: "#cf1322" },
  };

  const renderQualityTab = () => (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {/* 区域切换 */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Segmented
          value={qualityRegion}
          onChange={(v) => setQualityRegion(v as string)}
          options={[
            { label: "🌍 全球", value: "global" },
            { label: "🇪🇺 欧盟", value: "eu" },
          ]}
          style={{ borderRadius: 8 }}
        />
      </div>

      {/* 质量评分卡片 */}
      <Card
        title={<div className="section-title">质量评分{qualityRegion === "eu" ? "（欧盟）" : ""}</div>}
        style={{ borderRadius: 12, border: "1px solid #f0f0f0" }}
      >
        {qualityMetrics ? (
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Card className="stat-card stat-blue" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #1677ff" }}>
                <Statistic title="90天平均评分" value={Number(qualityMetrics.avgScore90d)?.toFixed(2) || "-"} valueStyle={{ color: "#1677ff", fontSize: 32, fontWeight: 700 }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card className="stat-card stat-orange" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #e55b00" }}>
                <Statistic title="90天售后退货率" value={qualityMetrics.qltyAfsOrdrRate90d ? (Number(qualityMetrics.qltyAfsOrdrRate90d) * 100).toFixed(2) : "-"} suffix="%" valueStyle={{ color: "#e55b00", fontSize: 32, fontWeight: 700 }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card className="stat-card stat-green" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #00b96b" }}>
                <Statistic title="质量售后成本" value={qualityMetrics.qltyAfsCst != null ? `¥${Number(qualityMetrics.qltyAfsCst).toFixed(2)}` : "-"} valueStyle={{ color: "#00b96b", fontSize: 32, fontWeight: 700 }} />
              </Card>
            </Col>
          </Row>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无质量评分数据" />
        )}
      </Card>

      {/* 商品质量分布 */}
      <Card
        title={<div className="section-title">商品质量分布</div>}
        style={{ borderRadius: 12, border: "1px solid #f0f0f0", marginTop: 24 }}
      >
        {qualityScoreList?.productQualityScoreList?.length > 0 ? (
          <Row gutter={[16, 16]}>
            {qualityScoreList.productQualityScoreList.map((item: any, idx: number) => {
              const enumVal = item.qualityScoreEnum || item.scoreEnum || idx + 1;
              const meta = scoreEnumMap[enumVal] || { label: `等级${enumVal}`, color: "#999" };
              const count = item.productQuantity || item.count || 0;
              return (
                <Col span={6} key={idx}>
                  <Card size="small" style={{ borderRadius: 10, borderTop: `3px solid ${meta.color}`, textAlign: "center" }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: meta.color }}>{count}</div>
                    <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                      <Tag color={meta.color} style={{ borderRadius: 4 }}>{meta.label}</Tag>
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无商品质量分布数据" />
        )}
      </Card>

      {/* 履约表现 */}
      <Card
        title={<div className="section-title">履约表现</div>}
        style={{ borderRadius: 12, border: "1px solid #f0f0f0", marginTop: 24 }}
      >
        {perfAbstract ? (
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Card className="stat-card stat-purple" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #722ed1" }}>
                <Statistic title="供应商综合得分" value={perfAbstract.supplierAvgScore ?? "-"} valueStyle={{ color: "#722ed1", fontSize: 32, fontWeight: 700 }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ borderRadius: 10, borderLeft: "4px solid #00b96b" }}>
                <Statistic title="优秀区间" value={`${perfAbstract.excellentZoneStart ?? "-"} ~ ${perfAbstract.excellentZoneEnd ?? "-"}`} valueStyle={{ color: "#00b96b", fontSize: 20, fontWeight: 600 }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ borderRadius: 10, borderLeft: "4px solid #faad14" }}>
                <Statistic title="良好区间" value={`${perfAbstract.wellZoneStart ?? "-"} ~ ${perfAbstract.wellZoneEnd ?? "-"}`} valueStyle={{ color: "#faad14", fontSize: 20, fontWeight: 600 }} />
              </Card>
            </Col>
          </Row>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无履约表现数据" />
        )}
      </Card>

      {/* 抽检结果明细 */}
      {(() => {
        const checkScore = findInRawStore(checkup, "check/score");
        const checkRules = findInRawStore(checkup, "check/rule/list");
        const checkProducts = findInRawStore(checkup, "check/product/list");
        const productList = checkProducts?.pageItems || checkProducts?.list || [];
        const ruleList = checkRules?.supplierCheckRuleList || [];

        return (
          <>
            <Card
              title={<div className="section-title">店铺体检</div>}
              style={{ borderRadius: 12, border: "1px solid #f0f0f0", marginTop: 24 }}
            >
              {checkScore ? (
                <Row gutter={[16, 16]}>
                  <Col span={6}>
                    <Card className="stat-card stat-blue" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #1677ff" }}>
                      <Statistic title="体检评分" value={checkScore.score ?? "-"} valueStyle={{ color: "#1677ff", fontSize: 32, fontWeight: 700 }} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card className="stat-card stat-purple" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #722ed1" }}>
                      <Statistic title="商品总数" value={checkScore.productNumber ?? "-"} valueStyle={{ color: "#722ed1", fontSize: 32, fontWeight: 700 }} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card className="stat-card stat-red" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #ff4d4f" }}>
                      <Statistic title="问题商品" value={checkScore.problemProductNumber ?? "-"} valueStyle={{ color: "#ff4d4f", fontSize: 32, fontWeight: 700 }} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card className="stat-card stat-orange" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #e55b00" }}>
                      <Statistic title="检查规则数" value={checkScore.supplierCheckRuleNumber ?? "-"} valueStyle={{ color: "#e55b00", fontSize: 32, fontWeight: 700 }} />
                    </Card>
                  </Col>
                </Row>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无体检数据" />
              )}
            </Card>

            {ruleList.length > 0 && (
              <Card
                title={<div className="section-title">问题分类</div>}
                style={{ borderRadius: 12, border: "1px solid #f0f0f0", marginTop: 24 }}
              >
                {ruleList.map((rule: any, idx: number) => (
                  <div key={idx} style={{ marginBottom: idx < ruleList.length - 1 ? 16 : 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: "#1a1a2e" }}>
                      {rule.ruleName} <Tag color="red" style={{ borderRadius: 4 }}>{rule.number} 个问题</Tag>
                    </div>
                    {rule.childCheckRuleList?.length > 0 && (
                      <Row gutter={[12, 12]}>
                        {rule.childCheckRuleList.map((child: any, ci: number) => (
                          <Col span={8} key={ci}>
                            <Card size="small" style={{ borderRadius: 8, borderLeft: `3px solid ${child.number > 50 ? "#ff4d4f" : child.number > 10 ? "#faad14" : "#00b96b"}` }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 13, color: "#333" }}>{child.ruleName}</span>
                                <span style={{ fontSize: 20, fontWeight: 700, color: child.number > 50 ? "#ff4d4f" : child.number > 10 ? "#faad14" : "#00b96b" }}>
                                  {child.number}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>权重: {((child.weight || 0) * 100).toFixed(0)}% | 扣分: {child.score ?? "-"}</div>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    )}
                  </div>
                ))}
              </Card>
            )}

            {productList.length > 0 && (
              <Card
                title={<div className="section-title">问题商品明细 ({productList.length})</div>}
                style={{ borderRadius: 12, border: "1px solid #f0f0f0", marginTop: 24 }}
              >
                <div style={{ borderRadius: 12, overflow: "hidden" }}>
                  <Table
                    dataSource={productList.map((p: any, i: number) => ({ key: i, ...p }))}
                    columns={[
                      {
                        title: "商品名称", dataIndex: "productName", key: "name", width: 350, ellipsis: true,
                        render: (v: string, r: any) => (
                          <Space>
                            {r.productImageList?.carouselImageUrls?.[0] && (
                              <img src={r.productImageList.carouselImageUrls[0]} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover" }} />
                            )}
                            <span style={{ fontSize: 13 }}>{v?.slice(0, 60) || "-"}</span>
                          </Space>
                        ),
                      },
                      {
                        title: "类目", dataIndex: "categoriesSimpleVO", key: "cat", width: 150,
                        render: (v: any) => <span style={{ fontSize: 12, color: "#666" }}>{v?.leafCat?.catName || v?.cat1?.catName || "-"}</span>,
                      },
                      {
                        title: "问题类型", dataIndex: "supplierCheckRuleList", key: "rules", width: 200,
                        render: (rules: any[]) => (
                          <Space wrap>
                            {rules?.map((r: any, i: number) => (
                              <Tag key={i} color="red" style={{ borderRadius: 4 }}>{r.ruleName || `规则${r.ruleId}`}</Tag>
                            )) || "-"}
                          </Space>
                        ),
                      },
                    ]}
                    bordered={false}
                    pagination={{ pageSize: 10 }}
                    size="small"
                  />
                </div>
              </Card>
            )}
          </>
        );
      })()}

      {/* 抽检结果明细 (商家中心) */}
      {(() => {
        // 从 qcDetail 中提取抽检列表
        const allPagesApi = qcDetail?.apis?.find((a: any) => a.path?.includes("all-pages"));
        const qcListApi = qcDetail?.apis?.find((a: any) => {
          const r = a.data?.result;
          return r && (r.list || r.pageItems || r.total);
        });
        const qcItems = allPagesApi?.data?.result?.list || qcListApi?.data?.result?.list || qcListApi?.data?.result?.pageItems || [];
        const qcTotal = allPagesApi?.data?.result?.total || qcListApi?.data?.result?.total || qcItems.length;

        if (qcItems.length === 0 && !qcTotal) return (
          <Card
            title={<div className="section-title">抽检结果明细</div>}
            style={{ borderRadius: 12, border: "1px solid #f0f0f0", marginTop: 24 }}
          >
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无抽检数据，请重新采集" />
          </Card>
        );

        return (
          <Card
            title={<div className="section-title">抽检结果明细 ({qcTotal})</div>}
            style={{ borderRadius: 12, border: "1px solid #f0f0f0", marginTop: 24 }}
          >
            <div style={{ borderRadius: 12, overflow: "hidden" }}>
              <Table
                dataSource={qcItems.map((item: any, i: number) => ({ key: i, ...item }))}
                columns={[
                  {
                    title: "商品信息", dataIndex: "productName", key: "name", width: 300, ellipsis: true,
                    render: (v: string, r: any) => {
                      const img = r.productImageList?.carouselImageUrls?.[0] || r.imageUrl || r.goodsImageUrl;
                      return (
                        <Space>
                          {img && <img src={img} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover" }} />}
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{(v || r.goodsName || "-").slice(0, 50)}</div>
                            <div style={{ fontSize: 11, color: "#999" }}>
                              {r.spuId ? `SPU: ${r.spuId}` : ""} {r.skcId ? `SKC: ${r.skcId}` : ""} {r.productSkcId ? `SKC: ${r.productSkcId}` : ""}
                            </div>
                          </div>
                        </Space>
                      );
                    },
                  },
                  {
                    title: "SKU信息", key: "sku", width: 150,
                    render: (_: any, r: any) => (
                      <div style={{ fontSize: 12 }}>
                        {r.skuId ? <div>SKU: {r.skuId}</div> : null}
                        {r.skuAttr || r.attribute ? <div style={{ color: "#666" }}>{r.skuAttr || r.attribute}</div> : null}
                      </div>
                    ),
                  },
                  {
                    title: "备货单号", dataIndex: "purchaseOrderSn", key: "po", width: 180,
                    render: (v: string) => <span style={{ fontSize: 12, fontFamily: "monospace" }}>{v || "-"}</span>,
                  },
                  {
                    title: "抽检时间", dataIndex: "checkTime", key: "time", width: 160,
                    render: (v: any) => {
                      if (!v) return "-";
                      if (typeof v === "number") return new Date(v).toLocaleString("zh-CN");
                      return String(v);
                    },
                  },
                  {
                    title: "结果", dataIndex: "checkResult", key: "result", width: 100,
                    render: (v: any) => {
                      const text = v === 1 || v === "合格" ? "合格" : v === 2 || v === "不合格" ? "不合格" : safeVal(v);
                      const color = text === "合格" ? "#00b96b" : text === "不合格" ? "#ff4d4f" : "#666";
                      return <Tag color={color} style={{ borderRadius: 4 }}>{text}</Tag>;
                    },
                  },
                ]}
                bordered={false}
                pagination={{ pageSize: 10 }}
                size="small"
              />
            </div>
          </Card>
        );
      })()}
    </Space>
  );

  // ========== Tab 4: 营销活动 ==========
  const renderMarketingTab = () => (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card
        title={<div className="section-title">昨日营销数据</div>}
        style={{ borderRadius: 12, border: "1px solid #f0f0f0" }}
      >
        {marketingStats?.yesterdayStatistics ? (() => {
          const s = marketingStats.yesterdayStatistics;
          return (
            <Row gutter={[16, 16]}>
              <Col span={6}>
                <Card className="stat-card stat-orange" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #e55b00" }}>
                  <Statistic title="活动支付金额" value={s.activityPayAmountTotal ? `¥${Number(s.activityPayAmountTotal).toLocaleString()}` : "-"} valueStyle={{ color: "#e55b00", fontSize: 28, fontWeight: 700 }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card className="stat-card stat-purple" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #722ed1" }}>
                  <Statistic title="活动商品数" value={s.activityGoodsCount ?? "-"} valueStyle={{ color: "#722ed1", fontSize: 28, fontWeight: 700 }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card className="stat-card stat-blue" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #1677ff" }}>
                  <Statistic title="活动订单数" value={s.activityGoodsOrderCount ?? "-"} valueStyle={{ color: "#1677ff", fontSize: 28, fontWeight: 700 }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card className="stat-card stat-green" size="small" style={{ borderRadius: 10, borderLeft: "4px solid #00b96b" }}>
                  <Statistic title="加购数" value={s.activityGoodsCartCount ?? "-"} valueStyle={{ color: "#00b96b", fontSize: 28, fontWeight: 700 }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: "#666" }}>支付金额占比</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#e55b00", marginTop: 4 }}>{s.activityPayAmountRatio ? `${Number(s.activityPayAmountRatio).toFixed(1)}%` : "-"}</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: "#666" }}>订单转化率</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#1677ff", marginTop: 4 }}>{s.activityGoodsOrderRatio ? `${Number(s.activityGoodsOrderRatio).toFixed(2)}%` : "-"}</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: "#666" }}>加购率</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#00b96b", marginTop: 4 }}>{s.activityGoodsCartRatio ? `${(Number(s.activityGoodsCartRatio) * 100).toFixed(2)}%` : "-"}</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: "#666" }}>商品占比</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#722ed1", marginTop: 4 }}>{s.activityGoodsRatio ? `${Number(s.activityGoodsRatio).toFixed(1)}%` : "0%"}</div>
                </Card>
              </Col>
            </Row>
          );
        })() : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无营销统计数据" />
        )}
      </Card>

      <Card
        title={<div className="section-title">活动待办</div>}
        style={{ borderRadius: 12, border: "1px solid #f0f0f0", marginTop: 24 }}
      >
        {marketingTodo ? (
          <Row gutter={[20, 20]}>
            <Col span={8}>
              <Card className="stat-card warn-card" size="small" style={{ borderRadius: 10, background: "#fff2f0" }}>
                <Statistic
                  title="缺货数量"
                  value={safeVal(marketingTodo.stockShort)}
                  valueStyle={{ color: "#ff4d4f" }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card className="stat-card" size="small" style={{ borderRadius: 10, background: "#f0f5ff" }}>
                <Statistic
                  title="处理中"
                  value={safeVal(marketingTodo.inProcess)}
                  valueStyle={{ color: "#1677ff" }}
                />
              </Card>
            </Col>
          </Row>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无活动待办数据" />
        )}
      </Card>
    </Space>
  );

  // ========== Tab 5: 合规状态 ==========
  const renderComplianceTab = () => {
    const boardList =
      complianceBoard?.addition_compliance_board_list || [];

    return (
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Card
          title={<div className="section-title">合规看板</div>}
          style={{ borderRadius: 12, border: "1px solid #f0f0f0" }}
        >
          {Array.isArray(boardList) && boardList.length > 0 ? (
            <div style={{ borderRadius: 12, overflow: "hidden" }}>
              <Table
                dataSource={boardList.map((item: any, idx: number) => ({
                  key: idx,
                  type: safeVal(item.dash_board_type),
                  count: safeVal(item.main_show_num),
                  url: safeVal(item.jump_url),
                }))}
                columns={[
                  { title: "类型", dataIndex: "type", key: "type" },
                  { title: "数量", dataIndex: "count", key: "count" },
                  { title: "跳转链接", dataIndex: "url", key: "url", ellipsis: true },
                ]}
                bordered={false}
                pagination={false}
                size="small"
              />
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无合规数据" />
          )}
        </Card>

        <Card
          title={<div className="section-title">实拍图待办</div>}
          style={{ borderRadius: 12, border: "1px solid #f0f0f0", marginTop: 24 }}
        >
          <Card className="stat-card" size="small" style={{ borderRadius: 10, background: "#f0f5ff", display: "inline-block" }}>
            <Statistic
              title="待处理总数"
              value={safeVal(realPictureTodo?.totalCount)}
              valueStyle={{ color: "#1677ff" }}
            />
          </Card>
        </Card>
      </Space>
    );
  };

  // ========== Tab 6: 物流发货 ==========
  const renderDeliveryTab = () => (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card
        title={<div className="section-title">发货概览</div>}
        style={{ borderRadius: 12, border: "1px solid #f0f0f0" }}
      >
        {deliverySummary ? (
          <Row gutter={[20, 20]}>
            <Col span={8}>
              <Card className="stat-card" size="small" style={{ borderRadius: 10, background: "#f0f5ff" }}>
                <Statistic
                  title="暂存数量"
                  value={safeVal(deliverySummary.stagingCount)}
                  valueStyle={{ color: "#1677ff" }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card className="stat-card" size="small" style={{ borderRadius: 10, background: "#f6ffed" }}>
                <Statistic
                  title="正向发货数"
                  value={safeVal(deliverySummary.forwardCount)}
                  valueStyle={{ color: "#00b96b" }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card className="stat-card warn-card" size="small" style={{ borderRadius: 10, background: "#fff2f0" }}>
                <Statistic
                  title="过期数量"
                  value={safeVal(deliverySummary.expiredCount)}
                  valueStyle={{ color: "#ff4d4f" }}
                />
              </Card>
            </Col>
          </Row>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无发货数据" />
        )}
      </Card>

      <Card
        title={<div className="section-title">售罄概览</div>}
        style={{ borderRadius: 12, border: "1px solid #f0f0f0", marginTop: 24 }}
      >
        {soldoutOverview ? (
          <Row gutter={[20, 20]}>
            <Col span={6}>
              <Card className="stat-card warn-card" size="small" style={{ borderRadius: 10, background: "#fff7e6" }}>
                <Statistic
                  title="即将售罄"
                  value={safeVal(soldoutOverview.soonSellOutNum)}
                  valueStyle={{ color: "#ff4d4f" }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="stat-card warn-card" size="small" style={{ borderRadius: 10, background: "#fff2f0" }}>
                <Statistic
                  title="已售罄"
                  value={safeVal(soldoutOverview.sellOutNum)}
                  valueStyle={{ color: "#ff4d4f" }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="stat-card warn-card" size="small" style={{ borderRadius: 10, background: "#fff2f0" }}>
                <Statistic
                  title="售罄损失"
                  value={safeVal(soldoutOverview.sellOutLossNum)}
                  valueStyle={{ color: "#ff4d4f" }}
                />
              </Card>
            </Col>
          </Row>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无售罄数据" />
        )}
      </Card>
    </Space>
  );

  // ========== 主渲染 ==========
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 100 }}>
        <Spin size="large" tip="加载店铺概览数据..." />
      </div>
    );
  }

  const tabItems = [
    {
      key: "overview",
      label: "数据概览",
      children: renderOverviewTab(),
    },
    {
      key: "flux",
      label: "流量分析",
      children: renderFluxTab(),
    },
    {
      key: "quality",
      label: "质量与履约",
      children: renderQualityTab(),
    },
    {
      key: "marketing",
      label: "营销活动",
      children: renderMarketingTab(),
    },
    {
      key: "compliance",
      label: "合规状态",
      children: renderComplianceTab(),
    },
    {
      key: "delivery",
      label: "物流发货",
      children: renderDeliveryTab(),
    },
  ];

  return (
    <div>
      {dataIssues.length > 0 && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message="部分模块暂无可用数据"
          description={[
            dataIssues.slice(0, 4).join("；"),
            dataIssues.length > 4 ? `另有 ${dataIssues.length - 4} 个模块也需要重新采集。` : "",
            diagnostics?.syncedAt ? `最近一次采集时间：${diagnostics.syncedAt}` : "",
          ].filter(Boolean).join(" ")}
        />
      )}
      <Tabs
        defaultActiveKey="overview"
        items={tabItems}
        tabBarStyle={{ marginBottom: 24 }}
      />
    </div>
  );
};

export default ShopOverview;
