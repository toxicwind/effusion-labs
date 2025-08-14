#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
docker compose -f "${here}/docker-compose.yml" -f "${here}/docker-compose.override.yml" down --remove-orphans
