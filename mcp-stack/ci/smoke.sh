#!/usr/bin/env bash
set -euo pipefail

node mcp-stack/tests/smoke.mjs
node mcp-stack/tests/integration.mjs

echo "CI: mcp-stack smoke+integration passed"

