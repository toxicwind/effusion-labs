#!/usr/bin/env bash
set -Eeuo pipefail
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh 1>out.txt 2>err.txt
./../../bin/shtap <<'RUN'
plan 2
expect 1 '[ ! -s out.txt ]'
expect 2 'grep -q "^# HB guard: armed" err.txt'
RUN
