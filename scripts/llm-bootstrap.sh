#!/usr/bin/env bash
# Strict, robust defaults: ERR-trace, nounset, and pipefail; no global -e foot-guns.
set -Euo pipefail
# If you later enable -e, also consider: shopt -s inherit_errexit  # Bash ≥5

: "${LLM_VERBOSE:=1}"
: "${LLM_HIJACK_DISABLE:=0}"
: "${LLM_FOLD_WIDTH:=4000}"
: "${LLM_TAIL_BLOCK:=1}"
: "${LLM_TAIL_MAX_LINES:=5000}"
: "${LLM_TAIL_ALLOW_CMDS:=}"
: "${LLM_IDLE_SECS:=${LLM_HEARTBEAT_SECS:-7}}"
: "${LLM_CAT_MAX_BYTES:=0}"
: "${LLM_DEPS_AUTOINSTALL:=1}"
: "${LLM_GIT_HOOKS:=1}"
: "${LLM_GLOBAL_HEARTBEAT:=1}"
: "${LLM_GLOBAL_HB_TIMEOUT_S:=600}"
: "${LLM_TEST_PRESETS:=1}"
: "${LLM_SUPPRESS_PATTERNS:=^::notice:: LLM-safe: tests alive}"
: "${LLM_STRICT:=1}"
: "${LLM_IDLE_FAIL_AFTER_SECS:=300}"
: "${LLM_HEAD_MAX_LINES:=2000}"

