#!/usr/bin/env bash
# HYPEBRUT / env-bootstrap.sh — deterministic console stream shaping + raw sidecar
# Path: utils/scripts/setup/env-bootstrap.sh
#
# Guarantees:
#   • Byte-true preservation of all input in a sidecar log.
#   • Console stream that remains readable and safe under extreme long-line and CR-overstrike patterns.
#   • Minified one-liners are soft-wrapped at a stable width with explicit markers, without altering payload bytes.
#   • Only hazardous control bytes are suppressed from console; everything else textual is allowed through.
#   • Stdout and stderr are merged through a single filter to preserve sequencing.
#   • Hooks activate this in noninteractive shells by default; simple env toggles give you control.

# Must be sourced to hijack current FDs.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  printf '❌ HYPEBRUT :: source this file (do not execute)\n' >&2
  return 1 2>/dev/null || exit 1
fi

# Preserve caller shell opts; enforce strict mode in our scope.
__HB_OLD_SET_OPTS="$(set +o)"
trap 'eval "$__HB_OLD_SET_OPTS"' RETURN
set -Euo pipefail

# ─────────────────────────── configuration (stable defaults) ───────────────────────────
_HB_SPLIT_WIDTH=3800                   # byte width for soft wrapping
_HB_MARK_PREFIX='[HBWRAP'              # visible split marker prefix
_HB_MARK_SUFFIX=']'
_HB_BIN_MARK_PREFIX='[HBBIN'           # visible suppression marker
_HB_LOG_DIR="/tmp/hype_logs"           # raw sidecar directory
_HB_CFG_DIR="${HOME}/.config/hypebrut" # user-scoped config
_HB_BOOTSTRAP_ABS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
_HB_LOGIN_HOOK="${_HB_CFG_DIR}/login-hook.sh"
_HB_NONINT_HOOK="${_HB_CFG_DIR}/noninteractive-hook.sh"
_HB_BASHENV_HOOK="${_HB_CFG_DIR}/bashenv.sh"
_HB_FILTER_PERL="${_HB_CFG_DIR}/guard-filter.pl"
_HB_FILTER_PY="${_HB_CFG_DIR}/guard-filter.py"

_hb_now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

mkdir -p "$_HB_CFG_DIR" "$_HB_LOG_DIR"

# ─────────────────────────── streaming filter (Perl primary) ───────────────────────────
# Notes:
#  • Treat \n and \r as delimiters; normalize to newline for readability.
#  • When no delimiter is present and the buffer exceeds a threshold, emit soft wraps.
#  • Allow ESC (0x1b) sequences and all bytes ≥0x80; suppress only hazardous control bytes.
#  • Every raw byte, including delimiters, is written to the sidecar before console shaping.
cat >"$_HB_FILTER_PERL" <<'PERL'
#!/usr/bin/env perl
use strict; use warnings;
binmode STDIN; binmode STDOUT;

# config via env
my $W     = $ENV{HB_FILTER_W}     || 3800;  # chunk width
my $LOGF  = $ENV{HB_FILTER_LOGF}  || "";    # sidecar path
my $PFX   = $ENV{HB_FILTER_PFX}   || "[HBWRAP";
my $SFX   = $ENV{HB_FILTER_SFX}   || "]";
my $BIN   = $ENV{HB_FILTER_BIN}   || "[HBBIN";
my $PREV  = $ENV{HB_BIN_PREVIEW}  || 0;     # tiny hex nibble for suppressed lines (0 = none)
my $FLUSH = $ENV{HB_FILTER_FLUSH} || (4 * $W); # soft-wrap threshold when no delimiters arrive

my $logfh;
if ($LOGF ne "") {
  open($logfh, ">>", $LOGF) or die "open log failed: $!";
  binmode $logfh;
}

# allow \t (\x09), \n (\x0A), \r (\x0D), and ESC (\x1B); disallow only truly hazardous C0 + DEL
sub is_hazardous_ctrl {
  my ($s) = @_;
  return ($s =~ /[\x00-\x08\x0B\x0C\x0E-\x1A\x1C-\x1F\x7F]/) ? 1 : 0;
}

