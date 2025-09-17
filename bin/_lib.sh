#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="$REPO_ROOT/.tools"

can_sudo() {
  command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1
}

path_without_repo_bin() {
  local new_path=""
  local part
  local -a path_parts=()
  IFS=':' read -ra path_parts <<<"${PATH:-}"
  for part in "${path_parts[@]}"; do
    [[ -z "$part" ]] && part='.'
    if [[ "$part" == "$REPO_ROOT/bin" ]]; then
      continue
    fi
    if [[ -z "$new_path" ]]; then
      new_path="$part"
    else
      new_path+=":$part"
    fi
  done
  printf '%s' "$new_path"
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
  local -a all_args=("$@")
  local sentinel_index=-1
  for (( idx=${#all_args[@]}-1; idx>=0; idx-- )); do
    if [[ "${all_args[idx]}" == "--" ]]; then
      sentinel_index=$idx
      break
    fi
  done

  if (( sentinel_index < 0 )); then
    echo "retry_exec: missing '--' separator" >&2
    return 1
  fi

  local -a args=()
  if (( sentinel_index > 0 )); then
    args=("${all_args[@]:0:sentinel_index}")
  fi

  local -a candidates=()
  if (( sentinel_index + 1 < ${#all_args[@]} )); then
    candidates=("${all_args[@]:sentinel_index+1}")
  fi

  if (( ${#candidates[@]} == 0 )); then
    echo "retry_exec: no fallback executables provided" >&2
    return 1
  fi

  local c resolved
  for c in "${candidates[@]}"; do
    [[ -z "$c" ]] && continue
    if [[ -x "$c" ]]; then
      exec "$c" "${args[@]}"
    fi
    resolved="$(command -v "$c" 2>/dev/null || true)"
    if [[ -n "$resolved" ]]; then
      exec "$resolved" "${args[@]}"
    fi
  done

  return 1
}
