#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────────
#  HYPEBRUT Operating System — Effusion Labs
#  llm-bootstrap.sh  (finalized; self-installing; LLM-safe; bash -lc resilient)
# ────────────────────────────────────────────────────────────────────────────────
#  PURPOSE
#  • Make HYPEBRUT tools (llm_cat, hype_run, etc.) available in EVERY shell the
#    LLM spawns — even when it always uses `bash -lc '<cmd>'`.
#  • Achieves persistence by auto-installing a **login-shell hook** that is read
#    by bash -l, and a **BASH_ENV hook** for non-interactive subshells.
#  • Idempotent, quiet by default for non-interactive shells, and restores the
#    caller’s shell options on return.
#
#  HOW IT WORKS (in 1 line):
#    Source this once → it plants ~/.config/hypebrut/login-hook.sh and ensures
#    ~/.bash_profile / ~/.profile source it → every `bash -lc` now auto-loads
#    HYPEBRUT without you having to `source` again.
#
#  USAGE
#    source scripts/llm-bootstrap.sh
#    # After this, even brand-new `bash -lc` calls can use:  llm_cat, hype_run, …
#
#  SAFETY
#  • No alias trapdoors; no PATH pollution beyond $repo_root/bin; no recursion.
#  • Respects existing dotfiles; adds clearly-marked, removable blocks.
# ────────────────────────────────────────────────────────────────────────────────

# ╭───────────────── restore-on-exit guard ─────────────────╮
# Save caller’s shell options; restore when we return.
_LLM_BOOT_OLD_SET_OPTS="$(set +o)"
trap 'eval "$_LLM_BOOT_OLD_SET_OPTS"' RETURN

# Strict, but contained to this script’s body.
set -Euo pipefail

# ╭───────────────── ensure we are SOURCED, not executed ─────────────────╮
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  printf '❌ HYPEBRUT :: This script must be *sourced*, not executed.\n' >&2
  exit 1
fi

# ╭───────────────── arg parsing (internal hook flag) ─────────────────╮
# When invoked by our login/noninteractive hook, we pass --as-hook to skip reinstall.
_LLM_AS_HOOK=0
for _arg in "${@:-}"; do
  [[ "${_arg}" == "--as-hook" ]] && _LLM_AS_HOOK=1
done

# ╭───────────────── tiny helpers ─────────────────╮
_llm_has() { command -v "$1" >/dev/null 2>&1; }
_llm_on()  { [[ "$1" == "1" || "$1" == "true" ]]; }
_llm_ts()  { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
_llm_path_prepend_unique() {
  local dir="$1"; [[ -d "$dir" ]] || return 0
  case ":$PATH:" in *":$dir:"*) ;; *) PATH="$dir:$PATH" ;; esac
}

_llm_emit() {
  # Quiet by default in non-interactive shells unless LLM_VERBOSE=1 is set.
  [[ "${LLM_VERBOSE:-0}" != "1" ]] && return 0
  local tag="${1:-INFO}"; shift || true
  local color="\033[0;34m" icon="ℹ️"
  case "$tag" in
    START) color="\033[1;33m"; icon="⚡" ;;
    DONE)  color="\033[1;32m"; icon="✅" ;;
    FAIL)  color="\033[1;31m"; icon="❌" ;;
    IDLE)  color="\033[0;36m"; icon="⌛" ;;
    SNAP)  color="\033[0;35m"; icon="📸" ;;
    BG)    color="\033[0;90m"; icon="⚙️" ;;
    INFO)  color="\033[0;34m"; icon="ℹ️" ;;
  esac
  printf "${color}%s HYPEBRUT %s\033[0m\n" "$icon" "$*" >&2
}

# ╭───────────────── repo + paths ─────────────────╮
# Script path + repo root (no reliance on PWD)
_LLM_THIS_SCRIPT="$(readlink -f "${BASH_SOURCE[0]}")"
_LLM_REPO_ROOT="$(cd "$(dirname "$_LLM_THIS_SCRIPT")/.." && pwd -P)"
_LLM_CFG_DIR="${HOME}/.config/hypebrut"
_LLM_LOGIN_HOOK="${_LLM_CFG_DIR}/login-hook.sh"
_LLM_NONINT_HOOK="${_LLM_CFG_DIR}/noninteractive-hook.sh"
_LLM_PID_DIR="/tmp/hype_pids"
_LLM_LOG_DIR="/tmp/hype_logs"

