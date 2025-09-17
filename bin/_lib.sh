#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="$REPO_ROOT/.tools"

can_sudo() {
  command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1
}

path_without_repo_bin() {
  local new_path=""
  local part
  local -a path_parts=()
  IFS=':' read -ra path_parts <<<"${PATH:-}"
  for part in "${path_parts[@]}"; do
    [[ -z "$part" ]] && part='.'
    if [[ "$part" == "$REPO_ROOT/bin" ]]; then
      continue
    fi
    if [[ -z "$new_path" ]]; then
      new_path="$part"
    else
      new_path+=":$part"
    fi
  done
  printf '%s' "$new_path"
}

apt_install() {
  local pkg="${1:-}"
  [[ -z "$pkg" ]] && return 1
  if can_sudo; then
    sudo apt-get update -y && sudo apt-get install -y "$pkg"
  else
    return 1
  fi
}

retry_exec() {
  local -a all_args=("$@")
  local sentinel_index=-1
  local sanitized_path="$(path_without_repo_bin)"
  for (( idx=${#all_args[@]}-1; idx>=0; idx-- )); do
    if [[ "${all_args[idx]}" == "--" ]]; then
      sentinel_index=$idx
      break
    fi
  done

  if (( sentinel_index < 0 )); then
    echo "retry_exec: missing '--' separator" >&2
    return 1
  fi

  local -a args=()
  if (( sentinel_index > 0 )); then
    args=("${all_args[@]:0:sentinel_index}")
  fi

  local -a candidates=()
  if (( sentinel_index + 1 < ${#all_args[@]} )); then
    candidates=("${all_args[@]:sentinel_index+1}")
  fi

  if (( ${#candidates[@]} == 0 )); then
    echo "retry_exec: no fallback executables provided" >&2
    return 1
  fi

  local c resolved
  for c in "${candidates[@]}"; do
    [[ -z "$c" ]] && continue
    if [[ -x "$c" ]]; then
      exec "$c" "${args[@]}"
    fi
    if [[ -n "$sanitized_path" ]]; then
      resolved="$(PATH="$sanitized_path" command -v "$c" 2>/dev/null || true)"
    else
      resolved="$(command -v "$c" 2>/dev/null || true)"
    fi
    if [[ -n "$resolved" ]]; then
      exec "$resolved" "${args[@]}"
    fi
  done

  return 1
}

_python_bin() {
  command -v python3 2>/dev/null || command -v python 2>/dev/null || true
}

_version_major() {
  local raw="${1#v}"
  raw="${raw%%.*}"
  [[ "$raw" =~ ^[0-9]+$ ]] || return 1
  printf '%s' "$raw"
}

node_version_satisfies() {
  local bin_path="${1:-}"
  local desired_major="${2:-24}"
  [[ -n "$bin_path" && -x "$bin_path" ]] || return 1
  local version
  version="$("$bin_path" --version 2>/dev/null || true)"
  [[ -n "$version" ]] || return 1
  local major
  major="$(_version_major "$version" || true)"
  [[ -n "$major" ]] || return 1
  (( major >= desired_major ))
}

_detect_node_platform() {
  local os arch
  os="$(uname -s 2>/dev/null || echo unknown)"
  arch="$(uname -m 2>/dev/null || echo unknown)"
  local os_tag arch_tag
  case "$os" in
    Linux) os_tag=linux ;;
    Darwin) os_tag=darwin ;;
    *) return 1 ;;
  esac
  case "$arch" in
    x86_64|amd64) arch_tag=x64 ;;
    arm64|aarch64) arch_tag=arm64 ;;
    *) return 1 ;;
  esac
  printf '%s %s' "$os_tag" "$arch_tag"
}

_github_latest_asset() {
  local repo="${1:-}"
  local suffix="${2:-}"
  [[ -n "$repo" && -n "$suffix" ]] || return 1
  local python
  python="$(_python_bin)"
  [[ -n "$python" ]] || return 1
  "$python" - "$repo" "$suffix" "${GITHUB_TOKEN:-}" <<'GITHUB_JSON'
import json
import sys
import urllib.request

repo, suffix, token = sys.argv[1:4]
headers = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "effusion-labs-shim",
}
if token:
    headers["Authorization"] = f"Bearer {token}"

url = f"https://api.github.com/repos/{repo}/releases/latest"
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, timeout=30) as resp:
    data = json.load(resp)

tag = data.get("tag_name") or ""
for asset in data.get("assets", []):
    name = asset.get("name") or ""
    if name.endswith(suffix):
        dl = asset.get("browser_download_url") or ""
        if dl:
            sys.stdout.write(f"{tag}|{name}|{dl}")
            sys.exit(0)

sys.exit(1)
GITHUB_JSON
}

ensure_node_runtime() {
  local desired_major="${1:-24}"
  local tools_node="$TOOLS_DIR/node/node"
  if node_version_satisfies "$tools_node" "$desired_major"; then
    return 0
  fi

  local path_without
  path_without="$(path_without_repo_bin)"
  local system_node=""
  if [[ -n "$path_without" ]]; then
    system_node="$(PATH="$path_without" command -v node 2>/dev/null || true)"
  else
    system_node="$(command -v node 2>/dev/null || true)"
  fi
  if node_version_satisfies "$system_node" "$desired_major"; then
    return 0
  fi

  local platform
  platform="$(_detect_node_platform)" || return 1
  local os_tag="${platform%% *}"
  local arch_tag="${platform##* }"
  local shasums_url="https://nodejs.org/dist/latest-v${desired_major}.x/SHASUMS256.txt"
  local tarball
  tarball="$(curl -fsSL "$shasums_url" 2>/dev/null | grep "node-v${desired_major}.*-${os_tag}-${arch_tag}.tar.xz" | awk '{print $2}' | head -n 1)"
  [[ -n "$tarball" ]] || return 1
  local version_dir="${tarball%.tar.xz}"
  local version="${version_dir%%-${os_tag}-${arch_tag}}"
  local version_tag="${version#node-}"
  local url="https://nodejs.org/dist/${version_tag}/${tarball}"
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  (
    set -e
    trap 'rm -rf "$tmp_dir"' EXIT
    local archive="$tmp_dir/node.tar.xz"
    curl -fsSL "$url" -o "$archive"
    tar -xJf "$archive" -C "$tmp_dir"
    local extracted="$tmp_dir/$version_dir"
    [[ -d "$extracted" ]] || exit 1
    mkdir -p "$TOOLS_DIR/node"
    rm -rf "$TOOLS_DIR/node/$version_dir"
    mv "$extracted" "$TOOLS_DIR/node/$version_dir"
    ln -sf "$TOOLS_DIR/node/$version_dir/bin/node" "$TOOLS_DIR/node/node"
    mkdir -p "$TOOLS_DIR/npm"
    ln -sf "$TOOLS_DIR/node/$version_dir/bin/npm" "$TOOLS_DIR/npm/npm"
    if [[ -x "$TOOLS_DIR/node/$version_dir/bin/npx" ]]; then
      ln -sf "$TOOLS_DIR/node/$version_dir/bin/npx" "$TOOLS_DIR/npm/npx"
    fi
  )
}

_detect_rust_target() {
  local os arch
  os="$(uname -s 2>/dev/null || echo unknown)"
  arch="$(uname -m 2>/dev/null || echo unknown)"
  case "$os" in
    Linux)
      case "$arch" in
        x86_64|amd64) printf 'x86_64-unknown-linux-gnu'; return 0 ;;
        arm64|aarch64) printf 'aarch64-unknown-linux-gnu'; return 0 ;;
      esac
      ;;
    Darwin)
      case "$arch" in
        x86_64|amd64) printf 'x86_64-apple-darwin'; return 0 ;;
        arm64|aarch64) printf 'aarch64-apple-darwin'; return 0 ;;
      esac
      ;;
  esac
  return 1
}

