const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

// 全局捕获未处理异常，防止 EPIPE 等 pipe 错误崩溃 Electron
process.on("uncaughtException", (err) => {
  if (err.code === "EPIPE" || err.code === "ERR_STREAM_DESTROYED") return; // 忽略 pipe 错误
  console.error("[Main] Uncaught exception:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("[Main] Unhandled rejection:", reason);
});

let mainWindow = null;
let worker = null;
let workerPort = 19280;
let workerReady = false;
const AUTO_PRICING_TASKS_KEY = "temu_auto_pricing_tasks";
const AUTO_PRICING_TASK_LIMIT = 20;
const CREATE_HISTORY_KEY = "temu_create_history";
const ACCOUNT_STORE_KEY = "temu_accounts";
let autoPricingTaskPromise = null;
let autoPricingTaskSyncTimer = null;
let autoPricingCurrentTaskId = null;

// ============ 自动更新 ============

const GITHUB_UPDATE_OWNER = "9619221";
const GITHUB_UPDATE_REPO = "temu-automation";

let updateState = {
  status: "idle",
  version: null,
  message: "未检查更新",
  releaseVersion: null,
  progressPercent: null,
};

function broadcastUpdateState(patch) {
  updateState = { ...updateState, ...patch };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("app:update-status", updateState);
  }
}

function configureAutoUpdater() {
  if (!app.isPackaged) {
    broadcastUpdateState({ status: "dev", message: "开发环境不支持自动更新" });
    return;
  }
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.setFeedURL({
    provider: "github",
    owner: GITHUB_UPDATE_OWNER,
    repo: GITHUB_UPDATE_REPO,
  });
  broadcastUpdateState({ message: `更新源: GitHub ${GITHUB_UPDATE_OWNER}/${GITHUB_UPDATE_REPO}` });
}

autoUpdater.on("checking-for-update", () => {
  broadcastUpdateState({ status: "checking", message: "正在检查更新…" });
});
autoUpdater.on("update-available", (info) => {
  broadcastUpdateState({ status: "available", message: `发现新版本 ${info?.version || ""}`, releaseVersion: info?.version });
  // 不自动下载，等用户手动点击下载按钮
});
autoUpdater.on("update-not-available", () => {
  broadcastUpdateState({ status: "up-to-date", message: "当前已是最新版本", releaseVersion: null, progressPercent: null });
});
autoUpdater.on("download-progress", (progress) => {
  broadcastUpdateState({ status: "downloading", message: `正在下载 ${Math.round(progress?.percent || 0)}%`, progressPercent: Math.round(progress?.percent || 0) });
});
autoUpdater.on("update-downloaded", (info) => {
  broadcastUpdateState({ status: "downloaded", message: `${info?.version || ""} 已下载，重启即可安装`, releaseVersion: info?.version, progressPercent: 100 });
  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "更新已就绪",
      message: `新版本 ${info?.version || ""} 已下载`,
      detail: "重启应用即可安装。",
      buttons: ["稍后", "立即重启"],
      defaultId: 1,
    }).then(({ response }) => {
      if (response === 1) autoUpdater.quitAndInstall(false, true);
    }).catch(() => {});
  }
});
autoUpdater.on("error", (error) => {
  const msg = error?.message || "检查更新失败";
  console.error("[updater] error:", msg, error?.stack || "");
  broadcastUpdateState({ status: "error", message: msg, progressPercent: null });
});

// ============ Worker 管理（HTTP 通信，彻底避免 stdio 继承） ============

