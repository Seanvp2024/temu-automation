/**
 * 云启数据 SQLite 数据库管理
 * - 导入 Excel 导出文件
 * - 查询、搜索、统计
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(
  process.env.APPDATA || path.join(process.env.HOME || "", ".config"),
  "temu-automation",
  "yunqi_products.db"
);

let _db = null;

export function getDb() {
  if (_db) return _db;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  initSchema(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goods_id TEXT NOT NULL,
      sku_id TEXT,
      title_zh TEXT,
      title_en TEXT,
      main_image TEXT,
      carousel_images TEXT,
      video_url TEXT,
      product_url TEXT,
      -- 价格
      usd_price REAL DEFAULT 0,
      eur_price REAL DEFAULT 0,
      -- 销量
      daily_sales INTEGER DEFAULT 0,
      weekly_sales INTEGER DEFAULT 0,
      monthly_sales INTEGER DEFAULT 0,
      total_sales INTEGER DEFAULT 0,
      -- GMV
      usd_gmv REAL DEFAULT 0,
      eur_gmv REAL DEFAULT 0,
      -- 评价
      score REAL DEFAULT 0,
      total_comments INTEGER DEFAULT 0,
      -- 分类
      category_en TEXT,
      category_zh TEXT,
      backend_category TEXT,
      -- 标签
      labels TEXT,
      -- 店铺
      mall_id TEXT,
      mall_name TEXT,
      mall_mode TEXT,
      mall_logo TEXT,
      mall_product_count INTEGER DEFAULT 0,
      mall_total_sales INTEGER DEFAULT 0,
      mall_score REAL DEFAULT 0,
      mall_fans INTEGER DEFAULT 0,
      -- 时间
      listed_at TEXT,
      recorded_at TEXT,
      -- 导入批次
      import_batch TEXT,
      imported_at TEXT DEFAULT (datetime('now', 'localtime')),
      -- 索引用
      UNIQUE(goods_id, import_batch)
    );

    CREATE INDEX IF NOT EXISTS idx_products_goods_id ON products(goods_id);
    CREATE INDEX IF NOT EXISTS idx_products_title_zh ON products(title_zh);
    CREATE INDEX IF NOT EXISTS idx_products_mall_id ON products(mall_id);
    CREATE INDEX IF NOT EXISTS idx_products_daily_sales ON products(daily_sales DESC);
    CREATE INDEX IF NOT EXISTS idx_products_weekly_sales ON products(weekly_sales DESC);
    CREATE INDEX IF NOT EXISTS idx_products_monthly_sales ON products(monthly_sales DESC);
    CREATE INDEX IF NOT EXISTS idx_products_total_sales ON products(total_sales DESC);
    CREATE INDEX IF NOT EXISTS idx_products_usd_price ON products(usd_price);
    CREATE INDEX IF NOT EXISTS idx_products_usd_gmv ON products(usd_gmv DESC);
    CREATE INDEX IF NOT EXISTS idx_products_score ON products(score DESC);
    CREATE INDEX IF NOT EXISTS idx_products_import_batch ON products(import_batch);
    CREATE INDEX IF NOT EXISTS idx_products_category_zh ON products(category_zh);
    CREATE INDEX IF NOT EXISTS idx_products_mall_mode ON products(mall_mode);

    CREATE TABLE IF NOT EXISTS import_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL UNIQUE,
      file_name TEXT,
      total_rows INTEGER DEFAULT 0,
      imported_rows INTEGER DEFAULT 0,
      skipped_rows INTEGER DEFAULT 0,
      imported_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);
}

/**
 * 从 Excel 行数据导入（xlsx 解析后的二维数组）
 */
