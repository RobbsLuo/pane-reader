#!/usr/bin/env bash
# 打一个可直接解压加载的 zip：解压后根目录就是 manifest.json
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
OUT="release/markdown-reader-v${VERSION}.zip"

mkdir -p release
rm -f "$OUT"

if [ ! -f dist/manifest.json ]; then
  echo "dist/manifest.json 不存在，先运行 npm run build" >&2
  exit 1
fi

(cd dist && zip -qr "../${OUT}" . -x '*.map')

echo "已生成 ${OUT}（$(du -h "$OUT" | cut -f1)）"