# ╭───────────────── idempotence gate ─────────────────╮
if [[ "${HYPEBRUT_ENV_READY:-}" == "1" && "${HYPEBRUT_ENV_ROOT:-}" == "${_LLM_REPO_ROOT}" && "${LLM_BOOTSTRAP_FORCE:-0}" != "1" ]]; then
  _llm_emit INFO "Environment already active. Sourcing skipped. **Proceed with task.** (root: ${_LLM_REPO_ROOT})"
  return 0
fi

# ╭───────────────── defaults & tuning ─────────────────╮
export LLM_VERBOSE="${LLM_VERBOSE:-1}"
export LLM_FOLD_WIDTH="${LLM_FOLD_WIDTH:-3996}"
export LLM_IDLE_SECS="${LLM_IDLE_SECS:-10}"
export LLM_IDLE_FAIL_AFTER_SECS="${LLM_IDLE_FAIL_AFTER_SECS:-300}"
export LLM_MAX_RUN_SECS="${LLM_MAX_RUN_SECS:-600}"
export LLM_TEST_PRESETS="${LLM_TEST_PRESETS:-1}"
export LLM_SUPPRESS_PATTERNS="${LLM_SUPPRESS_PATTERNS:-^npm ERR! cb}"
export LLM_DEPS_AUTOINSTALL="${LLM_DEPS_AUTOINSTALL:-1}"
export LLM_GIT_HOOKS="${LLM_GIT_HOOKS:-1}"
export TZ="${TZ:-UTC}"

# ╭───────────────── banner ─────────────────╮
_llm_emit INFO "Effusion Labs HYPEBRUT OS activated."
_llm_emit INFO "Repo Root: ${_LLM_REPO_ROOT}"

# ╭───────────────── PATH + dirs ─────────────────╮
mkdir -p "$_LLM_CFG_DIR" "$_LLM_PID_DIR" "$_LLM_LOG_DIR"
_llm_path_prepend_unique "${_LLM_REPO_ROOT}/bin"
_llm_emit INFO "Ensured '${_LLM_REPO_ROOT}/bin' is on PATH."

# ╭───────────────── stream formatting helpers ─────────────────╮
_llm_fold() {
  if _llm_has fold; then fold -w "${LLM_FOLD_WIDTH}" -s; else cat; fi
}
_llm_stream_filter() {
  if [[ -z "${LLM_SUPPRESS_PATTERNS}" ]]; then cat
  else awk -v pat="$LLM_SUPPRESS_PATTERNS" '{ if ($0 ~ pat) next; print }'
  fi
}

