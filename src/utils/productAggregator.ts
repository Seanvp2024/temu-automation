/**
 * 商品数据聚合器
 * 从多个 store 数据源中提取商品信息，按商品维度合并为完整画像
 */

const store = window.electronAPI?.store;

export interface AggregatedProduct {
  // 基础信息
  id: string; // 唯一标识（skcId 优先）
  title: string;
  category: string;
  categories: string;
  imageUrl: string;
  goodsId: string;
  skcId: string;
  spuId: string;
  status: string;
  // 销售
  todaySales: number;
  last7DaysSales: number;
  last30DaysSales: number;
  totalSales: number;
  price: string;
  // 流量
  exposeNum: number;
  clickNum: number;
  detailVisitNum: number;
  addToCartUserNum: number;
  payGoodsNum: number;
  buyerNum: number;
  exposeClickRate: number;
  clickPayRate: number;
  growDataText: string;
  // 库存
  warehouseStock: number;
  adviceQuantity: number;
  lackQuantity: number;
  // 备货单
  orders: OrderItem[];
  // 来源标记
  hasFluxData: boolean;
  hasSalesData: boolean;
  hasOrderData: boolean;
}

export interface OrderItem {
  purchaseOrderNo: string;
  quantity: number;
  status: string;
  amount: string;
}

// 名称归一化（取前15个字符，去空格）
function normalizeName(name: string): string {
  return (name || "").replace(/\s+/g, "").substring(0, 15);
}

