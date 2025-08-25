#!/usr/bin/env bash
# install-dev-tools-popos.sh
# Installs: ripgrep (rg), fd, jq, tree, bat, yq (Go), and Go 1.25.0 (verified).
# Idempotent. Pop!_OS/Ubuntu-friendly. Works with/without sudo (user-local fallback).

set -o pipefail

say()  { printf '%s\n' "$*"; }
ok()   { printf '✔ %s\n' "$*"; }
warn() { printf '⚠ %s\n' "$*" >&2; }
err()  { printf '✖ %s\n' "$*" >&2; }
need() { command -v "$1" >/dev/null 2>&1; }

SUDO=''
if need sudo && sudo -n true >/dev/null 2>&1; then SUDO='sudo'
elif need sudo; then sudo -v && SUDO='sudo' || true; fi

mkdir -p "$HOME/.local/bin"
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) warn 'Add to your shell rc:  export PATH="$HOME/.local/bin:$PATH"';; esac

# ---------- APT installs ----------
APT_PKGS=(ripgrep fd-find jq tree bat curl)
if [ -n "$SUDO" ]; then
  say "Updating apt metadata…"
  $SUDO apt-get update -y || warn "apt-get update failed; continuing."
  say "Installing base packages: ${APT_PKGS[*]} …"
  $SUDO apt-get install -y "${APT_PKGS[@]}" || warn "Some packages failed; continuing."
else
  warn "No sudo available; skipping apt installs."
fi

# ---------- fd → normalize to `fd` ----------
if need fdfind; then ln -sf "$(command -v fdfind)" "$HOME/.local/bin/fd"; ok "fd → $(readlink -f "$HOME/.local/bin/fd")"
elif need fd; then ok "fd present: $(command -v fd)"
else warn "fd not found. If apt failed: sudo apt-get install fd-find"; fi

# ---------- bat → normalize to `bat` ----------
if need batcat; then ln -sf "$(command -v batcat)" "$HOME/.local/bin/bat"; ok "bat → $(readlink -f "$HOME/.local/bin/bat")"
elif need bat; then ok "bat present: $(command -v bat)"
else warn "bat not found. If apt failed: sudo apt-get install bat"; fi

# ---------- ripgrep / jq / tree checks ----------
need rg   && ok "ripgrep present: $(command -v rg)"   || warn "ripgrep not found."
need jq   && ok "jq present: $(command -v jq)"        || warn "jq not found."
need tree && ok "tree present: $(command -v tree)"    || warn "tree not found."

# ---------- yq (Go) to ~/.local/bin ----------
YQ_BIN="$HOME/.local/bin/yq"
YQ_URL="https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64"
if [ ! -x "$YQ_BIN" ]; then
  if need curl; then
    say "Installing yq (Go) to ~/.local/bin …"
    if curl -fsSL "$YQ_URL" -o "$YQ_BIN"; then chmod +x "$YQ_BIN"; ok "yq installed: $YQ_BIN"
    else err "Failed to fetch yq. Retry: curl -fsSL $YQ_URL -o ~/.local/bin/yq && chmod +x ~/.local/bin/yq"; fi
  else warn "curl missing; cannot install yq. Install curl then re-run."; fi
else ok "yq present: $YQ_BIN"; fi

# ---------- Go 1.25.0 (linux-amd64/arm64) ----------
GO_VER="1.25.0"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) GO_ARCH="amd64"; GO_SHA256="2852af0cb20a13139b3448992e69b868e50ed0f8a1e5940ee1de9e19a123b613";;
  aarch64|arm64) GO_ARCH="arm64"; GO_SHA256="05de75d6994a2783699815ee553bd5a9327d8b79991de36e38b66862782f54ae";;
  *) warn "Unsupported arch for prebuilt Go ($ARCH). Skipping Go install."; GO_ARCH="";;
esac

install_go() {
  local prefix dest tmp url tar checksum
  if [ -n "$SUDO" ]; then prefix="/usr/local"; else prefix="$HOME/.local"; fi
  dest="$prefix/go"
  url="https://go.dev/dl/go${GO_VER}.linux-${GO_ARCH}.tar.gz"
  tar="$(basename "$url")"
  checksum="$GO_SHA256  $tar"

  tmp="$(mktemp -d)" || { err "mktemp failed"; return 1; }
  say "Downloading Go ${GO_VER} (${GO_ARCH}) …"
  if ! curl -fsSLo "$tmp/$tar" "$url"; then err "Download failed: $url"; rm -rf "$tmp"; return 1; fi

  say "Verifying SHA-256 …"
  if ! (cd "$tmp" && printf '%s\n' "$checksum" | sha256sum -c - >/dev/null 2>&1); then
    err "Checksum mismatch for $tar"; rm -rf "$tmp"; return 1;
  fi

  say "Installing to $prefix/go …"
  if [ -d "$dest" ]; then
    local bak="${dest}.bak.$(date +%s)"
    $SUDO mv "$dest" "$bak" || true
    warn "Previous Go moved to $bak"
  fi
  $SUDO tar -C "$prefix" -xzf "$tmp/$tar" || { err "Extraction failed"; rm -rf "$tmp"; return 1; }
  rm -rf "$tmp"

  # Ensure PATH entries
  local line='export PATH="'"$prefix"'/go/bin:$HOME/go/bin:$PATH"'
  for rc in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.profile"; do
    [ -f "$rc" ] || continue
    grep -F "$prefix/go/bin" "$rc" >/dev/null 2>&1 || printf '\n# Go toolchain\n%s\n' "$line" >> "$rc"
  done

  # Best-effort link for convenience when installing user-local
  if [ -z "$SUDO" ]; then
    ln -sf "$prefix/go/bin/go" "$HOME/.local/bin/go" 2>/dev/null || true
  fi

  # Verify
  if "$prefix/go/bin/go" version >/dev/null 2>&1; then
    ok "$("$prefix/go/bin/go" version)"
    say 'Open a new shell or run:  export PATH="'"$prefix"'/go/bin:$HOME/go/bin:$PATH"'
  else
    warn "Go installed but not on PATH yet; start a new shell or source your rc file."
  fi
}

[ -n "$GO_ARCH" ] && install_go

# ---------- Summary ----------
say ""
say "Done. Tools available (ensure ~/.local/bin and Go bin are on PATH):"
printf '  - %s\n' "rg (ripgrep)" "fd" "jq" "tree" "bat" "yq" "go"
