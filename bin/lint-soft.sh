#!/usr/bin/env bash

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STATUS=0

run_soft() {
  local label="$1"
  shift
  echo "▶ ${label}"
  if ! "$@"; then
    STATUS=1
    echo "⚠️  ${label} exited with a non-zero status (soft failure)." >&2
  fi
  echo
}

run_soft "eslint" npm run --if-present lint:js
run_soft "rustywind" npm run --if-present lint:classes
run_soft "dprint" npm run --if-present lint:format
run_soft "markdown-link-check" npm run --if-present lint:links

if (( STATUS != 0 )); then
  echo "Lint completed with issues (non-blocking)." >&2
fi

exit 0
