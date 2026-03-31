const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const logPath = process.env.WORKER_BOOTSTRAP_LOG
  || path.join(process.env.APP_USER_DATA || process.cwd(), "worker-bootstrap.log");

function appendLog(message) {
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`, "utf8");
  } catch {}
}

appendLog(`bootstrap start pid=${process.pid} node=${process.version} cwd=${process.cwd()}`);

process.on("uncaughtException", (error) => {
  appendLog(`uncaughtException: ${error?.stack || error?.message || String(error)}`);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  appendLog(`unhandledRejection: ${reason?.stack || reason?.message || String(reason)}`);
  process.exit(1);
});

const workerModuleUrl = pathToFileURL(path.join(__dirname, "worker.mjs")).href;
appendLog(`bootstrap import ${workerModuleUrl}`);

import(workerModuleUrl)
  .then(() => {
    appendLog("bootstrap import success");
  })
  .catch((error) => {
    appendLog(`bootstrap import failed: ${error?.stack || error?.message || String(error)}`);
    process.exit(1);
  });
