#!/usr/bin/env bash
# scripts/araca/hb-guard-fix.sh — analyzer + patcher + TDD runner for HYPEBRUT console guard
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BOOT="${ROOT}/utils/scripts/setup/env-bootstrap.sh"
BACKUP_DIR="${ROOT}/var/hb_guard_backups"
SUMMARY="${ROOT}/var/hb_guard_summary.json"
mkdir -p "${ROOT}/var" "${BACKUP_DIR}" "${ROOT}/bin" "${ROOT}/test/hb_guard"

timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
exists() { command -v "$1" >/dev/null 2>&1; }

log() { printf "[hb-guard] %s\n" "$*" >&2; }

case "${1:-}" in
  analyze)
    # Discover host traits without changing global state.
    OS="$(uname -s || echo unknown)"
    IN_CONTAINER="$([[ -f /.dockerenv || -f /run/.containerenv ]] && echo 1 || echo 0)"
    HAS_TTY="$([[ -t 1 ]] && echo 1 || echo 0)"
    HAS_PERL="$([[ $(exists perl; echo $?) -eq 0 ]] && echo 1 || echo 0)"
    HAS_PY3="$([[ $(exists python3; echo $?) -eq 0 ]] && echo 1 || echo 0)"
    HAS_FIFO="$([[ -n "$(command -v mkfifo || true)" ]] && echo 1 || echo 0)"
    HAS_SCRIPTPTY="$([[ $(exists script; echo $?) -eq 0 ]] && echo 1 || echo 0)"
    HAS_UNBUFFER="$([[ $(exists unbuffer; echo $?) -eq 0 ]] && echo 1 || echo 0)"
    HAS_STDBUF="$([[ $(exists stdbuf; echo $?) -eq 0 ]] && echo 1 || echo 0)"

    # We assume LLM session unless proven otherwise; it’s safer.
    LLM_MODE="${HB_LLM_MODE:-1}"

    STRATEGY="fifo"
    [[ "${HAS_FIFO}" = "0" ]] && STRATEGY="subproc"
    [[ "${HAS_PERL}" = "1" || "${HAS_PY3}" = "1" ]] || STRATEGY="noop"

    jq -n --arg os "$OS" \
          --argjson in_container "${IN_CONTAINER}" \
          --argjson tty "${HAS_TTY}" \
          --argjson perl "${HAS_PERL}" \
          --argjson py3 "${HAS_PY3}" \
          --argjson fifo "${HAS_FIFO}" \
          --argjson scriptpty "${HAS_SCRIPTPTY}" \
          --argjson unbuffer "${HAS_UNBUFFER}" \
          --argjson stdbuf "${HAS_STDBUF}" \
          --arg strat "$STRATEGY" \
          --argjson llm "${LLM_MODE}" \
          --arg now "$(timestamp)" '{os:$os,in_container:$in_container,tty:$tty,perl:$perl,py3:$py3,fifo:$fifo,script:$scriptpty,unbuffer:$unbuffer,stdbuf:$stdbuf,strategy:$strat,llm:$llm,t:$now}' \
          > "${SUMMARY}"
    log "analysis → ${SUMMARY}"
    ;;

  patch)
    [[ -f "${BOOT}" ]] && cp -a "${BOOT}" "${BACKUP_DIR}/env-bootstrap.sh.$(timestamp)"
    # Install the LLM-safe FIFO-based guard (below).
    install -m 0755 /dev/stdin "${BOOT}" <<'BOOTSTRAP_EOF'
#!/usr/bin/env bash
# HYPEBRUT / env-bootstrap.sh — LLM-safe stream guard (FIFO filters, per-process, no recursion)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  printf '# HB guard: source this file (do not execute)\n' >&2
  return 1 2>/dev/null || exit 1
