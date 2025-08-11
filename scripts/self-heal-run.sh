#!/usr/bin/env bash
set -e
max=3
for cycle in $(seq 1 $max); do
  npm ci || npm install
  (cd tools/web2md && npm ci || npm install)
  (cd tools/search2serp && npm ci || npm install)
  npm run build:tools || true
  if scripts/e2e-serp-proxy-check.sh; then
    exit 0
  fi
  npx playwright install chromium || true
  npx playwright install-deps || true
  git add -A
  git commit -m "chore(self-heal): attempt $cycle" || true
 done
echo "self-heal failed after $max attempts"
exit 1
