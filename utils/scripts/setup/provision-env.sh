#!/usr/bin/env bash
set -euo pipefail

install_cli_tool() {
  local cmd="$1"
  local npm_pkg="$2"
  local apt_pkg="$3"
  local pip_pkg="$4"

  if command -v "$cmd" >/dev/null 2>&1; then
    printf "%s already installed at %s\n" "$cmd" "$(command -v "$cmd")"
    return
  fi

  if [ -n "$npm_pkg" ]; then
    local version
    version=$(node utils/utils/scripts/npm-utils.js "$npm_pkg" 2>/dev/null || true)
    if [ -n "$version" ]; then
      npm install "$npm_pkg@$version" --save-dev --save-exact || true
    fi
    if command -v "$cmd" >/dev/null 2>&1; then return; fi
  fi

  sudo apt-get update && sudo apt-get install -y "$apt_pkg" || true
  if command -v "$cmd" >/dev/null 2>&1; then return; fi

  if [ -n "$pip_pkg" ]; then
    pip install "$pip_pkg" || true
  fi

  if [ "$cmd" = "fd" ] && ! command -v fd >/dev/null 2>&1 && command -v fdfind >/dev/null 2>&1; then
    sudo ln -sf "$(command -v fdfind)" /usr/local/bin/fd
  fi
}

install_cli_tool "rg" "ripgrep" "ripgrep" "ripgrep"
install_cli_tool "fd" "fd-find" "fd-find" "fd-find"
install_cli_tool "jq" "jq" "jq" "jq"

install_node_pkg() {
  local pkg="$1"
  local version
  version=$(node utils/utils/scripts/npm-utils.js "$pkg")
  npm install "$pkg@$version" --save-dev --save-exact
}

install_node_pkg "markdown-it"
install_node_pkg "ajv"
install_node_pkg "pandas"
