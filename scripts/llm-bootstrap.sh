#!/usr/bin/env bash
# HYPEBRUT Operating System --- Effusion Labs
# Strict, robust defaults. Let's create.

# IMPORTANT: This file is intended to be sourced.
# Do not leak strict mode into the caller. Save current shell options
# and restore them automatically when sourcing returns.
_LLM_BOOT_OLD_SET_OPTS="$(set +o)"
trap 'eval "$_LLM_BOOT_OLD_SET_OPTS"' RETURN

set -Euo pipefail

# --- EARLY-IDEMPOTENCE GUARD -------------------------------------------------
# If this bootstrap has already successfully run in the current shell for this
# repo, skip the rest to avoid duplicate work and noisy logs. You can force a
# re-run with `LLM_BOOTSTRAP_FORCE=1`.

_llm_repo_root_guess="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd 2>/dev/null || pwd)"
if [[ "${HYPEBRUT_ENV_READY:-}" == "1" \
   && "${HYPEBRUT_ENV_ROOT:-}" == "${_llm_repo_root_guess}" \
   && "${LLM_BOOTSTRAP_FORCE:-0}" != "1" ]]; then
  if [[ "${LLM_VERBOSE:-1}" == "1" ]]; then
    # LLM Informative Message: This is a directive, not just a status.
    printf '✅ HYPEBRUT :: Environment already active. Sourcing skipped. **Proceed with task.**\n' >&2
  fi
  return 0
fi

# --- CONFIGURATION & TUNING KNOBS ---
: "${LLM_VERBOSE:=1}"
: "${LLM_FOLD_WIDTH:=3996}"
: "${LLM_IDLE_SECS:=10}"
: "${LLM_IDLE_FAIL_AFTER_SECS:=360}"
: "${LLM_TEST_PRESETS:=1}"
: "${LLM_SUPPRESS_PATTERNS:='^npm ERR! cb'}"
: "${_LLM_PID_DIR:="/tmp/hype_pids"}"
: "${_LLM_LOG_DIR:="/tmp/hype_logs"}"

# --- BEHAVIOR FLAGS ---
: "${LLM_DEPS_AUTOINSTALL:=1}"
: "${LLM_GIT_HOOKS:=1}"

# --- AESTHETIC & PATH HELPERS ---
_llm_ts(){ date -u +"%Y-%m-%dT%H:%M:%SZ"; }
_llm_has(){ command -v "$1" >/dev/null 2>&1; }
_llm_on() { [[ "$1" == "1" || "$1" == "true" ]]; }
_llm_path_prepend_unique() {
    local dir="$1"; [[ -d "$dir" ]] || return 0
    case ":$PATH:" in *":$dir:") ;; *) PATH="$dir:$PATH" ;; esac
}

_llm_emit() {
    [[ "${LLM_VERBOSE}" != "1" ]] && return 0
    local theme_icon="::"; local theme_color_start="\033[1;35m"; local theme_color_end="\033[0m"
    case "${1:-}" in
        "START") theme_icon="⚡"; theme_color_start="\033[1;33m";; "DONE") theme_icon="✅"; theme_color_start="\033[1;32m";;
        "FAIL")  theme_icon="❌"; theme_color_start="\033[1;31m";; "IDLE") theme_icon="⌛"; theme_color_start="\033[0;36m";;
        "INFO")  theme_icon="ℹ️ "; theme_color_start="\033[0;34m";; "SNAP") theme_icon="📸"; theme_color_start="\033[0;35m";;
        "BG")    theme_icon="⚙️ "; theme_color_start="\033[0;90m";;
    esac
    printf "${theme_color_start}%s HYPEBRUT %s${theme_color_end}" "$theme_icon" "$*" >&2; printf '\n' >&2
}

_llm_fold() { if _llm_has fold; then fold -w "${LLM_FOLD_WIDTH}" -s; else cat; fi; }
_llm_stream_filter() { if [[ -z "${LLM_SUPPRESS_PATTERNS}" ]]; then cat; else awk -v pat="$LLM_SUPPRESS_PATTERNS" '{ if ($0 ~ pat) next; print }'; fi; }

