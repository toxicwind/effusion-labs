#!/usr/bin/env bash
set -Eeuo pipefail

# Verify armed and helpers exist; ensure hb_status writes to stderr
out=$( (hb_status) 2>&1 1>/dev/null || true )
[[ -n "$out" ]] || { echo "hb_status produced no stderr"; exit 1; }
[[ "${HB_GUARD_ARMED:-}" == "1" ]] || { echo "guard not armed"; exit 1; }
echo "ok 01-arm-quiet"

