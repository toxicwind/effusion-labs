#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────────
# HYPEBRUT / env-bootstrap.sh — minimal, no-env, explicit line-splitting
# Location: utils/scripts/setup/env-bootstrap.sh
# Purpose: Protect noninteractive sessions from >4096-byte *lines* by:
#   • Global stdout/stderr guard (per-process) with explicit split markers
#   • Binary-aware path: base64-encode non-text lines with visible header
#   • Sidecar log capturing raw, unwrapped output per process (file only)
#   • Login + noninteractive hook install, with NO exports
# Notes:
#   • No environment variables are created or read. All settings are static.
#   • For noninteractive children spawned as *login* shells (bash -lc), the hook
#     auto-engages. For bare `bash -c` (not login), consider the shim below.
# ────────────────────────────────────────────────────────────────────────────────

# Must be sourced, not executed.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  printf '❌ HYPEBRUT :: This script must be *sourced*, not executed.\n' >&2
  return 1 2>/dev/null || exit 1
fi

# Save/restore shell opts; scope our changes.
_HB_OLD_SET_OPTS="$(set +o)"
trap 'eval "$_HB_OLD_SET_OPTS"' RETURN
set -Euo pipefail

# ── static defaults (no env knobs) ─────────────────────────────────────────────
_HB_SPLIT_WIDTH=3800           # bytes per emitted chunk on stdout/stderr (<4096)
_HB_MARK_PREFIX='[HBWRAP'      # visible marker for wrapped text lines
_HB_MARK_SUFFIX=']'
_HB_B64_HEADER='[HBB64'        # visible header for binary lines (then base64 body)
_HB_B64_TAIL=']'
_HB_LOG_DIR="/tmp/hype_logs"   # sidecar logs (raw, unmodified lines)
_HB_CFG_DIR="${HOME}/.config/hypebrut"
_HB_LOGIN_HOOK="${_HB_CFG_DIR}/login-hook.sh"
_HB_NONINT_HOOK="${_HB_CFG_DIR}/noninteractive-hook.sh"
_HB_BOOTSTRAP_ABS="$(readlink -f "${BASH_SOURCE[0]}")"

# ── helpers (shell-local) ──────────────────────────────────────────────────────
_hb_has() { command -v "$1" >/dev/null 2>&1; }
_hb_now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# ── explicit, byte-aware splitter with visible markers + raw sidecar log ──────
# Reads stdin; writes:
#   • to $_HB_LOG_FILE: original, unwrapped bytes (for auditing)
#   • to stdout: safe lines
#     - ASCII/printable: split into ≤_HB_SPLIT_WIDTH chunks with [HBWRAP i/n a..b]
#     - Non-text (has non-printables in C locale): print one [HBB64 LEN=…] header
#       then base64 of the original line (naturally wrapped at ~76 chars)
_hb_filter() {
  local width="${_HB_SPLIT_WIDTH}" mark_pfx="${_HB_MARK_PREFIX}" mark_sfx="${_HB_MARK_SUFFIX}"
  local b64_head="${_HB_B64_HEADER}" b64_tail="${_HB_B64_TAIL}" logf="${_HB_LOG_FILE:-}" tmpdir="/tmp"
  # We keep a unique counter for temporary blobs used during base64 hashing.
  local -i seq=0

  # Use awk (C locale) to detect non-printables and split printable lines;
  # For binary lines we drop to a tiny shell to base64 the temp file, so we can
  # keep per-line isolation and avoid corrupting terminals.
  LC_ALL=C awk -v W="$width" -v LOGF="$logf" -v PFX="$mark_pfx" -v SFX="$mark_sfx" \
               -v B64H="$b64_head" -v B64T="$b64_tail" -v TMPDIR="$tmpdir" -v SEQPTR="/dev/fd/3" '
    # Utility: emit a wrapped chunk with header
    function emit_chunk(i,n,start,end,text) {
      if (n > 1) {
        printf("%s %d/%d %d..%d%s %s\n", PFX, i, n, start, end, SFX, text);
      } else {
        print text;
      }
    }
    # Utility: detect non-printables in C locale (NUL cannot appear in AWK records)
    function is_binary(s,  i,c) {
      for (i=1; i<=length(s); i++) {
        c = substr(s,i,1);
        if (c !~ /[[:print:]\t\r]/) return 1;
      }
      return 0;
    }
    {
      # Sidecar: raw line first (no wrapping)
      if (LOGF != "") { print $0 >> LOGF; fflush(LOGF); }

      # Printable path → wrap safely
      if (!is_binary($0)) {
        L = length($0);
        if (L <= W) { emit_chunk(1,1,1,L,$0); next }
        N = int((L + W - 1) / W);
        start = 1;
        for (i = 1; i <= N; i++) {
          end = (i*W < L) ? i*W : L;
          emit_chunk(i, N, start, end, substr($0, start, end - start + 1));
          start = end + 1;
        }
        next
      }

      # Binary path → write bytes to temp, then base64 them line-wrapped
      # Acquire a unique id from parent shell via fd 3 (increments an integer)
      if (getline seq < SEQPTR <= 0) { seq = 0 }  # paranoid default
      seq++
      blob = TMPDIR "/hb.bin." PROCINFO["pid"] "." seq
      # Write payload (plus \n since AWK records are newline-stripped)
      print $0 > blob; close(blob)

      # Compute length and hash if tools exist (best effort, not required)
      len = length($0)
      sha = "NA"
      if (system("command -v sha256sum >/dev/null 2>&1") == 0) {
        cmd = "sha256sum " blob " | awk \047{print $1}\047"; cmd | getline sha; close(cmd)
      } else if (system("command -v shasum >/dev/null 2>&1") == 0) {
        cmd = "shasum -a 256 " blob " | awk \047{print $1}\047"; cmd | getline sha; close(cmd)
      }

      # Header then base64 body (default base64 wrap ~76 chars on both GNU/BSD)
      printf("%s LEN=%d SHA256=%s%s\n", B64H, len, sha, B64T);
      cmd = "base64 " blob
      while ((cmd | getline line) > 0) { print line }
      close(cmd)
      # Clean temp
      system("rm -f " blob)
    }
  ' 3< <(
      # fd 3 streams an ever-increasing integer to awk so it can generate per-line temp names.
      # This protects against racing when multiple filter instances exist.
      i=0; while :; do printf '%s\n' "$i"; i=$((i+1)); done
  )
}

