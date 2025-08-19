#!/usr/bin/env bash
set -u

: "${LLM_VERBOSE:=1}"
: "${LLM_HIJACK_DISABLE:=0}"
: "${LLM_FOLD_WIDTH:=4000}"
: "${LLM_TAIL_BLOCK:=1}"
: "${LLM_TAIL_MAX_LINES:=5000}"
: "${LLM_TAIL_ALLOW_CMDS:=}"
: "${LLM_IDLE_SECS:=${LLM_HEARTBEAT_SECS:-7}}"
: "${LLM_CAT_MAX_BYTES:=0}"
: "${LLM_DEPS_AUTOINSTALL:=1}"
: "${LLM_ALIAS_CAT:=1}"
: "${LLM_GIT_HOOKS:=1}"
: "${LLM_GLOBAL_HEARTBEAT:=1}"
: "${LLM_GLOBAL_HB_TIMEOUT_S:=300}"

_llm_ts(){ date -u +"%Y-%m-%dT%H:%M:%SZ"; }
_llm_emit(){ [[ "${LLM_VERBOSE}" != "1" ]] && return 0; local ts=$(_llm_ts); printf '::notice:: LLM-GUARD ts=%s' "$ts" >&2; while [[ $# -gt 0 ]];do printf ' %s' "$1" >&2; shift; done; printf '\n' >&2; [[ -n "${GITHUB_STEP_SUMMARY:-}" ]] && { printf 'LLM-GUARD %s ' "$ts" >>"$GITHUB_STEP_SUMMARY"; printf '%s ' "$@" >>"$GITHUB_STEP_SUMMARY"; printf '\n' >>"$GITHUB_STEP_SUMMARY"; }; }
_llm_on(){ [[ "${1:-1}" == "1" || "${1:-1}" == "true" ]]; }
_llm_fold(){ command -v fold >/dev/null 2>&1 && fold -w "${LLM_FOLD_WIDTH:-4000}" -s || cat; }
_llm_has(){ command -v "$1" >/dev/null 2>&1; }
_llm_linebuf(){ _llm_has stdbuf && stdbuf -oL -eL "$@" || "$@"; }

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd 2>/dev/null || pwd)"
_llm_emit event=bootstrap.start repo_root="$repo_root" fold="$LLM_FOLD_WIDTH"

if [[ "${LLM_DEPS_AUTOINSTALL}" == "1" ]]; then
  mkdir -p "$repo_root/tmp"; DEPS_HASH_FILE="$repo_root/tmp/.llm_deps_hash"
  hash_inputs=(); [[ -f "$repo_root/package-lock.json" ]] && hash_inputs+=("$repo_root/package-lock.json")
  [[ -f "$repo_root/markdown_gateway/requirements.txt" ]] && hash_inputs+=("$repo_root/markdown_gateway/requirements.txt")
  if (( ${#hash_inputs[@]} )); then
    if _llm_has sha256sum; then current_hash="$(cat "${hash_inputs[@]}" | sha256sum | awk '{print $1}')"; else current_hash="$(cat "${hash_inputs[@]}" | shasum -a 256 | awk '{print $1}')"; fi
    stored_hash="$( [[ -f "$DEPS_HASH_FILE" ]] && cat "$DEPS_HASH_FILE" || printf '' )"
    if [[ -n "$current_hash" && "$current_hash" != "$stored_hash" ]]; then
      _llm_emit event=bootstrap.deps.install node=ci python=requirements.txt
      CI=${CI:-false} npm ci || true
      if [[ -f "$repo_root/markdown_gateway/requirements.txt" ]]; then
        if _llm_has python; then python -m pip install -r "$repo_root/markdown_gateway/requirements.txt" || true
        else pip install -r "$repo_root/markdown_gateway/requirements.txt" || true; fi
      fi
      echo "$current_hash" > "$DEPS_HASH_FILE"
    else
      _llm_emit event=bootstrap.deps.unchanged
    fi
  fi
fi

_prettier_bin(){ local bin_local; bin_local="$(git rev-parse --show-toplevel 2>/dev/null)/node_modules/.bin/prettier"; [[ -x "$bin_local" ]] && { echo "$bin_local"; return 0; }; command -v npx >/dev/null 2>&1 && { echo "npx --no-install prettier"; return 0; }; echo ""; return 1; }
llm_cat(){
  local p="$1"; if [[ ! -f "$p" ]]; then command cat -vt -- "$p" | _llm_fold; return; fi
  local size ext parser bin; size=$(wc -c <"$p" 2>/dev/null || echo 0); ext="${p##*.}"; parser=""
  case "$ext" in js|mjs|cjs) parser="babel";; ts|tsx) parser="babel-ts";; json|jsonl) parser="json";; md|markdown) parser="markdown";; html|htm) parser="html";; css|pcss) parser="css";; yml|yaml) parser="yaml";; esac
  bin="$(_prettier_bin || true)"
  if [[ -n "$parser" && -n "$bin" && ( "$LLM_CAT_MAX_BYTES" -eq 0 || "$size" -le "$LLM_CAT_MAX_BYTES" ) ]]; then
    _llm_emit cat.format file="$p" bytes="$size" parser="$parser"
    command cat -- "$p" | $bin --parser "$parser" --print-width "${LLM_FOLD_WIDTH:-100}" 2>/dev/null | _llm_fold
  else
    _llm_emit cat.raw file="$p" bytes="$size" reason="$([[ -z "$bin" ]] && echo no-prettier || ([[ -z "$parser" ]] && echo unknown-type || echo size-cap))"
    command cat -vt -- "$p" | _llm_fold
  fi
}
export -f llm_cat
[[ "${LLM_ALIAS_CAT}" == "1" ]] && alias cat='llm_cat'

