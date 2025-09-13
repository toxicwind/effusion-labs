#!/usr/bin/env bash
# HYPEBRUT / env-bootstrap.sh — forced FD guard (text-only splitting, no base64)
# Location: utils/scripts/setup/env-bootstrap.sh

# Must be sourced, not executed.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  printf '❌ HYPEBRUT :: This script must be *sourced*, not executed.\n' >&2
  return 1 2>/dev/null || exit 1
fi

# Save/restore shell opts for our scope.
_HB_OLD_SET_OPTS="$(set +o)"
trap 'eval "$_HB_OLD_SET_OPTS"' RETURN
set -Euo pipefail

# ── static defaults (no env knobs) ─────────────────────────────────────────────
_HB_SPLIT_WIDTH=3800           # bytes per emitted console line (<4096)
_HB_MARK_PREFIX='[HBWRAP'      # visible marker for split chunks
_HB_MARK_SUFFIX=']'
_HB_LOG_DIR="/tmp/hype_logs"   # sidecar raw log path (authoritative)
_HB_CFG_DIR="${HOME}/.config/hypebrut"
_HB_LOGIN_HOOK="${_HB_CFG_DIR}/login-hook.sh"
_HB_NONINT_HOOK="${_HB_CFG_DIR}/noninteractive-hook.sh"
_HB_BOOTSTRAP_ABS="$(command -v readlink >/dev/null 2>&1 && readlink -f "${BASH_SOURCE[0]}")"
_HB_BOOTSTRAP_ABS="${_HB_BOOTSTRAP_ABS:-${BASH_SOURCE[0]}}"

# ── helpers ───────────────────────────────────────────────────────────────────
_hb_now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# Byte-safe, text-only splitter with visible markers + raw sidecar log.
# - Every input line goes to the sidecar log unmodified.
# - Console output: if a line length > WIDTH, it is chunked with [HBWRAP i/n a..b].
# - No base64, no binary path. ANSI escapes are passed through as-is.
_hb_filter() {
  local width="${_HB_SPLIT_WIDTH}" mark_pfx="${_HB_MARK_PREFIX}" mark_sfx="${_HB_MARK_SUFFIX}"
  local logf="${_HB_LOG_FILE:-}"

  # Use C locale to count bytes, not characters.
  LC_ALL=C awk -v W="$width" -v LOGF="$logf" -v PFX="$mark_pfx" -v SFX="$mark_sfx" '
    function emit_chunk(i,n,start,end,text) {
      if (n > 1) {
        # marker + a space, then the chunk
        printf("%s %d/%d %d..%d%s %s\n", PFX, i, n, start, end, SFX, text);
      } else {
        print text;
      }
    }
    {
      # Sidecar raw line first (authoritative)
      if (LOGF != "") { print $0 >> LOGF; fflush(LOGF); }

      L = length($0);
      if (L <= W) { emit_chunk(1,1,1,L,$0); next }

      N = int((L + W - 1) / W);
      start = 1;
      for (i = 1; i <= N; i++) {
        end = (i*W < L) ? i*W : L;
        emit_chunk(i, N, start, end, substr($0, start, end - start + 1));
        start = end + 1;
      }
    }
  '
}

# ── global FD hijack (per-process; forced) ─────────────────────────────────────
_hb_enable_guard() {
  [[ "${_HB_FD_HIJACKED:-0}" == "1" && "${_HB_HIJACK_PID:-}" == "$$" ]] && return 0
  mkdir -p "$_HB_LOG_DIR"
  _HB_LOG_FILE="${_HB_LOG_DIR}/hb.$(basename "${SHELL:-bash}" 2>/dev/null).$$_$(_hb_now).log"
  # Save real FDs, then redirect stdout/stderr through the splitter.
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

# Idempotence (process-local).
if [[ "${_HB_READY:-}" == "1" && "${_HB_READY_PID:-}" == "$$" ]]; then
  printf "[HB] Ready in this process. Proceed.\n" >&2
  return 0
fi

# ── hooks to ensure noninteractive *login* shells source this (forced) ─────────
mkdir -p "$_HB_CFG_DIR"

cat > "$_HB_NONINT_HOOK" <<EOF
# >>> HYPEBRUT noninteractive hook >>>
# shellcheck shell=bash source=/dev/null
if [[ \$- != *i* ]]; then
  source "${_HB_BOOTSTRAP_ABS}" --as-hook
fi
# <<< HYPEBRUT noninteractive hook <<<
EOF
chmod 0644 "$_HB_NONINT_HOOK"

cat > "$_HB_LOGIN_HOOK" <<EOF
# >>> HYPEBRUT login hook >>>
# shellcheck shell=bash source=/dev/null
[ -f "${_HB_NONINT_HOOK}" ] && source "${_HB_NONINT_HOOK}"
# <<< HYPEBRUT login hook <<<
EOF
chmod 0644 "$_HB_LOGIN_HOOK"

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

# Process-local readiness banner (stderr).
_HB_READY=1
_HB_READY_PID="$$"
printf "[HB] Bootstrap active. Guard armed (width=%d bytes). Log: %s\n" \
       "$_HB_SPLIT_WIDTH" "${_HB_LOG_FILE:-<none>}" >&2
