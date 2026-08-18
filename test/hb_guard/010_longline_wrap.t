#!/usr/bin/env bash
set -Eeuo pipefail
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh >/dev/null 2>err.txt
python3 - <<'PY' 2>>err.txt
import sys
print("X"*12000)
PY
./../../bin/shtap <<'RUN'
plan 2
expect 1 'grep -q "^\[HBWRAP " err.txt'
expect 2 'grep -Eq "\[HBWRAP [0-9]+/[0-9]+ 1\.\." err.txt'
RUN
