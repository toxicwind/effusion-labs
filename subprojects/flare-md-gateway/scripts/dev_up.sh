#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"${here}/scripts/probe_solver.sh"
docker compose -f "${here}/docker-compose.yml" -f "${here}/docker-compose.override.yml" up -d --wait
