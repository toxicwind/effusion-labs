#!/usr/bin/env bash
set -euo pipefail
PORT=${1:-8080}
curl -sSf "http://localhost:${PORT}/readyz" >/dev/null
