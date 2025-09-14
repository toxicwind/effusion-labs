#!/usr/bin/env bash
set -Eeuo pipefail

# Inject NUL and DEL among text; ensure sidecar grows accordingly
before_out=$(wc -c <"${HB_SIDECAR_STDOUT}")
python3 - <<'PY'
import sys
sys.stdout.buffer.write(b'OK')
sys.stdout.buffer.write(bytes([0,127,0]))
sys.stdout.buffer.write(b'END\n')
sys.stdout.flush()
PY
after_out=$(wc -c <"${HB_SIDECAR_STDOUT}")
delta=$((after_out-before_out))
[[ "$delta" -ge 6 ]] || { echo "unsafe delta $delta"; exit 1; }
echo "ok 06-unsafe-bytes"