# ╭───────────────── core utilities (exported) ─────────────────╮
hype_run() {
  local capture_file="" idle="${LLM_IDLE_SECS}" tail_on_complete=0 hard_timeout="${LLM_MAX_RUN_SECS}" id="hype-$$"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --capture) capture_file="$2"; shift 2;;
      --idle)    idle="$2"; shift 2;;
      --tail)    tail_on_complete="$2"; shift 2;;
      --timeout) hard_timeout="$2"; shift 2;;
      --) shift; break;;
      *) break;;
    esac
  done
  [[ $# -ge 1 ]] || { _llm_emit FAIL "hype_run requires a command"; return 2; }

  # Safer FIFO path: dedicate a temp dir so `-u` races aren’t a problem.
  local tmpdir; tmpdir="$(mktemp -d "/tmp/hype_run.${id}.XXXXXX")" || { _llm_emit FAIL "mktemp failed"; return 2; }
  local pipe="${tmpdir}/pipe"
  mkfifo "$pipe" || { _llm_emit FAIL "Could not create pipe"; rm -rf "$tmpdir"; return 2; }

  local tmp_capture=""; if [[ -z "$capture_file" ]]; then tmp_capture="$(mktemp "/tmp/hype_run.${id}.cap.XXXXXX")" || true; capture_file="$tmp_capture"; fi
  local child_pid= reader_pid= watchdog_pid= timer_pid= status=0

  _llm_emit START "Running: $(printf '%q ' "$@")"
  [[ -n "$capture_file" ]] && _llm_emit INFO "Capturing → $capture_file"

  (
    set -o pipefail
    if _llm_has stdbuf; then stdbuf -oL -eL "$@" >"$pipe" 2>&1
    else "$@" >"$pipe" 2>&1
    fi
  ) & child_pid=$!

  (
    if [[ -n "$capture_file" ]]; then
      : > "$capture_file" 2>/dev/null || { _llm_emit FAIL "Capture unwritable: $capture_file"; exit 1; }
      _llm_stream_filter < "$pipe" | _llm_fold | tee -a -- "$capture_file"
    else
      _llm_stream_filter < "$pipe" | _llm_fold
    fi
  ) & reader_pid=$!

  if (( LLM_IDLE_FAIL_AFTER_SECS > 0 )); then
    (
      local last_size=-1 current_size=0 idle_total=0
      while kill -0 "$child_pid" 2>/dev/null; do
        sleep "$idle"
        if [[ -n "$capture_file" && -f "$capture_file" ]]; then
          current_size=$(wc -c <"$capture_file" 2>/dev/null || echo 0)
          if (( current_size == last_size )); then
            idle_total=$((idle_total + idle)); _llm_emit IDLE "Quiet for ${idle_total}s…"
            if (( idle_total >= LLM_IDLE_FAIL_AFTER_SECS )); then
              _llm_emit FAIL "Idle timeout ${LLM_IDLE_FAIL_AFTER_SECS}s → SIGTERM/SIGKILL"
              kill -TERM "$child_pid" 2>/dev/null || true; sleep 3
              kill -0 "$child_pid" 2>/dev/null && kill -KILL "$child_pid" 2>/dev/null || true
              break
            fi
          else last_size=$current_size; idle_total=0; fi
        fi
      done
    ) & watchdog_pid=$!
  fi

  if [[ -n "${hard_timeout}" && "${hard_timeout}" != "0" ]]; then
    (
      sleep "${hard_timeout}" || true
      if kill -0 "$child_pid" 2>/dev/null; then
        _llm_emit FAIL "Hard timeout ${hard_timeout}s → terminate"
        kill -TERM "$child_pid" 2>/dev/null || true; sleep 3
        kill -0 "$child_pid" 2>/dev/null && kill -KILL "$child_pid" 2>/dev/null || true
      fi
    ) & timer_pid=$!
  fi

  trap '_llm_emit FAIL "Interrupted"; kill -TERM '"$child_pid"' 2>/dev/null || true' INT TERM HUP
  wait "$child_pid" 2>/dev/null || status=$?
  sleep 0.1

  [[ -n "${reader_pid:-}"   ]] && kill "$reader_pid" 2>/dev/null || true
  [[ -n "${watchdog_pid:-}" ]] && kill "$watchdog_pid" 2>/dev/null || true
  [[ -n "${timer_pid:-}"    ]] && kill "$timer_pid" 2>/dev/null || true
  rm -f "$pipe" 2>/dev/null || true
  rm -rf "$tmpdir" 2>/dev/null || true

  if (( status == 0 )); then _llm_emit DONE "Command finished successfully."
  else _llm_emit FAIL "Command failed (status: $status)"; fi

  if [[ -n "$capture_file" && -f "$capture_file" && "$tail_on_complete" -gt 0 ]]; then
    _llm_emit INFO "Final tail:"; command tail -n "$tail_on_complete" -- "$capture_file" | _llm_fold
  fi

  trap - INT TERM HUP
  [[ -n "$tmp_capture" && -f "$tmp_capture" ]] && rm -f "$tmp_capture" || true
  return "$status"
}; export -f hype_run

llm_cat() {
  local target="${1:-}"
  if [[ -z "$target" ]]; then command cat | _llm_fold; return; fi
  if [[ ! -f "$target" ]]; then _llm_emit FAIL "File not found: $target"; return 1; fi
  local ext="${target##*.}" parser=""
  case "$ext" in
    js|mjs|cjs) parser="babel" ;;
    ts|tsx)     parser="babel-ts" ;;
    json|jsonl) parser="json" ;;
    md|markdown)parser="markdown" ;;
    html|htm)   parser="html" ;;
    css|pcss)   parser="css" ;;
    yml|yaml)   parser="yaml" ;;
  esac
  if [[ -n "$parser" ]] && _llm_has npx; then
    _llm_emit INFO "Pretty-printing $target (parser: $parser)"
    npx --no-install prettier --parser "$parser" --print-width "${LLM_FOLD_WIDTH}" --no-config -- "$target" 2>/dev/null | _llm_fold
  else
    _llm_emit INFO "Displaying raw content of $target"
    command cat -- "$target" | _llm_fold
  fi
}; export -f llm_cat

