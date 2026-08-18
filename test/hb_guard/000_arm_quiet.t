#!/usr/bin/env bash
set -Eeuo pipefail
. "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh 2>err.txt 1>out.txt || true
echo "#source again"
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh 2>>err.txt 1>>out.txt || true
./../../bin/shtap <<'RUN'
plan 3
expect 1 '[ ! -s out.txt ]'
expect 2 'grep -q "^# HB guard: armed" err.txt'
expect 3 '! grep -q "^[^#]" err.txt'
RUN