tail(){
  local follow=0 file="" args=()
  for a in "$@"; do [[ "$a" == "-f" || "$a" == "-F" ]] && follow=1; args+=("$a"); [[ -f "$a" ]] && file="$a"; done
  if _llm_on "${LLM_TAIL_BLOCK:-1}" && (( follow )); then
    if [[ -n "${LLM_TAIL_ALLOW_CMDS:-}" && "${BASH_COMMAND:-}" =~ ${LLM_TAIL_ALLOW_CMDS} ]]; then
      _llm_emit event=tail.pass reason=allowlist args="$(printf '%q ' "$@")"; command tail "$@" | _llm_fold
    else
      local n="${LLM_TAIL_MAX_LINES:-5000}"; _llm_emit event=tail.block file="$file" lines="$n"; command tail -n "$n" -- "$file" | _llm_fold
    fi
  else
    _llm_emit event=tail.pass args="$(printf '%q ' "$@")"
    if _llm_has stdbuf; then command tail "${args[@]}" | stdbuf -o0 -e0 cat | _llm_fold; else command tail "${args[@]}" | _llm_fold; fi
  fi
}
export -f tail

llm_run(){
  local out="/tmp/llm-run.$$.log" idle="${LLM_IDLE_SECS:-7}" id="r$$-$(date +%s)-$RANDOM" tail_on_complete=0
  while [[ $# -gt 0 ]]; do case "$1" in --out) out="$2"; shift 2;; --idle) idle="$2"; shift 2;; --id) id="$2"; shift 2;; --tail) tail_on_complete="$2"; shift 2;; --) shift; break;; *) break;; esac; done
  [[ $# -ge 1 ]] || { _llm_emit event=run.error id="$id" err=no-command; return 2; }
  : >"$out" 2>/dev/null || true
  local lock="/tmp/llm-run.${id}.lock"; printf '%s\n' "$$" > "$lock" 2>/dev/null || true
  local start=$(date +%s) status=0 pipe="$out.pipe.$$"; mkfifo "$pipe" || { _llm_emit event=run.error id="$id" err=fifo-fail; rm -f "$lock"; return 2; }
  _llm_emit event=run.start id="$id" out="$out" cmd="$(printf '%q ' "$@")"
  ( set -o pipefail; bash -lc 'exec "$@"' _ llm "$@" >"$pipe" 2>&1 ) & child=$!
  ( cat "$pipe" | _llm_fold | tee -a -- "$out" ) & reader=$!
  ( last=0; while kill -0 "$child" 2>/dev/null; do sz=$(wc -c <"$out" 2>/dev/null || echo 0); if (( sz==last )); then _llm_emit event=run.idle id="$id" idle_secs="$idle"; else last=$sz; fi; sleep "$idle"; done ) & wd=$!
  trap '_llm_emit event=run.interrupt id='"$id"'; kill -TERM '"$child"' 2>/dev/null || true; sleep 2; _llm_emit event=run.tail id='"$id"' lines=80; command tail -n 80 -- "'"$out"'" | _llm_fold; kill '"$reader $wd"' 2>/dev/null || true; rm -f "'"$pipe"'" "'"$lock"'"; exit 130' INT
  wait "$child"; status=$?
  kill "$reader" "$wd" 2>/dev/null || true
  rm -f "$pipe" "$lock"
  local dur=$(( $(date +%s) - start ))
  _llm_emit event=run.complete id="$id" status="$status" duration_s="$dur"
  if (( tail_on_complete > 0 )); then _llm_emit event=run.tail id="$id" lines="$tail_on_complete"; command tail -n "$tail_on_complete" -- "$out" | _llm_fold; fi
  return "$status"
}
export -f llm_run

_llm_rewrite(){
  [[ "${LLM_HIJACK_DISABLE:-0}" == "1" ]] && return 0
  [[ -z "${BASH_COMMAND:-}" ]] && return 0
  [[ "${_LLM_REWRITE_ACTIVE:-}" == "1" ]] && return 0
  local c="$BASH_COMMAND"
  if [[ "$c" =~ ^[[:space:]]*(.+)[[:space:]]\>[\> ]*[[:space:]]*([^[:space:];&\|]+)[[:space:]]*((2\>\&1)*)[[:space:]]*&&[[:space:]]*tail ]]; then
    local base="${BASH_REMATCH[1]}" out="${BASH_REMATCH[2]}"; _LLM_REWRITE_ACTIVE=1
    _llm_emit event=rewrite.chain op=">+tail" out="$out"
    BASH_COMMAND="llm_run --out $(printf %q "$out") -- $base"; return 0
  fi
  if [[ "$c" =~ [[:space:]](1?\>\>|\>)[[:space:]]*([^[:space:]&|;]+)[[:space:]]*(2\>\&1)?[[:space:]]*$ ]] && [[ ! "$c" =~ \| ]] && [[ ! "$c" =~ \&\& ]] && [[ ! "$c" =~ \|\| ]]; then
    local op="${BASH_REMATCH[1]}" outfile="${BASH_REMATCH[2]}" base="${c%${BASH_REMATCH[0]}}"; local tee_flag=""; case "$op" in '>>'|'1>>') tee_flag='-a';; esac; _LLM_REWRITE_ACTIVE=1
    _llm_emit event=rewrite.redirect op="$op" file="$outfile"
    ( set -o pipefail; bash -c "$base" 2>&1 ) | _llm_fold | tee $tee_flag -- "$outfile"; local s=${PIPESTATUS[0]}
    _LLM_REWRITE_ACTIVE=; BASH_COMMAND=:
    return "$s"
  fi
}
trap _llm_rewrite DEBUG
export -f _llm_rewrite

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

_llm_emit event=tip text='Prefer: llm_run --out /tmp/unit.log -- npm test ; Avoid: npm test >/tmp/unit.log && tail -n 20 /tmp/unit.log'
_llm_emit event=bootstrap.ready fold="$LLM_FOLD_WIDTH" idle="$LLM_IDLE_SECS" tail_block="$LLM_TAIL_BLOCK" hijack="$LLM_HIJACK_DISABLE"
_llm_emit event=bootstrap.done summary="llm_run pid-scoped; chain+redirect rewrites; tail fold; deps:auto=${LLM_DEPS_AUTOINSTALL}; hooks=${LLM_GIT_HOOKS}; hb.global=${LLM_GLOBAL_HEARTBEAT}"
printf 'LLM-GUARD summary: fold=%s idle=%s tail_block=%s hijack=%s hooks=%s hb_global=%s\n' "$LLM_FOLD_WIDTH" "$LLM_IDLE_SECS" "$LLM_TAIL_BLOCK" "$LLM_HIJACK_DISABLE" "$LLM_GIT_HOOKS" "$LLM_GLOBAL_HEARTBEAT" >&2