function findNodeExe() {
  const bundledNode = app.isPackaged
    ? path.join(process.resourcesPath, "node-runtime", "node.exe")
    : path.join(app.getAppPath(), "build", "node-runtime", "node.exe");
  const candidates = [
    process.env.TEMU_NODE_RUNTIME,
    process.env.NODE_EXE,
    bundledNode,
    process.execPath && process.execPath.toLowerCase().endsWith("node.exe") ? process.execPath : "",
    "C:/Program Files/nodejs/node.exe",
    "C:/Program Files (x86)/nodejs/node.exe",
  ].filter(Boolean);
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
        timeout: 86400000,  // 24小时超时
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks).toString("utf8");
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

  // 打包模式优先用 ELECTRON_RUN_AS_NODE（能读 asar），否则用外部 Node
  const workerPath = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar", "automation", "worker-entry.cjs")
    : path.join(__dirname, "../automation/worker.mjs");

  let nodeExe, childEnv;
  if (app.isPackaged) {
    nodeExe = process.execPath; // Electron 自身
    childEnv = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([k]) => !k.startsWith("ELECTRON"))
      ),
      ELECTRON_RUN_AS_NODE: "1",
      WORKER_PORT: String(workerPort),
      APP_USER_DATA: app.getPath("userData"),
    };
  } else {
    nodeExe = findNodeExe();
    childEnv = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([k]) => !k.startsWith("ELECTRON"))
      ),
      WORKER_PORT: String(workerPort),
    };
  }

  console.log(`[Main] Starting worker: ${nodeExe} ${workerPath} (port ${workerPort}) packaged=${app.isPackaged}`);

  worker = spawn(nodeExe, [workerPath], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
    windowsHide: true,
    env: childEnv,
  });

  // 只读 stderr 用于调试日志（安全处理 EPIPE）
  if (worker.stderr) {
    worker.stderr.on("data", (d) => {
      try { console.error("[Worker]", d.toString()); } catch {}
    });
    worker.stderr.on("error", () => {}); // 忽略 pipe 错误
  }
  if (worker.stdout) {
    worker.stdout.on("error", () => {}); // 忽略 pipe 错误
  }

  worker.on("exit", (code) => {
    console.log(`[Main] Worker exited: ${code}`);
    markAutoPricingTaskInterrupted("批量上品任务已中断，worker 已退出。");
    stopAutoPricingTaskSync();
    worker = null;
    workerReady = false;
  });

  worker.on("error", (err) => {
    try { console.error("[Main] Worker spawn error:", err.message); } catch {}
    markAutoPricingTaskInterrupted("批量上品任务已中断，worker 启动失败。");
    stopAutoPricingTaskSync();
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

function getDefaultAutoPricingState() {
  return {
    activeTaskId: null,
    tasks: [],
  };
}

function summarizeAutoPricingResults(results) {
  const list = Array.isArray(results) ? results : [];
  const successCount = list.filter((item) => item?.success).length;
  return {
    successCount,
    failCount: list.length - successCount,
  };
}

function isSafeStorageReady() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function encryptSecret(text) {
  if (typeof text !== "string" || !text) return "";
  if (!isSafeStorageReady()) return text;
  try {
    return `enc:${safeStorage.encryptString(text).toString("base64")}`;
  } catch (error) {
    console.error("[Store] Failed to encrypt secret:", error.message);
    return text;
  }
}

function decryptSecret(text) {
  if (typeof text !== "string" || !text) return "";
  if (!text.startsWith("enc:")) return text;
  if (!isSafeStorageReady()) return "";
  try {
    return safeStorage.decryptString(Buffer.from(text.slice(4), "base64"));
  } catch (error) {
    console.error("[Store] Failed to decrypt secret:", error.message);
    return "";
  }
}

function serializeStoreValue(key, data) {
  const normalized = data === undefined ? null : data;
  if (key !== ACCOUNT_STORE_KEY || !Array.isArray(normalized)) {
    return normalized;
  }

  const encrypted = isSafeStorageReady();
  return {
    __temuSecureStore: "accounts:v1",
    encrypted,
    accounts: normalized.map((account) => ({
      ...account,
      password: encrypted ? encryptSecret(account?.password) : (typeof account?.password === "string" ? account.password : ""),
    })),
  };
}

function deserializeStoreValue(key, data, filePath) {
  if (key !== ACCOUNT_STORE_KEY) {
    return data;
  }

  if (Array.isArray(data)) {
    if (data.length > 0 && isSafeStorageReady()) {
      try {
        writeStoreJsonAtomic(filePath, data, { skipBackup: true, key });
      } catch (error) {
        console.error("[Store] Failed to migrate account store:", error.message);
      }
    }
    return data;
  }

  if (!data || typeof data !== "object" || !Array.isArray(data.accounts)) {
    return data;
  }

  return data.accounts.map((account) => ({
    ...account,
    password: data.encrypted ? decryptSecret(account?.password) : (typeof account?.password === "string" ? account.password : ""),
  }));
}

function appendCreateHistoryEntries(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) return;

  const history = readStoreJsonWithRecovery(getStoreFilePath(CREATE_HISTORY_KEY));
  const nextHistory = Array.isArray(history) ? [...history] : [];

  list.forEach((entry) => {
    nextHistory.unshift(entry);
  });

  writeStoreJsonAtomic(getStoreFilePath(CREATE_HISTORY_KEY), nextHistory.slice(0, 100));
}

function normalizeAutoPricingTask(task = {}) {
  const results = Array.isArray(task.results) ? task.results : [];
  const summary = summarizeAutoPricingResults(results);
  return {
    taskId: typeof task.taskId === "string" ? task.taskId : `pricing_${Date.now()}`,
    status: typeof task.status === "string" ? task.status : "idle",
    running: Boolean(task.running),
    paused: Boolean(task.paused),
    total: Number(task.total) || 0,
    completed: Number(task.completed) || 0,
    current: typeof task.current === "string" ? task.current : "",
    step: typeof task.step === "string" ? task.step : "",
    message: typeof task.message === "string" ? task.message : "",
    csvPath: typeof task.csvPath === "string" ? task.csvPath : "",
    startRow: Number(task.startRow) || 0,
    count: Number(task.count) || 0,
    results,
    successCount: summary.successCount,
    failCount: summary.failCount,
    createdAt: typeof task.createdAt === "string" ? task.createdAt : "",
    updatedAt: typeof task.updatedAt === "string" ? task.updatedAt : "",
    startedAt: typeof task.startedAt === "string" ? task.startedAt : "",
    finishedAt: typeof task.finishedAt === "string" ? task.finishedAt : "",
  };
}

function readAutoPricingState() {
  try {
    const raw = readStoreJsonWithRecovery(getStoreFilePath(AUTO_PRICING_TASKS_KEY));
    if (!raw || typeof raw !== "object") {
      autoPricingCurrentTaskId = null;
      return getDefaultAutoPricingState();
    }
    const tasks = Array.isArray(raw.tasks) ? raw.tasks.map((task) => normalizeAutoPricingTask(task)) : [];
    const activeTaskId = typeof raw.activeTaskId === "string"
      ? raw.activeTaskId
      : (tasks[0]?.taskId || null);
    autoPricingCurrentTaskId = activeTaskId;
    return {
      activeTaskId,
      tasks,
    };
  } catch {
    autoPricingCurrentTaskId = null;
    return getDefaultAutoPricingState();
  }
}

function writeAutoPricingState(state) {
  const nextState = {
    activeTaskId: typeof state?.activeTaskId === "string" ? state.activeTaskId : null,
    tasks: Array.isArray(state?.tasks) ? state.tasks.map((task) => normalizeAutoPricingTask(task)) : [],
  };
  writeStoreJsonAtomic(getStoreFilePath(AUTO_PRICING_TASKS_KEY), nextState);
  autoPricingCurrentTaskId = nextState.activeTaskId;
  return nextState;
}

function getAutoPricingTask(taskId) {
  const state = readAutoPricingState();
  if (taskId) {
    return state.tasks.find((task) => task.taskId === taskId) || null;
  }
  return state.tasks.find((task) => task.taskId === state.activeTaskId) || state.tasks[0] || null;
}

function listAutoPricingTasks() {
  return readAutoPricingState().tasks;
}

function upsertAutoPricingTask(taskPatch) {
  const state = readAutoPricingState();
  const existing = state.tasks.find((task) => task.taskId === taskPatch.taskId);
  const nextTask = normalizeAutoPricingTask({ ...existing, ...taskPatch });
  const tasks = [
    nextTask,
    ...state.tasks.filter((task) => task.taskId !== nextTask.taskId),
  ].slice(0, AUTO_PRICING_TASK_LIMIT);

  writeAutoPricingState({
    activeTaskId: nextTask.taskId,
    tasks,
  });

  return nextTask;
}

function markAutoPricingTaskInterrupted(message) {
  const activeTask = getAutoPricingTask(autoPricingCurrentTaskId);
  if (!activeTask || !["running", "paused"].includes(activeTask.status)) {
    return activeTask;
  }
  const now = new Date().toLocaleString("zh-CN");
  return upsertAutoPricingTask({
    ...activeTask,
    status: "interrupted",
    running: false,
    paused: false,
    message,
    updatedAt: now,
    finishedAt: activeTask.finishedAt || now,
  });
}

async function requestWorkerProgressSnapshot(taskId) {
  if (!workerReady) {
    return { running: false };
  }

  try {
    const pathWithQuery = taskId
      ? `/progress?taskId=${encodeURIComponent(taskId)}`
      : "/progress";
    return await new Promise((resolve) => {
      const req = http.request(
        { hostname: "127.0.0.1", port: workerPort, method: "GET", path: pathWithQuery, timeout: 3000 },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
            catch { resolve({ running: false }); }
          });
        }
      );
      req.on("error", () => resolve({ running: false }));
      req.on("timeout", () => { req.destroy(); resolve({ running: false }); });
      req.end();
    });
  } catch {
    return { running: false };
  }
}

