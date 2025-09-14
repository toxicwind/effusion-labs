#!/usr/bin/env bash
set -Eeuo pipefail

# Emit ANSI clear-line and colors repeatedly; ensure sidecar grows
before=$(wc -c <"${HB_SIDECAR_STDOUT}")
for i in $(seq 1 50); do
  printf "\e[2K\r\e[32mgreen %d\e[0m" "$i"
done
printf "\n"
after=$(wc -c <"${HB_SIDECAR_STDOUT}")
delta=$((after-before))
[[ "$delta" -gt 50 ]] || { echo "ansi too small $delta"; exit 1; }
echo "ok 05-ansi-progress"

