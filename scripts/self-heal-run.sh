#!/usr/bin/env bash
set -euo pipefail

cycle=1
prev=""
while [ $cycle -le 2 ]; do
  echo "[self-heal] cycle $cycle"
  npm ci >/tmp/npm.root.log 2>&1 || npm install >/tmp/npm.root.log 2>&1
  (cd tools/search2serp && (npm ci || npm install)) >/tmp/npm.search.log 2>&1 || true
  (cd tools/web2md && (npm ci || npm install)) >/tmp/npm.web.log 2>&1 || true
  npm run build:tools >/tmp/build.tools.log 2>&1 || true
  if scripts/e2e-serp-proxy-check.sh; then
    echo "[self-heal] success"; exit 0
  fi
  err="$(cat /tmp/search2serp.err /tmp/web2md.err 2>/tmp/empty 2>/dev/null || true)"
  if echo "$err" | grep -qi 'missing.*chromium'; then
    npx playwright install chromium >/tmp/playwright.install.log 2>&1 || true
    npx playwright install-deps >/tmp/playwright.deps.log 2>&1 || true
    git add -A && git commit -m "chore(self-heal): install playwright deps" || true
  fi
  if [ "$err" = "$prev" ]; then
    echo "[self-heal] no change, stopping"; exit 1
  fi
  prev="$err"
  cycle=$((cycle+1))
done
exit 1