async function requestWorkerTaskSnapshots() {
  if (!workerReady) {
    return [];
  }

  try {
    return await new Promise((resolve) => {
      const req = http.request(
        { hostname: "127.0.0.1", port: workerPort, method: "GET", path: "/tasks", timeout: 3000 },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            try {
              const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
              resolve(Array.isArray(payload) ? payload : []);
            } catch {
              resolve([]);
            }
          });
        }
      );
      req.on("error", () => resolve([]));
      req.on("timeout", () => { req.destroy(); resolve([]); });
      req.end();
    });
  } catch {
    return [];
  }
}

function hasWorkerTaskSnapshot(task) {
  return Boolean(
    task
    && (
      task.running
      || task.paused
      || task.current
      || task.step
      || task.total
      || task.completed
      || (Array.isArray(task.results) && task.results.length > 0)
      || (typeof task.status === "string" && task.status !== "idle")
    )
  );
}

function mergeWorkerSnapshotIntoTask(task, live, fallbackTaskId) {
  const baseTask = task || {};
  const now = new Date().toLocaleString("zh-CN");
  const isRunning = Boolean(live?.running);
  const isPaused = Boolean(live?.paused);
  const nextStatus = typeof live?.status === "string" && live.status
    ? live.status
    : (isRunning ? (isPaused ? "paused" : "running") : baseTask.status);
  const nextResults = Array.isArray(live?.results) ? live.results : baseTask.results;
  const nextCompleted = Number(live?.completed)
    || (Array.isArray(live?.results) ? live.results.length : baseTask.completed);
  const nextFinishedAt = !isRunning && !isPaused && ["completed", "failed", "interrupted"].includes(nextStatus)
    ? (typeof live?.finishedAt === "string" && live.finishedAt ? live.finishedAt : (baseTask.finishedAt || now))
    : "";

  return upsertAutoPricingTask({
    ...baseTask,
    ...live,
    taskId: typeof live?.taskId === "string" && live.taskId
      ? live.taskId
      : (baseTask.taskId || fallbackTaskId || `pricing_${Date.now()}`),
    status: nextStatus,
    running: isRunning,
    paused: isPaused,
    total: Number(live?.total) || baseTask.total,
    completed: nextCompleted,
    current: typeof live?.current === "string" ? live.current : baseTask.current,
    step: typeof live?.step === "string" ? live.step : baseTask.step,
    results: Array.isArray(nextResults) ? nextResults : [],
    message: typeof live?.message === "string" && live.message ? live.message : baseTask.message,
    updatedAt: typeof live?.updatedAt === "string" && live.updatedAt ? live.updatedAt : now,
    finishedAt: nextFinishedAt,
  });
}

