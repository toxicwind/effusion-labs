#!/usr/bin/env bash
set -Eeuo pipefail

# Source again; expect banner to say already hijacked
msg=$( ( source utils/scripts/setup/env-bootstrap.sh ) 2>&1 1>/dev/null || true )
grep -q "Already hijacked" <<<"$msg" || { echo "no already hijacked banner"; exit 1; }

# Disarm and confirm inactive
hb_disarm
out=$( (hb_status) 2>&1 1>/dev/null || true )
grep -qi "inactive" <<<"$out" || { echo "not inactive"; exit 1; }
echo "ok 09-idempotence-teardown"

