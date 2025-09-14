#!/usr/bin/env bash
set -Eeuo pipefail

# Record sidecar size before
before=$(wc -c <"${HB_SIDECAR_STDOUT}")

# Emit 20000 bytes without newline
python3 - "$@" <<'PY'
import sys
sys.stdout.write('A'*20000)
sys.stdout.flush()
PY

after=$(wc -c <"${HB_SIDECAR_STDOUT}")
delta=$((after-before))
[[ "$delta" -ge 20000 ]] || { echo "short sidecar delta $delta"; exit 1; }
echo "ok 02-wrap-3500 $delta"