async function syncAutoPricingTaskFromWorker(taskId, options = {}) {
  const { markInterruptedOnIdle = false } = options;
  const task = getAutoPricingTask(taskId || autoPricingCurrentTaskId);
  if (!task) {
    return null;
  }

  const live = await requestWorkerProgressSnapshot(task.taskId);

  if (hasWorkerTaskSnapshot(live)) {
    return mergeWorkerSnapshotIntoTask(task, live, task.taskId);
  }

  if (markInterruptedOnIdle && !autoPricingTaskPromise && ["running", "paused"].includes(task.status)) {
    return markAutoPricingTaskInterrupted("任务已中断，应用或 worker 已重启，请重新发起批量上品。");
  }

  return task;
}

async function syncWorkerTaskSnapshotsToStore() {
  const liveTasks = await requestWorkerTaskSnapshots();
  if (!Array.isArray(liveTasks) || liveTasks.length === 0) {
    return listAutoPricingTasks();
  }

  liveTasks.forEach((liveTask) => {
    if (!hasWorkerTaskSnapshot(liveTask)) return;
    mergeWorkerSnapshotIntoTask(getAutoPricingTask(liveTask.taskId), liveTask, liveTask.taskId);
  });

  return listAutoPricingTasks();
}

async function syncActiveAutoPricingTaskFromWorker(options = {}) {
  return syncAutoPricingTaskFromWorker(autoPricingCurrentTaskId, options);
}

function startAutoPricingTaskSync() {
  if (autoPricingTaskSyncTimer) return;
  autoPricingTaskSyncTimer = setInterval(() => {
    syncActiveAutoPricingTaskFromWorker({ markInterruptedOnIdle: true }).catch(() => {});
  }, 3000);
}

function stopAutoPricingTaskSync() {
  if (autoPricingTaskSyncTimer) {
    clearInterval(autoPricingTaskSyncTimer);
    autoPricingTaskSyncTimer = null;
  }
}

function getAutoPricingProgressPayload(task) {
  if (!task) {
    return {
      taskId: null,
      status: "idle",
      running: false,
      paused: false,
      total: 0,
      completed: 0,
      current: "",
      step: "",
      results: [],
      successCount: 0,
      failCount: 0,
      message: "",
      csvPath: "",
      startRow: 0,
      count: 0,
      updatedAt: "",
      createdAt: "",
      startedAt: "",
      finishedAt: "",
    };
  }
  return normalizeAutoPricingTask(task);
}

function stopWorker() {
  stopAutoPricingTaskSync();
  if (worker) {
    try { worker.kill(); } catch {}
    worker = null;
    workerReady = false;
  }
}

// ============ AI 出图服务管理 ============

const AUTO_IMAGE_HOST = "127.0.0.1";
const AUTO_IMAGE_PORT = 3210;
const AUTO_IMAGE_HEALTH_PATH = "/api/config";

let imageStudioProcess = null;
let imageStudioStatus = {
  status: "idle",
  message: "AI 出图服务未启动",
  url: `http://${AUTO_IMAGE_HOST}:${AUTO_IMAGE_PORT}`,
  projectPath: "",
  port: AUTO_IMAGE_PORT,
  ready: false,
};

