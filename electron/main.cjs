const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

let mainWindow = null;
let worker = null;
let workerPort = 19280;
let workerReady = false;

// ============ Worker 管理（HTTP 通信，彻底避免 stdio 继承） ============

function findNodeExe() {
  const candidates = [
    "C:/New Folder/node.exe",
    "C:/Program Files/nodejs/node.exe",
    "C:/Program Files (x86)/nodejs/node.exe",
  ];
  const pathDirs = (process.env.PATH || "").split(";");
  for (const dir of pathDirs) {
    candidates.push(path.join(dir, "node.exe"));
  }
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return "node";
}

function httpPost(port, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
        timeout: 600000,  // 10分钟超时（抓取大量商品需要较长时间）
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          try {
            const json = JSON.parse(buf);
            if (json.type === "error") reject(new Error(json.message));
            else resolve(json.data);
          } catch (e) {
            reject(new Error("Worker 返回无效 JSON: " + buf.substring(0, 200)));
          }
        });
      }
    );
    req.on("error", (e) => reject(new Error("Worker 通信失败: " + e.message)));
    req.on("timeout", () => { req.destroy(); reject(new Error("Worker 请求超时")); });
    req.write(data);
    req.end();
  });
}

function waitForWorker(port, maxWait = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      if (Date.now() - start > maxWait) {
        reject(new Error("Worker 启动超时"));
        return;
      }
      httpPost(port, { action: "ping" })
        .then(() => resolve(true))
        .catch(() => setTimeout(check, 500));
    }
    check();
  });
}

// 尝试关闭旧的 worker（通过端口文件找到）
async function shutdownOldWorker() {
  try {
    const portFile = path.join(app.getPath("userData"), "worker-port");
    if (fs.existsSync(portFile)) {
      const oldPort = parseInt(fs.readFileSync(portFile, "utf-8").trim());
      if (oldPort > 0) {
        console.log(`[Main] Trying to shutdown old worker on port ${oldPort}`);
        // 先尝试 shutdown 命令
        await httpPost(oldPort, { action: "shutdown" }).catch(() => {});
        await new Promise(r => setTimeout(r, 1000));
        // 如果还在运行，用系统命令杀掉
        try {
          const { execSync } = require("child_process");
          const out = execSync(`netstat -ano | findstr :${oldPort} | findstr LISTENING`, { encoding: "utf8" });
          const pids = [...new Set(out.trim().split(/\n/).map(l => l.trim().split(/\s+/).pop()))];
          for (const pid of pids) {
            try { execSync(`taskkill /F /PID ${pid}`); console.log(`[Main] Killed old worker PID ${pid}`); } catch {}
          }
        } catch {}
        await new Promise(r => setTimeout(r, 500));
      }
    }
  } catch {}
}

async function startWorker() {
  if (worker && workerReady) return;

  // 清理旧进程
  if (worker) {
    try { worker.kill(); } catch {}
    worker = null;
    workerReady = false;
  }

  // 先尝试关闭旧的 worker
  await shutdownOldWorker();

  const nodeExe = findNodeExe();
  const workerPath = path.join(__dirname, "../automation/worker.mjs");

  console.log(`[Main] Starting worker: ${nodeExe} ${workerPath} (port ${workerPort})`);

  // 关键：stdio 全部 ignore，不继承任何 handle
  worker = spawn(nodeExe, [workerPath], {
    stdio: ["ignore", "ignore", "pipe"],
    detached: true,
    windowsHide: true,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([k]) => !k.startsWith("ELECTRON"))
      ),
      WORKER_PORT: String(workerPort),
    },
  });

  // 只读 stderr 用于调试日志
  if (worker.stderr) {
    worker.stderr.on("data", (d) => console.error("[Worker]", d.toString()));
  }

  worker.on("exit", (code) => {
    console.log(`[Main] Worker exited: ${code}`);
    worker = null;
    workerReady = false;
  });

  worker.on("error", (err) => {
    console.error("[Main] Worker spawn error:", err.message);
    worker = null;
    workerReady = false;
  });

  // 等待 worker HTTP 服务就绪
  try {
    await waitForWorker(workerPort);
    workerReady = true;
    console.log(`[Main] Worker ready on port ${workerPort}`);
  } catch (e) {
    console.error("[Main] Worker 启动失败:", e.message);
    if (worker) { try { worker.kill(); } catch {} }
    worker = null;
    workerReady = false;
    throw e;
  }
}

async function sendCmd(action, params = {}) {
  if (!workerReady) {
    await startWorker();
  }
  return httpPost(workerPort, { action, params });
}

function stopWorker() {
  if (worker) {
    try { worker.kill(); } catch {}
    worker = null;
    workerReady = false;
  }
}

// ============ 窗口 ============

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    title: "Temu 自动化运营工具",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 优先使用 Vite 开发服务器，不可用则加载 dist
  const devUrl = "http://localhost:1420";
  const distPath = path.join(__dirname, "../dist/index.html");
  let useDevServer = false;
  try {
    await new Promise((resolve, reject) => {
      const req = http.get(devUrl, (res) => { res.resume(); resolve(true); });
      req.on("error", reject);
      req.setTimeout(2000, () => { req.destroy(); reject(new Error("timeout")); });
    });
    useDevServer = true;
  } catch {}

  if (useDevServer) {
    console.log("[Main] Loading from Vite dev server");
    mainWindow.loadURL(devUrl);
  } else if (fs.existsSync(distPath)) {
    console.log("[Main] Loading from dist");
    mainWindow.loadFile(distPath);
  } else {
    console.log("[Main] Fallback to dev URL");
    mainWindow.loadURL(devUrl);
  }

  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  await createWindow();
  // 启动时自动启动 worker，这样用户操作时不用等待
  try {
    await startWorker();
    console.log("[Main] Worker auto-started successfully");
  } catch (e) {
    console.error("[Main] Worker auto-start failed (will retry on demand):", e.message);
  }
});
app.on("window-all-closed", () => { stopWorker(); app.quit(); });
app.on("activate", () => { if (!mainWindow) createWindow(); });

// ============ IPC ============

ipcMain.handle("get-app-path", () => app.getPath("userData"));

ipcMain.handle("automation:login", async (_, accountId, phone, password) => {
  return sendCmd("login", { accountId, phone, password });
});

ipcMain.handle("automation:scrape-products", async () => {
  return sendCmd("scrape_products");
});

ipcMain.handle("automation:scrape-orders", async () => {
  return sendCmd("scrape_orders");
});

ipcMain.handle("automation:scrape-sales", async () => {
  return sendCmd("scrape_sales");
});

ipcMain.handle("automation:close", async () => {
  return sendCmd("close");
});

ipcMain.handle("automation:ping", async () => {
  return sendCmd("ping");
});

// ============ 文件存储 IPC ============

ipcMain.handle("store:get", (_, key) => {
  const filePath = path.join(app.getPath("userData"), `${key}.json`);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch {}
  return null;
});

ipcMain.handle("store:set", (_, key, data) => {
  const filePath = path.join(app.getPath("userData"), `${key}.json`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return true;
});
