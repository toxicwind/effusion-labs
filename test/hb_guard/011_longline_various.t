#!/usr/bin/env bash
set -Eeuo pipefail
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh >/dev/null 2>err.txt
lengths=(3499 3500 3501 10000 100000 1048576)
for L in "${lengths[@]}"; do
  python3 - <<PY >"out_$L.txt"
import sys
print('A'*$L)
PY
done
../../bin/shtap <<'RUN'
plan 7
expect 1 '[ $(grep -c "\\[HBWRAP" out_3499.txt) -eq 0 ]'
expect 2 '[ $(grep -c "\\[HBWRAP" out_3500.txt) -eq 0 ]'
expect 3 'grep -q "^\[HBWRAP 1/2 1..3500\]" out_3501.txt'
expect 4 'grep -q "^\[HBWRAP 1/3 1..3500\]" out_10000.txt'
expect 5 'grep -q "^\[HBWRAP 1/29 1..3500\]" out_100000.txt'
expect 6 'grep -q "^\[HBWRAP 1/300 1..3500\]" out_1048576.txt'
expect 7 'grep -q "^\[HBWRAP 300/300 1048501..1048576\]" out_1048576.txt'
RUN
