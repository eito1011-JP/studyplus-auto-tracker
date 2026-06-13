#!/bin/bash
# launchd 常駐を停止・削除する。
set -euo pipefail

LABEL="com.eito.studyplus-tracker.poll"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"

launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
echo "✓ 停止・削除: ${LABEL}"
