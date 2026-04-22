#!/usr/bin/env node
"use strict";

// 端到端测试 grsai 生图接口
// 读取 .env.local 中的 GENERATE_* 配置，发送一次最小调用，验证连通性、鉴权、返回 URL

const fs = require("node:fs");
const path = require("node:path");

function readEnvLocal(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim();
  }
  return out;
}

async function main() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const env = readEnvLocal(envPath);
  const apiKey = env.GENERATE_API_KEY || process.env.GENERATE_API_KEY;
  const baseUrl = (env.GENERATE_BASE_URL || process.env.GENERATE_BASE_URL || "https://grsaiapi.com")
    .replace(/\/+$/, "")
    .replace(/\/v1$/i, "");
  const model = env.GENERATE_MODEL || process.env.GENERATE_MODEL || "nano-banana-2";

  if (!apiKey) {
    console.error("✗ GENERATE_API_KEY 未配置");
    process.exit(1);
  }

  const isNanoBanana = /^nano-banana/i.test(model);
  const endpointPath = isNanoBanana ? "/v1/draw/nano-banana" : "/v1/draw/completions";
  const url = `${baseUrl}${endpointPath}`;

  // 用一张公开样例图作为输入（nano-banana 是图编辑模型，需要至少 1 张输入）
  const sampleInput = "https://placehold.co/512x512/png";
  const body = {
    model,
    prompt: "A cute red panda holding a tiny coffee cup, studio lighting, white background",
    size: "",
    urls: [sampleInput],
    badPrompt: "",
    webHook: "",
    shutProgress: false,
    variants: 0,
    cdn: "",
  };

  console.log("→ POST", url);
  console.log("  model:", model);
  console.log("  key  :", apiKey.slice(0, 12) + "..." + apiKey.slice(-4));

  const startedAt = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`✗ HTTP ${res.status}: ${text.slice(0, 600)}`);
    process.exit(2);
  }
  if (!res.body) {
    console.error("✗ 响应无 body（无 SSE 流）");
    process.exit(3);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";
  let lastEvent = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const dataLines = block
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart());
      if (dataLines.length === 0) continue;
      const payload = dataLines.join("\n").trim();
      if (!payload) continue;
      let evt;
      try {
        evt = JSON.parse(payload);
      } catch {
        continue;
      }
      lastEvent = evt;
      const status = evt.status || evt.event || "";
      const progress = evt.progress != null ? `${evt.progress}%` : "";
      console.log(`  · ${status} ${progress}`.trim());
      if (status === "succeeded") {
        const urlOut = evt.results?.[0]?.url || evt.url;
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(`✓ 成功 (${elapsed}s)`);
        console.log(`  图片 URL: ${urlOut}`);
        process.exit(0);
      }
      if (status === "failed") {
        console.error(`✗ 生成失败: ${evt.failure_reason || evt.error || "未知原因"}`);
        process.exit(4);
      }
    }
  }

  console.error(`✗ SSE 流结束但未收到 succeeded：最后事件 ${lastEvent ? JSON.stringify(lastEvent).slice(0, 300) : "无"}`);
  process.exit(5);
}

main().catch((e) => {
  console.error("✗ 测试异常:", e?.message || e);
  process.exit(99);
});
