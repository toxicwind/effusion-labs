#!/usr/bin/env bash
set -Eeuo pipefail

# Run a chatty child and ensure sidecar grows
before=$(wc -c <"${HB_SIDECAR_STDOUT}")
hb_run bash -lc 'for i in $(seq 1 200); do echo "child-$i"; done'
after=$(wc -c <"${HB_SIDECAR_STDOUT}")
delta=$((after-before))
[[ "$delta" -ge 1200 ]] || { echo "child inherit delta $delta"; exit 1; }
echo "ok 08-child-inherit"