function updateImageStudioStatus(patch = {}) {
  imageStudioStatus = { ...imageStudioStatus, ...patch, url: `http://${AUTO_IMAGE_HOST}:${AUTO_IMAGE_PORT}`, port: AUTO_IMAGE_PORT };
  return imageStudioStatus;
}

function dedupePaths(paths) {
  const seen = new Set();
  const list = [];
  paths.filter(Boolean).forEach((item) => {
    const normalized = path.resolve(item);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    list.push(normalized);
  });
  return list;
}

function getAutoImageProjectCandidates() {
  const appDir = app.getAppPath();
  const cwd = process.cwd();
  return dedupePaths([
    process.env.AUTO_IMAGE_GEN_DIR,
    app.isPackaged ? path.join(process.resourcesPath, "auto-image-gen-runtime") : path.resolve(appDir, "build", "auto-image-gen-runtime"),
    path.resolve(appDir, "auto-image-gen-dev"),
    path.resolve(appDir, "..", "auto-image-gen-dev"),
    path.resolve(appDir, "..", "build", "auto-image-gen-runtime"),
    path.resolve(cwd, "auto-image-gen-dev"),
    path.resolve(cwd, "..", "auto-image-gen-dev"),
    path.resolve(cwd, "build", "auto-image-gen-runtime"),
    app.isPackaged ? path.join(process.resourcesPath, "auto-image-gen-runtime") : "",
  ]);
}

function resolveAutoImageProjectDir() {
  const candidates = getAutoImageProjectCandidates();
  for (const candidate of candidates) {
    try {
      const standaloneServerPath = path.join(candidate, "server.js");
      const standaloneBootstrapPath = path.join(candidate, "bootstrap.cjs");
      const packageJsonPath = path.join(candidate, "package.json");
      const nextBinPath = path.join(candidate, "node_modules", "next", "dist", "bin", "next");
      if (fs.existsSync(standaloneServerPath)) {
        return {
          projectPath: candidate,
          mode: "packaged-runtime",
          serverPath: fs.existsSync(standaloneBootstrapPath) ? standaloneBootstrapPath : standaloneServerPath,
          searchedPaths: candidates,
        };
      }
      if (fs.existsSync(packageJsonPath) && fs.existsSync(nextBinPath)) {
        return { projectPath: candidate, mode: "dev-project", nextBinPath, searchedPaths: candidates };
      }
    } catch {}
  }
  return { searchedPaths: candidates };
}

function httpGet(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ statusCode: res.statusCode || 0, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(new Error("timeout")); });
  });
}

async function isImageStudioHealthy() {
  try {
    const response = await httpGet(`http://${AUTO_IMAGE_HOST}:${AUTO_IMAGE_PORT}${AUTO_IMAGE_HEALTH_PATH}`);
    return response.statusCode >= 200 && response.statusCode < 500;
  } catch { return false; }
}

async function waitForImageStudio(maxWait = 90000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    if (await isImageStudioHealthy()) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error("AI 出图服务启动超时");
}

function stopImageStudioService() {
  if (imageStudioProcess) {
    try { imageStudioProcess.kill(); } catch {}
    imageStudioProcess = null;
  }
  updateImageStudioStatus({ status: "stopped", ready: false, message: "AI 出图服务已停止" });
}

