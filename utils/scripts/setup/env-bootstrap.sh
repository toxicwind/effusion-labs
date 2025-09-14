#!/usr/bin/env bash
# Stream guard bootstrap enforcing 3500-byte windowing
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  printf '# HB guard: source this file (do not execute)\n' >&2
  return 1 2>/dev/null || exit 1
fi
__HB_OLD_SET_OPTS="$(set +o)"; trap 'eval "$__HB_OLD_SET_OPTS"' RETURN; set -Euo pipefail
: "${HB_LLM_MODE:=1}"; : "${HB_FORCE_GUARD:=0}"; : "${HB_NO_GUARD:=0}"
: "${HB_FILTER_W:=3500}"; : "${HB_FILTER_FLUSH:=$((4*HB_FILTER_W))}"
: "${HB_FILTER_PFX:="[HBWRAP"}"; : "${HB_FILTER_SFX:="]"}"; : "${HB_FILTER_BIN:="[HBBIN"}"
_HB_LOG_DIR="${HB_LOG_DIR:-/tmp/hype_logs}"
mkdir -p "$_HB_LOG_DIR"
_HB_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_HB_FILTER_PERL="${_HB_SCRIPT_DIR}/filters/hb-filter.pl"
_HB_FILTER_PY="${_HB_SCRIPT_DIR}/filters/hb-filter.py"
_hb_now(){ date -u +"%Y-%m-%dT%H:%M:%SZ"; }
if command -v perl >/dev/null 2>&1; then _HB_FILTER_BIN="$_HB_FILTER_PERL"
elif command -v python3 >/dev/null 2>&1; then _HB_FILTER_BIN="$_HB_FILTER_PY"
else _HB_FILTER_BIN=""; fi
_hb_enable_guard(){
  [[ "${HB_NO_GUARD}" == "1" ]] && return 0
  [[ -z "${_HB_FILTER_BIN}" ]] && return 0
  if [[ "${_HB_FD_HIJACKED:-0}" == "1" && "${_HB_HIJACK_PID:-}" == "$$" ]]; then
    printf '# HB guard: already armed (PID=%s)\n' "$$" >&2
    return 0
  fi
  _HB_TMP_DIR="$(mktemp -d "/tmp/hb.$$.$(date +%s).XXXX")"
  _HB_FIFO_OUT="${_HB_TMP_DIR}/out.fifo"; _HB_FIFO_ERR="${_HB_TMP_DIR}/err.fifo"
  mkfifo -m 600 "$_HB_FIFO_OUT" "$_HB_FIFO_ERR"
  exec {_HB_STDOUT_ORIG}>&1; exec {_HB_STDERR_ORIG}>&2
  _HB_LOG_OUT="${_HB_LOG_DIR}/hb.out.$$_$(_hb_now).log"
  _HB_LOG_ERR="${_HB_LOG_DIR}/hb.err.$$_$(_hb_now).log"
  export HB_FILTER_W HB_FILTER_FLUSH HB_FILTER_PFX HB_FILTER_SFX HB_FILTER_BIN
  HB_FILTER_LOGF="$_HB_LOG_OUT" "$_HB_FILTER_BIN" < "$_HB_FIFO_OUT" >&${_HB_STDOUT_ORIG} &
  _HB_FILTER_OUT_PID=$!
  HB_FILTER_LOGF="$_HB_LOG_ERR" "$_HB_FILTER_BIN" < "$_HB_FIFO_ERR" >&${_HB_STDERR_ORIG} &
  _HB_FILTER_ERR_PID=$!
  exec 1>"$_HB_FIFO_OUT"; exec 2>"$_HB_FIFO_ERR"
  _HB_FD_HIJACKED=1; _HB_HIJACK_PID="$$"
  printf '# HB guard: armed • width=%s • sidecar(out)=%s • sidecar(err)=%s\n' "$HB_FILTER_W" "$_HB_LOG_OUT" "$_HB_LOG_ERR" >&2
  trap _hb_disarm_on_exit EXIT
}
_hb_disarm_on_exit(){
  [[ "${_HB_FD_HIJACKED:-0}" != "1" || "${_HB_HIJACK_PID:-}" != "$$" ]] && return 0
  exec 1>&${_HB_STDOUT_ORIG} 2>&${_HB_STDERR_ORIG}
  exec {_HB_STDOUT_ORIG}>&- {_HB_STDERR_ORIG}>&-
  [[ -n "${_HB_FILTER_OUT_PID:-}" ]] && kill -TERM "${_HB_FILTER_OUT_PID}" 2>/dev/null || true
  [[ -n "${_HB_FILTER_ERR_PID:-}" ]] && kill -TERM "${_HB_FILTER_ERR_PID}" 2>/dev/null || true
  [[ -n "${_HB_FIFO_OUT:-}" && -p "${_HB_FIFO_OUT}" ]] && rm -f "${_HB_FIFO_OUT}"
  [[ -n "${_HB_FIFO_ERR:-}" && -p "${_HB_FIFO_ERR}" ]] && rm -f "${_HB_FIFO_ERR}"
  [[ -n "${_HB_TMP_DIR:-}" && -d "${_HB_TMP_DIR}" ]] && rmdir "${_HB_TMP_DIR}" 2>/dev/null || true
  unset _HB_FD_HIJACKED _HB_HIJACK_PID _HB_FILTER_OUT_PID _HB_FILTER_ERR_PID _HB_STDOUT_ORIG _HB_STDERR_ORIG _HB_FIFO_OUT _HB_FIFO_ERR _HB_TMP_DIR
  printf '# HB guard: disarmed\n' >&2
}

auto_hb_status(){
  if [[ "${_HB_FD_HIJACKED:-0}" == "1" && "${_HB_HIJACK_PID:-}" == "$$" ]]; then
    printf '# HB guard: active • out=%s • err=%s • width=%s\n' "${_HB_LOG_OUT:-?}" "${_HB_LOG_ERR:-?}" "${HB_FILTER_W}"
  else
    printf '# HB guard: inactive\n'
  fi
}
hb_disarm(){ _hb_disarm_on_exit; }
hb_status(){ auto_hb_status; }
hb_run(){
  local -a cmd=("$@")
  if command -v script >/dev/null 2>&1; then script -q -e -c "$(printf '%q ' "${cmd[@]}")" /dev/null
  elif command -v unbuffer >/dev/null 2>&1; then unbuffer "${cmd[@]}"
  elif command -v expect >/dev/null 2>&1; then expect -c "spawn -noecho $(printf '%q ' "${cmd[@]}"); interact"
  elif command -v stdbuf >/dev/null 2>&1; then stdbuf -oL -eL "${cmd[@]}"
  else "${cmd[@]}"; fi
}
if [[ "${HB_NO_GUARD}" != "1" ]]; then
  if [[ $- != *i* || "${HB_FORCE_GUARD}" == "1" ]]; then _hb_enable_guard; fi
fi
