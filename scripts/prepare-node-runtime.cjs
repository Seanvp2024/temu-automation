const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "build", "node-runtime");
const outputPath = path.join(outputDir, "node.exe");

function resolveNodeSource() {
  const candidates = [
    process.env.TEMU_NODE_RUNTIME,
    process.env.NODE_EXE,
    process.execPath,
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {}
  }

  throw new Error("未找到可用的 node.exe，请设置 TEMU_NODE_RUNTIME 后重试。");
}

function main() {
  const nodeSource = resolveNodeSource();
  fs.mkdirSync(outputDir, { recursive: true });
  fs.copyFileSync(nodeSource, outputPath);
  console.log(`[ok] node runtime prepared: ${outputPath}`);
}

main();
