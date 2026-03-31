const cp = require("child_process");
const fs = require("fs");
const http = require("http");

const entry = process.argv[2];
const port = process.argv[3] || "3224";
const log = process.argv[4] || "C:/Users/Administrator/Documents/Playground/tmp_ai_verify.log";

if (!entry) {
  console.error("Usage: node verify_ai_runtime.cjs <entry> [port] [log]");
  process.exit(2);
}

try {
  fs.unlinkSync(log);
} catch {}

const child = cp.spawn(process.execPath, [entry], {
  env: {
    ...process.env,
    PORT: port,
    HOSTNAME: "127.0.0.1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

const out = fs.createWriteStream(log, { flags: "a" });
child.stdout.pipe(out);
child.stderr.pipe(out);

let finished = false;
const done = (code, msg) => {
  if (finished) return;
  finished = true;
  try {
    child.kill();
  } catch {}
  if (msg) {
    console.log(msg);
  }
  process.exit(code);
};

child.on("exit", (code) => {
  done(1, `CHILD_EXIT ${code}`);
});

setTimeout(() => {
  http
    .get(`http://127.0.0.1:${port}/api/config`, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        done(0, data);
      });
    })
    .on("error", (error) => {
      done(1, `HTTP_ERR ${error.message}`);
    });
}, 10000);

setTimeout(() => {
  done(1, "TIMEOUT");
}, 25000);
