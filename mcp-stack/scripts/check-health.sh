#!/bin/sh
set -eu
HOST=${HOST:-127.0.0.1}
PORT=${PORT:-3000}
BASE="http://$HOST:$PORT"

curl -fsS "$BASE/healthz" | sed -e 's/.*/HEALTHZ: OK/' || echo "HEALTHZ: FAIL"
curl -fsS "$BASE/readyz" | sed -e 's/.*/READYZ: OK/' || echo "READYZ: FAIL"
curl -fsS "$BASE/.well-known/mcp-servers.json" >/dev/null 2>&1 && echo "WELL-KNOWN: OK" || echo "WELL-KNOWN: FAIL"
curl -fsS "$BASE/admin/queue" >/dev/null 2>&1 && echo "ADMIN-QUEUE: OK" || echo "ADMIN-QUEUE: FAIL"
curl -fsS "$BASE/admin/rate" >/dev/null 2>&1 && echo "ADMIN-RATE: OK" || echo "ADMIN-RATE: FAIL"
curl -fsS "$BASE/admin/retry" >/dev/null 2>&1 && echo "ADMIN-RETRY: OK" || echo "ADMIN-RETRY: FAIL"
curl -fsS "$BASE/admin/sidecars" >/dev/null 2>&1 && echo "ADMIN-SIDECARS: OK" || echo "ADMIN-SIDECARS: FAIL"