async function ensureImageStudioService() {
  const projectInfo = resolveAutoImageProjectDir();
  if (!projectInfo?.projectPath) {
    const searched = (projectInfo?.searchedPaths || []).join("；");
    throw new Error(`未找到 AI 出图运行时。请设置 AUTO_IMAGE_GEN_DIR，或确认这些目录之一存在可运行项目：${searched}`);
  }
  updateImageStudioStatus({ projectPath: projectInfo.projectPath });

  if (await isImageStudioHealthy()) {
    return updateImageStudioStatus({ status: "ready", ready: true, message: "AI 出图服务已就绪" });
  }

  if (imageStudioProcess) {
    try { imageStudioProcess.kill(); } catch {}
    imageStudioProcess = null;
  }

  updateImageStudioStatus({ status: "starting", ready: false, message: "正在启动 AI 出图服务…" });

  const nodeExe = findNodeExe();
  const env = { ...process.env, PORT: String(AUTO_IMAGE_PORT), HOSTNAME: AUTO_IMAGE_HOST, NODE_ENV: "production" };

  const spawnArgs = projectInfo.mode === "packaged-runtime"
    ? [projectInfo.serverPath]
    : [projectInfo.nextBinPath, "start", "-p", String(AUTO_IMAGE_PORT), "--hostname", AUTO_IMAGE_HOST];

  console.log(`[Main] Starting image studio: ${nodeExe} ${spawnArgs.join(" ")} (${projectInfo.mode})`);

  imageStudioProcess = spawn(nodeExe, spawnArgs, {
    cwd: projectInfo.projectPath,
    env,
    stdio: "ignore",
    windowsHide: true,
    detached: false,
  });

  imageStudioProcess.on("error", (error) => {
    console.error("[Main] Image studio spawn error:", error.message);
  });
  imageStudioProcess.on("exit", (code) => {
    console.log(`[Main] Image studio exited: ${code}`);
    if (imageStudioProcess) {
      imageStudioProcess = null;
      updateImageStudioStatus({ status: "error", ready: false, message: `AI 出图服务已退出（code=${code ?? "unknown"}）` });
    }
  });

  await waitForImageStudio();
  return updateImageStudioStatus({ status: "ready", ready: true, message: "AI 出图服务已就绪" });
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

  // 开发模式：等待 Vite dev server 就绪（最多30秒）
  const devUrl = "http://localhost:1420";
  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

  if (isDev) {
    console.log("[Main] Dev mode: waiting for Vite server...");
    const maxWait = 30000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      try {
        await new Promise((resolve, reject) => {
          const req = http.get(devUrl, (res) => { res.resume(); resolve(true); });
          req.on("error", reject);
          req.setTimeout(2000, () => { req.destroy(); reject(new Error("timeout")); });
        });
        break;
      } catch {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    console.log("[Main] Loading from Vite dev server");
    mainWindow.loadURL(devUrl);
  } else {
    // 打包后 dist 在 app 根目录（extraFiles），开发时在项目根目录
    const distCandidates = [
      path.join(__dirname, "../dist/index.html"),
      app.isPackaged ? path.join(path.dirname(app.getPath("exe")), "dist", "index.html") : "",
    ].filter(Boolean);
    const distPath = distCandidates.find(p => fs.existsSync(p));
    if (distPath) {
      console.log("[Main] Loading from dist:", distPath);
      mainWindow.loadFile(distPath);
    } else {
      console.log("[Main] Fallback to dev URL");
      mainWindow.loadURL(devUrl);
    }
  }

  // DevTools: 按 F12 手动打开，不自动打开（避免遮挡页面）
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12") mainWindow.webContents.toggleDevTools();
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  await createWindow();
  try {
    await startWorker();
    console.log("[Main] Worker auto-started successfully");
  } catch (e) {
    console.error("[Main] Worker auto-start failed (will retry on demand):", e.message);
  }
  // 自动检查更新（延迟5秒，避免阻塞启动）
  configureAutoUpdater();
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 5000);
  }
});
app.on("window-all-closed", () => { stopWorker(); stopImageStudioService(); app.quit(); });
app.on("activate", () => { if (!mainWindow) createWindow(); });

// ============ IPC ============

ipcMain.handle("get-app-path", () => app.getPath("userData"));

