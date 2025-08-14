#!/usr/bin/env bash
set -euo pipefail

STACK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OVR="${STACK_DIR}/docker-compose.override.yml"
IMG="ghcr.io/flaresolverr/flaresolverr:latest"

echo ">> Probing FlareSolverr stability…"
docker rm -f flare-probe >/dev/null 2>&1 || true

probe() {
  docker run -d --name flare-probe "$@" \
    --health-cmd='curl -fsS -X POST -H "Content-Type: application/json" -d "{\"cmd\":\"sessions.list\"}" http://localhost:8191/v1 || exit 1' \
    --health-interval=10s --health-timeout=5s --health-retries=3 "${IMG}" >/dev/null 2>&1 || return 1
  for _ in {1..30}; do
    s="$(docker inspect -f '{{.State.Health.Status}}' flare-probe 2>/dev/null || echo "none")"
    [[ "$s" == "healthy" ]] && { docker rm -f flare-probe >/dev/null 2>&1 || true; return 0; }
    [[ "$s" == "unhealthy" || "$s" == "exited" ]] && break
    sleep 2
  done
  docker rm -f flare-probe >/dev/null 2>&1 || true
  return 1
}

cfg="vanilla"
if probe; then cfg="vanilla"
elif probe --shm-size=2g; then cfg="shm"
elif probe --shm-size=2g --security-opt seccomp=unconfined; then cfg="shm+seccomp"
else echo "!! No stable configuration"; exit 1
fi

echo ">> Writing override: ${cfg}"
{
  echo "services:"
  echo "  solver:"
  [[ "$cfg" == "shm" || "$cfg" == "shm+seccomp" ]] && echo "    shm_size: 2g"
  [[ "$cfg" == "shm+seccomp" ]] && { echo "    security_opt:"; echo "      - seccomp=unconfined"; }
} > "$OVR"
