#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────────
# HYPEBRUT / env-bootstrap.sh — minimal, no-env, explicit line-splitting
# Location: utils/scripts/setup/env-bootstrap.sh
# Guarantees:
#   • Always-on global stdout/stderr guard (this process) with explicit markers
#   • Binary-aware: base64 + header for non-printable lines
#   • Sidecar log of raw (unwrapped) output at /tmp/hype_logs
#   • Repo ./bin is prepended to PATH (no exports)
#   • Login + noninteractive hooks installed (no exports)
# ────────────────────────────────────────────────────────────────────────────────

# Must be sourced, not executed.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  printf '❌ HYPEBRUT :: This script must be *sourced*, not executed.\n' >&2
  return 1 2>/dev/null || exit 1
fi

# Save/restore shell opts; scope our changes.
_HB_OLD_SET_OPTS="$(set +o)"; trap 'eval "$_HB_OLD_SET_OPTS"' RETURN
set -Euo pipefail

# ── static defaults (no env knobs) ─────────────────────────────────────────────
_HB_SPLIT_WIDTH=3800           # keep <4096 incl. header
_HB_MARK_PREFIX='[HBWRAP'      # text wrap header
_HB_MARK_SUFFIX=']'
_HB_B64_HEADER='[HBB64'        # binary header
_HB_B64_TAIL=']'
_HB_LOG_DIR="/tmp/hype_logs"   # sidecar raw log
_HB_BOOTSTRAP_ABS="$(readlink -f "${BASH_SOURCE[0]}")"
_HB_REPO_ROOT="$(cd "$(dirname "$_HB_BOOTSTRAP_ABS")/../../.." && pwd -P)"  # utils/scripts/setup → repo

# ── PATH: prepend repo ./bin (idempotent; no export) ───────────────────────────
_hb_path_prepend_unique() {
  local dir="$1"; [[ -d "$dir" ]] || return 0
  case ":$PATH:" in *":$dir:"*) ;; *) PATH="$dir:$PATH" ;; esac
}
_hb_path_prepend_unique "${_HB_REPO_ROOT}/bin"

# ── helpers ────────────────────────────────────────────────────────────────────
_hb_now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# ── explicit, byte-aware splitter with visible markers + raw sidecar log ──────
_hb_filter() {
  local width="${_HB_SPLIT_WIDTH}" mark_pfx="${_HB_MARK_PREFIX}" mark_sfx="${_HB_MARK_SUFFIX}"
  local b64_head="${_HB_B64_HEADER}" b64_tail="${_HB_B64_TAIL}" logf="${_HB_LOG_FILE:-}" tmpdir="/tmp"
  LC_ALL=C awk -v W="$width" -v LOGF="$logf" -v PFX="$mark_pfx" -v SFX="$mark_sfx" \
               -v B64H="$b64_head" -v B64T="$b64_tail" -v TMPDIR="$tmpdir" -v SEQPTR="/dev/fd/3" '
    function emit_chunk(i,n,start,end,text){ if(n>1){printf("%s %d/%d %d..%d%s %s\n",PFX,i,n,start,end,SFX,text)} else {print text}}
    function is_binary(s, i,c){ for(i=1;i<=length(s);i++){c=substr(s,i,1); if(c !~ /[[:print:]\t\r]/) return 1 } return 0 }
    {
      if (LOGF != "") { print $0 >> LOGF; fflush(LOGF) }
      if (!is_binary($0)) {
        L=length($0); if(L<=W){ emit_chunk(1,1,1,L,$0); next }
        N=int((L+W-1)/W); start=1
        for(i=1;i<=N;i++){ end=(i*W<L)?i*W:L; emit_chunk(i,N,start,end,substr($0,start,end-start+1)); start=end+1 }
        next
      }
      # binary path
      if (getline seq < SEQPTR <= 0) { seq=0 } ; seq++
      blob = TMPDIR "/hb.bin." PROCINFO["pid"] "." seq
      print $0 > blob; close(blob)
      len=length($0); sha="NA"
      if (system("command -v sha256sum >/dev/null 2>&1")==0){
        cmd="sha256sum " blob " | awk \047{print $1}\047"; cmd|getline sha; close(cmd)
      } else if (system("command -v shasum >/dev/null 2>&1")==0){
        cmd="shasum -a 256 " blob " | awk \047{print $1}\047"; cmd|getline sha; close(cmd)
      }
      printf("%s LEN=%d SHA256=%s%s\n", B64H, len, sha, B64T)
      cmd="base64 " blob; while((cmd|getline line)>0){ print line } ; close(cmd)
      system("rm -f " blob)
    }
  ' 3< <( i=0; while :; do printf '%s\n' "$i"; i=$((i+1)); done )
}

# ── global FD hijack (per-process; always on) ──────────────────────────────────
_hb_enable_guard() {
  [[ "${_HB_FD_HIJACKED:-0}" == "1" && "${_HB_HIJACK_PID:-}" == "$$" ]] && return 0
  mkdir -p "$_HB_LOG_DIR"
  _HB_LOG_FILE="${_HB_LOG_DIR}/hb.$(basename "${SHELL:-bash}").$$_$(_hb_now).log"
  exec {_HB_STDOUT_ORIG}>&1
  exec {_HB_STDERR_ORIG}>&2
  exec 1> >(_hb_filter)
  exec 2> >(_hb_filter)
  _HB_FD_HIJACKED=1; _HB_HIJACK_PID="$$"
}
_hb_disable_guard() {
  [[ "${_HB_FD_HIJACKED:-0}" != "1" || "${_HB_HIJACK_PID:-}" != "$$" ]] && return 0
  exec 1>&${_HB_STDOUT_ORIG} 2>&${_HB_STDERR_ORIG}
  exec {_HB_STDOUT_ORIG}>&- {_HB_STDERR_ORIG}>&-
  unset _HB_FD_HIJACKED _HB_HIJACK_PID _HB_STDOUT_ORIG _HB_STDERR_ORIG _HB_LOG_FILE
}

# Arm the guard unconditionally in this shell (interactive and noninteractive).
_hb_enable_guard

# ── idempotence (process-local; no env) ───────────────────────────────────────
if [[ "${_HB_READY:-}" == "1" && "${_HB_READY_PID:-}" == "$$" ]]; then
  printf "[HB] Ready in this process. Proceed.\n" >&2
  return 0
fi

# ── hooks (no exports) ─────────────────────────────────────────────────────────
_HB_CFG_DIR="${HOME}/.config/hypebrut"
_HB_LOGIN_HOOK="${_HB_CFG_DIR}/login-hook.sh"
_HB_NONINT_HOOK="${_HB_CFG_DIR}/noninteractive-hook.sh"
mkdir -p "$_HB_CFG_DIR"

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

cat > "$_HB_LOGIN_HOOK" <<EOF
# >>> HYPEBRUT login hook (no-env) >>>
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

# Mark process-local readiness.
_HB_READY=1; _HB_READY_PID="$$"
printf "[HB] Bootstrap active. Guard armed (width=%d bytes). Log: %s | PATH[0]=%s\n" \
       "$_HB_SPLIT_WIDTH" "${_HB_LOG_FILE:-<none>}" "$(printf '%s' "$PATH" | awk -F: '{print $1}')" >&2