fi
__HB_OLD_SET_OPTS="$(set +o)"; trap 'eval "$__HB_OLD_SET_OPTS"' RETURN; set -Euo pipefail
: "${HB_LLM_MODE:=1}"; : "${HB_FORCE_GUARD:=0}"; : "${HB_NO_GUARD:=0}"
: "${HB_FILTER_W:=3800}"; : "${HB_FILTER_FLUSH:=$((4*HB_FILTER_W))}"
: "${HB_FILTER_PFX:="[HBWRAP"}"; : "${HB_FILTER_SFX:="]"}"; : "${HB_FILTER_BIN:="[HBBIN"}"
_HB_CFG_DIR="${HOME}/.config/hypebrut"; _HB_LOG_DIR="${HB_LOG_DIR:-/tmp/hype_logs}"
mkdir -p "$_HB_CFG_DIR" "$_HB_LOG_DIR"
_HB_FILTER_PERL="${_HB_CFG_DIR}/guard-filter.pl"; _HB_FILTER_PY="${_HB_CFG_DIR}/guard-filter.py"
_hb_now(){ date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# Perl filter
cat >"$_HB_FILTER_PERL" <<'PERL'
#!/usr/bin/env perl
use strict; use warnings; binmode STDIN; binmode STDOUT;
my $W=$ENV{HB_FILTER_W}||3800; my $LOGF=$ENV{HB_FILTER_LOGF}||"";
my $PFX=$ENV{HB_FILTER_PFX}||"[HBWRAP"; my $SFX=$ENV{HB_FILTER_SFX}||"]";
my $BIN=$ENV{HB_FILTER_BIN}||"[HBBIN"; my $FLUSH=$ENV{HB_FILTER_FLUSH}||(4*$W);
my $logfh; if ($LOGF ne ""){ open($logfh,">>",$LOGF) or die $!; binmode $logfh; }
sub bad{ my($s)=@_; return ($s=~/[\x00-\x08\x0B\x0C\x0E-\x1A\x1C-\x1F\x7F]/)?1:0; }
sub chunks{ my($line,$nl)=@_; my $L=length($line); if($L<=$W){ print STDOUT $line,$nl; return; }
  my $n=int(($L+$W-1)/$W); my $start=0; for(my $i=1;$i<=$n;$i++){ my $end=$start+$W; $end=$L if $end>$L;
    my $chunk=substr($line,$start,$end-$start); my $a=$start+1; my $b=$end;
    print STDOUT "$PFX $i/$n $a..$b$SFX $chunk\n"; $start=$end; } print STDOUT $nl if $nl ne ""; }
sub soft{ my($r)=@_; my $buf=$$r; while(length($buf)>$FLUSH){ my $w=substr($buf,0,$W,"");
    print STDOUT "$PFX 1/1 1..".length($w)."$SFX $w\n"; } $$r=$buf; }
my $buf=""; while(1){ my $n=sysread(STDIN,my $c,8192); last if !defined($n)||$n==0; $buf.=$c; soft(\$buf);
  while($buf=~/[\r\n]/){ my $pn=index($buf,"\n"); $pn=1<<30 if $pn<0; my $pr=index($buf,"\r"); $pr=1<<30 if $pr<0;
    my $pos=($pn<$pr)?$pn:$pr; my $d=substr($buf,$pos,1); my $line=substr($buf,0,$pos);
    my $take=1; $take=2 if $d eq "\r" && substr($buf,$pos+1,1) eq "\n";
    my $raw=substr($buf,0,$pos+$take); $buf=substr($buf,$pos+$take); print $logfh $raw if $logfh;
    my $nl="\n"; if(bad($line)){ print STDOUT "$BIN suppressed ".length($line)." bytes$nl"; } else { chunks($line,$nl); } } }
if(length($buf)){ print $logfh $buf if $logfh; if(bad($buf)){ print STDOUT "$BIN suppressed ".length($buf)." bytes"; } else { chunks($buf,""); } }
PERL
chmod 0755 "$_HB_FILTER_PERL"

# Python fallback
cat >"$_HB_FILTER_PY" <<'PY'
#!/usr/bin/env python3
import os,sys
W=int(os.environ.get("HB_FILTER_W","3800")); LOGF=os.environ.get("HB_FILTER_LOGF","")
PFX=os.environ.get("HB_FILTER_PFX","[HBWRAP"); SFX=os.environ.get("HB_FILTER_SFX","]")
BIN=os.environ.get("HB_FILTER_BIN","[HBBIN"); FLUSH=int(os.environ.get("HB_FILTER_FLUSH",str(4*W)))
logfh=open(LOGF,"ab",buffering=0) if LOGF else None
ALLOWED={9,10,13,27}
def bad(b): return any(((x not in ALLOWED) and (x<32 or x==127)) for x in b)
def chunks(b,nl):
  L=len(b)
  if L<=W: sys.stdout.buffer.write(b+nl); return
  n=(L+W-1)//W; s=0
  for i in range(1,n+1):
    e=min(s+W,L); chunk=b[s:e]; a, c = s+1, e
    sys.stdout.buffer.write((f"{PFX} {i}/{n} {a}..{c}{SFX} ").encode()+chunk+b"\n"); s=e
  if nl: sys.stdout.buffer.write(nl)
def soft(buf):
  while len(buf)>FLUSH:
    win=bytes(buf[:W]); del buf[:W]
    sys.stdout.buffer.write((f"{PFX} 1/1 1..{len(win)}{SFX} ").encode()+win+b"\n")
buf=bytearray()
while True:
  ch=sys.stdin.buffer.read(8192)
  if not ch: break
  buf.extend(ch); soft(buf)
  while True:
    pn=buf.find(b"\n"); pr=buf.find(b"\r")
    if pn<0 and pr<0: break
    if pn<0: pn=1<<30
    if pr<0: pr=1<<30
    pos = pn if pn<pr else pr
    delim=buf[pos:pos+1]; line=bytes(buf[:pos]); take=1
    if delim==b"\r" and buf[pos:pos+2]==b"\r\n": take=2
    raw=bytes(buf[:pos+take]); del buf[:pos+take]
    if logfh: logfh.write(raw)
    if bad(line): sys.stdout.buffer.write((f"{BIN} suppressed {len(line)} bytes\n").encode())
    else: chunks(line,b"\n")
if buf:
  if logfh: logfh.write(bytes(buf))
  if bad(bytes(buf)): sys.stdout.buffer.write((f"{BIN} suppressed {len(buf)} bytes").encode())
  else: chunks(bytes(buf),b"")
PY
chmod 0755 "$_HB_FILTER_PY"

# Select filter binary
if command -v perl >/dev/null 2>&1; then _HB_FILTER_BIN="$_HB_FILTER_PERL"
elif command -v python3 >/dev/null 2>&1; then _HB_FILTER_BIN="$_HB_FILTER_PY"
else _HB_FILTER_BIN=""
fi

_hb_enable_guard() {
  [[ "${HB_NO_GUARD}" == "1" ]] && return 0
  [[ -z "${_HB_FILTER_BIN}" ]] && return 0
  if [[ "${_HB_FD_HIJACKED:-0}" == "1" && "${_HB_HIJACK_PID:-}" == "$$" ]]; then return 0; fi
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

_hb_disarm_on_exit() {
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

hb_disarm(){ _hb_disarm_on_exit; }
hb_status(){
  if [[ "${_HB_FD_HIJACKED:-0}" == "1" && "${_HB_HIJACK_PID:-}" == "$$" ]]; then
    printf '# HB guard: active • out=%s • err=%s • width=%s\n' "${_HB_LOG_OUT:-?}" "${_HB_LOG_ERR:-?}" "${HB_FILTER_W}"
  else printf '# HB guard: inactive\n'; fi
}
hb_run(){
  local -a cmd=( "$@" )
  if command -v script >/dev/null 2>&1; then script -q -e -c "$(printf '%q ' "${cmd[@]}")" /dev/null
  elif command -v unbuffer >/dev/null 2>&1; then unbuffer "${cmd[@]}"
  elif command -v expect >/dev/null 2>&1; then expect -c "spawn -noecho $(printf '%q ' "${cmd[@]}"); interact"
  elif command -v stdbuf >/dev/null 2>&1; then stdbuf -oL -eL "${cmd[@]}"
  else "${cmd[@]}"; fi
}

if [[ "${HB_NO_GUARD}" != "1" ]]; then
  if [[ $- != *i* || "${HB_FORCE_GUARD}" == "1" ]]; then _hb_enable_guard; fi
fi
BOOTSTRAP_EOF
    log "patched ${BOOT}"
    ;;

  write-shims)
    # npm shim that preserves streaming and inherits guard
    install -m 0755 /dev/stdin "${ROOT}/bin/npm" <<'NPM'
#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PATH_TRIMMED="$(printf "%s" "$PATH" | sed -e "s|${DIR}:||g" -e "s|:${DIR}||g")"
NPM_BIN="$(PATH="$PATH_TRIMMED" command -v npm || true)"
if [[ -z "${NPM_BIN}" ]]; then echo "# npm shim: real npm not found" >&2; exit 127; fi
hb_run "${NPM_BIN}" "$@"
NPM
    log "wrote bin/npm shim"
    ;;

  test)
    # tiny TAP runner + tests (installed once)
    if [[ ! -f "${ROOT}/bin/shtap" ]]; then
      install -m 0755 /dev/stdin "${ROOT}/bin/shtap" <<'SHTAP'
#!/usr/bin/env bash
set -Eeuo pipefail
plan(){ echo "1..$1"; }
ok(){ local c="$1"; shift; echo "ok $c - $*"; }
not_ok(){ local c="$1"; shift; echo "not ok $c - $*"; }
expect(){ local idx="$1"; shift; eval "$@" && ok "$idx" "$*" || { not_ok "$idx" "$*"; exit 1; }; }
SHTAP
    fi

    # Write tests if missing.
    TDIR="${ROOT}/test/hb_guard"
    write_test(){
      local name="$1"; shift
      [[ -f "${TDIR}/${name}.t" ]] && return 0
      install -m 0755 /dev/stdin "${TDIR}/${name}.t" <<<"$*"
    }

    # 000_arm_quiet: no stdout on source; stderr banner comment-only
    write_test 000_arm_quiet "$(cat <<'T'
#!/usr/bin/env bash
set -Eeuo pipefail
. "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh 2>err.txt 1>out.txt || true
echo "#source again"
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh 2>>err.txt 1>>out.txt || true
./../../bin/shtap <<'RUN'
plan 3
expect 1 '[ ! -s out.txt ]'
expect 2 'grep -q "^# HB guard: armed" err.txt'
expect 3 '! grep -q "^[^#]" err.txt'
RUN
T
)"
    # 010_longline_wrap
    write_test 010_longline_wrap "$(cat <<'T'
#!/usr/bin/env bash
set -Eeuo pipefail
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh >/dev/null 2>err.txt
python3 - <<'PY' 2>>err.txt
import sys
print("X"*12000)
PY
./../../bin/shtap <<'RUN'
plan 2
expect 1 'grep -q "^\[HBWRAP " err.txt'
expect 2 'grep -Eq "\[HBWRAP [0-9]+/[0-9]+ 1\.\." err.txt'
RUN
T
)"
    # 020_ctrl_suppression
    write_test 020_ctrl_suppression "$(cat <<'T'
