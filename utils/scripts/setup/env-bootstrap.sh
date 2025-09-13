#!/usr/bin/env bash
# HYPEBRUT / env-bootstrap.sh \u2014 LLM-safe stream guard (separate stdout/stderr filters via FIFOs)
# Path: utils/scripts/setup/env-bootstrap.sh

# Sourcing is mandatory (we must hijack *current* FDs).
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  printf '# HB guard: source this file (do not execute)\n' >&2
  return 1 2>/dev/null || exit 1
fi

# Preserve caller shell flags; strict within our scope.
__HB_OLD_SET_OPTS="$(set +o)"
trap 'eval "$__HB_OLD_SET_OPTS"' RETURN
set -Euo pipefail

# \u2500\u2500 defaults tuned for LLM sessions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# LLM mode: no automatic login/BASH_ENV hooks, no noisy banners, per-process only.
: "${HB_LLM_MODE:=1}"
: "${HB_FORCE_GUARD:=0}"         # arm in interactive shells when set to 1
: "${HB_NO_GUARD:=0}"            # hard opt-out

# Soft-wrap width and soft-flush threshold for delimiterless runs.
: "${HB_FILTER_W:=3800}"
: "${HB_FILTER_FLUSH:=$((4*HB_FILTER_W))}"

# Visual markers (ASCII only).
: "${HB_FILTER_PFX:="[HBWRAP"}"
: "${HB_FILTER_SFX:="]"}"
: "${HB_FILTER_BIN:="[HBBIN"}"

# Paths.
_HB_CFG_DIR="${HOME}/.config/hypebrut"
_HB_LOG_DIR="${HB_LOG_DIR:-/tmp/hype_logs}"
_HB_BOOTSTRAP_ABS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"

# Artifacts installed under config dir.
_HB_FILTER_PERL="${_HB_CFG_DIR}/guard-filter.pl"
_HB_FILTER_PY="${_HB_CFG_DIR}/guard-filter.py"

_hb_now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

mkdir -p "$_HB_CFG_DIR" "$_HB_LOG_DIR"

# \u2500\u2500 streaming filter (Perl primary) \u2014 ANSI/UTF-8 safe, chunk long lines, suppress hazardous C0/DEL only \u2500\u2500
cat >"$_HB_FILTER_PERL" <<'PERL'
#!/usr/bin/env perl
use strict; use warnings;
binmode STDIN; binmode STDOUT;

my $W     = $ENV{HB_FILTER_W}     || 3800;
my $LOGF  = $ENV{HB_FILTER_LOGF}  || "";
my $PFX   = $ENV{HB_FILTER_PFX}   || "[HBWRAP";
my $SFX   = $ENV{HB_FILTER_SFX}   || "]";
my $BIN   = $ENV{HB_FILTER_BIN}   || "[HBBIN";
my $FLUSH = $ENV{HB_FILTER_FLUSH} || (4 * $W);

my $logfh;
if ($LOGF ne "") { open($logfh, ">>", $LOGF) or die "open log failed: $!"; binmode $logfh; }

sub bad_ctrl { my($s)=@_; return ($s =~ /[\x00-\x08\x0B\x0C\x0E-\x1A\x1C-\x1F\x7F]/) ? 1 : 0; }

sub emit_chunks {
  my ($line, $nl) = @_;
  my $L = length($line);
  if ($L <= $W) { print STDOUT $line, $nl; return; }
  my $n = int(($L + $W - 1)/$W);
  my $start = 0;
  for (my $i=1; $i<=$n; $i++) {
    my $end = $start + $W; $end = $L if $end > $L;
    my $chunk = substr($line, $start, $end-$start);
    my $a = $start + 1; my $b = $end;
    print STDOUT "$PFX $i/$n $a..$b$SFX $chunk\n";
    $start = $end;
  }
  print STDOUT $nl if $nl ne "";
}

sub softflush {
  my ($bufref) = @_;
  my $buf = $$bufref;
  while (length($buf) > $FLUSH) {
    my $win = substr($buf, 0, $W, "");
    print STDOUT "$PFX 1/1 1..".length($win)."$SFX $win\n";
  }
  $$bufref = $buf;
}

my $buf = "";
while (1) {
  my $r = sysread(STDIN, my $chunk, 8192);
  last if !defined($r) || $r == 0;
  $buf .= $chunk;

  softflush(\$buf);

  while ($buf =~ /[\r\n]/) {
    my $pn = index($buf, "\n"); $pn = 1<<30 if $pn < 0;
    my $pr = index($buf, "\r"); $pr = 1<<30 if $pr < 0;
    my $pos = ($pn < $pr) ? $pn : $pr;
    my $delim = substr($buf, $pos, 1);
    my $line = substr($buf, 0, $pos);

    my $take = 1;
    if ($delim eq "\r" && substr($buf, $pos+1, 1) eq "\n") { $take = 2; }
    my $raw = substr($buf, 0, $pos + $take);
    $buf = substr($buf, $pos + $take);

    print $logfh $raw if $logfh;
    my $nl = "\n";
    if (bad_ctrl($line)) { print STDOUT "$BIN suppressed ".length($line)." bytes$nl"; }
    else { emit_chunks($line, $nl); }
  }
}

if (length($buf)) {
  print $logfh $buf if $logfh;
  if (bad_ctrl($buf)) { print STDOUT "$BIN suppressed ".length($buf)." bytes"; }
  else { emit_chunks($buf, ""); }
}
PERL
chmod 0755 "$_HB_FILTER_PERL"

# \u2500\u2500 streaming filter (Python fallback) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
cat >"$_HB_FILTER_PY" <<'PY'
#!/usr/bin/env python3
import os, sys
W     = int(os.environ.get("HB_FILTER_W", "3800"))
LOGF  = os.environ.get("HB_FILTER_LOGF", "")
PFX   = os.environ.get("HB_FILTER_PFX", "[HBWRAP")
SFX   = os.environ.get("HB_FILTER_SFX", "]")
BIN   = os.environ.get("HB_FILTER_BIN", "[HBBIN")
FLUSH = int(os.environ.get("HB_FILTER_FLUSH", str(4*W)))
logfh = open(LOGF, "ab", buffering=0) if LOGF else None

ALLOWED = {9,10,13,27}
def bad_ctrl(b: bytes) -> bool:
    for x in b:
        if x in ALLOWED: continue
        if x < 32 or x == 127: return True
    return False

def emit_chunks(b: bytes, nl: bytes):
    L = len(b)
    if L <= W:
        sys.stdout.buffer.write(b + nl); return
    n = (L + W - 1)//W; start = 0
    for i in range(1, n+1):
        end = min(start + W, L)
        chunk = b[start:end]; a, c = start+1, end
        sys.stdout.buffer.write((f"{PFX} {i}/{n} {a}..{c}{SFX} ").encode("utf-8") + chunk + b"\n")
        start = end
    if nl: sys.stdout.buffer.write(nl)

def softflush(buf: bytearray):
    while len(buf) > FLUSH:
        win = bytes(buf[:W]); del buf[:W]
        sys.stdout.buffer.write((f"{PFX} 1/1 1..{len(win)}{SFX} ").encode("utf-8") + win + b"\n")

buf = bytearray()
while True:
    chunk = sys.stdin.buffer.read(8192)
    if not chunk: break
    buf.extend(chunk)
    softflush(buf)
    while True:
        pn = buf.find(b"\n"); pr = buf.find(b"\r")
        if pn < 0 and pr < 0: break
        if pn < 0: pn = 1<<30
        if pr < 0: pr = 1<<30
        pos = pn if pn < pr else pr
        delim = buf[pos:pos+1]
        line = bytes(buf[:pos])
        take = 1
        if delim == b"\r" and buf[pos:pos+2] == b"\r\n": take = 2
        raw = bytes(buf[:pos+take]); del buf[:pos+take]
        if logfh: logfh.write(raw)
        if bad_ctrl(line): sys.stdout.buffer.write((f"{BIN} suppressed {len(line)} bytes\n").encode("utf-8"))
        else: emit_chunks(line, b"\n")
if buf:
    if logfh: logfh.write(bytes(buf))
    if bad_ctrl(bytes(buf)): sys.stdout.buffer.write((f"{BIN} suppressed {len(buf)} bytes").encode("utf-8"))
    else: emit_chunks(bytes(buf), b"")
PY
chmod 0755 "$_HB_FILTER_PY"

# Select filter runtime.
if command -v perl >/dev/null 2>&1; then _HB_FILTER_BIN="$_HB_FILTER_PERL"
elif command -v python3 >/dev/null 2>&1; then _HB_FILTER_BIN="$_HB_FILTER_PY"
else _HB_FILTER_BIN=""
fi

# \u2500\u2500 core: arm/disarm using FIFOs; no process substitution; one filter per stream \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
_hb_enable_guard() {
  [[ "${HB_NO_GUARD}" == "1" ]] && return 0
  [[ -z "${_HB_FILTER_BIN}" ]] && return 0

  # Only if this PID hasn't already armed.
  if [[ "${_HB_FD_HIJACKED:-0}" == "1" && "${_HB_HIJACK_PID:-}" == "$$" ]]; then
    return 0
  fi

  # Create per-PID workspace and FIFOs.
  _HB_TMP_DIR="$(mktemp -d "/tmp/hb.$$.$(date +%s).XXXX")"
  _HB_FIFO_OUT="${_HB_TMP_DIR}/out.fifo"
  _HB_FIFO_ERR="${_HB_TMP_DIR}/err.fifo"
  mkfifo -m 600 "$_HB_FIFO_OUT" "$_HB_FIFO_ERR"

  # Save real FDs.
  exec {_HB_STDOUT_ORIG}>&1
  exec {_HB_STDERR_ORIG}>&2

  # Logs per stream.
  _HB_LOG_OUT="${_HB_LOG_DIR}/hb.out.$$_$(_hb_now).log"
  _HB_LOG_ERR="${_HB_LOG_DIR}/hb.err.$$_$(_hb_now).log"

  # Export filter config for children.
  export HB_FILTER_W HB_FILTER_FLUSH HB_FILTER_PFX HB_FILTER_SFX HB_FILTER_BIN

  # Start filters wired to original FDs, not the hijacked ones.
  HB_FILTER_LOGF="$_HB_LOG_OUT" "$_HB_FILTER_BIN" < "$_HB_FIFO_OUT" >&${_HB_STDOUT_ORIG} &
  _HB_FILTER_OUT_PID=$!
  HB_FILTER_LOGF="$_HB_LOG_ERR" "$_HB_FILTER_BIN" < "$_HB_FIFO_ERR" >&${_HB_STDERR_ORIG} &
  _HB_FILTER_ERR_PID=$!

  # Route this shell\u2019s stdout/stderr into FIFOs.
  exec 1>"$_HB_FIFO_OUT"
  exec 2>"$_HB_FIFO_ERR"

  _HB_FD_HIJACKED=1
  _HB_HIJACK_PID="$$"

  # Comment-safe banner on stderr only, and only once armed.
  printf '# HB guard: armed \u2022 width=%s \u2022 sidecar(out)=%s \u2022 sidecar(err)=%s\n' \
         "$HB_FILTER_W" "$_HB_LOG_OUT" "$_HB_LOG_ERR" >&2

  # Auto-clean on shell exit.
  trap _hb_disarm_on_exit EXIT
}

_hb_disarm_on_exit() {
  # If already disarmed, nothing to do.
  [[ "${_HB_FD_HIJACKED:-0}" != "1" || "${_HB_HIJACK_PID:-}" != "$$" ]] && return 0

  # Restore FDs.
  exec 1>&${_HB_STDOUT_ORIG} 2>&${_HB_STDERR_ORIG}
  exec {_HB_STDOUT_ORIG}>&- {_HB_STDERR_ORIG}>&-

  # Stop filters and remove FIFOs/dir.
  [[ -n "${_HB_FILTER_OUT_PID:-}" ]] && kill -TERM "${_HB_FILTER_OUT_PID}" 2>/dev/null || true
  [[ -n "${_HB_FILTER_ERR_PID:-}" ]] && kill -TERM "${_HB_FILTER_ERR_PID}" 2>/dev/null || true
  [[ -n "${_HB_FIFO_OUT:-}" && -p "${_HB_FIFO_OUT}" ]] && rm -f "${_HB_FIFO_OUT}"
  [[ -n "${_HB_FIFO_ERR:-}" && -p "${_HB_FIFO_ERR}" ]] && rm -f "${_HB_FIFO_ERR}"
  [[ -n "${_HB_TMP_DIR:-}" && -d "${_HB_TMP_DIR}" ]] && rmdir "${_HB_TMP_DIR}" 2>/dev/null || true

  unset _HB_FD_HIJACKED _HB_HIJACK_PID _HB_FILTER_OUT_PID _HB_FILTER_ERR_PID
  unset _HB_STDOUT_ORIG _HB_STDERR_ORIG _HB_FIFO_OUT _HB_FIFO_ERR _HB_TMP_DIR
  printf '# HB guard: disarmed\n' >&2
}

# Public disarm helper (manual).
hb_disarm() { _hb_disarm_on_exit; }

# Status (comment-safe).
hb_status() {
  if [[ "${_HB_FD_HIJACKED:-0}" == "1" && "${_HB_HIJACK_PID:-}" == "$$" ]]; then
    printf '# HB guard: active \u2022 out=%s \u2022 err=%s \u2022 width=%s\n' "${_HB_LOG_OUT:-?}" "${_HB_LOG_ERR:-?}" "${HB_FILTER_W}"
  else
    printf '# HB guard: inactive\n'
  fi
}

# Burst-friendly runner that inherits the guard.
hb_run() {
  # usage: hb_run <cmd> [args...]
  local -a cmd=( "$@" )
  if command -v script >/dev/null 2>&1; then
    script -q -e -c "$(printf '%q ' "${cmd[@]}")" /dev/null
  elif command -v unbuffer >/dev/null 2>&1; then
    unbuffer "${cmd[@]}"
  elif command -v expect >/dev/null 2>&1; then
    expect -c "spawn -noecho $(printf '%q ' "${cmd[@]}"); interact"
  elif command -v stdbuf >/dev/null 2>&1; then
    stdbuf -oL -eL "${cmd[@]}"
  else
    "${cmd[@]}"
  fi
}

# \u2500\u2500 hooks (disabled by default in LLM mode) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# Explicit helpers if you want persistent hooks *outside* LLM sessions.
hb_install_hooks() {
  [[ "${HB_LLM_MODE}" == "1" ]] && { printf '# HB hooks: skipped (HB_LLM_MODE=1)\n' >&2; return 0; }
  local login="${HOME}/.bash_profile" profile="${HOME}/.profile"
  local marker="# >>> HYPEBRUT login sourcing >>>"
  local bashenv="${_HB_CFG_DIR}/bashenv.sh"
  cat > "$bashenv" <<'EOF'
# >>> HYPEBRUT BASH_ENV >>>
# shellcheck shell=bash source=/dev/null
if [ -n "${BASH_VERSION:-}" ] && [[ "$-" != *i* ]]; then
  __HB_BOOTSTRAP="${HOME}/.config/hypebrut/login-hook.sh"
  [ -f "$__HB_BOOTSTRAP" ] && source "$__HB_BOOTSTRAP"
fi
# <<< HYPEBRUT BASH_ENV <<<
EOF
  chmod 0644 "$bashenv"
  echo -e "\n$marker\n[ -f \"${_HB_CFG_DIR}/login-hook.sh\" ] && source \"${_HB_CFG_DIR}/login-hook.sh\"\nexport BASH_ENV=\"${bashenv}\"\n# <<< HYPEBRUT login sourcing <<<" >> "$profile"
  [[ -f "$login" || ! -f "$profile" ]] && echo -e "\n$marker\n[ -f \"${_HB_CFG_DIR}/login-hook.sh\" ] && source \"${_HB_CFG_DIR}/login-hook.sh\"\nexport BASH_ENV=\"${bashenv}\"\n# <<< HYPEBRUT login sourcing <<<" >> "$login"
  cat > "${_HB_CFG_DIR}/noninteractive-hook.sh" <<EOF
# >>> HYPEBRUT noninteractive hook >>>
# shellcheck shell=bash source=/dev/null
if [[ "\$-" != *i* ]]; then source "${_HB_BOOTSTRAP_ABS}" --as-hook; fi
# <<< HYPEBRUT noninteractive hook <<<
EOF
  chmod 0644 "${_HB_CFG_DIR}/noninteractive-hook.sh"
  cat > "${_HB_CFG_DIR}/login-hook.sh" <<EOF
# >>> HYPEBRUT login hook >>>
# shellcheck shell=bash source=/dev/null
[ -f "${_HB_CFG_DIR}/noninteractive-hook.sh" ] && source "${_HB_CFG_DIR}/noninteractive-hook.sh"
# <<< HYPEBRUT login hook <<<
EOF
  chmod 0644 "${_HB_CFG_DIR}/login-hook.sh"
  printf '# HB hooks: installed\n' >&2
}

hb_uninstall_hooks() {
  rm -f "${_HB_CFG_DIR}/bashenv.sh" "${_HB_CFG_DIR}/login-hook.sh" "${_HB_CFG_DIR}/noninteractive-hook.sh" 2>/dev/null || true
  printf '# HB hooks: removed\n' >&2
}

# \u2500\u2500 arming policy \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
# Non-interactive shells auto-arm; interactive require HB_FORCE_GUARD=1.
if [[ "${HB_NO_GUARD}" != "1" ]]; then
  if [[ $- != *i* || "${HB_FORCE_GUARD}" == "1" ]]; then
    _hb_enable_guard
  fi
fi
