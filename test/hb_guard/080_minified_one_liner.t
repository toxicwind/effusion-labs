#!/usr/bin/env bash
set -Eeuo pipefail
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh 2>err.txt
python3 - <<'PY' 2>>err.txt
import sys
sys.stdout.write("/*min*/"+"A"*20000+"\n")
PY
./../../bin/shtap <<'RUN'
plan 1
expect 1 'grep -q "^\[HBWRAP " err.txt'
RUN
