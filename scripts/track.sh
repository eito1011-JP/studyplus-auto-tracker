#!/bin/bash
# 1コマンドでトラッキングを開始する。以後は launchd が5分おきに自動継続。
# 前提: 初回だけ `npm run seed`（または `npm run seed:browser`）でトークンを Keychain に保管済みであること。
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.eito.studyplus-tracker.poll"

# 1) ActivityWatch を起動（既に起動済みなら何もしない）
open -a ActivityWatch

# 2) 常駐が未ロードなら入れる（ログイン時自動起動 + 5分間隔）
if launchctl list 2>/dev/null | grep -q "$LABEL"; then
  echo "✓ 常駐は既に有効"
else
  bash "$PROJECT_DIR/scripts/launchd-install.sh"
fi

# 3) すぐ1回ポーリング（確定ブロックがあれば即投稿）
cd "$PROJECT_DIR" && npm run poll

echo ""
echo "✓ トラッキング開始。以後は何もしなくて OK（launchd が5分おきに自動実行・再起動後も自動復帰）。"