ipcMain.handle("select-file", async (_e, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: filters || [{ name: "表格文件", extensions: ["xlsx", "xls", "csv"] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

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

ipcMain.handle("automation:scrape-flux", async () => {
  return sendCmd("scrape_flux");
});

ipcMain.handle("automation:scrape-dashboard", async () => {
  return sendCmd("scrape_dashboard");
});

ipcMain.handle("automation:scrape-aftersales", async () => {
  return sendCmd("scrape_aftersales");
});

ipcMain.handle("automation:scrape-soldout", async () => {
  return sendCmd("scrape_soldout");
});

ipcMain.handle("automation:scrape-goods-data", async () => {
  return sendCmd("scrape_goods_data");
});

ipcMain.handle("automation:scrape-activity", async () => {
  return sendCmd("scrape_activity");
});

ipcMain.handle("automation:scrape-performance", async () => {
  return sendCmd("scrape_performance");
});

ipcMain.handle("automation:scrape-all", async () => {
  return sendCmd("scrape_all");
});

ipcMain.handle("automation:create-product", async (_e, params) => {
  return sendCmd("create_product", params);
});

ipcMain.handle("automation:auto-pricing", async (_e, params) => {
  const existingTask = getAutoPricingTask(autoPricingCurrentTaskId);
  if (existingTask && ["running", "paused"].includes(existingTask.status)) {
    return {
      accepted: false,
      taskId: existingTask.taskId,
      message: "已有批量上品任务正在执行，请先等待完成或恢复当前任务。",
      task: getAutoPricingProgressPayload(existingTask),
    };
  }

  await startWorker();

  const now = new Date().toLocaleString("zh-CN");
  const taskId = typeof params?.taskId === "string" && params.taskId.trim()
    ? params.taskId.trim()
    : `pricing_${Date.now()}`;

  const nextTask = upsertAutoPricingTask({
    taskId,
    status: "running",
    running: true,
    paused: false,
    total: Number(params?.count) || 0,
    completed: 0,
    current: "准备中...",
    step: "初始化",
    message: "批量上品任务已启动",
    csvPath: typeof params?.csvPath === "string" ? params.csvPath : "",
    startRow: Number(params?.startRow) || 0,
    count: Number(params?.count) || 0,
    results: [],
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    finishedAt: "",
  });

  startAutoPricingTaskSync();
  autoPricingTaskPromise = sendCmd("auto_pricing", { ...params, taskId })
    .then((result) => {
      const finishedAt = new Date().toLocaleString("zh-CN");
      appendCreateHistoryEntries((result?.results || []).map((item) => ({
        title: item?.name || "商品",
        status: item?.success ? "draft" : "failed",
        message: item?.message || "",
        productId: item?.productId || "",
        createdAt: Date.now(),
      })));
      upsertAutoPricingTask({
        ...nextTask,
        taskId,
        status: result?.success === false ? "failed" : "completed",
        running: false,
        paused: false,
        total: Number(result?.total) || nextTask.total,
        completed: Number(result?.total) || (Array.isArray(result?.results) ? result.results.length : nextTask.completed),
        current: "完成",
        step: result?.success === false ? "失败" : "完成",
        message: result?.message || "批量上品任务已完成",
        results: Array.isArray(result?.results) ? result.results : nextTask.results,
        updatedAt: finishedAt,
        finishedAt,
      });
      return result;
    })
    .catch(async (error) => {
      const live = await requestWorkerProgressSnapshot(taskId);
      if (live?.running || live?.paused) {
        upsertAutoPricingTask({
          ...nextTask,
          taskId,
          status: live.paused ? "paused" : "running",
          running: Boolean(live.running),
          paused: Boolean(live.paused),
          total: Number(live.total) || nextTask.total,
          completed: Number(live.completed) || nextTask.completed,
          current: typeof live.current === "string" ? live.current : nextTask.current,
          step: typeof live.step === "string" ? live.step : nextTask.step,
          results: Array.isArray(live.results) ? live.results : nextTask.results,
          updatedAt: new Date().toLocaleString("zh-CN"),
          message: "与 worker 的长连接已断开，正在根据实时进度继续跟踪任务。",
        });
        return null;
      }

      const failedAt = new Date().toLocaleString("zh-CN");
      upsertAutoPricingTask({
        ...nextTask,
        taskId,
        status: "failed",
        running: false,
        paused: false,
        current: "失败",
        step: "失败",
        message: error?.message || "批量上品任务失败",
        updatedAt: failedAt,
        finishedAt: failedAt,
      });
      return null;
    })
    .finally(async () => {
      autoPricingTaskPromise = null;
      const latestTask = await syncActiveAutoPricingTaskFromWorker({ markInterruptedOnIdle: true });
      if (!latestTask || !latestTask.running) {
        stopAutoPricingTaskSync();
      }
    });

  return {
    accepted: true,
    taskId,
    task: getAutoPricingProgressPayload(nextTask),
  };
});

ipcMain.handle("automation:pause-pricing", async (_e, taskId) => {
  const result = await sendCmd("pause_pricing", { taskId });
  const activeTask = getAutoPricingTask(taskId || autoPricingCurrentTaskId);
  if (activeTask) {
    upsertAutoPricingTask({
      ...activeTask,
      status: "paused",
      running: true,
      paused: true,
      message: "暂停请求已发送，当前商品处理完后停止。",
      updatedAt: new Date().toLocaleString("zh-CN"),
    });
  }
  return result;
});

ipcMain.handle("automation:resume-pricing", async (_e, taskId) => {
  const result = await sendCmd("resume_pricing", { taskId });
  const activeTask = getAutoPricingTask(taskId || autoPricingCurrentTaskId);
  if (activeTask) {
    upsertAutoPricingTask({
      ...activeTask,
      status: "running",
      running: true,
      paused: false,
      message: "批量上品任务已恢复。",
      updatedAt: new Date().toLocaleString("zh-CN"),
    });
  }
  startAutoPricingTaskSync();
  return result;
});

ipcMain.handle("automation:list-drafts", async () => {
  return sendCmd("list_drafts");
});

ipcMain.handle("automation:retry-draft", async (_e, draftId) => {
  return sendCmd("retry_draft", { draftId });
});

ipcMain.handle("automation:delete-draft", async (_e, draftId) => {
  return sendCmd("delete_draft", { draftId });
});

ipcMain.handle("automation:get-progress", async () => {
  const syncedTask = await syncActiveAutoPricingTaskFromWorker({ markInterruptedOnIdle: true });
  return getAutoPricingProgressPayload(syncedTask || getAutoPricingTask(autoPricingCurrentTaskId));
});

ipcMain.handle("automation:get-task-progress", async (_e, taskId) => {
  await syncAutoPricingTaskFromWorker(taskId, { markInterruptedOnIdle: true });
  return getAutoPricingProgressPayload(getAutoPricingTask(taskId));
});

ipcMain.handle("automation:list-tasks", async () => {
  await syncWorkerTaskSnapshotsToStore();
  await syncActiveAutoPricingTaskFromWorker({ markInterruptedOnIdle: true });
  return listAutoPricingTasks().map((task) => getAutoPricingProgressPayload(task));
});

ipcMain.handle("automation:read-scrape-data", async (_e, key) => {
  return sendCmd("read_scrape_data", { key });
});

ipcMain.handle("automation:scrape-lifecycle", async () => { return sendCmd("scrape_lifecycle"); });
ipcMain.handle("automation:scrape-bidding", async () => { return sendCmd("scrape_bidding"); });
ipcMain.handle("automation:scrape-price-compete", async () => { return sendCmd("scrape_price_compete"); });
ipcMain.handle("automation:scrape-hot-plan", async () => { return sendCmd("scrape_hot_plan"); });
ipcMain.handle("automation:scrape-checkup", async () => { return sendCmd("scrape_checkup"); });
ipcMain.handle("automation:scrape-us-retrieval", async () => { return sendCmd("scrape_us_retrieval"); });
ipcMain.handle("automation:scrape-delivery", async () => { return sendCmd("scrape_delivery"); });

ipcMain.handle("automation:close", async () => {
  return sendCmd("close");
});

ipcMain.handle("automation:ping", async () => {
  return sendCmd("ping");
});

// ============ AI 出图 IPC ============

ipcMain.handle("image-studio:get-status", async () => {
  const projectInfo = resolveAutoImageProjectDir();
  const projectPath = imageStudioStatus.projectPath || projectInfo?.projectPath || "";
  const healthy = await isImageStudioHealthy();
  return updateImageStudioStatus({
    projectPath,
    ready: healthy,
    status: healthy ? "ready" : imageStudioStatus.status,
    message: healthy ? "AI 出图服务已就绪" : imageStudioStatus.message,
  });
});

ipcMain.handle("image-studio:ensure-running", async () => {
  return ensureImageStudioService();
});

ipcMain.handle("image-studio:restart", async () => {
  stopImageStudioService();
  return ensureImageStudioService();
});

ipcMain.handle("image-studio:open-external", async () => {
  const status = await ensureImageStudioService();
  await shell.openExternal(status.url);
  return status.url;
});

ipcMain.handle("app:get-version", () => app.getVersion());

ipcMain.handle("app:get-update-status", () => updateState);

ipcMain.handle("app:check-for-updates", async () => {
  try {
    await autoUpdater.checkForUpdates();
    return updateState;
  } catch (e) {
    broadcastUpdateState({ status: "error", message: e?.message || "检查更新失败" });
    return updateState;
  }
});

ipcMain.handle("app:download-update", async () => {
  await autoUpdater.downloadUpdate();
  return updateState;
});

ipcMain.handle("app:quit-and-install-update", () => {
  autoUpdater.quitAndInstall(false, true);
  return true;
});

ipcMain.handle("app:open-log-directory", async () => {
  const logDir = app.getPath("userData");
  await shell.openPath(logDir);
  return logDir;
});

// ============ 文件存储 IPC ============

function getStoreFilePath(key) {
  return path.join(app.getPath("userData"), `${key}.json`);
}

function getStoreBackupPath(filePath) {
  return `${filePath}.bak`;
}

function readStoreJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeStoreJsonAtomic(filePath, data, options = {}) {
  const { skipBackup = false, key } = options;
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const backupPath = getStoreBackupPath(filePath);
  const serialized = JSON.stringify(serializeStoreValue(key, data), null, 2);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  try {
    fs.writeFileSync(tempPath, serialized);

    if (fs.existsSync(filePath)) {
      if (!skipBackup) {
        try {
          fs.copyFileSync(filePath, backupPath);
        } catch (error) {
          console.error("[Store] Failed to create backup:", error.message);
        }
      }
      fs.rmSync(filePath, { force: true });
    }

    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true });
    } catch {}
    throw error;
  }
}

function readStoreJsonWithRecovery(filePath, key) {
  const backupPath = getStoreBackupPath(filePath);

  if (fs.existsSync(filePath)) {
    try {
      return deserializeStoreValue(key, readStoreJson(filePath), filePath);
    } catch (error) {
      console.error(`[Store] Failed to read ${path.basename(filePath)}:`, error.message);
    }
  }

  if (!fs.existsSync(backupPath)) {
    return null;
  }

  try {
    const restored = readStoreJson(backupPath);
    writeStoreJsonAtomic(filePath, restored, { skipBackup: true, key });
    console.error(`[Store] Restored ${path.basename(filePath)} from backup`);
    return deserializeStoreValue(key, restored, filePath);
  } catch (error) {
    console.error(`[Store] Failed to recover ${path.basename(filePath)} from backup:`, error.message);
    return null;
  }
}

ipcMain.handle("store:get", (_, key) => {
  return readStoreJsonWithRecovery(getStoreFilePath(key), key);
});

ipcMain.handle("store:set", (_, key, data) => {
  writeStoreJsonAtomic(getStoreFilePath(key), data, { key });
  return true;
});
