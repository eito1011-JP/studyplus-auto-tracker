#!/bin/bash
# launchd 常駐をインストールする（決定 #8）。数分おきに poller を実行する。
# 使い方: bash scripts/launchd-install.sh
set -euo pipefail

LABEL="com.eito.studyplus-tracker.poll"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
INTERVAL=300 # 5分

mkdir -p "$HOME/Library/LaunchAgents" "$PROJECT_DIR/.state"

# zsh -lc でログインシェルの PATH を読み、node/npm（nvm 等）を解決する。
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>open -a ActivityWatch ; cd "${PROJECT_DIR}" && npm run poll</string>
  </array>
  <key>StartInterval</key><integer>${INTERVAL}</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${PROJECT_DIR}/.state/poll.log</string>
  <key>StandardErrorPath</key><string>${PROJECT_DIR}/.state/poll.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load -w "$PLIST"

echo "✓ インストール: ${LABEL}（${INTERVAL}秒間隔）"
echo "  plist: ${PLIST}"
echo "  ログ:  ${PROJECT_DIR}/.state/poll.log"
echo "  停止:  bash scripts/launchd-uninstall.sh"
