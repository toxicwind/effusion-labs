#!/usr/bin/env bash
# HYPEBRUT Operating System --- Effusion Labs
# Strict, robust defaults. Let's create.
set -Euo pipefail

# --- CONFIGURATION & TUNING KNOBS ---
# These are the dials for your session.
: "${LLM_VERBOSE:=1}"
: "${LLM_FOLD_WIDTH:=4000}"             # Max line width before folding.
: "${LLM_IDLE_SECS:=10}"                # Seconds before an idle process emits a heartbeat.
: "${LLM_IDLE_FAIL_AFTER_SECS:=360}"    # Seconds of total idle time before a process is considered stalled.
: "${LLM_DEPS_AUTOINSTALL:=1}"          # Auto-run `npm ci` if package-lock.json changes.
: "${LLM_GIT_HOOKS:=1}"                  # Auto-install git hooks to keep this script active.
: "${LLM_TEST_PRESETS:=1}"               # Auto-set CI=1 etc. for `npm test`.
: "${LLM_SUPPRESS_PATTERNS:='^npm ERR! cb'}" # Regex to filter out common, low-signal noise from streams.

# --- AESTHETIC HELPERS ---
# For injecting personality into the shell.

_llm_ts(){ date -u +"%Y-%m-%dT%H:%M:%SZ"; }
_llm_has(){ command -v "$1" >/dev/null 2>&1; }
# (FIX ADDED) Helper to check if a feature flag is enabled.
_llm_on() { [[ "$1" == "1" || "$1" == "true" ]]; }


# The core aesthetic emitter. All themed output flows through here.
_llm_emit() {
    [[ "${LLM_VERBOSE}" != "1" ]] && return 0
    local theme_icon="::"
    local theme_color_start="\033[1;35m" # Bold Magenta
    local theme_color_end="\033[0m"
    
    # Select icon based on event type
    case "${1:-}" in
        "START") theme_icon="⚡"; theme_color_start="\033[1;33m";; # Bold Yellow
        "DONE")  theme_icon="✅"; theme_color_start="\033[1;32m";; # Bold Green
        "FAIL")  theme_icon="❌"; theme_color_start="\033[1;31m";; # Bold Red
        "IDLE")  theme_icon="⌛"; theme_color_start="\033[0;36m";;  # Cyan
        "INFO")  theme_icon="ℹ️ "; theme_color_start="\033[0;34m";; # Blue
        "SNAP")  theme_icon="📸"; theme_color_start="\033[0;35m";; # Magenta
    esac

    printf "${theme_color_start}%s HYPEBRUT %s${theme_color_end}" "$theme_icon" "$*" >&2
    printf '\n' >&2
}

# Folds long lines to keep output readable.
_llm_fold() {
    # Check if `fold` is available, otherwise just use `cat`.
    if _llm_has fold; then
        fold -w "${LLM_FOLD_WIDTH}" -s
    else
        cat
    fi
}

# Filters a stream to suppress noisy, low-value lines.
_llm_stream_filter() {
    if [[ -z "${LLM_SUPPRESS_PATTERNS}" ]]; then
        cat
    else
        # Use awk to filter lines matching the suppression pattern.
        awk -v pat="$LLM_SUPPRESS_PATTERNS" '{ if ($0 ~ pat) next; print }'
    fi
}

# --- CORE UTILITIES ---
# These are the primary instruments for the agent.

