#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────────
# HYPEBRUT / env-bootstrap.sh — no-env hijack: global guard + forced PTY shims
# Location: utils/scripts/setup/env-bootstrap.sh
#
# Guarantees (this process):
#   • Always-on global stdout/stderr guard with explicit markers
#   • Binary-aware: base64 + header for non-printable lines
#   • Sidecar raw log at /tmp/hype_logs
#   • Repo ./bin is prepended to PATH (idempotent)
#   • Forced PATH shim layer: every PATH command runs via PTY trampoline
#   • Login + noninteractive hooks installed (no exports)
#
# Notes:
#   • Absolute path invocations (e.g. /usr/bin/grep) bypass shims; the FD guard still applies.
#   • No environment variables are exported; everything is shell-local to this process.
# ────────────────────────────────────────────────────────────────────────────────

# Must be sourced, not executed.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  printf '❌ HYPEBRUT :: This script must be *sourced*, not executed.\n' >&2
  return 1 2>/dev/null || exit 1
fi

# Save/restore shell opts; scope changes.
_HB_OLD_SET_OPTS="$(set +o)"; trap 'eval "$_HB_OLD_SET_OPTS"' RETURN
set -Euo pipefail

# ── static defaults (no env knobs)
_HB_SPLIT_WIDTH=3800           # keep <4096 incl. header
_HB_MARK_PREFIX='[HBWRAP'      # text wrap header
_HB_MARK_SUFFIX=']'
_HB_B64_HEADER='[HBB64'        # binary header
_HB_B64_TAIL=']'
_HB_LOG_DIR="/tmp/hype_logs"   # sidecar raw log
_HB_BOOTSTRAP_ABS="$(readlink -f "${BASH_SOURCE[0]}")"
_HB_REPO_ROOT="$(cd "$(dirname "$_HB_BOOTSTRAP_ABS")/../../.." && pwd -P)"  # utils/scripts/setup → repo
_HB_CFG_DIR="${HOME}/.config/hypebrut"
_HB_LOGIN_HOOK="${_HB_CFG_DIR}/login-hook.sh"
_HB_NONINT_HOOK="${_HB_CFG_DIR}/noninteractive-hook.sh"

# ── PATH: prepend repo ./bin (idempotent; no export)
_hb_path_prepend_unique() {
  local dir="$1"; [[ -d "$dir" ]] || return 0
  case ":$PATH:" in *":$dir:"*) ;; *) PATH="$dir:$PATH" ;; esac
}
_hb_path_prepend_unique "${_HB_REPO_ROOT}/bin"

# ── helpers
_hb_now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
_hb_has() { command -v "$1" >/dev/null 2>&1; }

# ── explicit, byte-aware splitter with visible markers + raw sidecar log
_hb_filter() {
  local width="${_HB_SPLIT_WIDTH}" mark_pfx="${_HB_MARK_PREFIX}" mark_sfx="${_HB_MARK_SUFFIX}"
  local b64_head="${_HB_B64_HEADER}" b64_tail="${_HB_B64_TAIL}" logf="${_HB_LOG_FILE:-}" tmpdir="/tmp"
  LC_ALL=C awk -v W="$width" -v LOGF="$logf" -v PFX="$mark_pfx" -v SFX="$mark_sfx" \
               -v B64H="$b64_head" -v B64T="$b64_tail" -v TMPDIR="$tmpdir" '
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
      # binary path: dump to temp, then base64 with header
      blob = TMPDIR "/hb.bin." PROCINFO["pid"] "." srand()
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
  '
}

# ── global FD hijack (per-process; always on)
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
_hb_enable_guard

# ── PTY trampoline (parent side: coproc + fixed FDs 9/8 to children)
_hb_exec_under_pty() {
  if _hb_has script; then
    script -qfec "$(printf '%q ' "$@")" /dev/null
  elif _hb_has python3; then
    python3 - "$@" <<'PY'
import pty, sys, os
os._exit(pty.spawn(sys.argv[1:])[0])
PY
  elif _hb_has python; then
    python - "$@" <<'PY'
import pty, sys, os
os._exit(pty.spawn(sys.argv[1:])[0])
PY
  else
    "$@"
  fi
}

