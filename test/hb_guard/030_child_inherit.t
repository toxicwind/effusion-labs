#!/usr/bin/env bash
set -Eeuo pipefail
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh >/dev/null 2>err.txt
# child writes a giant line and CR progress
python3 - <<'PY' 2>>err.txt
import sys,time
sys.stdout.write("A"*8000+"\n"); sys.stdout.flush()
for i in range(3):
  sys.stdout.write("\rstep"+str(i)); sys.stdout.flush(); time.sleep(0.05)
sys.stdout.write("\n")
PY
./../../bin/shtap <<'RUN'
plan 2
expect 1 'grep -q "^\[HBWRAP " err.txt'
expect 2 'grep -q "step0" err.txt'
RUN
