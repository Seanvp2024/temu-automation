# 前端数据展示重构计划

## 现状
- 62个采集任务，46个store文件全部有数据
- 前端只有5个路由（店铺概览、商品管理、任务管理、设置、账号管理）
- 6个页面写好了但没挂载到路由（ActivityData, Analytics, GoodsData, OrderList, PerformanceBoard, SalesManagement）
- 大量数据（物流、退货、价格、质量、合规、广告等）完全无法在前端查看

## 方案：挂载所有已有页面 + 新增缺失页面

### 第一步：挂载已有的6个未挂载页面

在App.tsx中添加路由，在AppLayout.tsx中添加菜单：

| 路由 | 组件 | 菜单名 | 数据源 |
|------|------|--------|--------|
| `/orders` | OrderList | 订单管理 | temu_orders |
| `/sales` | SalesManagement | 销售管理 | temu_sales |
| `/analytics` | Analytics | 流量分析 | temu_flux |
| `/activity` | ActivityData | 活动数据 | temu_activity_data |
| `/goods-data` | GoodsData | 商品数据 | temu_goods_data |
| `/performance` | PerformanceBoard | 履约看板 | temu_performance |

### 第二步：新增9个页面覆盖剩余数据

| 路由 | 页面 | 菜单名 | 数据源 |
|------|------|--------|--------|
| `/shipping` | ShippingPage | 物流管理 | temu_shipping_desk, temu_shipping_list, temu_address_manage, temu_urgent_orders |
| `/returns` | ReturnsPage | 退货管理 | temu_return_orders, temu_return_detail, temu_sales_return, temu_return_receipt |
| `/pricing` | PricingPage | 价格管理 | temu_price_report, temu_flow_price, temu_retail_price, temu_price_compete |
| `/quality` | QualityPage | 质量管理 | temu_quality_dashboard, temu_quality_eu, temu_qc_detail, temu_checkup |
| `/marketing` | MarketingPage | 营销推广 | temu_marketing_activity, temu_chance_goods, temu_bidding, temu_hot_plan |
| `/lifecycle` | LifecyclePage | 商品生命周期 | temu_lifecycle, temu_image_task, temu_sample_manage |
| `/compliance` | CompliancePage | 合规中心 | temu_raw_governDashboard 等16个govern数据 |
| `/ads` | AdsPage | 广告推广 | temu_raw_adsHome等6个ads数据 |
| `/flux-detail` | FluxDetailPage | 流量明细 | temu_mall_flux, temu_flux_eu, temu_flux_us, temu_flow_grow 等 |

### 第三步：每个新页面的展示方式

不再使用DataBrowser显示原始JSON，而是：

1. **提取关键业务API**（过滤掉系统API如auth、privilege等）
2. **自动检测数据类型**：
   - 数组 → 表格（自动提取列名）
   - 对象 → 描述列表（key-value）
   - 数字 → 统计卡片
3. **按API分组展示**，每个API一个Card
4. **值为对象时转为字符串**，避免React渲染错误

### 侧边栏菜单结构

```
📊 店铺概览 (Dashboard)
📦 商品管理 (ProductList)
  └─ 商品详情 (ProductDetail)
📊 商品数据 (GoodsData)
🔄 商品生命周期 (LifecyclePage)
💰 销售管理 (SalesManagement)
📋 订单管理 (OrderList)
🚚 物流管理 (ShippingPage)
↩️ 退货管理 (ReturnsPage)
💲 价格管理 (PricingPage)
📈 流量分析 (Analytics)
📊 流量明细 (FluxDetailPage)
🎯 活动数据 (ActivityData)
📢 营销推广 (MarketingPage)
📺 广告推广 (AdsPage)
✅ 质量管理 (QualityPage)
📋 履约看板 (PerformanceBoard)
🏛 合规中心 (CompliancePage)
👤 账号管理 (AccountManager)
📅 任务管理 (TaskManager)
⚙️ 设置 (Settings)
```

### 通用SmartDataView组件

创建 `src/components/SmartDataView.tsx`，替代原来的DataBrowser：
- 输入：raw store data（apis数组格式）
- 自动过滤系统API
- 数组数据 → antd Table（自动列名 + 中文翻译）
- 对象数据 → Descriptions
- 所有值安全渲染（对象→JSON字符串）
- 支持搜索过滤

这样每个新页面只需要几十行代码：读取store → 传给SmartDataView。