llm_snapshot() {
  local msg="${1:-chore: WIP checkpoint}"
  _llm_emit SNAP "Snapshot: '$msg'"
  if ! _llm_has git || ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    _llm_emit FAIL "Not in a git repository."
    return 1
  fi
  git add -A
  if git commit --allow-empty -m "$msg"; then _llm_emit DONE "Snapshot committed."
  else _llm_emit INFO "No changes to commit."; fi
}; export -f llm_snapshot

hype_bg() {
  local check_port=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --port) check_port="$2"; shift 2;;
      --) shift; break;;
      *) break;;
    esac
  done
  [[ $# -ge 2 ]] || { _llm_emit FAIL "hype_bg requires a name and a command"; return 2; }
  local name=$1; shift

  if [[ "$name" == "devserver" && -z "$check_port" ]]; then
    _llm_emit FAIL "POLICY: 'devserver' requires --port <n>"; return 1
  fi

  if [[ -n "$check_port" ]] && _llm_has lsof; then
    local pid; pid="$(lsof -t -i :"$check_port" 2>/dev/null || true)"
    if [[ -n "$pid" ]]; then
      if [[ -d "$_LLM_PID_DIR" ]] && grep -qsx "$pid" "$_LLM_PID_DIR"/*.pid 2>/dev/null; then
        _llm_emit INFO "Managed process already on port $check_port (PID: $pid)"; return 0
      else
        _llm_emit FAIL "Port $check_port blocked by unmanaged PID $pid"; return 1
      fi
    fi
  fi

  local pid_file="${_LLM_PID_DIR}/${name}.pid" log_file="${_LLM_LOG_DIR}/${name}.log"
  if [[ -f "$pid_file" ]]; then _llm_emit FAIL "Process '$name' already managed (stale pidfile?)"; return 1; fi

  _llm_emit BG "Start '$name': $(printf '%q ' "$@")"
  _llm_emit BG "Log → $log_file"
  ( "$@" >"$log_file" 2>&1 ) & echo $! > "$pid_file"
  sleep 0.5
  if ! kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    _llm_emit FAIL "'$name' failed to start; see $log_file"; rm -f "$pid_file"; return 1
  fi
  _llm_emit BG "'$name' running (PID $(cat "$pid_file"))."
}; export -f hype_bg

hype_kill() {
  [[ $# -ge 1 ]] || { _llm_emit FAIL "hype_kill requires a process name"; return 2; }
  local name=$1 pid_file="${_LLM_PID_DIR}/${name}.pid"
  if [[ ! -f "$pid_file" ]]; then _llm_emit FAIL "'$name' is not running"; return 1; fi
  local pid; pid="$(cat "$pid_file")"
  _llm_emit BG "Stopping '$name' (PID: $pid)…"
  if kill -TERM "$pid" 2>/dev/null; then _llm_emit BG "'$name' terminated."
  else _llm_emit BG "'$name' not found or already stopped."; fi
  rm -f "$pid_file"
}; export -f hype_kill

hype_status() {
  _llm_emit BG "Managed processes:"
  if [[ ! -d "$_LLM_PID_DIR" ]] || [[ -z "$(ls -A "$_LLM_PID_DIR" 2>/dev/null || true)" ]]; then
    _llm_emit BG "None."; return 0
  fi
  local pid_file name pid
  for pid_file in "${_LLM_PID_DIR}"/*.pid; do
    [[ -f "$pid_file" ]] || continue
    name="$(basename "$pid_file" .pid)"; pid="$(cat "$pid_file")"
    if kill -0 "$pid" 2>/dev/null; then _llm_emit BG "- $name: RUNNING (PID $pid)"
    else _llm_emit BG "- $name: STALE (cleaning)"; rm -f "$pid_file"; fi
  done
}; export -f hype_status

# ╭───────────────── auto-install shell hijack (once) ─────────────────╮
_llm_install_hooks() {
  mkdir -p "$_LLM_CFG_DIR"

  # 1) Non-interactive hook (BASH_ENV target) — used by `bash -c` shells.
  cat > "$_LLM_NONINT_HOOK" <<EOF
# >>> HYPEBRUT noninteractive hook (auto-generated) >>>
# shellcheck source=/dev/null
HYPEBRUT_ENV_ROOT="${_LLM_REPO_ROOT}"
if [[ "\${HYPEBRUT_ENV_READY:-}" != "1" || "\${HYPEBRUT_ENV_ROOT:-}" != "\${HYPEBRUT_ENV_ROOT}" ]]; then
  source "${_LLM_THIS_SCRIPT}" --as-hook
fi
# <<< HYPEBRUT noninteractive hook <<<
EOF
  chmod 0644 "$_LLM_NONINT_HOOK"

  # 2) Login hook — sourced by login shells (`bash -l`).
  cat > "$_LLM_LOGIN_HOOK" <<EOF
# >>> HYPEBRUT login hook (auto-generated) >>>
# Ensure noninteractive shells also load this environment
export BASH_ENV="${_LLM_NONINT_HOOK}"
# shellcheck source=/dev/null
HYPEBRUT_ENV_ROOT="${_LLM_REPO_ROOT}"
if [[ "\${HYPEBRUT_ENV_READY:-}" != "1" || "\${HYPEBRUT_ENV_ROOT:-}" != "\${HYPEBRUT_ENV_ROOT}" ]]; then
  # Pass --as-hook to suppress re-install during hook stage
  source "${_LLM_THIS_SCRIPT}" --as-hook
fi
# <<< HYPEBRUT login hook <<<
EOF
  chmod 0644 "$_LLM_LOGIN_HOOK"

  # 3) Ensure login shells source our hook (idempotent block inserts).
  _llm_patch_file() {
    local file="$1" marker="# >>> HYPEBRUT login sourcing >>>"
    if [[ -f "$file" ]] && grep -Fq "$marker" "$file"; then
      return 0
    fi
    mkdir -p "$(dirname "$file")"
    {
      echo ""; echo "$marker"
      echo "[ -f \"${_LLM_LOGIN_HOOK}\" ] && source \"${_LLM_LOGIN_HOOK}\""
      echo "# <<< HYPEBRUT login sourcing <<<"
    } >> "$file"
  }

  # Bash prefers ~/.bash_profile for login shells; fallback ~/.profile if absent.
  if [[ -f "${HOME}/.bash_profile" || ! -f "${HOME}/.profile" ]]; then
    _llm_patch_file "${HOME}/.bash_profile"
  fi
  _llm_patch_file "${HOME}/.profile"

  _llm_emit DONE "Shell hijack installed → login + noninteractive hooks ready."
}

# Install once unless invoked as a hook (hooks should stay lightweight).
if (( _LLM_AS_HOOK == 0 )); then _llm_install_hooks; fi

# ╭───────────────── optional: npm ci auto-install (hashed) ─────────────────╮
if _llm_on "${LLM_DEPS_AUTOINSTALL}"; then
  mkdir -p "${_LLM_REPO_ROOT}/tmp"; hash_file="${_LLM_REPO_ROOT}/tmp/.deps_hash"
  lock_file="${_LLM_REPO_ROOT}/package-lock.json"
  if [[ -f "$lock_file" ]]; then
    current_hash="$(sha256sum "$lock_file" | awk '{print $1}')"
    stored_hash="$(cat "$hash_file" 2>/dev/null || echo "")"
    if [[ "$current_hash" != "$stored_hash" ]]; then
      mkdir -p "${_LLM_REPO_ROOT}/logs"
      ci_log="${_LLM_REPO_ROOT}/logs/npm-ci.$(_llm_ts).log"
      _llm_emit INFO "Dependencies changed → npm ci (capturing to ${ci_log})"
      if (cd "${_LLM_REPO_ROOT}" && hype_run --timeout "${LLM_MAX_RUN_SECS}" --capture "$ci_log" --tail 80 -- npm ci); then
        echo "$current_hash" > "$hash_file"
      else
        _llm_emit FAIL "'npm ci' failed; not updating deps hash."
      fi
    fi
  fi
fi

# ╭───────────────── optional: lightweight git hooks ─────────────────╮
if _llm_on "${LLM_GIT_HOOKS}"; then
  hooks_dir="${_LLM_REPO_ROOT}/.git/hooks"
  if [[ -d "$hooks_dir" ]]; then
    for hook in post-checkout post-merge; do
      hook_path="$hooks_dir/$hook"
      printf '%s\n' '#!/usr/bin/env bash' \
        "source \"${_LLM_THIS_SCRIPT}\" --as-hook >/dev/null 2>&1 || true" > "$hook_path"
      chmod +x "$hook_path"
    done
  fi
fi

# ╭───────────────── export environment flags ─────────────────╮
export HYPEBRUT_ENV_READY=1
export HYPEBRUT_ENV_ROOT="${_LLM_REPO_ROOT}"

_llm_emit DONE "Environment activated. Tools are available for this shell session. **Do not source again.**"
# ────────────────────────────────────────────────────────────────────────────────
# End of file
# ────────────────────────────────────────────────────────────────────────────────
