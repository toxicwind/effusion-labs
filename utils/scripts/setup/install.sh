#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd 2>/dev/null || pwd)"
log_dir="$repo_root/logs"
mkdir -p "$log_dir"
ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

info() { printf "\033[0;34mℹ️  %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✅ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m⚠️  %s\033[0m\n" "$*"; }
fail() { printf "\033[1;31m❌ %s\033[0m\n" "$*"; exit 1; }

# --- Node & npm sanity -------------------------------------------------------
need_cmd() { command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"; }
need_cmd node
need_cmd npm

# Node engine check (package.json engines.node)
engine_req=24
node_major=$(node -p "process.versions.node.split('.')[0]") || node_major=0
if (( node_major < engine_req )); then
  warn "Node >=${engine_req} required; found $(node -v). Continue at your own risk."
fi

# --- Determine if install is needed -----------------------------------------
hash_file="$repo_root/tmp/.deps_hash"
lock_file="$repo_root/package-lock.json"
current_hash=""
stored_hash=""
if [[ -f "$lock_file" ]]; then
  current_hash=$(sha256sum "$lock_file" | awk '{print $1}')
  stored_hash=$(cat "$hash_file" 2>/dev/null || true)
fi

ci_log="$log_dir/local-install.$(ts).log"
run_ci=1

if [[ -d "$repo_root/node_modules" && -n "$current_hash" && "$current_hash" == "$stored_hash" ]]; then
  run_ci=0
  info "Dependencies appear current (hash match). Skipping npm ci."
else
  info "Dependencies changed or missing. Preparing to install."
fi

# --- Optional OS-level tools (best-effort) ----------------------------------
install_apt() {
  local pkg="$1"; local alias="${2:-}"
  if command -v "$pkg" >/dev/null 2>&1; then return 0; fi
  if [[ -n "$alias" ]] && command -v "$alias" >/dev/null 2>&1; then return 0; fi
  if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
    info "Installing $pkg via apt-get..."
    sudo apt-get update -y >>"$ci_log" 2>&1 || true
    sudo apt-get install -y "$pkg" >>"$ci_log" 2>&1 || true
  fi
}

# Try to ensure helpful CLIs exist
install_apt ripgrep
install_apt fd-find fd
install_apt jq
install_apt yq

# --- NPM installation --------------------------------------------------------
if (( run_ci )); then
  info "Running npm ci (capturing to $ci_log)"
  (
    cd "$repo_root"
    # Reduce noise and speed it up a bit
    npm ci --no-audit --fund=false 2>&1 | tee -a -- "$ci_log"
  ) || fail "npm ci failed. See $ci_log"
  if [[ -n "$current_hash" ]]; then
    mkdir -p "$repo_root/tmp"
    echo "$current_hash" > "$hash_file"
  fi
  ok "npm dependencies installed"
else
  ok "npm dependencies already satisfied"
fi

# --- Quick smoke checks ------------------------------------------------------
if npx --yes --no-install eleventy --version >/dev/null 2>&1; then
  ok "Eleventy available"
else
  warn "Eleventy not found on PATH; try: npx @11ty/eleventy --version"
fi

ok "Local install complete. Logs: $ci_log"
