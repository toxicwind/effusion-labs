#!/usr/bin/env bash
# Codex-friendly setup: no nvm auto-loops, no sudo, proxy/CA persisted, Puppeteer no-download
set -Eeuo pipefail

say() { printf '==> %s\n' "$*"; }
ok()  { printf '✔ %s\n' "$*"; }
warn(){ printf '⚠ %s\n' "$*" >&2; }
die() { printf '✖ %s\n' "$*" >&2; exit 1; }

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

BRC="$HOME/.bashrc"
touch "$BRC"

# ── Phase 0: Persist proxy + CA for agent shell
persist_proxy() {
  local k v
  for k in HTTP_PROXY HTTPS_PROXY NO_PROXY http_proxy https_proxy no_proxy; do
    v="${!k-}"
    if [ -n "${v:-}" ] && ! grep -q "^export $k=" "$BRC" 2>/dev/null; then
      echo "export $k=\"$v\"" >> "$BRC"
    fi
  done
}
persist_proxy

# If Codex provides a MITM CA bundle, wire all major stacks to it and persist
if [ -n "${CODEX_PROXY_CERT-}" ] && [ -r "$CODEX_PROXY_CERT" ]; then
  grep -q 'NODE_EXTRA_CA_CERTS=' "$BRC" 2>/dev/null || echo "export NODE_EXTRA_CA_CERTS=\"$CODEX_PROXY_CERT\"" >> "$BRC"
  grep -q 'GIT_SSL_CAINFO='    "$BRC" 2>/dev/null || echo "export GIT_SSL_CAINFO=\"$CODEX_PROXY_CERT\""  >> "$BRC"
  grep -q 'SSL_CERT_FILE='     "$BRC" 2>/dev/null || echo "export SSL_CERT_FILE=\"$CODEX_PROXY_CERT\""   >> "$BRC"
  grep -q 'REQUESTS_CA_BUNDLE=' "$BRC" 2>/dev/null || echo "export REQUESTS_CA_BUNDLE=\"$CODEX_PROXY_CERT\"" >> "$BRC"
fi

# Make persisted vars visible to the rest of this script
# shellcheck disable=SC1090
. "$BRC" || true
ok "Proxy/CA persisted to ~/.bashrc (if provided)"

# Teach apt about the proxy if present (you are root; no sudo)
if command -v apt-get >/dev/null 2>&1; then
  if [ -n "${http_proxy-}${HTTP_PROXY-}${https_proxy-}${HTTPS_PROXY-}" ]; then
    cat > /etc/apt/apt.conf.d/99proxy <<APTCONF
Acquire::http::Proxy  "${http_proxy:-${HTTP_PROXY:-}}";
Acquire::https::Proxy "${https_proxy:-${HTTPS_PROXY:-${http_proxy:-${HTTP_PROXY:-}}}}";
APTCONF
  fi
fi

# ── Phase 1: Node via nvm, with nvm auto-use disabled to stop loops
say "Installing Node via nvm (no auto-mode)"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# Disable nvm “auto use” before sourcing to prevent repeated nvm_use chatter
export NVM_AUTO_MODE=0
export NVM_AUTO_USE=false

if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  command -v curl >/dev/null 2>&1 || die "curl required for nvm"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
# shellcheck disable=SC1090
. "$NVM_DIR/nvm.sh"

# Resolve desired Node
if [ -f .nvmrc ]; then
  NODE_TARGET="$(head -n1 .nvmrc)"
else
  NODE_TARGET="${NODE_TARGET:-22}"
fi

# Single install/use path. No duplicate calls.
nvm install "$NODE_TARGET" >/dev/null
nvm alias default "$NODE_TARGET" >/dev/null
nvm use --silent "$NODE_TARGET"
command -v corepack >/dev/null 2>&1 && corepack enable >/dev/null 2>&1 || true
ok "Node $(node -v), npm $(npm -v)"

# ── Phase 2: npm hygiene + single lock-aware install
say "Configuring npm and installing deps (once)"
npm config set fund false           >/dev/null
npm config set audit false          >/dev/null
npm config set progress false       >/dev/null
npm config set fetch-timeout 300000 >/dev/null
npm config set fetch-retry-maxtimeout 120000 >/dev/null
# If proxy CA exists, let npm trust it
if [ -n "${CODEX_PROXY_CERT-}" ] && [ -r "$CODEX_PROXY_CERT" ]; then
  npm config set cafile "$CODEX_PROXY_CERT" >/dev/null || true
fi
# If proxy provided, set npm proxy explicitly
[ -n "${HTTP_PROXY-}${http_proxy-}" ]  && npm config set proxy       "${HTTP_PROXY:-${http_proxy:-}}"       >/dev/null || true
[ -n "${HTTPS_PROXY-}${https_proxy-}" ]&& npm config set https-proxy "${HTTPS_PROXY:-${https_proxy:-}}"     >/dev/null || true

if [ -f pnpm-lock.yaml ]; then
  corepack prepare pnpm@latest --activate >/dev/null 2>&1 || true
  pnpm install --frozen-lockfile
elif [ -f yarn.lock ]; then
  corepack prepare yarn@stable --activate >/dev/null 2>&1 || true
  yarn install --frozen-lockfile
elif [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi
ok "Dependencies installed"

# ── Phase 3: System Chrome via apt (preferred) and Puppeteer no-download
say "Provisioning browser"
CHROME_BIN=""
if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  . /etc/os-release 2>/dev/null || true
  apt-get update -yq
  apt-get install -yq ca-certificates curl gnupg
  # Try Google Chrome repo first
  install -d -m 0755 /etc/apt/keyrings
  if curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/keyrings/google.gpg; then
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/google.gpg] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
    apt-get update -yq || true
    apt-get install -yq google-chrome-stable || true
    CHROME_BIN="$(command -v google-chrome || command -v google-chrome-stable || true)"
  fi
  # Fallback to distro Chromium
  if [ -z "$CHROME_BIN" ]; then
    apt-get install -yq chromium-browser || apt-get install -yq chromium || true
    CHROME_BIN="$(command -v chromium || command -v chromium-browser || true)"
  fi
fi

# Persist Puppeteer policy to avoid Chromium downloads
grep -q 'PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=' "$BRC" 2>/dev/null || echo 'export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1' >> "$BRC"
if [ -n "$CHROME_BIN" ]; then
  grep -q 'PUPPETEER_EXECUTABLE_PATH=' "$BRC" 2>/dev/null || echo "export PUPPETEER_EXECUTABLE_PATH=\"$CHROME_BIN\"" >> "$BRC"
  mkdir -p node_modules/.bin
  for name in google-chrome-stable google-chrome chromium chromium-browser; do
    printf '#!/usr/bin/env bash\nexec "%s" --no-sandbox "$@"\n' "$CHROME_BIN" > "node_modules/.bin/$name"
    chmod +x "node_modules/.bin/$name"
  done
  ok "Browser at $CHROME_BIN"
else
  warn "No system browser found; Puppeteer may need manual executable path."
fi

# ── Phase 4: Quick verify
say "Verification"
echo "• Node $(node -v), npm $(npm -v)"
echo "• Proxy HTTP=${HTTP_PROXY:-${http_proxy:-unset}} HTTPS=${HTTPS_PROXY:-${https_proxy:-unset}}"
[ -n "$CHROME_BIN" ] && echo "• Browser: $CHROME_BIN"
npm ping || warn "npm ping failed behind proxy"

ok "Setup complete. Open a new shell or 'source ~/.bashrc' for agent phase."