#!/usr/bin/env bash
set -Eeuo pipefail
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh >/dev/null 2>err.txt
python3 - <<'PY' 2>>err.txt
import sys
sys.stdout.buffer.write(b"\x00\x01\x02BAD\n")
PY
./../../bin/shtap <<'RUN'
plan 1
expect 1 'grep -q "\[HBBIN suppressed " err.txt'
RUN
T
)"
    # 030_child_inherit
    write_test 030_child_inherit "$(cat <<'T'
#!/usr/bin/env bash
set -Eeuo pipefail
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh >/dev/null 2>err.txt
# child writes a giant line and CR progress
python3 - <<'PY' 2>>err.txt
import sys,time
sys.stdout.write("A"*8000+"\n"); sys.stdout.flush()
for i in range(3):
  sys.stdout.write("\rstep"+str(i)); sys.stdout.flush(); time.sleep(0.05)
sys.stdout.write("\n")
PY
./../../bin/shtap <<'RUN'
plan 2
expect 1 'grep -q "^\[HBWRAP " err.txt'
expect 2 'grep -q "step0" err.txt'
RUN
T
)"
    # 040_idempotence
    write_test 040_idempotence "$(cat <<'T'
#!/usr/bin/env bash
set -Eeuo pipefail
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh 2>err.txt
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh 2>>err.txt
./../../bin/shtap <<'RUN'
plan 1
expect 1 'grep -c "^# HB guard: armed" err.txt | grep -q "^1$"'
RUN
T
)"
    # 050_disarm_restore
    write_test 050_disarm_restore "$(cat <<'T'
