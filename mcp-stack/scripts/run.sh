#!/usr/bin/env bash
set -euo pipefail
PROFILE=${PROFILE:-dev}
PORT_HTTP=${PORT_HTTP:-0}
node mcp-stack/gateway/index.js
