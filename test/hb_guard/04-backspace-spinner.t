#!/usr/bin/env bash
set -Eeuo pipefail

# Emit a backspace spinner for a short period
before=$(wc -c <"${HB_SIDECAR_STDOUT}")
for c in '|' '/' '-' '\\'; do
  printf "%s" "$c"
  printf "\b"
done
printf "done\n"
after=$(wc -c <"${HB_SIDECAR_STDOUT}")
delta=$((after-before))
[[ "$delta" -ge 6 ]] || { echo "spinner too small $delta"; exit 1; }
echo "ok 04-backspace-spinner"