# --- CORE UTILITIES ---
hype_run() {
    local capture_file="" idle="${LLM_IDLE_SECS}" tail_on_complete=0; local id="hype-$$"
    while [[ $# -gt 0 ]]; do case "$1" in --capture) capture_file="$2"; shift 2;; --idle) idle="$2"; shift 2;; --tail) tail_on_complete="$2"; shift 2;; --) shift; break;; *) break;; esac; done
    [[ $# -ge 1 ]] || { _llm_emit "FAIL :: hype_run requires a command to execute."; return 2; }
    local pipe="/tmp/hype_run.${id}.pipe"; mkfifo "$pipe" || { _llm_emit "FAIL :: Could not create execution pipe."; return 2; }
    _llm_emit "START :: Running command: $(printf '%q ' "$@")"; [[ -n "$capture_file" ]] && _llm_emit "INFO :: Capturing full output to $capture_file"
    ( set -o pipefail; if [[ "${LLM_TEST_PRESETS}" == "1" && "$*" =~ (npm|pnpm|yarn|npx).*(test|@11ty/eleventy) ]]; then export CI=1 ELEVENTY_ENV=test WATCH=0; fi; if _llm_has stbuf; then stdbuf -oL -eL "$@" >"$pipe" 2>&1; else "$@" >"$pipe" 2>&1; fi ) &
    local child_pid=$!; local reader_pid; ( if [[ -n "$capture_file" ]]; then : > "$capture_file" 2>/dev/null || { _llm_emit "FAIL :: Capture file '$capture_file' is not writable."; exit 1; }; _llm_stream_filter < "$pipe" | _llm_fold | tee -a -- "$capture_file"; else _llm_stream_filter < "$pipe" | _llm_fold; fi ) &
    reader_pid=$!; local watchdog_pid; ( local last_size=-1 current_size=0 idle_total=0; while kill -0 "$child_pid" 2>/dev/null; do sleep "$idle"; if [[ -n "$capture_file" && -f "$capture_file" ]]; then current_size=$(wc -c <"$capture_file" 2>/dev/null || echo 0); if (( current_size == last_size )); then idle_total=$((idle_total + idle)); _llm_emit "IDLE :: Process has been quiet for $idle_total seconds..."; if (( LLM_IDLE_FAIL_AFTER_SECS > 0 && idle_total >= LLM_IDLE_FAIL_AFTER_SECS )); then _llm_emit "FAIL :: Process timed out. Terminating."; kill -TERM "$child_pid" 2>/dev/null; break; fi; else last_size=$current_size; idle_total=0; fi; fi; done ) &
    watchdog_pid=$!; trap ' _llm_emit "FAIL :: Interrupted."; kill -TERM '"$child_pid"' '"$reader_pid"' '"$watchdog_pid"' 2>/dev/null; rm -f "'"$pipe"'"; exit 130 ' INT
    local status=0; wait "$child_pid"; status=$?; sleep 0.1; kill "$reader_pid" "$watchdog_pid" 2>/dev/null || true; rm -f "$pipe"
    if (( status == 0 )); then _llm_emit "DONE :: Command finished successfully."; else _llm_emit "FAIL :: Command failed (status: $status)."; fi
    if [[ -n "$capture_file" && -f "$capture_file" && "$tail_on_complete" -gt 0 ]]; then _llm_emit "INFO :: Final output tail:"; command tail -n "$tail_on_complete" -- "$capture_file" | _llm_fold; fi; return "$status"
}; export -f hype_run
llm_cat() {
    local target="${1:-}"; if [[ -z "$target" ]]; then command cat | _llm_fold; return; fi; if [[ ! -f "$target" ]]; then _llm_emit "FAIL :: File not found: $target"; return 1; fi; local ext="${target##*.}" parser=""; case "$ext" in js|mjs|cjs) parser="babel" ;; ts|tsx) parser="babel-ts" ;; json|jsonl) parser="json" ;; md|markdown)parser="markdown" ;; html|htm) parser="html" ;; css|pcss) parser="css" ;; yml|yaml) parser="yaml" ;; esac
    if [[ -n "$parser" ]] && _llm_has npx; then _llm_emit "INFO :: Pretty-printing $target (type: $parser)"; npx --no-install prettier --parser "$parser" --print-width "${LLM_FOLD_WIDTH}" --no-config -- "$target" 2>/dev/null | _llm_fold; else _llm_emit "INFO :: Displaying raw content of $target"; command cat -- "$target" | _llm_fold; fi
}; export -f llm_cat
llm_snapshot() {
    local msg="${1:-chore: WIP checkpoint}"; _llm_emit "SNAP :: Creating snapshot with message: '$msg'"; if ! _llm_has git || ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then _llm_emit "FAIL :: Not in a git repository."; return 1; fi
    git add -A; if git commit --allow-empty -m "$msg"; then _llm_emit "DONE :: Snapshot created successfully."; else _llm_emit "INFO :: No changes to commit for snapshot."; fi
}; export -f llm_snapshot