# ---- utils ----
_llm_ts(){ date -u +"%Y-%m-%dT%H:%M:%SZ"; }
_llm_has(){ command -v "$1" >/dev/null 2>&1; }
_llm_on(){ [[ "${1:-1}" == "1" || "${1:-1}" == "true" ]]; }
_llm_fold(){ _llm_has fold && fold -w "${LLM_FOLD_WIDTH:-4000}" -s || cat; }
_llm_emit(){
  [[ "${LLM_VERBOSE}" != "1" ]] && return 0
  local ts; ts="$(_llm_ts)"
  printf '::notice:: LLM-GUARD ts=%s' "$ts" >&2
  while [[ $# -gt 0 ]]; do printf ' %s' "$1" >&2; shift; done
  printf '\n' >&2
  [[ -n "${GITHUB_STEP_SUMMARY:-}" ]] && { printf 'LLM-GUARD %s ' "$ts" >>"$GITHUB_STEP_SUMMARY"; printf '%s ' "$@" >>"$GITHUB_STEP_SUMMARY"; printf '\n' >>"$GITHUB_STEP_SUMMARY"; }
}

# Atomic regex helper: captures are copied immediately; avoids ambient BASH_REMATCH hazards.
# Usage: if rex "$string" "$regex" rem; then echo "${rem[1]}"; fi
rex() {
  local s=$1 re=$2
  local -n _out=$3
  if [[ $s =~ $re ]]; then
    _out=("${BASH_REMATCH[@]}")
    return 0
  fi
  _out=()
  return 1
}

# Detect Python venv (guard pip install)
_llm_in_venv(){
  python - <<'PY' 2>/dev/null || return 1
import sys
print(int(hasattr(sys, "real_prefix") or (getattr(sys, "base_prefix", sys.prefix) != sys.prefix)))
PY
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd 2>/dev/null || pwd)"
_llm_emit event=bootstrap.start repo_root="$repo_root" fold="$LLM_FOLD_WIDTH"

# ---- deps autoinstall (hash-based) ----
if [[ "${LLM_DEPS_AUTOINSTALL}" == "1" ]]; then
  mkdir -p "$repo_root/tmp"; DEPS_HASH_FILE="$repo_root/tmp/.llm_deps_hash"
  hash_inputs=()
  [[ -f "$repo_root/package-lock.json" ]] && hash_inputs+=("$repo_root/package-lock.json")
  [[ -f "$repo_root/markdown_gateway/requirements.txt" ]] && hash_inputs+=("$repo_root/markdown_gateway/requirements.txt")
  if (( ${#hash_inputs[@]} )); then
    if _llm_has sha256sum; then
      current_hash="$(cat "${hash_inputs[@]}" | sha256sum | awk '{print $1}')"
    else
      current_hash="$(cat "${hash_inputs[@]}" | shasum -a 256 | awk '{print $1}')"
    fi
    stored_hash="$( [[ -f "$DEPS_HASH_FILE" ]] && cat "$DEPS_HASH_FILE" || printf '' )"
    if [[ -n "$current_hash" && "$current_hash" != "$stored_hash" ]]; then
      _llm_emit event=bootstrap.deps.install node=ci python=requirements.txt
      CI=${CI:-false} npm ci || true
      if [[ -f "$repo_root/markdown_gateway/requirements.txt" ]]; then
        if _llm_in_venv; then
          if _llm_has python; then python -m pip install -r "$repo_root/markdown_gateway/requirements.txt" || true
          else pip install -r "$repo_root/markdown_gateway/requirements.txt" || true; fi
        else
          _llm_emit event=deps.skip reason=no-venv path="$repo_root/markdown_gateway/requirements.txt"
        fi
      fi
      echo "$current_hash" > "$DEPS_HASH_FILE"
    else
      _llm_emit event=bootstrap.deps.unchanged
    fi
  fi
fi

# ---- pretty cat (llm_cat) ----
_prettier_bin(){
  local bin_local; bin_local="$(git rev-parse --show-toplevel 2>/dev/null)/node_modules/.bin/prettier"
  [[ -x "$bin_local" ]] && { echo "$bin_local"; return 0; }
  command -v npx >/dev/null 2>&1 && { echo "npx --no-install prettier"; return 0; }
  echo ""; return 1
}
llm_cat(){
  local p="${1:-}"
  if [[ -z "$p" ]]; then command cat | _llm_fold; return; fi
  if [[ ! -f "$p" ]]; then command cat -vt -- "$p" | _llm_fold; return; fi
  local size ext parser bin; size=$(wc -c <"$p" 2>/dev/null || echo 0); ext="${p##*.}"; parser=""
  case "$ext" in
    js|mjs|cjs) parser="babel" ;;
    ts|tsx)     parser="babel-ts" ;;
    json|jsonl) parser="json" ;;
    md|markdown) parser="markdown" ;;
    html|htm)   parser="html" ;;
    css|pcss)   parser="css" ;;
    yml|yaml)   parser="yaml" ;;
  esac
  bin="$(_prettier_bin || true)"
  if [[ -n "$parser" && -n "$bin" && ( "${LLM_CAT_MAX_BYTES:-0}" -eq 0 || "$size" -le "${LLM_CAT_MAX_BYTES:-0}" ) ]]; then
    _llm_emit cat.format file="$p" bytes="$size" parser="$parser"
    command cat -- "$p" | $bin --parser "$parser" --print-width "${LLM_FOLD_WIDTH:-100}" 2>/dev/null | _llm_fold
  else
    _llm_emit cat.raw file="$p" bytes="$size" reason="$([[ -z "$bin" ]] && echo no-prettier || ([[ -z "$parser" ]] && echo unknown-type || echo size-cap))"
    command cat -vt -- "$p" | _llm_fold
  fi
}
export -f llm_cat

# Make cat a default wrapper (use "command cat" for raw)
cat(){ llm_cat "$@"; }
export -f cat

# ---- tail guard (default wrapper; use "command tail" to bypass) ----
tail(){
  local follow=0 file="" args=() full="tail"
  for a in "$@"; do
    [[ "$a" == "-f" || "$a" == "-F" ]] && follow=1
    args+=("$a")
    full+=" $(printf '%q' "$a")"
    [[ -f "$a" ]] && file="$a"
  done
  if _llm_on "${LLM_TAIL_BLOCK:-1}" && (( follow )); then
    if [[ -n "${LLM_TAIL_ALLOW_CMDS:-}" && "$full" =~ ${LLM_TAIL_ALLOW_CMDS} ]]; then
      _llm_emit event=tail.pass reason=allowlist args="$full"
      command tail "$@" | _llm_fold
    else
      local n="${LLM_TAIL_MAX_LINES:-5000}"
      _llm_emit event=tail.block file="$file" lines="$n"
      command tail -n "$n" -- "$file" | _llm_fold
    fi
  else
    _llm_emit event=tail.pass args="$full"
    if _llm_has stdbuf; then command tail "${args[@]}" | stdbuf -o0 -e0 cat | _llm_fold
    else command tail "${args[@]}" | _llm_fold
    fi
  fi
}
export -f tail

