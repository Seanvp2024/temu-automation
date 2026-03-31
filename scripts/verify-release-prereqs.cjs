const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(repoRoot, "package.json");

function resolveResourcePath(resourcePath) {
  if (!resourcePath || typeof resourcePath !== "string") return null;
  if (path.isAbsolute(resourcePath)) return resourcePath;
  return path.resolve(repoRoot, resourcePath);
}

function checkPathExists(targetPath) {
  try {
    fs.accessSync(targetPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const buildConfig = pkg.build || {};
  const extraResources = Array.isArray(buildConfig.extraResources) ? buildConfig.extraResources : [];
  const checks = [];

  checks.push({
    label: "build/icon.ico",
    path: path.join(repoRoot, "build", "icon.ico"),
  });

  for (const resource of extraResources) {
    if (!resource || typeof resource !== "object" || !resource.from) continue;
    checks.push({
      label: `extraResource:${resource.to || resource.from}`,
      path: resolveResourcePath(resource.from),
    });
  }

  const missing = [];
  for (const check of checks) {
    const exists = checkPathExists(check.path);
    const prefix = exists ? "[ok]" : "[missing]";
    console.log(`${prefix} ${check.label}: ${check.path}`);
    if (!exists) {
      missing.push(check);
    }
  }

  if (missing.length > 0) {
    console.error("");
    console.error("Release prerequisite check failed.");
    console.error("Missing paths:");
    for (const check of missing) {
      console.error(`- ${check.path}`);
    }
    process.exit(1);
  }

  console.log("");
  console.log("Release prerequisite check passed.");
}

main();
