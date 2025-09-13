#!/usr/bin/env bash
set -Eeuo pipefail
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh 2>err.txt
python3 - <<'PY' 2>>err.txt
import sys,time
for i in range(5):
  sys.stdout.write("\rspin"+str(i)); sys.stdout.flush(); time.sleep(0.02)
sys.stdout.write("\n")
PY
./../../bin/shtap <<'RUN'
plan 1
expect 1 'grep -q "spin4" err.txt'
RUN