# --- BACKGROUND PROCESS MANAGEMENT ---
hype_bg() {
    local check_port=""; while [[ $# -gt 0 ]]; do case "$1" in --port) check_port="$2"; shift 2;; --) shift; break;; *) break;; esac; done
    [[ $# -ge 2 ]] || { _llm_emit "FAIL :: hype_bg requires a name and a command."; return 2; }
    local name=$1; shift
    
    # Technical Guardrail: Dev servers MUST use the --port flag.
    if [[ "$name" == "devserver" && -z "$check_port" ]]; then
        _llm_emit "FAIL :: POLICY ENFORCED: Starting 'devserver' requires the --port flag."
        _llm_emit "INFO :: REQUIRED USAGE: hype_bg --port <port> devserver <command...>"
        return 1
    fi

    if [[ -n "$check_port" ]]; then
        if _llm_has lsof; then
            local existing_pid; existing_pid=$(lsof -t -i :"$check_port" 2>/dev/null || true)
            if [[ -n "$existing_pid" ]]; then
                if grep -q -r "^${existing_pid}$" "$_LLM_PID_DIR"; then
                    _llm_emit "INFO :: Managed process is already running on port $check_port (PID: $existing_pid). Success."
                    return 0
                else
                    _llm_emit "FAIL :: Port $check_port is blocked by an unmanaged process (PID: $existing_pid). Cannot start '$name'."
                    return 1
                fi
            fi
        fi
    fi

    local pid_file="${_LLM_PID_DIR}/${name}.pid"
    if [[ -f "$pid_file" ]]; then _llm_emit "FAIL :: Process '$name' is already managed (stale pidfile?)."; return 1; fi
    _llm_emit "BG :: Starting background process '$name': $(printf '%q ' "$@")"
    local log_file="${_LLM_LOG_DIR}/${name}.log"
    _llm_emit "BG :: Logging output to $log_file"
    ( "$@" >"$log_file" 2>&1 ) &
    echo $! > "$pid_file"
    sleep 0.5
    if ! kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        _llm_emit "FAIL :: Process '$name' failed to start. Check log: $log_file"; rm -f "$pid_file"; return 1
    fi
    _llm_emit "BG :: Process '$name' is running with PID $(cat "$pid_file")."
}; export -f hype_bg
hype_kill() {
    [[ $# -ge 1 ]] || { _llm_emit "FAIL :: hype_kill requires a process name."; return 2; }; local name=$1; local pid_file="${_LLM_PID_DIR}/${name}.pid"; if [[ ! -f "$pid_file" ]]; then _llm_emit "FAIL :: Process '$name' is not running."; return 1; fi
    local pid; pid=$(cat "$pid_file"); _llm_emit "BG :: Stopping background process '$name' (PID: $pid)..."
    if kill -TERM "$pid" 2>/dev/null; then _llm_emit "BG :: Process '$name' terminated successfully."; else _llm_emit "BG :: Process '$name' not found or already stopped."; fi; rm -f "$pid_file"
}; export -f hype_kill
hype_status() {
    _llm_emit "BG :: Checking status of background processes..."; if [[ ! -d "$_LLM_PID_DIR" ]] || [[ -z "$(ls -A "$_LLM_PID_DIR")" ]]; then _llm_emit "BG :: No background processes are being managed."; return 0; fi
    for pid_file in "${_LLM_PID_DIR}"/*.pid; do if [[ -f "$pid_file" ]]; then local name; name=$(basename "$pid_file" .pid); local pid; pid=$(cat "$pid_file"); if kill -0 "$pid" 2>/dev/null; then _llm_emit "BG :: - $name is RUNNING (PID: $pid)"; else _llm_emit "BG :: - $name is STALE. Cleaning up."; rm -f "$pid_file"; fi; fi; done
}; export -f hype_status

# --- ENVIRONMENT SETUP ---
repo_root="${_llm_repo_root_guess}"
_llm_emit "INFO :: Effusion Labs HYPEBRUT OS activated."
_llm_emit "INFO :: Repo Root: $repo_root"
mkdir -p "$_LLM_PID_DIR" "$_LLM_LOG_DIR"
_llm_path_prepend_unique "$repo_root/bin"
_llm_emit "INFO :: Ensured '$repo_root/bin' is on PATH."
if _llm_on "$LLM_DEPS_AUTOINSTALL"; then
    mkdir -p "$repo_root/tmp"; hash_file="$repo_root/tmp/.deps_hash"; lock_file="$repo_root/package-lock.json"
    if [[ -f "$lock_file" ]]; then
        current_hash=$(sha256sum "$lock_file" | awk '{print $1}')
        stored_hash=$(cat "$hash_file" 2>/dev/null || echo "")
        if [[ "$current_hash" != "$stored_hash" ]]; then
            _llm_emit "INFO :: Dependencies changed. Running 'npm ci' with capture..."; mkdir -p "$repo_root/logs"; ci_log="$repo_root/logs/npm-ci.$(_llm_ts).log"
            (cd "$repo_root" && hype_run --capture "$ci_log" --tail 80 -- npm ci); echo "$current_hash" > "$hash_file"
        fi
    fi
fi
if _llm_on "$LLM_GIT_HOOKS"; then
    hooks_dir="$repo_root/.git/hooks"; if [[ -d "$hooks_dir" ]]; then
        for hook in post-checkout post-merge; do hook_path="$hooks_dir/$hook"; printf '%s\n' '#!/usr/bin/env bash' 'source "$(git rev-parse --show-toplevel)/scripts/llm-bootstrap.sh" >/dev/null 2>&1' > "$hook_path"; chmod +x "$hook_path"; done
    fi
fi

# LLM Informative Message: Reinforces the "source once" rule upon successful activation.
_llm_emit "DONE :: Environment activated. Tools are available for this shell session. **Do not source again.**"
export HYPEBRUT_ENV_READY=1
export HYPEBRUT_ENV_ROOT="$repo_root"