# The canonical runner for all commands. Expressive, safe, and powerful.
hype_run() {
    local capture_file="" idle="${LLM_IDLE_SECS}" tail_on_complete=0
    local id="hype-$$"
    
    # Parse arguments for --capture and other flags.
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --capture) capture_file="$2"; shift 2;;
            --idle)    idle="$2"; shift 2;;
            --tail)    tail_on_complete="$2"; shift 2;;
            --)        shift; break;;
            *)         break;;
        esac
    done

    [[ $# -ge 1 ]] || { _llm_emit "FAIL :: hype_run requires a command to execute."; return 2; }

    # Create a named pipe for real-time stream processing.
    local pipe="/tmp/hype_run.${id}.pipe"
    mkfifo "$pipe" || { _llm_emit "FAIL :: Could not create execution pipe."; return 2; }
    
    _llm_emit "START :: Running command: $(printf '%q ' "$@")"
    [[ -n "$capture_file" ]] && _llm_emit "INFO :: Capturing full output to $capture_file"

    # Start the child process, redirecting its output to the pipe.
    # Automatically applies test-safe environment variables if needed.
    (
        set -o pipefail
        if [[ "${LLM_TEST_PRESETS}" == "1" && "$*" =~ (npm|pnpm|yarn|npx).*(test|@11ty/eleventy) ]]; then
            export CI=1 ELEVENTY_ENV=test WATCH=0
        fi
        # Use stdbuf to prevent output buffering issues.
        if _llm_has stdbuf; then
            stdbuf -oL -eL "$@" >"$pipe" 2>&1
        else
            "$@" >"$pipe" 2>&1
        fi
    ) &
    local child_pid=$!

    # Process the stream from the pipe in real-time.
    local reader_pid
    (
        local stream_processor
        # If capturing, `tee` the output to the file; otherwise, just print.
        if [[ -n "$capture_file" ]]; then
            # Ensure the capture file is writable.
            : > "$capture_file" 2>/dev/null || { _llm_emit "FAIL :: Capture file '$capture_file' is not writable."; exit 1; }
            stream_processor="tee -a -- '$capture_file'"
        else
            stream_processor="cat"
        fi
        
        # The main pipeline: read from pipe -> filter noise -> fold lines -> process/tee
        bash -c "_llm_stream_filter < '$pipe' | _llm_fold | $stream_processor"
    ) &
    reader_pid=$!

    # Watchdog process to detect stalls.
    local watchdog_pid
    (
        local last_size=-1 current_size=0 idle_total=0
        while kill -0 "$child_pid" 2>/dev/null; do
            sleep "$idle"
            # If a capture file exists, check its size to detect idle state.
            if [[ -n "$capture_file" && -f "$capture_file" ]]; then
                current_size=$(wc -c <"$capture_file" 2>/dev/null || echo 0)
                if (( current_size == last_size )); then
                    idle_total=$((idle_total + idle))
                    _llm_emit "IDLE :: Process has been quiet for $idle_total seconds..."
                    if (( LLM_IDLE_FAIL_AFTER_SECS > 0 && idle_total >= LLM_IDLE_FAIL_AFTER_SECS )); then
                        _llm_emit "FAIL :: Process timed out after $idle_total seconds of inactivity. Terminating."
                        kill -TERM "$child_pid" 2>/dev/null
                        break
                    fi
                else
                    last_size=$current_size
                    idle_total=0
                fi
            fi
        done
    ) &
    watchdog_pid=$!
    
    # Trap interrupts (Ctrl-C) for graceful shutdown.
    trap '
        _llm_emit "FAIL :: Interrupted by user."
        kill -TERM '"$child_pid"' '"$reader_pid"' '"$watchdog_pid"' 2>/dev/null
        rm -f "'"$pipe"'"
        exit 130
    ' INT

    # Wait for the command to finish and get its exit code.
    local status=0
    wait "$child_pid"; status=$?

    # Clean up background processes and the named pipe.
    # A short sleep ensures the reader can process the final output.
    sleep 0.1
    kill "$reader_pid" "$watchdog_pid" 2>/dev/null || true
    rm -f "$pipe"

    if (( status == 0 )); then
        _llm_emit "DONE :: Command finished successfully (status: $status)."
    else
        _llm_emit "FAIL :: Command failed (status: $status)."
    fi
    
    # If requested, show the last few lines of the captured output.
    if [[ -n "$capture_file" && -f "$capture_file" && "$tail_on_complete" -gt 0 ]]; then
        _llm_emit "INFO :: Final output tail:"
        command tail -n "$tail_on_complete" -- "$capture_file" | _llm_fold
    fi

    return "$status"
}
export -f hype_run

# An intelligent file viewer that pretty-prints known file types.
llm_cat() {
    local target="${1:-}"
    if [[ -z "$target" ]]; then
        # Handle piped input
        command cat | _llm_fold
        return
    fi
    if [[ ! -f "$target" ]]; then
        _llm_emit "FAIL :: File not found: $target"
        return 1
    fi

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

    # Use npx to run prettier if available, ensuring we don't need a global install.
    if [[ -n "$parser" ]] && _llm_has npx; then
        _llm_emit "INFO :: Pretty-printing $target (type: $parser)"
        npx --no-install prettier --parser "$parser" --print-width "${LLM_FOLD_WIDTH}" --no-config -- "$target" 2>/dev/null | _llm_fold
    else
        _llm_emit "INFO :: Displaying raw content of $target"
        command cat -- "$target" | _llm_fold
    fi
}
export -f llm_cat

# A single, atomic command to stage and commit all work with a conventional message.
llm_snapshot() {
    local msg="${1:-chore: WIP checkpoint}"
    _llm_emit "SNAP :: Creating snapshot with message: '$msg'"
    
    if ! _llm_has git || ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        _llm_emit "FAIL :: Not in a git repository. Cannot create snapshot."
        return 1
    fi

    git add -A
    # Use --allow-empty in case of metadata changes, and ignore failure if there's nothing to commit.
    if git commit --allow-empty -m "$msg"; then
        _llm_emit "DONE :: Snapshot created successfully."
        # Optional: Append to a worklog.
        # local worklog_file="artifacts/worklogs/$(date -u +%Y%m%d).md"
        # mkdir -p "$(dirname "$worklog_file")"
        # printf "\n- **%s**: Snapshot created: \`%s\`\n" "$(_llm_ts)" "$msg" >> "$worklog_file"
    else
        _llm_emit "INFO :: No changes to commit for snapshot."
    fi
}
export -f llm_snapshot


# --- ENVIRONMENT SETUP ---
# Final setup steps to make the shell ready.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd 2>/dev/null || pwd)"
_llm_emit "INFO :: Effusion Labs HYPEBRUT OS activated."
_llm_emit "INFO :: Repo Root: $repo_root"

# (FIX ADDED) Add the repo's /bin directory to the PATH.
if [[ -d "$repo_root/bin" ]]; then
    export PATH="$repo_root/bin:$PATH"
    _llm_emit "INFO :: Added '$repo_root/bin' to PATH."
fi

# Auto-install dependencies if package-lock.json has changed.
if _llm_on "$LLM_DEPS_AUTOINSTALL"; then
    mkdir -p "$repo_root/tmp"
    local hash_file="$repo_root/tmp/.deps_hash"
    local lock_file="$repo_root/package-lock.json"
    if [[ -f "$lock_file" ]]; then
        local current_hash; current_hash=$(sha256sum "$lock_file" | awk '{print $1}')
        local stored_hash; stored_hash=$(cat "$hash_file" 2>/dev/null || echo "")
        if [[ "$current_hash" != "$stored_hash" ]]; then
            _llm_emit "INFO :: Dependencies have changed. Running 'npm ci'..."
            (cd "$repo_root" && hype_run -- npm ci)
            echo "$current_hash" > "$hash_file"
        fi
    fi
fi

# Install git hooks to ensure the bootstrap script is always active.
if _llm_on "$LLM_GIT_HOOKS"; then
    local hooks_dir="$repo_root/.git/hooks"
    if [[ -d "$hooks_dir" ]]; then
        for hook in post-checkout post-merge; do
            local hook_path="$hooks_dir/$hook"
            printf '%s\n' '#!/usr/bin/env bash' 'source "$(git rev-parse --show-toplevel)/scripts/llm-bootstrap.sh" >/dev/null 2>&1' > "$hook_path"
            chmod +x "$hook_path"
        done
    fi
fi

_llm_emit "DONE :: Environment ready. Go create something amazing."