#!/usr/bin/env bash
# Repo-scoped hijack to maintain test liveness.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -d "$repo_root/.git" ]] || return 0
[[ "${LLM_HIJACK_DISABLE:-}" == "1" ]] && return 0

source "$repo_root/scripts/llm-constants.sh"

hb_interval=$(( ${LLM_HEARTBEAT_SECS:-15} * 4 ))
(( hb_interval < 30 )) && hb_interval=30
if [[ "${CI:-}" == "true" || "${LLM_SHELL_HEARTBEAT:-}" == "1" ]]; then
  llm_shell_hb() {
    while true; do
      printf '::notice:: LLM-safe: shell alive @ %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >&2
      sleep "$hb_interval"
    done
  }
  llm_shell_hb &
  _llm_hb_pid=$!
  trap 'kill "$_llm_hb_pid" 2>/dev/null' EXIT
fi

_llm_hijack() {
  [[ "${_LLM_REWRITE_ACTIVE:-}" == "1" ]] && return 0
  local cmd="$BASH_COMMAND"
  read -r -a toks <<<"$cmd"
  [[ "${toks[0]}" == npm ]] || return 0
  local idx=0
  local extra=()
  local outfile=""
  if [[ "${toks[1]}" == test ]]; then
    idx=2
  elif [[ "${toks[1]}" == run && "${toks[2]}" == test ]]; then
    idx=3
  else
    return 0
  fi
  while (( idx < ${#toks[@]} )); do
    local token="${toks[idx]}"
    if [[ "$token" == "2>&1" ]]; then
      ((idx++))
      continue
    elif [[ "$token" == ">" || "$token" == "1>" ]]; then
      outfile="${toks[idx+1]}"
      idx=$((idx+2))
      break
    else
      extra+=("$token")
      ((idx++))
    fi
  done
  [[ -n "$outfile" ]] || return 0
  printf '::notice:: LLM-safe: rewrote "%s" -> tee\n' "$cmd" >&2
  export _LLM_REWRITE_ACTIVE=1
  export LLM_KEEPALIVE_INJECTED=1
  local qfile
  qfile=$(printf '%q' "$outfile")
  eval "npm test ${extra[*]} 2>&1 | tee -i $qfile"
  BASH_COMMAND=:
  unset _LLM_REWRITE_ACTIVE
  return 0
}
trap _llm_hijack DEBUG