# ---- head guard (default wrapper; use "command head" to bypass) ----
llm_head(){
  local args=("$@") file="" n_req=""
  local i rem=()
  for ((i=0;i<${#args[@]};i++)); do
    if [[ "${args[i]}" == "-n" && $((i+1)) -lt ${#args[@]} ]]; then
      n_req="${args[i+1]}"
    elif rex "${args[i]}" '^-n([0-9]+)$' rem; then
      n_req="${rem[1]}"
    fi
    [[ -z "$file" && -f "${args[i]}" ]] && file="${args[i]}"
  done
  if [[ -n "$file" && -n "${n_req-}" && "$n_req" =~ ^[0-9]+$ ]]; then
    local max="${LLM_HEAD_MAX_LINES:-2000}" use_n="$n_req"
    if (( n_req > max )); then
      use_n="$max"; _llm_emit event=head.clamp file="$file" requested="$n_req" used="$use_n"
    else
      _llm_emit event=head.pass file="$file" lines="$use_n"
    fi
    command head -n "$use_n" -- "$file" | _llm_fold
    return ${PIPESTATUS[0]}
  fi
  _llm_emit event=head.pass args="$(printf '%q ' "$@")"
  command head "$@" | _llm_fold
}
export -f llm_head

# Make head a default wrapper (use "command head" for raw)
head(){ llm_head "$@"; }
export -f head

# ---- stream filter for noisy lines ----
_llm_stream_filter(){
  if [[ -z "${LLM_SUPPRESS_PATTERNS}" ]]; then cat
  else awk -v pat="$LLM_SUPPRESS_PATTERNS" 'pat==""{print;next} { if ($0 ~ pat) next; print }'
  fi
}

# ---- PID-scoped runner ----
llm_run(){
  local out="/tmp/llm-run.$$.log" idle="${LLM_IDLE_SECS:-7}" id="r$$-$(date +%s)-$RANDOM" tail_on_complete=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --out) out="$2"; shift 2;;
      --idle) idle="$2"; shift 2;;
      --id) id="$2"; shift 2;;
      --tail) tail_on_complete="$2"; shift 2;;
      --) shift; break;;
      *) break;;
    esac
  done
  [[ $# -ge 1 ]] || { _llm_emit event=run.error id="$id" err=no-command; return 2; }

  : >"$out" 2>/dev/null || true
  local lock="/tmp/llm-run.${id}.lock"; printf '%s\n' "$$" > "$lock" 2>/dev/null || true
  local start=$(date +%s) status=0 pipe="$out.pipe.$$"
  mkfifo "$pipe" || { _llm_emit event=run.error id="$id" err=fifo-fail; rm -f "$lock"; return 2; }

  _llm_emit event=run.start id="$id" out="$out" cmd="$(printf '%q ' "$@")"

  (
    set -o pipefail
    if [[ "${LLM_TEST_PRESETS}" == "1" ]]; then
      if [[ "$1" =~ ^(npm|pnpm|yarn)$ && "${2:-}" == "test" ]]; then export CI=1 ELEVENTY_ENV=test WATCH=0; fi
      if [[ "$1" == "npx" && "${2:-}" == "@11ty/eleventy" ]]; then export CI=1 ELEVENTY_ENV=test WATCH=0; fi
    fi
    if _llm_has stdbuf; then stdbuf -oL -eL "$@" >"$pipe" 2>&1; else "$@" >"$pipe" 2>&1; fi
  ) & child=$!

  (
    _llm_stream_filter <"$pipe" | _llm_fold | tee -a -- "$out"
  ) & reader=$!

  (
    last=0; idle_total=0
    while kill -0 "$child" 2>/dev/null; do
      sz=$(wc -c <"$out" 2>/dev/null || echo 0)
      if (( sz==last )); then
        idle_total=$((idle_total+idle))
        _llm_emit event=run.idle id="$id" idle_secs="$idle" total_idle="$idle_total"
        if (( LLM_IDLE_FAIL_AFTER_SECS>0 && idle_total>=LLM_IDLE_FAIL_AFTER_SECS )); then
          _llm_emit event=run.timeout id="$id" after_s="$idle_total"
          kill -TERM "$child" 2>/dev/null || true
          break
        fi
      else
        last=$sz; idle_total=0
      fi
      sleep "$idle"
    done
  ) & wd=$!

  trap '
    _llm_emit event=run.interrupt id='"$id"'
    kill -TERM '"$child"' 2>/dev/null || true
    sleep 2
    _llm_emit event=run.tail id='"$id"' lines=80
    command tail -n 80 -- "'"$out"'" | _llm_fold
    kill '"$reader"' '"$wd"' 2>/dev/null || true
    rm -f "'"$pipe"'" "'"$lock"'"
    exit 130
  ' INT

  wait "$child"; status=$?
  kill "$reader" "$wd" 2>/dev/null || true
  rm -f "$pipe" "$lock"

  local dur=$(( $(date +%s) - start ))
  _llm_emit event=run.complete id="$id" status="$status" duration_s="$dur"

  if (( tail_on_complete > 0 )); then
    _llm_emit event=run.tail id="$id" lines="$tail_on_complete"
    command tail -n "$tail_on_complete" -- "$out" | _llm_fold
  fi
  return "$status"
}
export -f llm_run

# ---- redirect/chain rewrite trap (robust EREs; no \b) ----
_llm_rewrite(){
  [[ "${LLM_HIJACK_DISABLE:-0}" == "1" ]] && return 0
  [[ -z "${BASH_COMMAND:-}" ]] && return 0
  [[ "${_LLM_REWRITE_ACTIVE:-}" == "1" ]] && return 0

  local c="$BASH_COMMAND"
  local re_chain='^[[:space:]]*(.+)[[:space:]]>[> ]*[[:space:]]*([^[:space:];&|]+)[[:space:]]*(2>&1)?[[:space:]]*&&[[:space:]]*(tail|head)([[:space:]]|$)'
  local re_redirect='[[:space:]]((1>>|1>|>>|>))[[:space:]]*([^[:space:]&|;]+)[[:space:]]*(2>&1)?[[:space:]]*$'
  local re_has_pipe='[|]'  # kept for reference; avoid using to not clobber captures

  local rem=()

  # "<cmd> > file && (tail|head) ..."
  if rex "$c" "$re_chain" rem; then
    local whole="${rem[0]}" base="${rem[1]}" out="${rem[2]}"
    if [[ "${LLM_STRICT}" == "1" ]]; then
      _llm_emit event=rewrite.reject reason=">+tail/head disallowed" suggest="llm_run --out $(printf %q "$out") -- $base"
      BASH_COMMAND="false"; return 0
    fi
    _LLM_REWRITE_ACTIVE=1
    _llm_emit event=rewrite.chain op=">+tail/head" out="$out"
    BASH_COMMAND="llm_run --out $(printf %q "$out") -- $base"
    return 0
  fi

  # Simple redirects: "<cmd> > file" / ">> file" (optionally with 1>)
  if rex "$c" "$re_redirect" rem; then
    # Avoid any further =~ until after we consume captures
    local whole="${rem[0]}" op="${rem[1]}" outfile="${rem[3]}"
    # Block pipes/&&/|| for this rewrite path using glob checks (doesn't touch BASH_REMATCH)
    if [[ "$c" != *'|'* && "$c" != *'&&'* && "$c" != *'||'* ]]; then
      local base="${c%$whole}"
      if [[ "${LLM_STRICT}" == "1" ]]; then
        _llm_emit event=rewrite.reject reason="redirection disallowed" suggest="llm_run --out $(printf %q "$outfile") -- $base"
        BASH_COMMAND="false"; return 0
      fi
      local tee_flag=''
      [[ "$op" == *">>"* ]] && tee_flag='-a'
      _LLM_REWRITE_ACTIVE=1
      _llm_emit event=rewrite.redirect op="$op" file="$outfile"
      (
        set -o pipefail
        bash -c "$base" 2>&1
      ) | _llm_fold | tee $tee_flag -- "$outfile"
      local s=${PIPESTATUS[0]}
      _LLM_REWRITE_ACTIVE=
      BASH_COMMAND=:
      return "$s"
    fi
  fi
}
trap _llm_rewrite DEBUG
export -f _llm_rewrite

# ---- git hooks (persist activation on branch moves) ----
if [[ "${LLM_GIT_HOOKS:-0}" == "1" ]]; then
  for hook in post-checkout post-merge; do
    hp="$repo_root/.git/hooks/$hook"
    printf '%s\n' '#!/usr/bin/env bash' 'set -euo pipefail' \
      'repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"' \
      '. "$repo_root/scripts/llm-bootstrap.sh" 2>/dev/null || true' > "$hp"
    chmod +x "$hp"
  done
  _llm_emit event=hooks.installed hooks="post-checkout,post-merge"
fi

# ---- scoped global heartbeat (quiet while llm_run lock exists) ----
_llm_hb_global(){
  local interval=$(( ${LLM_IDLE_SECS:-7} * 4 )); (( interval < 30 )) && interval=30
  local stop_after="${LLM_GLOBAL_HB_TIMEOUT_S:-600}" start=$(date +%s)
  while true; do
    if compgen -G "/tmp/llm-run.*.lock" >/dev/null; then sleep "$interval"; continue; fi
    printf '::notice:: LLM-GUARD ts=%s event=heartbeat interval=%ss\n' "$(_llm_ts)" "$interval" >&2
    [[ "$stop_after" -gt 0 ]] && (( $(date +%s) - start >= stop_after )) && break
    sleep "$interval"
  done
}
if [[ "${LLM_GLOBAL_HEARTBEAT:-0}" == "1" ]]; then
  if [[ -z "${_LLM_HB_GLOBAL_PID:-}" ]] || ! kill -0 "${_LLM_HB_GLOBAL_PID}" 2>/dev/null; then
    _llm_hb_global & export _LLM_HB_GLOBAL_PID=$!
    trap 'kill "${_LLM_HB_GLOBAL_PID}" 2>/dev/null || true' EXIT
    _llm_emit event=heartbeat.enabled scope=global timeout_s="${LLM_GLOBAL_HB_TIMEOUT_S}"
  fi
fi

# ---- final notices ----
_llm_emit event=tip text='Prefer: llm_run --out /tmp/unit.log -- <cmd>; Avoid: <cmd> >/tmp/unit.log && (tail|head) …'
_llm_emit event=bootstrap.ready fold="$LLM_FOLD_WIDTH" idle="$LLM_IDLE_SECS" tail_block="$LLM_TAIL_BLOCK" hijack="$LLM_HIJACK_DISABLE"
_llm_emit event=bootstrap.done summary="llm_run; rewrites(strict=${LLM_STRICT}); tail/head/cat wrappers; deps:auto=${LLM_DEPS_AUTOINSTALL}; hooks=${LLM_GIT_HOOKS}; hb.global=${LLM_GLOBAL_HEARTBEAT}; presets=${LLM_TEST_PRESETS}; suppress='${LLM_SUPPRESS_PATTERNS}'"

printf 'LLM-GUARD summary: fold=%s idle=%s tail_block=%s hijack=%s hooks=%s hb_global=%s presets=%s strict=%s\n' \
  "$LLM_FOLD_WIDTH" "$LLM_IDLE_SECS" "$LLM_TAIL_BLOCK" "$LLM_HIJACK_DISABLE" "$LLM_GIT_HOOKS" "$LLM_GLOBAL_HEARTBEAT" "$LLM_TEST_PRESETS" "$LLM_STRICT" >&2
printf 'LLM-GUARD suppress_patterns: %s\n' "${LLM_SUPPRESS_PATTERNS:-}" >&2

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf 'LLM-GUARD summary: fold=%s idle=%s tail_block=%s hijack=%s hooks=%s hb_global=%s presets=%s strict=%s\n' \
    "$LLM_FOLD_WIDTH" "$LLM_IDLE_SECS" "$LLM_TAIL_BLOCK" "$LLM_HIJACK_DISABLE" "$LLM_GIT_HOOKS" "$LLM_GLOBAL_HEARTBEAT" "$LLM_TEST_PRESETS" "$LLM_STRICT" >>"$GITHUB_STEP_SUMMARY"
  printf 'LLM-GUARD suppress_patterns: %s\n' "${LLM_SUPPRESS_PATTERNS:-}" >>"$GITHUB_STEP_SUMMARY"
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'llm_run_pid=%s\n' "$$" >>"$GITHUB_OUTPUT"
  printf 'llm_run_out=/tmp/llm-run.%s.log\n' "$$" >>"$GITHUB_OUTPUT"
fi
