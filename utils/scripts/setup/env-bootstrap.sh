#!/usr/bin/env bash
# HYPEBRUT Bootstrap — stream guard arming
# Source this file to arm; prints a single banner to stderr.

# Avoid bashisms that break under zsh 'source'; be conservative.
# No strict 'set' to maintain cross-shell compatibility when sourced.

# Idempotence: if already armed for this shell, report and exit
if [[ -n "${HB_GUARD_ARMED:-}" ]] && [[ "${HB_GUARD_SHELL_PID:-$$}" -eq $$ ]]; then
  >&2 echo "[HB] Bootstrap already hijacked (PID=$$). Log: ${HB_LOG_DIR:-.hb-logs}/$$"
  return 0 2>/dev/null || exit 0
fi

# Config
export HB_FILTER_W="${HB_FILTER_W:-3500}"
export HB_FILTER_FLUSH="${HB_FILTER_FLUSH:-}" # computed in filter: ≈ 4•W if empty
export HB_LOG_DIR="${HB_LOG_DIR:-.hb-logs}"
export HB_GUARD_SHELL_PID="$$"
mkdir -p "$HB_LOG_DIR"
export _HB_FD_HIJACKED=1
export _HB_HIJACK_PID="$$"

# Preserve original stdout/stderr for restoration (zsh-safe)
if [ -n "${ZSH_VERSION:-}" ]; then
  exec {HB_ORIG_OUT_FD}>&1
  exec {HB_ORIG_ERR_FD}>&2
  export HB_ORIG_OUT_FD HB_ORIG_ERR_FD
else
  exec 9>&1
  exec 10>&2
  export HB_ORIG_OUT_FD=9 HB_ORIG_ERR_FD=10
fi

# Paths
HB_FILTER_NODE="utils/scripts/filters/hb_filter.cjs"
if [[ ! -x "$HB_FILTER_NODE" ]]; then
  chmod +x "$HB_FILTER_NODE" 2>/dev/null || true
fi

# Decide node runtime: prefer repo-local ./bin/node else fall back to global
HB_NODE="./bin/node"
if [[ ! -x "$HB_NODE" ]]; then
  HB_NODE="node"
  export HB_NODE_FALLBACK=1
fi

# Sidecars (per-process)
export HB_SIDECAR_STDOUT="$HB_LOG_DIR/$$.stdout.log"
export HB_SIDECAR_STDERR="$HB_LOG_DIR/$$.stderr.log"

# Named pipes for guard
HB_PIPE_DIR="${HB_PIPE_DIR:-${TMPDIR:-/tmp}/hbguard.$$}"
mkdir -p "$HB_PIPE_DIR"
export HB_PIPE_OUT="$HB_PIPE_DIR/out.fifo"
export HB_PIPE_ERR="$HB_PIPE_DIR/err.fifo"
[[ -p "$HB_PIPE_OUT" ]] || mkfifo "$HB_PIPE_OUT"
[[ -p "$HB_PIPE_ERR" ]] || mkfifo "$HB_PIPE_ERR"

# Launch filters
if [ -n "${ZSH_VERSION:-}" ]; then
  "$HB_NODE" "$HB_FILTER_NODE" --chan stdout --pid $$ --logdir "$HB_LOG_DIR" --width "$HB_FILTER_W" --flush "$HB_FILTER_FLUSH" <"$HB_PIPE_OUT" 1>&$HB_ORIG_OUT_FD &
else
  "$HB_NODE" "$HB_FILTER_NODE" --chan stdout --pid $$ --logdir "$HB_LOG_DIR" --width "$HB_FILTER_W" --flush "$HB_FILTER_FLUSH" <"$HB_PIPE_OUT" 1>&9 &
fi
HB_FILT_OUT_PID=$!
if [ -n "${ZSH_VERSION:-}" ]; then
  "$HB_NODE" "$HB_FILTER_NODE" --chan stderr --pid $$ --logdir "$HB_LOG_DIR" --width "$HB_FILTER_W" --flush "$HB_FILTER_FLUSH" <"$HB_PIPE_ERR" 1>&$HB_ORIG_ERR_FD &
else
  "$HB_NODE" "$HB_FILTER_NODE" --chan stderr --pid $$ --logdir "$HB_LOG_DIR" --width "$HB_FILTER_W" --flush "$HB_FILTER_FLUSH" <"$HB_PIPE_ERR" 1>&10 &
fi
HB_FILT_ERR_PID=$!

export HB_GUARD_FILTER_PIDS="$HB_FILT_OUT_PID $HB_FILT_ERR_PID"

# Redirect shell stdout/stderr into FIFOs so children inherit
exec 1>"$HB_PIPE_OUT" 2>"$HB_PIPE_ERR"

# Mark armed
export HB_GUARD_ARMED=1

# Helper: hb_status
hb_status() {
  if [[ -n "${HB_GUARD_ARMED:-}" ]]; then
    echo "armed pid=$$ pipes=$HB_PIPE_DIR sidecars=$HB_SIDECAR_STDOUT,$HB_SIDECAR_STDERR width=${HB_FILTER_W}" >&2
  else
    echo "inactive" >&2
  fi
}

# Helper: hb_disarm — restore FDs, stop filters, cleanup
hb_disarm() {
  if [[ -z "${HB_GUARD_ARMED:-}" ]]; then return 0; fi
  # Restore original fds
  if [ -n "${ZSH_VERSION:-}" ]; then
    exec 1>&$HB_ORIG_OUT_FD 2>&$HB_ORIG_ERR_FD
  else
    exec 1>&9 2>&10
  fi
  # Stop filters
  if [[ -n "${HB_GUARD_FILTER_PIDS:-}" ]]; then
    for p in ${HB_GUARD_FILTER_PIDS}; do kill "$p" 2>/dev/null || true; done
  fi
  # Close and cleanup
  rm -f "$HB_PIPE_OUT" "$HB_PIPE_ERR" 2>/dev/null || true
  rmdir "$HB_PIPE_DIR" 2>/dev/null || true
  export HB_GUARD_ARMED=""
}

# Helper: hb_run — run a command with optional PTY or TTY deny
hb_run() {
  local force_pty="${HB_FORCE_PTY:-}" tty_deny="${HB_TTY_DENY:-}" cmd=("$@")
  if [[ -n "$force_pty" ]] && command -v script >/dev/null 2>&1; then
    script -qfec "${cmd[*]}" /dev/null
  elif command -v stdbuf >/dev/null 2>&1; then
    stdbuf -oL -eL "${cmd[@]}"
  else
    "${cmd[@]}"
  fi
}

# Single stderr banner; stdout stays silent
{
  if [[ -n "${HB_NODE_FALLBACK:-}" ]]; then
    echo "[HB] Bootstrap armed. Output is hijacked. Log: $HB_LOG_DIR (node:global)"
  else
    echo "[HB] Bootstrap armed. Output is hijacked. Log: $HB_LOG_DIR"
  fi
} 1>&2

return 0 2>/dev/null || exit 0
