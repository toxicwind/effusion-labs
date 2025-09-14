#!/usr/bin/env bash
set -Eeuo pipefail

# Large stream without newline; check sidecar grows
before=$(wc -c <"${HB_SIDECAR_STDOUT}")
python3 - <<'PY'
import sys
sys.stdout.write('Z'*15000)
sys.stdout.flush()
PY
after=$(wc -c <"${HB_SIDECAR_STDOUT}")
delta=$((after-before))
[[ "$delta" -ge 15000 ]] || { echo "delimiterless too small $delta"; exit 1; }
echo "ok 07-delimiterless"

