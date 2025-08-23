#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="$REPO_ROOT/.tools"

can_sudo() {
  command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1
}

apt_install() {
  local pkg="${1:-}"
  [[ -z "$pkg" ]] && return 1
  if can_sudo; then
    sudo apt-get update -y && sudo apt-get install -y "$pkg"
  else
    return 1
  fi
}

retry_exec() {
  local args=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --) shift; break;;
      *) args+=("$1"); shift;;
    esac
  done
  local candidates=("$@")
  for c in "${candidates[@]}"; do
    if [[ -x "$c" ]]; then exec "$c" "${args[@]}"; fi
    if command -v "$c" >/dev/null 2>&1; then exec "$c" "${args[@]}"; fi
  done
  return 1
}
