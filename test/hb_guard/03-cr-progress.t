#!/usr/bin/env bash
set -Eeuo pipefail

before=$(wc -c <"${HB_SIDECAR_STDOUT}")
for i in $(seq 1 100); do
  printf "\rstep %03d" "$i"
  sleep 0.001
done
printf "\n"
after=$(wc -c <"${HB_SIDECAR_STDOUT}")
delta=$((after-before))
[[ "$delta" -gt 100 ]] || { echo "progress too small $delta"; exit 1; }
echo "ok 03-cr-progress"