_install_fd_release() {
  local target="${1:-}"
  [[ -n "$target" ]] || return 1
  local info
  info="$(_github_latest_asset "sharkdp/fd" "-${target}.tar.gz" 2>/dev/null)" || return 1
  local tag asset url
  IFS='|' read -r tag asset url <<<"$info"
  [[ -n "$asset" && -n "$url" ]] || return 1
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  (
    set -e
    trap 'rm -rf "$tmp_dir"' EXIT
    local archive="$tmp_dir/$asset"
    curl -fsSL "$url" -o "$archive"
    tar -xzf "$archive" -C "$tmp_dir"
    local extracted="$tmp_dir/${asset%.tar.gz}"
    [[ -d "$extracted" ]] || exit 1
    mkdir -p "$TOOLS_DIR/fd"
    rm -rf "$TOOLS_DIR/fd/${asset%.tar.gz}"
    mv "$extracted" "$TOOLS_DIR/fd/${asset%.tar.gz}"
    ln -sf "$TOOLS_DIR/fd/${asset%.tar.gz}/fd" "$TOOLS_DIR/fd/fd"
  )
}

ensure_fd_tool() {
  if [[ -x "$TOOLS_DIR/fd/fd" ]]; then
    return 0
  fi
  if command -v fd >/dev/null 2>&1 || command -v fdfind >/dev/null 2>&1; then
    return 0
  fi
  local target
  target="$(_detect_rust_target)" || return 1
  if _install_fd_release "$target"; then
    return 0
  fi
  apt_install fd-find
}

_install_sd_release() {
  local target="${1:-}"
  [[ -n "$target" ]] || return 1
  local info
  info="$(_github_latest_asset "chmln/sd" "-${target}.tar.gz" 2>/dev/null)" || return 1
  local tag asset url
  IFS='|' read -r tag asset url <<<"$info"
  [[ -n "$asset" && -n "$url" ]] || return 1
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  (
    set -e
    trap 'rm -rf "$tmp_dir"' EXIT
    local archive="$tmp_dir/$asset"
    curl -fsSL "$url" -o "$archive"
    tar -xzf "$archive" -C "$tmp_dir"
    local extracted="$tmp_dir/${asset%.tar.gz}"
    [[ -d "$extracted" ]] || exit 1
    mkdir -p "$TOOLS_DIR/sd"
    rm -rf "$TOOLS_DIR/sd/${asset%.tar.gz}"
    mv "$extracted" "$TOOLS_DIR/sd/${asset%.tar.gz}"
    ln -sf "$TOOLS_DIR/sd/${asset%.tar.gz}/sd" "$TOOLS_DIR/sd/sd"
  )
}

ensure_sd_tool() {
  if [[ -x "$TOOLS_DIR/sd/sd" ]]; then
    return 0
  fi
  if command -v sd >/dev/null 2>&1; then
    return 0
  fi
  local target
  target="$(_detect_rust_target)" || return 1
  if _install_sd_release "$target"; then
    return 0
  fi
  apt_install sd
}
