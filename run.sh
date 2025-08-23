#!/usr/bin/env bash
# scripts/setup-shims.sh
# Repo-local CLI shims + caches for Ubuntu (prefer apt; static fallback where sane).
# Tools: rg, fd, jq, tree, bat, yq, prettier
set -euo pipefail

# --- Repo & paths ---
REPO_ROOT="$(pwd)"
BIN_DIR="$REPO_ROOT/bin"
TOOLS_DIR="$REPO_ROOT/.tools"

# --- Env checks ---
if [[ ! -d "$REPO_ROOT/.git" && ! -f "$REPO_ROOT/package.json" ]]; then
  echo "⚠️  Run this from the repo root (where package.json lives)." >&2
  exit 1
fi

mkdir -p "$TOOLS_DIR"

# --- Helpers (shared) ---
can_sudo() {
  command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1
}

apt_install() {
  # $1: package name
  local pkg="${1:-}"
  [[ -z "$pkg" ]] && return 1
  if can_sudo; then
    sudo apt-get update -y && sudo apt-get install -y "$pkg"
  else
    return 1
  fi
}

retry_exec() {
  # Try a list of candidate commands/paths until one runs.
  # Usage: retry_exec "arg1" "arg2" -- cmd1 cmd2 cmd3 ...
  local args=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --) shift; break;;
      *) args+=("$1"); shift;;
    esac
  done
  local candidates=("$@")
  for c in "${candidates[@]}"; do
    if [[ -x "$c" ]]; then exec "$c" "${args[@]}"; fi
    if command -v "$c" >/dev/null 2>&1; then exec "$c" "${args[@]}"; fi
  done
  return 1
}

download_jq_static() {
  local dest="$TOOLS_DIR/jq/jq"
  mkdir -p "$(dirname "$dest")"
  # Official static x86_64 build
  local url="https://github.com/jqlang/jq/releases/latest/download/jq-linux-amd64"
  echo "⬇️  Downloading jq static build..." >&2
  curl -fsSL "$url" -o "$dest"
  chmod +x "$dest"
}

download_yq_static() {
  local dest="$TOOLS_DIR/yq/yq"
  mkdir -p "$(dirname "$dest")"
  # Mike Farah yq static x86_64 build
  local url="https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64"
  echo "⬇️  Downloading yq static build..." >&2
  curl -fsSL "$url" -o "$dest"
  chmod +x "$dest"
}

# --- Shim writers ---
write_lib() {
  cat >"$BIN_DIR/_lib.sh" <<'LIB'
#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="$REPO_ROOT/.tools"

can_sudo() {
  command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1
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
  local args=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --) shift; break;;
      *) args+=("$1"); shift;;
    esac
  done
  local candidates=("$@")
  for c in "${candidates[@]}"; do
    if [[ -x "$c" ]]; then exec "$c" "${args[@]}"; fi
    if command -v "$c" >/dev/null 2>&1; then exec "$c" "${args[@]}"; fi
  done
  return 1
}
LIB
  chmod +x "$BIN_DIR/_lib.sh"
}

write_rg() {
  cat >"$BIN_DIR/rg" <<'RG'
#!/usr/bin/env bash
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

# Try repo cache, then system, then apt
retry_exec "$@" -- \
  "$TOOLS_DIR/rg/rg" \
  rg
# Install via apt if missing
apt_install ripgrep >/dev/null 2>&1 || true
retry_exec "$@" -- \
  "$TOOLS_DIR/rg/rg" \
  rg

echo "❌ ripgrep (rg) not available and static fallback is not configured for this host. Install via: sudo apt-get install ripgrep" >&2
exit 127
RG
  chmod +x "$BIN_DIR/rg"
}

write_fd() {
  cat >"$BIN_DIR/fd" <<'FD'
#!/usr/bin/env bash
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

# Ubuntu often ships fd as 'fdfind'
retry_exec "$@" -- \
  "$TOOLS_DIR/fd/fd" \
  fd \
  fdfind
apt_install fd-find >/dev/null 2>&1 || true
retry_exec "$@" -- \
  "$TOOLS_DIR/fd/fd" \
  fd \
  fdfind

echo "❌ fd not available. On Ubuntu the binary may be 'fdfind'. Try: sudo apt-get install fd-find" >&2
exit 127
FD
  chmod +x "$BIN_DIR/fd"
}