#!/usr/bin/env bash
set -Eeuo pipefail
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh 2>err.txt
type hb_disarm >/dev/null
hb_disarm
./../../bin/shtap <<'RUN'
plan 1
expect 1 'grep -q "^# HB guard: disarmed" err.txt'
RUN
T
)"
    # 060_no_banner_stdout
    write_test 060_no_banner_stdout "$(cat <<'T'
#!/usr/bin/env bash
set -Eeuo pipefail
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh 1>out.txt 2>err.txt
./../../bin/shtap <<'RUN'
plan 2
expect 1 '[ ! -s out.txt ]'
expect 2 'grep -q "^# HB guard: armed" err.txt'
RUN
T
)"
    # 070_cr_progress
    write_test 070_cr_progress "$(cat <<'T'
#!/usr/bin/env bash
set -Eeuo pipefail
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh 2>err.txt
python3 - <<'PY' 2>>err.txt
import sys,time
for i in range(5):
  sys.stdout.write("\rspin"+str(i)); sys.stdout.flush(); time.sleep(0.02)
sys.stdout.write("\n")
PY
./../../bin/shtap <<'RUN'
plan 1
expect 1 'grep -q "spin4" err.txt'
RUN
T
)"
    # 080_minified_one_liner
    write_test 080_minified_one_liner "$(cat <<'T'
