#!/usr/bin/env bash
set -euo pipefail
logfile="$1"
if grep -i "warning" "$logfile" | grep -v -f scripts/warn-allow.txt; then
  echo "Unexpected warnings found" >&2
  exit 1
fi
