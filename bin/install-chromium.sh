#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESOLVER="${ROOT_DIR}/tools/resolve-chromium.mjs"

log() {
  printf '%s\n' "$*" >&2
}

playwright_wrappers() {
  cat <<'EOF'
npx --yes
npm exec --yes
pnpm dlx
yarn dlx
bunx
corepack pnpm dlx
corepack yarn dlx
EOF
}

run_playwright_command() {
  local require_root=0
  if [[ ${1:-} == "--sudo" ]]; then
    require_root=1
    shift
  fi

  local subcommand="$1"
  shift
  local -a args=("$@")

  local attempted=0
  while IFS= read -r wrapper; do
    [[ -n "$wrapper" ]] || continue
    # shellcheck disable=SC2206
    local tokens=($wrapper)
    local bin="${tokens[0]}"
    if ! command -v "$bin" >/dev/null 2>&1; then
      continue
    fi
    attempted=1
    local -a cmd=("${tokens[@]}" playwright "$subcommand")
    cmd+=("${args[@]}")

    if ((require_root)) && [[ ${EUID:-0} -ne 0 ]] && command -v sudo >/dev/null 2>&1; then
      if sudo "${cmd[@]}" >/dev/null 2>&1; then
        log "Playwright $subcommand succeeded via sudo ${wrapper}"
        return 0
      else
        log "Playwright $subcommand via sudo ${wrapper} failed; continuing"
        continue
      fi
    fi

    if "${cmd[@]}" >/dev/null 2>&1; then
      log "Playwright $subcommand succeeded via ${wrapper}"
      return 0
    fi

    log "Playwright $subcommand via ${wrapper} failed; continuing"
  done < <(playwright_wrappers)

  if ((attempted == 0)); then
    log "No Playwright wrapper commands available"
  fi

  return 1
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
  if ! $sudo_cmd apt-get update -y >/dev/null 2>&1; then
    log "apt-get update failed; skipping system package install"
    return 1
  fi

  if $sudo_cmd apt-get install -y chromium >/dev/null 2>&1; then
    return 0
  fi

  if $sudo_cmd apt-get install -y chromium-browser >/dev/null 2>&1; then
    return 0
  fi

  log "apt-get install chromium|chromium-browser failed"
  return 1
}

ensure_playwright_deps() {
  if run_playwright_command --sudo install-deps chromium; then
    return 0
  fi

  if run_playwright_command install-deps chromium; then
    return 0
  fi

  log "Playwright dependency setup failed across available wrappers"
  return 1
}

main() {
  local existing
  existing="$(find_chromium)"
  if validate_chromium "$existing"; then
    log "Chromium already available at $existing"
  else
    log "Chromium not found; attempting apt-get install before Playwright fallback"
    ensure_apt_chromium || {
      log "System package installation failed; will try Playwright-managed download"
      existing=""
    }
    existing="$(find_chromium)"
    if ! validate_chromium "$existing"; then
      log "Falling back to Playwright-managed Chromium download"
      ensure_playwright_deps || log "Continuing without Playwright system deps; proceeding with download"
      if ! run_playwright_command install chromium; then
        log "Automatic Playwright download attempts exhausted"
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
