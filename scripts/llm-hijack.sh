#!/usr/bin/env bash
# Repo-scoped hijack to maintain test liveness.

# Skip if disabled or outside repo.
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -d "$root_dir/.git" ]] || return 0
[[ "${LLM_HIJACK_DISABLE:-}" == "1" ]] && return 0

# Low-frequency shell heartbeat.
hb_interval=$(( ${LLM_HEARTBEAT_SECS:-15} * 4 ))
llm_shell_hb() {
  while true; do
    printf '::notice:: LLM-safe: shell alive @ %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >&2
    sleep "$hb_interval"
  done
}
llm_shell_hb &
_llm_hb_pid=$!
trap 'kill "$_llm_hb_pid" 2>/dev/null' EXIT

# DEBUG trap to rewrite silent npm test pattern.
_llm_hijack() {
  local cmd="$BASH_COMMAND"
  if [[ "$cmd" == "npm test >"* && "$cmd" == *"&& tail"* ]]; then
    local file="${cmd#npm test > }"
    file="${file%% && tail*}"
    printf '::notice:: LLM-safe: rewrote npm test redirect -> tee %s\n' "$file" >&2
    eval "npm test | tee -i \"$file\""
    return 1
  fi
}
trap _llm_hijack DEBUG

