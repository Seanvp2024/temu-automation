from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "build" / "auto-image-gen-runtime"
BOOTSTRAP_CONTENT = """const path = require('path');
const Module = require('module');

const runtimeNodeModules = path.join(__dirname, 'runtime_node_modules');
const existingNodePath = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];
if (!existingNodePath.includes(runtimeNodeModules)) {
  process.env.NODE_PATH = [runtimeNodeModules, ...existingNodePath].filter(Boolean).join(path.delimiter);
  Module._initPaths();
}

require('./server.js');
"""


def get_source_candidates() -> list[Path]:
    env_candidate = os.environ.get("AUTO_IMAGE_GEN_DIR", "").strip()
    raw_candidates = [
        Path(env_candidate) if env_candidate else None,
        ROOT / "auto-image-gen-dev",
        ROOT.parent / "auto-image-gen-dev",
        Path.cwd() / "auto-image-gen-dev",
        Path.cwd().parent / "auto-image-gen-dev",
    ]
    candidates: list[Path] = []
    seen: set[str] = set()
    for candidate in raw_candidates:
        if candidate is None:
            continue
        normalized = candidate.expanduser().resolve()
        key = str(normalized)
        if key in seen:
            continue
        seen.add(key)
        candidates.append(normalized)
    return candidates


def resolve_source_dir() -> Path:
    candidates = get_source_candidates()
    for candidate in candidates:
        if (candidate / "package.json").exists():
            return candidate
    searched = "\n".join(f" - {candidate}" for candidate in candidates)
    raise SystemExit(
        "未找到 AI 出图项目目录。请设置 AUTO_IMAGE_GEN_DIR，或确认以下目录之一存在完整项目：\n"
        f"{searched}"
    )


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def copy_tree(src: Path, dst: Path) -> None:
    if not src.exists():
        return
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def copy_file(src: Path, dst: Path) -> None:
    if not src.exists():
        return
    ensure_dir(dst.parent)
    shutil.copy2(src, dst)


def main() -> None:
    source = resolve_source_dir()

    subprocess.run(["cmd", "/c", "npm", "run", "build"], cwd=source, check=True)

    standalone_root = source / ".next" / "standalone"
    standalone_server = standalone_root / "server.js"
    static_root = source / ".next" / "static"
    public_root = source / "public"

    if not standalone_server.exists():
        raise SystemExit(f"未生成 Next standalone 产物: {standalone_server}")

    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    ensure_dir(OUTPUT)

    # standalone 根目录本身就是一个可启动运行时，直接复制其内容。
    for child in standalone_root.iterdir():
      target = OUTPUT / child.name
      if child.is_dir():
        shutil.copytree(child, target)
      else:
        ensure_dir(target.parent)
        shutil.copy2(child, target)

    packaged_node_modules = OUTPUT / "node_modules"
    runtime_node_modules = OUTPUT / "runtime_node_modules"
    if packaged_node_modules.exists():
        if runtime_node_modules.exists():
            shutil.rmtree(runtime_node_modules)
        packaged_node_modules.rename(runtime_node_modules)

    copy_tree(static_root, OUTPUT / ".next" / "static")
    copy_tree(public_root, OUTPUT / "public")
    copy_file(source / ".env.local", OUTPUT / ".env.local")
    copy_tree(source / "data", OUTPUT / "data")
    (OUTPUT / "bootstrap.cjs").write_text(BOOTSTRAP_CONTENT, encoding="utf-8")

    print(f"Prepared AI image runtime at: {OUTPUT} (source: {source})")


if __name__ == "__main__":
    main()