_hb_start_trampoline() {
  # One coprocess that receives NUL-separated argv records on its stdin
  # and returns NUL-terminated exit codes on its stdout.
  coproc HBTRAMP {
    set -euo pipefail
    while :; do
      # Read one record (NUL-separated fields, terminated by an empty field)
      args=()
      while IFS= read -r -d '' tok; do
        [[ -z "$tok" ]] && break
        args+=("$tok")
      done || exit 0
      [[ "${#args[@]}" -ge 1 ]] || continue
      real="${args[0]}"; unset 'args[0]'; args=("${args[@]}")
      # Exec under PTY and capture exit code
      if command -v script >/dev/null 2>&1 || command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1; then
        # shellcheck disable=SC2048,SC2086
        script -qfec "$(printf '%q ' "$real" ${args+${args[*]@Q}})" /dev/null 2>/dev/null || true
        code=$?
        if ! command -v script >/dev/null 2>&1; then
          # Fallback to Python pty if script is unavailable
          if command -v python3 >/dev/null 2>&1; then
            python3 - "$real" "${args[@]}" <<'PY'
import pty, sys, os
os._exit(pty.spawn(sys.argv[1:])[0])
PY
            code=$?
          elif command -v python >/dev/null 2>&1; then
            python - "$real" "${args[@]}" <<'PY'
import pty, sys, os
os._exit(pty.spawn(sys.argv[1:])[0])
PY
            code=$?
          fi
        fi
      else
        "$real" "${args[@]}"
        code=$?
      fi
      printf '%s\0' "$code"
    done
  }
  # Duplicate coproc FDs to fixed numbers inherited by children
  exec 9>&"${HBTRAMP[1]}"
  exec 8<"${HBTRAMP[0]}"
}

# ── forced PATH hijack via shim bin (per-process)
# Build symlinks for every executable on PATH; each symlink sends argv to FD 9,
# parent executes under PTY, then child reads exit code on FD 8.
_hb_build_shims() {
  _HB_SHIM_DIR="/tmp/hb_shims.$$"
  [[ -d "$_HB_SHIM_DIR" ]] || mkdir -p "$_HB_SHIM_DIR"

  _HB_SHIM_ENTRY="$_HB_SHIM_DIR/_hb-shim"
  cat >"$_HB_SHIM_ENTRY" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
self_dir="$(dirname "$0")"
name="$(basename "$0")"

# Resolve real target by scanning PATH but skipping the shim dir itself.
real=""
IFS=':' read -r -a parts <<< "${PATH:-}"
for d in "${parts[@]}"; do
  [[ -z "$d" || "$d" == "$self_dir" ]] && continue
  cand="$d/$name"
  if [[ -x "$cand" && ! -d "$cand" ]]; then real="$cand"; break; fi
done
if [[ -z "${real:-}" ]]; then
  printf 'hb-shim: unable to resolve real target for %q\n' "$name" >&2
  exit 127
fi

# Avoid recursion into ourselves or script(1)
case "$name" in _hb-shim|script) exec "$real" "$@";; esac

# Compose NUL-separated record: real, args..., then extra NUL as terminator.
{
  printf '%s\0' "$real"
  for arg in "$@"; do printf '%s\0' "$arg"; done
  printf '\0'
} >&9 2>/dev/null || { exec "$real" "$@"; }

# Wait for NUL-terminated exit code on FD 8, then exit with that code.
if IFS= read -r -d '' code <&8 2>/dev/null; then
  exit "${code:-0}"
else
  exec "$real" "$@"
fi
SH
  chmod 0755 "$_HB_SHIM_ENTRY"

  # Populate symlinks (non-recursive) for each executable currently on PATH.
  IFS=':' read -r -a dirs <<< "${PATH:-}"
  for d in "${dirs[@]}"; do
    [[ -z "$d" || "$d" == "$_HB_SHIM_DIR" || ! -d "$d" ]] && continue
    for f in "$d"/*; do
      [[ -e "$f" && -x "$f" && ! -d "$f" ]] || continue
      name="$(basename "$f")"
      [[ -e "$_HB_SHIM_DIR/$name" ]] && continue
      ln -s "$_HB_SHIM_ENTRY" "$_HB_SHIM_DIR/$name" 2>/dev/null || true
    done
  done

  # Place shim dir first on PATH; rehash.
  case ":$PATH:" in *":$_HB_SHIM_DIR:"*) ;; *) PATH="$_HB_SHIM_DIR:$PATH" ;; esac
  hash -r
}

# Start trampoline + shims once per process.
if [[ "${_HB_SHIMS_READY:-}" != "1" || "${_HB_SHIMS_PID:-}" != "$$" ]]; then
  _hb_start_trampoline
  _hb_build_shims
  _HB_SHIMS_READY=1; _HB_SHIMS_PID="$$"
fi

# ── hooks (no exports)
mkdir -p "$_HB_CFG_DIR"
cat > "$_HB_NONINT_HOOK" <<EOF
# >>> HYPEBRUT noninteractive hook (no-env) >>>
# shellcheck shell=bash source=/dev/null
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
printf "[HB] Bootstrap active. Guard=%db ShimDir=%s Log=%s | PATH[0]=%s\n" \
       "$_HB_SPLIT_WIDTH" "${_HB_SHIM_DIR:-<none>}" "${_HB_LOG_FILE:-<none>}" \
       "$(printf '%s' "$PATH" | awk -F: '{print $1}')" >&2
# RETURN trap restores shell opts; guard and shims persist for this process.
