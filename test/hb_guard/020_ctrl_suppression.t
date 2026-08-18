#!/usr/bin/env bash
set -Eeuo pipefail
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh >/dev/null 2>err.txt
python3 - <<'PY' 2>>err.txt
import sys
sys.stdout.buffer.write(b"\x00\x01\x02BAD\n")
PY
./../../bin/shtap <<'RUN'
plan 1
expect 1 'grep -q "\[HBBIN suppressed " err.txt'
RUN