export function importFromRows(rows, fileName = "unknown") {
  const db = getDb();
  const batchId = `batch_${Date.now()}`;
  const header = rows[1]; // 第2行是表头
  if (!header) throw new Error("无法读取表头");

  const insert = db.prepare(`
    INSERT OR REPLACE INTO products (
      goods_id, title_zh, title_en, main_image, carousel_images, video_url, product_url,
      usd_price, eur_price, daily_sales, weekly_sales, monthly_sales, total_sales,
      usd_gmv, eur_gmv, score, total_comments,
      category_en, category_zh, backend_category, labels,
      mall_id, mall_name, mall_mode, mall_logo, mall_product_count, mall_total_sales, mall_score, mall_fans,
      listed_at, recorded_at, import_batch
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?
    )
  `);

  let imported = 0;
  let skipped = 0;

  const tx = db.transaction(() => {
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[10]) { skipped++; continue; } // 跳过没有商品ID的行

      try {
        insert.run(
          String(r[10] || ""),           // goods_id
          r[11] || "",                    // title_zh
          r[12] || "",                    // title_en
          r[13] || "",                    // main_image
          r[14] || "",                    // carousel_images
          r[15] || "",                    // video_url
          r[16] || "",                    // product_url
          parseFloat(r[21]) || 0,         // usd_price
          parseFloat(r[22]) || 0,         // eur_price
          parseInt(r[26]) || 0,           // daily_sales
          parseInt(r[27]) || 0,           // weekly_sales
          parseInt(r[28]) || 0,           // monthly_sales
          parseInt(r[25]) || 0,           // total_sales
          parseFloat(r[23]) || 0,         // usd_gmv
          parseFloat(r[24]) || 0,         // eur_gmv
          parseFloat(r[29]) || 0,         // score
          parseInt(r[30]) || 0,           // total_comments
          r[17] || "",                    // category_en
          r[18] || "",                    // category_zh
          r[19] || "",                    // backend_category
          r[20] || "",                    // labels
          String(r[0] || ""),             // mall_id
          r[1] || "",                     // mall_name
          r[2] || "",                     // mall_mode
          r[3] || "",                     // mall_logo
          parseInt(r[4]) || 0,            // mall_product_count
          parseInt(r[5]) || 0,            // mall_total_sales
          parseFloat(r[6]) || 0,          // mall_score
          parseInt(r[7]) || 0,            // mall_fans
          r[8] || "",                     // listed_at
          r[9] ? String(r[9]) : "",       // recorded_at
          batchId                         // import_batch
        );
        imported++;
      } catch (e) {
        skipped++;
      }
    }

    // 记录导入历史
    db.prepare(`
      INSERT INTO import_history (batch_id, file_name, total_rows, imported_rows, skipped_rows)
      VALUES (?, ?, ?, ?, ?)
    `).run(batchId, fileName, rows.length - 2, imported, skipped);
  });

  tx();

  return { batchId, imported, skipped, total: rows.length - 2 };
}

/**
 * 搜索商品
 */