export async function aggregateProducts(): Promise<AggregatedProduct[]> {
  if (!store) return [];

  // 并行读取所有数据源
  const [rawProducts, rawFlux, rawSales, rawOrders] = await Promise.all([
    store.get("temu_products"),
    store.get("temu_flux"),
    store.get("temu_sales"),
    store.get("temu_orders"),
  ]);

  // 商品索引 Map：key -> AggregatedProduct
  const productMap = new Map<string, AggregatedProduct>();

  // 辅助：通过多种 key 查找或创建商品
  function findOrCreate(ids: { skcId?: string; goodsId?: string; spuId?: string; title?: string; imageUrl?: string }): AggregatedProduct {
    const { skcId, goodsId, spuId, title } = ids;
    const nameKey = normalizeName(title || "");

    // 精确 ID 匹配
    if (skcId && productMap.has(`skc:${skcId}`)) return productMap.get(`skc:${skcId}`)!;
    if (goodsId && productMap.has(`goods:${goodsId}`)) return productMap.get(`goods:${goodsId}`)!;
    if (spuId && productMap.has(`spu:${spuId}`)) return productMap.get(`spu:${spuId}`)!;

    // 名称匹配
    if (nameKey && nameKey.length >= 5) {
      for (const p of productMap.values()) {
        if (normalizeName(p.title) === nameKey) return p;
      }
    }

    // 创建新商品
    const product: AggregatedProduct = {
      id: skcId || goodsId || spuId || `name:${nameKey}`,
      title: title || "", category: "", categories: "",
      imageUrl: ids.imageUrl || "", goodsId: goodsId || "", skcId: skcId || "", spuId: spuId || "",
      status: "",
      todaySales: 0, last7DaysSales: 0, last30DaysSales: 0, totalSales: 0, price: "",
      exposeNum: 0, clickNum: 0, detailVisitNum: 0, addToCartUserNum: 0,
      payGoodsNum: 0, buyerNum: 0, exposeClickRate: 0, clickPayRate: 0, growDataText: "",
      warehouseStock: 0, adviceQuantity: 0, lackQuantity: 0,
      orders: [],
      hasFluxData: false, hasSalesData: false, hasOrderData: false,
    };

    // 注册所有 key
    if (skcId) productMap.set(`skc:${skcId}`, product);
    if (goodsId) productMap.set(`goods:${goodsId}`, product);
    if (spuId) productMap.set(`spu:${spuId}`, product);
    if (nameKey && nameKey.length >= 5) productMap.set(`name:${nameKey}`, product);

    return product;
  }

  // 1. 导入商品基础数据
  const products = Array.isArray(rawProducts) ? rawProducts : [];
  for (const p of products) {
    const prod = findOrCreate({
      skcId: String(p.skcId || ""),
      goodsId: String(p.goodsId || ""),
      spuId: String(p.spuId || ""),
      title: p.title,
      imageUrl: p.imageUrl,
    });
    prod.title = p.title || prod.title;
    prod.category = p.category || prod.category;
    prod.categories = p.categories || prod.categories;
    prod.imageUrl = p.imageUrl || prod.imageUrl;
    prod.status = p.status || prod.status;
    prod.totalSales = p.totalSales || prod.totalSales;
    prod.skcId = String(p.skcId || "") || prod.skcId;
    prod.goodsId = String(p.goodsId || "") || prod.goodsId;
    prod.spuId = String(p.spuId || "") || prod.spuId;
  }

  // 2. 导入流量数据
  const fluxItems = rawFlux?.items || [];
  for (const f of fluxItems) {
    const prod = findOrCreate({
      goodsId: String(f.goodsId || ""),
      title: f.goodsName,
      imageUrl: f.imageUrl,
    });
    prod.title = prod.title || f.goodsName || "";
    prod.imageUrl = prod.imageUrl || f.imageUrl || "";
    prod.category = prod.category || (typeof f.category === "string" ? f.category : "") || "";
    prod.exposeNum = f.exposeNum || 0;
    prod.clickNum = f.clickNum || 0;
    prod.detailVisitNum = f.detailVisitNum || 0;
    prod.addToCartUserNum = f.addToCartUserNum || 0;
    prod.payGoodsNum = f.payGoodsNum || 0;
    prod.buyerNum = f.buyerNum || 0;
    prod.exposeClickRate = f.exposeClickRate || 0;
    prod.clickPayRate = f.clickPayRate || 0;
    prod.growDataText = f.growDataText || "";
    prod.hasFluxData = true;
  }

  // 3. 导入销售数据
  const salesItems = rawSales?.items || [];
  for (const s of salesItems) {
    const prod = findOrCreate({
      skcId: String(s.skcId || ""),
      title: s.title,
      imageUrl: s.imageUrl,
    });
    prod.title = prod.title || s.title || "";
    prod.imageUrl = prod.imageUrl || s.imageUrl || "";
    prod.todaySales = s.todaySales || 0;
    prod.last7DaysSales = s.last7DaysSales || 0;
    prod.last30DaysSales = s.last30DaysSales || 0;
    prod.totalSales = s.totalSales || prod.totalSales || 0;
    prod.price = s.price || prod.price || "";
    prod.warehouseStock = s.warehouseStock || 0;
    prod.adviceQuantity = s.adviceQuantity || 0;
    prod.lackQuantity = s.lackQuantity || 0;
    prod.hasSalesData = true;
  }

  // 4. 导入备货单数据
  const orders = Array.isArray(rawOrders) ? rawOrders : [];
  for (const o of orders) {
    const prod = findOrCreate({
      skcId: String(o.skcId || ""),
      title: o.title,
    });
    prod.title = prod.title || o.title || "";
    prod.orders.push({
      purchaseOrderNo: o.purchaseOrderNo || "",
      quantity: o.quantity || 0,
      status: o.status || "",
      amount: o.amount || "",
    });
    prod.hasOrderData = true;
  }

  // 去重：收集所有唯一商品
  const seen = new Set<AggregatedProduct>();
  const result: AggregatedProduct[] = [];
  for (const p of productMap.values()) {
    if (!seen.has(p) && p.title) {
      seen.add(p);
      // 生成稳定 ID
      p.id = p.skcId || p.goodsId || p.spuId || `idx_${result.length}`;
      result.push(p);
    }
  }

  // 按总销量降序排序
  result.sort((a, b) => (b.totalSales + b.last30DaysSales) - (a.totalSales + a.last30DaysSales));

  return result;
}