# ── global FD hijack (per-process; no env) ─────────────────────────────────────
_hb_enable_guard() {
  [[ "${_HB_FD_HIJACKED:-0}" == "1" && "${_HB_HIJACK_PID:-}" == "$$" ]] && return 0
  mkdir -p "$_HB_LOG_DIR"
  _HB_LOG_FILE="${_HB_LOG_DIR}/hb.$(basename "${SHELL:-bash}" 2>/dev/null).$$_$(_hb_now).log"
  # Save original FDs and redirect through the guard
  exec {_HB_STDOUT_ORIG}>&1
  exec {_HB_STDERR_ORIG}>&2
  exec 1> >(_hb_filter)
  exec 2> >(_hb_filter)
  _HB_FD_HIJACKED=1
  _HB_HIJACK_PID="$$"
}
_hb_disable_guard() {
  [[ "${_HB_FD_HIJACKED:-0}" != "1" || "${_HB_HIJACK_PID:-}" != "$$" ]] && return 0
  exec 1>&${_HB_STDOUT_ORIG} 2>&${_HB_STDERR_ORIG}
  exec {_HB_STDOUT_ORIG}>&- {_HB_STDERR_ORIG}>&-
  unset _HB_FD_HIJACKED _HB_HIJACK_PID _HB_STDOUT_ORIG _HB_STDERR_ORIG _HB_LOG_FILE
}

# Engage the guard automatically in *noninteractive* shells.
if [[ $- != *i* ]]; then
  _hb_enable_guard
fi

# ── idempotence (process-local; no env) ───────────────────────────────────────
if [[ "${_HB_READY:-}" == "1" && "${_HB_READY_PID:-}" == "$$" ]]; then
  printf "[HB] Ready in this process. Proceed.\n" >&2
  return 0
fi

# ── hooks (no exports) ─────────────────────────────────────────────────────────
mkdir -p "$_HB_CFG_DIR"

# Noninteractive hook (absolute path to this bootstrap; no guessing)
cat > "$_HB_NONINT_HOOK" <<EOF
# >>> HYPEBRUT noninteractive hook (no-env) >>>
# shellcheck shell=bash source=/dev/null
# Always source the bootstrap in noninteractive *login* shells so the guard engages.
if [[ \$- != *i* ]]; then
  source "${_HB_BOOTSTRAP_ABS}" --as-hook
fi
# <<< HYPEBRUT noninteractive hook <<<
EOF
chmod 0644 "$_HB_NONINT_HOOK"

# Login hook: ensure login shells source the noninteractive hook
cat > "$_HB_LOGIN_HOOK" <<EOF
# >>> HYPEBRUT login hook (no-env) >>>
# shellcheck shell=bash source=/dev/null
[ -f "${_HB_NONINT_HOOK}" ] && source "${_HB_NONINT_HOOK}"
# <<< HYPEBRUT login hook <<<
EOF
chmod 0644 "$_HB_LOGIN_HOOK"

# Idempotently append login sourcing to common startup files.
_hb_patch_file() {
  local f="$1" marker="# >>> HYPEBRUT login sourcing >>>"
  if [[ -f "$f" ]] && grep -Fq "$marker" "$f"; then return 0; fi
  mkdir -p "$(dirname "$f")"
  {
    echo ""; echo "$marker"
    echo "[ -f \"${_HB_LOGIN_HOOK}\" ] && source \"${_HB_LOGIN_HOOK}\""
    echo "# <<< HYPEBRUT login sourcing <<<"
  } >> "$f"
}
if [[ -f "${HOME}/.bash_profile" || ! -f "${HOME}/.profile" ]]; then
  _hb_patch_file "${HOME}/.bash_profile"
fi
_hb_patch_file "${HOME}/.profile"

# Mark process-local readiness.
_HB_READY=1
_HB_READY_PID="$$"
printf "[HB] Bootstrap active. Guard armed (width=%d bytes). Log: %s\n" \
       "$_HB_SPLIT_WIDTH" "${_HB_LOG_FILE:-<none>}" >&2

# Done. RETURN trap restores shell options (not the guard; it persists).
