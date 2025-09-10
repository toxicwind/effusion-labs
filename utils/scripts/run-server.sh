#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." &>/dev/null && pwd)

# Back-compat: allow PORT_SSE to alias PORT_HTTP
if [[ -n "${PORT_SSE:-}" && -z "${PORT_HTTP:-}" ]]; then
  export PORT_HTTP="${PORT_SSE}"
fi

exec node "${ROOT}/mcp-stack/gateway/server.mjs"

