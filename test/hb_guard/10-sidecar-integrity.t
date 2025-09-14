#!/usr/bin/env bash
set -Eeuo pipefail

# Re-arm to restore guard for this test (09 disarmed)
source utils/scripts/setup/env-bootstrap.sh

before_out=$(wc -c <"${HB_SIDECAR_STDOUT}")
before_err=$(wc -c <"${HB_SIDECAR_STDERR}")

{ echo "STDOUT-LINE"; } 1>&1
{ echo "STDERR-LINE"; } 1>&2

after_out=$(wc -c <"${HB_SIDECAR_STDOUT}")
after_err=$(wc -c <"${HB_SIDECAR_STDERR}")

[[ $((after_out-before_out)) -ge 11 ]] || { echo "stdout sidecar small"; exit 1; }
[[ $((after_err-before_err)) -ge 11 ]] || { echo "stderr sidecar small"; exit 1; }
echo "ok 10-sidecar-integrity"

