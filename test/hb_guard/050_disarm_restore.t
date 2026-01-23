#!/usr/bin/env bash
set -Eeuo pipefail
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh 2>err.txt
type hb_disarm >/dev/null
hb_disarm
./../../bin/shtap <<'RUN'
plan 1
expect 1 'grep -q "^# HB guard: disarmed" err.txt'
RUN
