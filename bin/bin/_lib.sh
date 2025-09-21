#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="$REPO_ROOT/.tools"

# Remove REPO_ROOT/bin from PATH when resolving fallback candidates
path_without_repo_bin() {
  local newp='' part
  IFS=':' read -r -a parts <<< "${PATH:-}"
  for part in "${parts[@]}"; do
    [[ "$part" == "$REPO_ROOT/bin" ]] && continue
    newp+="${newp:+:}$part"
  done
  printf '%s' "$newp"
}

# Execute first available candidate; avoids recursion by dropping repo bin from PATH.
retry_exec() {
  local -a user_args=() candidates=()
  local sep=0
  for a in "$@"; do
    if [[ $sep -eq 0 && "$a" == "--" ]]; then sep=1; continue; fi
    if [[ $sep -eq 0 ]]; then user_args+=("$a"); else candidates+=("$a"); fi
  done
  local PATH_NO_BIN; PATH_NO_BIN="$(path_without_repo_bin)"
  for c in "${candidates[@]}"; do
    if [[ "$c" == /* || "$c" == .* || "$c" == ~* ]]; then
      [[ -x "$c" ]] && exec -a "${c##*/}" "$c" "${user_args[@]}"
    else
      if command -v "$c" >/dev/null 2>&1; then
        local p; p="$(PATH="$PATH_NO_BIN" command -v "$c" || true)"
        [[ -n "$p" ]] && exec -a "${c##*/}" "$p" "${user_args[@]}"
      fi
    fi
  done
  return 1
}