export function searchProducts(params = {}) {
  const db = getDb();
  const {
    keyword = "",
    mallName = "",
    mallMode = "",
    category = "",
    minPrice = null,
    maxPrice = null,
    minDailySales = null,
    sortBy = "daily_sales",
    sortOrder = "DESC",
    page = 1,
    pageSize = 50,
  } = params;

  const conditions = [];
  const values = [];

  if (keyword) {
    conditions.push("(title_zh LIKE ? OR title_en LIKE ?)");
    values.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (mallName) {
    conditions.push("mall_name LIKE ?");
    values.push(`%${mallName}%`);
  }
  if (mallMode) {
    conditions.push("mall_mode = ?");
    values.push(mallMode);
  }
  if (category) {
    conditions.push("(category_zh LIKE ? OR category_en LIKE ? OR backend_category LIKE ?)");
    values.push(`%${category}%`, `%${category}%`, `%${category}%`);
  }
  if (minPrice != null) {
    conditions.push("usd_price >= ?");
    values.push(minPrice);
  }
  if (maxPrice != null) {
    conditions.push("usd_price <= ?");
    values.push(maxPrice);
  }
  if (minDailySales != null) {
    conditions.push("daily_sales >= ?");
    values.push(minDailySales);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const allowedSorts = ["daily_sales", "weekly_sales", "monthly_sales", "total_sales", "usd_price", "usd_gmv", "score", "total_comments", "listed_at"];
  const sort = allowedSorts.includes(sortBy) ? sortBy : "daily_sales";
  const order = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";
  const offset = (page - 1) * pageSize;

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM products ${where}`).get(...values);
  const items = db.prepare(`SELECT * FROM products ${where} ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`).all(...values, pageSize, offset);

  return {
    items,
    total: countRow.total,
    page,
    pageSize,
    totalPages: Math.ceil(countRow.total / pageSize),
  };
}

/**
 * 统计概览
 */
export function getStats() {
  const db = getDb();
  const stats = db.prepare(`
    SELECT
      COUNT(*) as totalProducts,
      COUNT(DISTINCT mall_id) as totalMalls,
      ROUND(AVG(usd_price), 2) as avgPrice,
      ROUND(MIN(usd_price), 2) as minPrice,
      ROUND(MAX(usd_price), 2) as maxPrice,
      SUM(daily_sales) as totalDailySales,
      SUM(weekly_sales) as totalWeeklySales,
      SUM(monthly_sales) as totalMonthlySales,
      SUM(total_sales) as totalSales,
      ROUND(SUM(usd_gmv), 2) as totalGmv,
      ROUND(AVG(score), 2) as avgScore,
      SUM(total_comments) as totalComments,
      SUM(CASE WHEN video_url != '' AND video_url IS NOT NULL THEN 1 ELSE 0 END) as withVideo
    FROM products
  `).get();

  // 分类统计 TOP 10
  const categories = db.prepare(`
    SELECT category_zh, COUNT(*) as count, ROUND(AVG(usd_price), 2) as avgPrice,
           SUM(daily_sales) as totalDailySales
    FROM products WHERE category_zh != ''
    GROUP BY category_zh ORDER BY count DESC LIMIT 10
  `).all();

  // 托管模式分布
  const modeDistribution = db.prepare(`
    SELECT mall_mode, COUNT(*) as count FROM products GROUP BY mall_mode
  `).all();

  // 导入历史
  const importHistory = db.prepare(`
    SELECT * FROM import_history ORDER BY imported_at DESC LIMIT 10
  `).all();

  return { ...stats, categories, modeDistribution, importHistory };
}

/**
 * 获取 TOP 商品
 */
export function getTopProducts(field = "daily_sales", limit = 20) {
  const db = getDb();
  const allowedFields = ["daily_sales", "weekly_sales", "monthly_sales", "total_sales", "usd_gmv", "score", "usd_price"];
  const f = allowedFields.includes(field) ? field : "daily_sales";
  return db.prepare(`SELECT * FROM products ORDER BY ${f} DESC LIMIT ?`).all(limit);
}

/**
 * 获取数据库路径
 */
export function getDbPath() {
  return DB_PATH;
}

/**
 * 获取数据库总行数
 */
export function getRowCount() {
  const db = getDb();
  return db.prepare("SELECT COUNT(*) as count FROM products").get().count;
}

/**
 * 从云启 API 返回的商品对象数组直接导入数据库
 * @param {Array} items - 云启 API 返回的商品对象列表
 * @param {string} sourceName - 导入来源标识（如关键词）
 */
export function importFromApiItems(items, sourceName = "api-sync") {
  if (!Array.isArray(items) || items.length === 0) return { batchId: null, imported: 0, skipped: 0, total: 0 };
  const db = getDb();
  const batchId = `api_${Date.now()}`;

  const insert = db.prepare(`
    INSERT OR REPLACE INTO products (
      goods_id, title_zh, title_en, main_image, carousel_images, video_url, product_url,
      usd_price, eur_price, daily_sales, weekly_sales, monthly_sales, total_sales,
      usd_gmv, eur_gmv, score, total_comments,
      category_en, category_zh, backend_category, labels,
      mall_id, mall_name, mall_mode, mall_logo, mall_product_count, mall_total_sales, mall_score, mall_fans,
      listed_at, recorded_at, import_batch
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?
    )
  `);

  let imported = 0;
  let skipped = 0;

  const str = (v) => String(v || "").trim();
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const firstStr = (...vals) => { for (const v of vals) { const s = str(v); if (s) return s; } return ""; };
  const firstNum = (...vals) => { for (const v of vals) { const n = Number(v); if (Number.isFinite(n)) return n; } return 0; };

  const tx = db.transaction(() => {
    for (const row of items) {
      if (!row) { skipped++; continue; }
      const goodsId = firstStr(row.goods_id, row.goodsId, row.id);
      if (!goodsId) { skipped++; continue; }
      const mall = row.mall || {};
      const imageUrls = Array.isArray(row.image_urls) ? row.image_urls : Array.isArray(row.imageUrls) ? row.imageUrls : [];
      try {
        insert.run(
          goodsId,
          firstStr(row.title_zh, row.titleZh, row.title, row.productName),
          firstStr(row.title_en, row.titleEn),
          firstStr(row.thumb_url, row.thumbUrl, row.image, row.main_image, imageUrls[0]),
          imageUrls.filter(Boolean).join(","),
          firstStr(row.video_url, row.videoUrl),
          firstStr(row.product_url, row.productUrl) || `https://www.temu.com/goods.html?goods_id=${goodsId}`,
          firstNum(row.usd_price, row.usdPrice, row.price),
          firstNum(row.eur_price, row.eurPrice),
          firstNum(row.daily_sales, row.dailySales),
          firstNum(row.weekly_sales, row.weeklySales),
          firstNum(row.monthly_sales, row.monthlySales),
          firstNum(row.sales, row.total_sales, row.totalSales),
          firstNum(row.usd_gmv, row.usdGmv),
          firstNum(row.eur_gmv, row.eurGmv),
          firstNum(row.score, row.rating),
          firstNum(row.total_comment_num_tips, row.comment_num_tips, row.reviewCount),
          firstStr(row.category_en),
          firstStr(row.category_zh, row.categoryName, row.category),
          firstStr(row.backend_category),
          Array.isArray(row.labels) ? row.labels.join(",") : str(row.labels),
          firstStr(row.mall_id, row.mallId, mall.id),
          firstStr(row.mall_name, row.mallName, mall.name),
          firstStr(row.mall_mode, row.wareHouseType != null ? String(row.wareHouseType) : "", mall.mode),
          firstStr(mall.logo, row.mall_logo),
          firstNum(row.mall_product_count, mall.total_goods, mall.total_show_goods),
          firstNum(row.mall_total_sales, mall.total_sales),
          firstNum(row.mall_score, mall.score),
          firstNum(row.mall_fans, mall.fans),
          firstStr(row.created_at, row.createdAt, row.listed_at, row.issued_date),
          new Date().toISOString(),
          batchId
        );
        imported++;
      } catch { skipped++; }
    }

    db.prepare(`
      INSERT INTO import_history (batch_id, file_name, total_rows, imported_rows, skipped_rows)
      VALUES (?, ?, ?, ?, ?)
    `).run(batchId, `[API] ${sourceName}`, items.length, imported, skipped);
  });

  tx();
  return { batchId, imported, skipped, total: items.length };
}
