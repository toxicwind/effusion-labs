#!/usr/bin/env bash
set -Eeuo pipefail
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh 2>err.txt
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh 2>>err.txt
./../../bin/shtap <<'RUN'
plan 1
expect 1 'grep -c "^# HB guard: armed" err.txt | grep -q "^1$"'
RUN
