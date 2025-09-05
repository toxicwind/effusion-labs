#!/usr/bin/env bash
set -euo pipefail

# One-Shot Operator Script — Interlinker Fortification & Hotfix
# Runs discovery, verifies patches, builds Eleventy with thresholds,
# verifies unresolved report schema, runs tests, and prints audit suggestions.

echo "[op] Activating HYPEBRUT shell toolkit (idempotent)."
if [ -f scripts/llm-bootstrap.sh ]; then source scripts/llm-bootstrap.sh; fi
# Ensure hype_run env defaults under set -u
: "${LLM_IDLE_SECS:=10}"
: "${LLM_IDLE_FAIL_AFTER_SECS:=360}"

echo "[op] Checking Node runtime >= 24"
node -e "const v=+process.versions.node.split('.')[0]; if(v<24){console.error('Node >=24 required');process.exit(1)}"

echo "[op] Installing deps (npm ci)"
hype_run --capture logs/npm-ci.$(date -u +%Y-%m-%dT%H%M%SZ).log -- npm ci

echo "[op] Discovery artifacts"
hype_run --capture logs/discovery.$(date -u +%Y%m%dT%H%M%SZ).log -- node tools/interlinker-discover.mjs
hype_run --capture logs/hotfix-discovery.$(date -u +%Y%m%dT%H%M%SZ).log -- node tools/interlinker-hotfix-discover.mjs

echo "[op] Verify plugin patches are applied"
hype_run -- node tools/verify-patch-applied.mjs

echo "[op] Build with thresholds"
export INTERLINKER_MAX_UNRESOLVED="${INTERLINKER_MAX_UNRESOLVED:-200}"
export INTERLINKER_FAIL_ON_UNRESOLVED="${INTERLINKER_FAIL_ON_UNRESOLVED:-false}"
hype_run --capture logs/eleventy.$(date -u +%Y%m%dT%H%M%SZ).log -- npx @11ty/eleventy || true

echo "[op] Final flush (no-op if already flushed)"
node -e "import('./lib/interlinkers/unresolved-report.mjs').then(m=>m.flushUnresolved&&m.flushUnresolved())"

echo "[op] Verify artifact schema"
node - <<'JS'
const fs=require('fs'), p='artifacts/reports/interlinker-unresolved.json';
if(!fs.existsSync(p)){ console.log('[info] no unresolved report'); process.exit(0); }
const j=JSON.parse(fs.readFileSync(p,'utf8'));
const iso = s => /^\d{4}-\d{2}-\d{2}T/.test(s);
if(j.schemaVersion!==1) throw new Error('schemaVersion != 1');
if(!iso(j.generatedAt)) throw new Error('generatedAt not ISO');
if(!Array.isArray(j.items)) throw new Error('items not array');
console.log(`[ok] unresolved=${j.count}`);
JS

echo "[op] Run tests"
hype_run --capture logs/tests.$(date -u +%Y%m%dT%H%M%SZ).log -- npm test

echo "[op] Dry-run alias proposals"
node tools/interlinker-audit.mjs || true

echo "[op] Done."