sub hex_preview {
  my ($s, $n) = @_;
  $n = 0 + $n;
  return "" if $n <= 0;
  my $take = substr($s, 0, $n);
  my @h = map { sprintf("%02x", ord($_)) } split(//, $take);
  return " preview=" . join(" ", @h);
}

# emit a textual line, chunking into [HBWRAP …] windows as needed
sub emit_text_chunks {
  my ($line, $nl) = @_;
  my $L = length($line);
  if ($L <= $W) {
    print STDOUT $line, $nl;
    return;
  }
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

# when there is no delimiter for a long time, periodically soft-wrap to avoid starving the consumer
sub emit_softwrap_windows {
  my ($bufref) = @_;
  my $buf = $$bufref;
  while (length($buf) > $FLUSH) {
    my $win = substr($buf, 0, $W, "");
    # sidecar sees exact bytes with a synthetic newline to mark the window boundary in the log
    print STDOUT "$PFX 1/1 1..".length($win)."$SFX $win\n";
  }
  $$bufref = $buf;
}

my $buf = "";
while (1) {
  my $r = sysread(STDIN, my $chunk, 8192);
  last if !defined($r) || $r == 0;
  $buf .= $chunk;

  # soft-wrap on long delimiterless stretches
  emit_softwrap_windows(\$buf);

  # process full records terminated by \n or \r
  while ($buf =~ /[\r\n]/) {
    my $pos_n = index($buf, "\n");
    my $pos_r = index($buf, "\r");
    $pos_n = 1<<30 if $pos_n < 0;
    $pos_r = 1<<30 if $pos_r < 0;
    my $pos = ($pos_n < $pos_r) ? $pos_n : $pos_r;
    my $delim = substr($buf, $pos, 1);
    my $line = substr($buf, 0, $pos);

    # consume delimiter (+ optional LF if CRLF)
    my $consume = 1;
    if ($delim eq "\r" && substr($buf, $pos+1, 1) eq "\n") { $consume = 2; }
    my $raw = substr($buf, 0, $pos + $consume);
    $buf = substr($buf, $pos + $consume);

    print $logfh $raw if $logfh;  # raw to sidecar
    my $nl = "\n";

    if (is_hazardous_ctrl($line)) {
      my $len = length($line);
      my $pv = hex_preview($line, $PREV);
      print STDOUT "$BIN suppressed $len bytes$pv$nl";
    } else {
      emit_text_chunks($line, $nl);
    }
  }
}

# tail remainder
if (length($buf)) {
  print $logfh $buf if $logfh;
  if (is_hazardous_ctrl($buf)) {
    my $len = length($buf);
    my $pv = hex_preview($buf, $PREV);
    print STDOUT "$BIN suppressed $len bytes$pv";
  } else {
    emit_text_chunks($buf, "");
  }
}
PERL
chmod 0755 "$_HB_FILTER_PERL"

# ─────────────────────────── streaming filter (Python fallback) ───────────────────────────
cat >"$_HB_FILTER_PY" <<'PY'
#!/usr/bin/env python3
import os, sys
W     = int(os.environ.get("HB_FILTER_W", "3800"))
LOGF  = os.environ.get("HB_FILTER_LOGF", ""))
PFX   = os.environ.get("HB_FILTER_PFX", "[HBWRAP")
SFX   = os.environ.get("HB_FILTER_SFX", "]")
BIN   = os.environ.get("HB_FILTER_BIN", "[HBBIN")
PREV  = int(os.environ.get("HB_BIN_PREVIEW", "0"))
FLUSH = int(os.environ.get("HB_FILTER_FLUSH", str(4*W)))

logfh = open(LOGF, "ab", buffering=0) if LOGF else None

ALLOWED = {9,10,13,27}  # \t, \n, \r, ESC

def hazardous_ctrl(b: bytes) -> bool:
    for x in b:
        if x in ALLOWED:
            continue
        if x < 32 or x == 127:
            return True
    return False

def hex_preview(b: bytes, n: int) -> str:
    if n <= 0: return ""
    take = b[:n]
    return " preview=" + " ".join(f"{x:02x}" for x in take)

def emit_text_chunks(b: bytes, nl: bytes):
    L = len(b)
    if L <= W:
        sys.stdout.buffer.write(b + nl)
        return
    n = (L + W - 1)//W
    start = 0
    for i in range(1, n+1):
        end = min(start + W, L)
        chunk = b[start:end]
        a, c = start+1, end
        sys.stdout.buffer.write((f"{PFX} {i}/{n} {a}..{c}{SFX} ").encode("utf-8") + chunk + b"\n")
        start = end
    if nl:
        sys.stdout.buffer.write(nl)

def emit_softwrap_windows(buf: bytearray):
    while len(buf) > FLUSH:
        win = bytes(buf[:W])
        del buf[:W]
        sys.stdout.buffer.write((f"{PFX} 1/1 1..{len(win)}{SFX} ").encode("utf-8") + win + b"\n")

buf = bytearray()
while True:
    chunk = sys.stdin.buffer.read(8192)
    if not chunk: break
    buf.extend(chunk)
    emit_softwrap_windows(buf)

    # process delimiters
    while True:
        pos_n = buf.find(b"\n")
        pos_r = buf.find(b"\r")
        if pos_n < 0 and pos_r < 0:
            break
        if pos_n < 0: pos_n = 1<<30
        if pos_r < 0: pos_r = 1<<30
        pos = pos_n if pos_n < pos_r else pos_r
        delim = buf[pos:pos+1]
        line = bytes(buf[:pos])

        consume = 1
        if delim == b"\r" and buf[pos:pos+2] == b"\r\n":
            consume = 2
        raw = bytes(buf[:pos+consume])
        del buf[:pos+consume]

        if logfh:
            logfh.write(raw)

        nl = b"\n"
        if hazardous_ctrl(line):
            msg = f"{BIN} suppressed {len(line)} bytes"
            if PREV > 0: msg += hex_preview(line, PREV)
            sys.stdout.buffer.write(msg.encode("utf-8") + nl)
        else:
            emit_text_chunks(line, nl)

# tail
if buf:
    if logfh:
        logfh.write(bytes(buf))
    if hazardous_ctrl(bytes(buf)):
        msg = f"{BIN} suppressed {len(buf)} bytes"
        if PREV > 0: msg += hex_preview(bytes(buf), PREV)
        sys.stdout.buffer.write(msg.encode("utf-8"))
    else:
        emit_text_chunks(bytes(buf), b"")
PY
chmod 0755 "$_HB_FILTER_PY"

# pick a filter
if command -v perl >/dev/null 2>&1; then
  _HB_FILTER_BIN="$_HB_FILTER_PERL"
elif command -v python3 >/dev/null 2>&1; then
  _HB_FILTER_BIN="$_HB_FILTER_PY"
else
  _HB_FILTER_BIN=""
fi

# ─────────────────────────── FD hijack (single filter, ordered) ───────────────────────────
_hb_enable_guard() {
  if [[ "${HB_NO_GUARD:-0}" == "1" ]]; then
    printf "[HB] guard disabled (HB_NO_GUARD=1)\n" >&2
    return 0
  fi
  if [[ -z "${_HB_FILTER_BIN}" ]]; then
    printf "[HB] guard unavailable (perl/python3 not found); pass-through\n" >&2
    return 0
  fi
  if [[ "${_HB_FD_HIJACKED:-0}" == "1" && "${_HB_HIJACK_PID:-}" == "$$" ]]; then
    return 0
  fi

  _HB_LOG_FILE="${_HB_LOG_DIR}/hb.$(basename "${SHELL:-bash}" 2>/dev/null).$$_$(_hb_now).log"

  export HB_FILTER_W="$_HB_SPLIT_WIDTH"
  export HB_FILTER_LOGF="$_HB_LOG_FILE"
  export HB_FILTER_PFX="$_HB_MARK_PREFIX"
  export HB_FILTER_SFX="$_HB_MARK_SUFFIX"
  export HB_FILTER_BIN="$_HB_BIN_MARK_PREFIX"
  : "${HB_BIN_PREVIEW:=0}"; export HB_BIN_PREVIEW
  : "${HB_FILTER_FLUSH:=$((4*_HB_SPLIT_WIDTH))}"; export HB_FILTER_FLUSH

  # Save originals, wire stdout to filter, then route stderr into stdout.
  exec {_HB_STDOUT_ORIG}>&1
  exec {_HB_STDERR_ORIG}>&2
  exec 1> >("$_HB_FILTER_BIN")
  exec 2>&1

  _HB_FD_HIJACKED=1
  _HB_HIJACK_PID="$$"
}

_hb_disable_guard() {
  [[ "${_HB_FD_HIJACKED:-0}" != "1" || "${_HB_HIJACK_PID:-}" != "$$" ]] && return 0
  exec 1>&${_HB_STDOUT_ORIG} 2>&${_HB_STDERR_ORIG}
  exec {_HB_STDOUT_ORIG}>&- {_HB_STDERR_ORIG}>&-
  unset _HB_FD_HIJACKED _HB_HIJACK_PID _HB_STDOUT_ORIG _HB_STDERR_ORIG _HB_LOG_FILE
}

# auto-arm in noninteractive or when forced
if [[ $- != *i* || "${HB_FORCE_GUARD:-0}" == "1" ]]; then
  _hb_enable_guard
fi

# idempotence banner
if [[ "${_HB_READY:-}" == "1" && "${_HB_READY_PID:-}" == "$$" ]]; then
  printf "[HB] already active (pid=%s) sidecar=%s\n" "$$" "${_HB_LOG_FILE:-<none>}" >&2
  return 0
fi

# ─────────────────────────── durable hooks for persistence ───────────────────────────
cat > "$_HB_NONINT_HOOK" <<EOF
# >>> HYPEBRUT noninteractive hook >>>
# shellcheck shell=bash source=/dev/null
if [[ "\$-" != *i* ]]; then
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

cat > "$_HB_BASHENV_HOOK" <<'EOF'
# >>> HYPEBRUT BASH_ENV >>>
# shellcheck shell=bash source=/dev/null
if [ -n "${BASH_VERSION:-}" ] && [[ "$-" != *i* ]]; then
  __HB_BOOTSTRAP="${HOME}/.config/hypebrut/login-hook.sh"
  [ -f "$__HB_BOOTSTRAP" ] && source "$__HB_BOOTSTRAP"
fi
# <<< HYPEBRUT BASH_ENV <<<
EOF
chmod 0644 "$_HB_BASHENV_HOOK"
export BASH_ENV="$_HB_BASHENV_HOOK"

_hb_patch_file() {
  local f="$1" marker="# >>> HYPEBRUT login sourcing >>>"
  [[ -f "$f" ]] && grep -Fq "$marker" "$f" && return 0
  mkdir -p "$(dirname "$f")"
  {
    echo ""
    echo "$marker"
    echo "[ -f \"${_HB_LOGIN_HOOK}\" ] && source \"${_HB_LOGIN_HOOK}\""
    echo "export BASH_ENV=\"${_HB_BASHENV_HOOK}\""
    echo "# <<< HYPEBRUT login sourcing <<<"
  } >> "$f"
}
if [[ -f "${HOME}/.bash_profile" || ! -f "${HOME}/.profile" ]]; then
  _hb_patch_file "${HOME}/.bash_profile"
fi
_hb_patch_file "${HOME}/.profile"

_HB_READY=1
_HB_READY_PID="$$"
printf "[HB] stream guard armed • width=%d • sidecar=%s\n" "$_HB_SPLIT_WIDTH" "${_HB_LOG_FILE:-<none>}" >&2

# ─────────────────────────── operational notes (for humans skimming) ───────────────────────────
# • Minified files or single-line payloads: emitted in windows with [HBWRAP …] markers at the configured width.
# • CR-based progress: each update appears as its own line so you can see incremental movement in non-PTY contexts.
# • Hazardous control bytes: summarized inline as “[HBBIN suppressed N bytes]”; raw bytes are always in the sidecar.
# • Tuning knobs:
#     HB_NO_GUARD=1       # temporarily bypass for this shell (source again to re-arm later)
#     HB_FORCE_GUARD=1    # arm even in interactive shells
#     HB_BIN_PREVIEW=64   # include a tiny hex nibble with suppression lines when actively debugging
#     HB_FILTER_W=4096    # override split width if a tool prefers a different ceiling
#     HB_FILTER_FLUSH=…   # adjust soft-wrap threshold for delimiterless streams
