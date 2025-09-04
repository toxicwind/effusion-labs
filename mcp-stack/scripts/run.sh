#!/usr/bin/env bash
set -euo pipefail
DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
ROOT=$(cd -- "${DIR}/../.." &>/dev/null && pwd)

exec node "${ROOT}/mcp-stack/gateway/server.mjs"

