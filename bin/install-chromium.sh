#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESOLVER="${ROOT_DIR}/tools/resolve-chromium.mjs"

log() {
  printf '%s\n' "$*"
}

find_chromium() {
  node "$RESOLVER" 2>/dev/null || true
}

validate_chromium() {
  local bin="$1"
  [[ -n "$bin" ]] || return 1
  if ! "$bin" --version >/dev/null 2>&1; then
    return 1
  fi
  return 0
}

ensure_apt_chromium() {
  if ! command -v apt-get >/dev/null 2>&1; then
    log "apt-get not available; cannot auto-install Chromium."
    return 1
  fi

  local sudo_cmd=""
  if [[ ${EUID:-0} -ne 0 ]]; then
    if command -v sudo >/dev/null 2>&1; then
      sudo_cmd="sudo"
    else
      log "Need root privileges or sudo to install Chromium via apt-get."
      return 1
    fi
  fi

  export DEBIAN_FRONTEND=noninteractive
  $sudo_cmd apt-get update -y >/dev/null
  if ! $sudo_cmd apt-get install -y chromium >/dev/null 2>&1; then
    $sudo_cmd apt-get install -y chromium-browser >/dev/null 2>&1
  fi
}

ensure_playwright_deps() {
  if ! command -v npx >/dev/null 2>&1; then
    return 0
  fi

  local runner=(npx --yes playwright install-deps chromium)
  if [[ ${EUID:-0} -ne 0 ]] && command -v sudo >/dev/null 2>&1; then
    sudo "${runner[@]}" >/dev/null
  else
    "${runner[@]}" >/dev/null
  fi
}

main() {
  local existing
  existing="$(find_chromium)"
  if validate_chromium "$existing"; then
    log "Chromium already available at $existing"
  else
    log "Chromium not found; attempting installation via apt-get"
    ensure_apt_chromium || {
      log "Failed to install Chromium automatically."
      existing=""
    }
    existing="$(find_chromium)"
    if ! validate_chromium "$existing"; then
      log "Falling back to Playwright-managed Chromium download"
      if command -v npx >/dev/null 2>&1; then
        ensure_playwright_deps
        npx --yes playwright install chromium >/dev/null
      else
        log "npx unavailable; unable to download Chromium via Playwright."
        exit 1
      fi
      existing="$(find_chromium)"
      if ! validate_chromium "$existing"; then
        log "Chromium download failed."
        exit 1
      fi
    else
      log "Chromium installed at $existing"
    fi
  fi

  if [[ -n "${GITHUB_ENV:-}" ]]; then
    printf 'PUPPETEER_EXECUTABLE_PATH=%s\n' "$existing" >>"$GITHUB_ENV"
  fi
  printf '%s\n' "$existing"
}

main "$@"
