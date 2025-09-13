#!/usr/bin/env bash
# HYPEBRUT / env-bootstrap.sh — Forced global FD hijack w/ auto line split & binary safety
# Location: utils/scripts/setup/env-bootstrap.sh

# Must be sourced, not executed.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  printf '❌ HYPEBRUT :: This script must be *sourced*, not executed.\n' >&2
  return 1 2>/dev/null || exit 1
fi

_HB_SPLIT_WIDTH=3800
_HB_MARK_PREFIX='[HBWRAP'
_HB_MARK_SUFFIX=']'
_HB_BIN_MARK_PREFIX='[HBBIN'
_HB_LOG_DIR="/tmp/hype_logs"
_HB_CFG_DIR="${HOME}/.config/hypebrut"
_HB_LOGIN_HOOK="${_HB_CFG_DIR}/login-hook.sh"
_HB_NONINT_HOOK="${_HB_CFG_DIR}/noninteractive-hook.sh"
_HB_BOOTSTRAP_ABS="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || realpath "${BASH_SOURCE[0]}")"
_HB_READY=0

# ── Timestamp
_hb_now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# ── Binary detector (C locale, octets)
_hb_is_binary() {
  LC_ALL=C grep -qU '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]' <<<"$1"
}

# ── Byte-safe splitter with visible markers + sidecar log
_hb_filter() {
  local width="${_HB_SPLIT_WIDTH}" logf="${_HB_LOG_FILE:-}" mark_pfx="${_HB_MARK_PREFIX}" mark_sfx="${_HB_MARK_SUFFIX}"
  local bin_pfx="${_HB_BIN_MARK_PREFIX}"

  LC_ALL=C awk -v W="$width" -v LOGF="$logf" -v PFX="$mark_pfx" -v SFX="$mark_sfx" -v BIN="$bin_pfx" '
    function emit_chunk(i,n,start,end,text) {
      if (n > 1) {
        printf("%s %d/%d %d..%d%s %s\n", PFX, i, n, start, end, SFX, text);
      } else {
        print text;
      }
    }
    {
      # Sidecar first
      if (LOGF != "") { print $0 >> LOGF; fflush(LOGF); }

      # Binary detection
      for (i = 1; i <= length($0); i++) {
        c = substr($0, i, 1);
        if (c ~ /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/) {
          cmd = "echo \""$0"\" | base64";
          cmd | getline b64; close(cmd);
          printf("%s BASE64 LINE %d\n%s\n", BIN, NR, b64);
          next;
        }
      }

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

# ── Forced hijack of all FDs in this process
_hb_enable_guard() {
  [[ "${_HB_FD_HIJACKED:-0}" == "1" && "${_HB_HIJACK_PID:-}" == "$$" ]] && return 0
  mkdir -p "$_HB_LOG_DIR"
  _HB_LOG_FILE="${_HB_LOG_DIR}/hb.$(basename "${SHELL:-bash}" 2>/dev/null).$$_$(_hb_now).log"

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

# ── Noninteractive hijack: any shell not interactive gets FD-guarded
if [[ $- != *i* ]]; then
  _hb_enable_guard
fi

# ── Idempotence
if [[ "${_HB_READY:-}" == "1" && "${_HB_READY_PID:-}" == "$$" ]]; then
  printf "[HB] Already hijacked (PID=$$). Proceed.\n" >&2
  return 0
fi

# ── Hooks into login/profile + ~/.config/hypebrut
mkdir -p "$_HB_CFG_DIR"

cat > "$_HB_NONINT_HOOK" <<EOF
# >>> HYPEBRUT noninteractive hook >>>
# shellcheck shell=bash source=/dev/null
if [[ \$- != *i* ]]; then
  source "${_HB_BOOTSTRAP_ABS}" --as-hook
fi
# <<< HYPEBRUT noninteractive hook <<<
EOF

cat > "$_HB_LOGIN_HOOK" <<EOF
# >>> HYPEBRUT login hook >>>
# shellcheck shell=bash source=/dev/null
[ -f "${_HB_NONINT_HOOK}" ] && source "${_HB_NONINT_HOOK}"
# <<< HYPEBRUT login hook <<<
EOF

chmod 0644 "$_HB_LOGIN_HOOK" "$_HB_NONINT_HOOK"

# ── Force insert into ~/.profile and ~/.bash_profile
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

# ── Mark ready
_HB_READY=1
_HB_READY_PID="$$"
printf "[HB] Bootstrap armed. Output is hijacked. Log: %s\n" "${_HB_LOG_FILE:-<none>}" >&2