#!/usr/bin/env bash
set -Eeuo pipefail
HB_FORCE_GUARD=1 . "$(dirname "$0")"/../../utils/scripts/setup/env-bootstrap.sh 2>err.txt
python3 - <<'PY' 2>>err.txt
import sys
sys.stdout.write("/*min*/"+"A"*20000+"\n")
PY
./../../bin/shtap <<'RUN'
plan 1
expect 1 'grep -q "^\[HBWRAP " err.txt'
RUN
T
)"

    # Run tests in a clean non-interactive shell to emulate LLM execution.
    failures=0
    for t in "${TDIR}"/*.t; do
      if ! bash "$t"; then
        echo "[hb-guard] FAIL: $t" >&2
        failures=$((failures+1))
      else
        echo "[hb-guard] PASS: $t" >&2
      fi
    done
    if [[ $failures -gt 0 ]]; then
      echo "{ \"status\":\"fail\", \"failures\": $failures, \"time\": \"$(timestamp)\" }" > "${SUMMARY}"
      exit 1
    fi
    echo "{ \"status\":\"pass\", \"failures\": 0, \"time\": \"$(timestamp)\" }" > "${SUMMARY}"
    ;;

  report)
    [[ -f "${SUMMARY}" ]] && jq . "${SUMMARY}" || { echo "{ \"status\":\"unknown\" }"; }
    ;;

  rollback)
    last="$(ls -1 "${BACKUP_DIR}"/env-bootstrap.sh.* 2>/dev/null | tail -n1 || true)"
    if [[ -n "${last}" ]]; then
      cp -a "${last}" "${BOOT}"
      log "restored ${BOOT} from ${last}"
    else
      log "no backups to restore"
    fi
    ;;

  *)
    echo "usage: $0 {analyze|patch|write-shims|test|report|rollback}" >&2
    exit 2
    ;;
esac