write_jq() {
  cat >"$BIN_DIR/jq" <<'JQ'
#!/usr/bin/env bash
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

# 1) repo cache 2) system 3) apt 4) static
retry_exec "$@" -- \
  "$TOOLS_DIR/jq/jq" \
  jq
apt_install jq >/dev/null 2>&1 || true
retry_exec "$@" -- \
  "$TOOLS_DIR/jq/jq" \
  jq

# Static fallback
if [[ ! -x "$TOOLS_DIR/jq/jq" ]]; then
  mkdir -p "$TOOLS_DIR/jq"
  url="https://github.com/jqlang/jq/releases/latest/download/jq-linux-amd64"
  echo "⬇️  Downloading jq static build..." >&2
  curl -fsSL "$url" -o "$TOOLS_DIR/jq/jq" && chmod +x "$TOOLS_DIR/jq/jq"
fi
retry_exec "$@" -- "$TOOLS_DIR/jq/jq"

echo "❌ jq not available; apt denied and static download failed." >&2
exit 127
JQ
  chmod +x "$BIN_DIR/jq"
}

write_tree() {
  cat >"$BIN_DIR/tree" <<'TREE'
#!/usr/bin/env bash
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

retry_exec "$@" -- \
  "$TOOLS_DIR/tree/tree" \
  tree
apt_install tree >/dev/null 2>&1 || true
retry_exec "$@" -- \
  "$TOOLS_DIR/tree/tree" \
  tree

echo "❌ tree not available and no static fallback configured. Install via: sudo apt-get install tree" >&2
exit 127
TREE
  chmod +x "$BIN_DIR/tree"
}

write_bat() {
  cat >"$BIN_DIR/bat" <<'BAT'
#!/usr/bin/env bash
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

# Ubuntu may name it 'batcat'
retry_exec "$@" -- \
  "$TOOLS_DIR/bat/bat" \
  bat \
  batcat
apt_install bat >/dev/null 2>&1 || true
retry_exec "$@" -- \
  "$TOOLS_DIR/bat/bat" \
  bat \
  batcat

echo "❌ bat not available. Try: sudo apt-get install bat (binary may be 'batcat')." >&2
exit 127
BAT
  chmod +x "$BIN_DIR/bat"
}

write_yq() {
  cat >"$BIN_DIR/yq" <<'YQ'
#!/usr/bin/env bash
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

# Prefer Mike Farah yq (Go static binary), not Python yq.
retry_exec "$@" -- \
  "$TOOLS_DIR/yq/yq" \
  yq
# Try apt (some Ubuntu distribs ship the Go yq)
apt_install yq >/dev/null 2>&1 || true
retry_exec "$@" -- \
  "$TOOLS_DIR/yq/yq" \
  yq

# Static fallback
if [[ ! -x "$TOOLS_DIR/yq/yq" ]]; then
  mkdir -p "$TOOLS_DIR/yq"
  url="https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64"
  echo "⬇️  Downloading yq static build..." >&2
  curl -fsSL "$url" -o "$TOOLS_DIR/yq/yq" && chmod +x "$TOOLS_DIR/yq/yq"
fi
retry_exec "$@" -- "$TOOLS_DIR/yq/yq"

echo "❌ yq not available; apt denied and static download failed." >&2
exit 127
YQ
  chmod +x "$BIN_DIR/yq"
}

write_prettier() {
  cat >"$BIN_DIR/prettier" <<'PRETTIER'
#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_LOCAL="$REPO_ROOT/node_modules/.bin/prettier"

# Ensure local devDependency exists (non‑interactive idempotent install)
if [[ ! -x "$BIN_LOCAL" ]]; then
  if command -v npm >/dev/null 2>&1; then
    echo "📦 Installing prettier (devDependency)..." >&2
    # Pin major to 3 for stability; exact patch can float via lockfile.
    npm install --save-dev --save-exact prettier@3 >/dev/null 2>&1 || true
  fi
fi

if [[ -x "$BIN_LOCAL" ]]; then
  exec "$BIN_LOCAL" "$@"
fi

# Fallback to global (if present)
if command -v prettier >/dev/null 2>&1; then
  exec prettier "$@"
fi

echo "❌ prettier not available and local install failed. Ensure npm is usable or preinstall devDeps." >&2
exit 127
PRETTIER
  chmod +x "$BIN_DIR/prettier"
}

# --- Main: rebuild bin/ and write shims ---
echo "🧹 Removing existing ./bin (if any)…"
rm -rf "$BIN_DIR"
mkdir -p "$BIN_DIR"

write_lib
write_rg
write_fd
write_jq
write_tree
write_bat
write_yq
write_prettier

echo "✅ Repo shims created in: $BIN_DIR"
ls -1 "$BIN_DIR" | sed 's/^/  /'

cat <<EOF

To prioritize repo shims in this shell session:
  export PATH="$BIN_DIR:\$PATH"

Notes:
- Native tools prefer: repo cache (.tools), then system, then apt.
- Static fallbacks used for jq and yq when apt is unavailable/denied.
- Ubuntu quirks handled:
    fd → tries 'fd' then 'fdfind'
    bat → tries 'bat' then 'batcat'
- Prettier is installed as a local devDependency on first use if needed.

EOF
