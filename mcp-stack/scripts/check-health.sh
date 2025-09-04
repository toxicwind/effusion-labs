#!/usr/bin/env bash
set -euo pipefail
curl -fsS http://localhost:${PORT_HTTP:-3000}/healthz >/dev/null
