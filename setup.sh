#!/usr/bin/env bash --login
set -euo pipefail

# Runtime version overrides (optional)
CODEX_ENV_PYTHON_VERSION=${CODEX_ENV_PYTHON_VERSION:-}
CODEX_ENV_NODE_VERSION=${CODEX_ENV_NODE_VERSION:-}
CODEX_ENV_RUBY_VERSION=${CODEX_ENV_RUBY_VERSION:-}
CODEX_ENV_RUST_VERSION=${CODEX_ENV_RUST_VERSION:-}
CODEX_ENV_GO_VERSION=${CODEX_ENV_GO_VERSION:-}
CODEX_ENV_SWIFT_VERSION=${CODEX_ENV_SWIFT_VERSION:-}
CODEX_ENV_PHP_VERSION=${CODEX_ENV_PHP_VERSION:-}

# Helper prints
print_status()  { echo "📦 $1"; }
print_success() { echo "✅ $1"; }
print_warning() { echo "⚠️ $1"; }
print_error()   { echo "❌ $1"; }

echo "🚀 Hybrid Codex Setup Starting"

#
# Phase I – Language Runtimes
#

# Python via pyenv
if [ -n "$CODEX_ENV_PYTHON_VERSION" ]; then
  print_status "Python → $CODEX_ENV_PYTHON_VERSION"
  pyenv global "$CODEX_ENV_PYTHON_VERSION"
  print_success "Python: $(python --version 2>&1)"
fi

# Node via NVM: respect env override, then .nvmrc, then CODEX_ENV_NODE_VERSION, default 22
export NVM_DIR=/root/.nvm
source "$NVM_DIR/nvm.sh"
TARGET_NODE=
if [ -n "$CODEX_ENV_NODE_VERSION" ]; then
  TARGET_NODE="$CODEX_ENV_NODE_VERSION"
elif [ -f .nvmrc ]; then
  TARGET_NODE="$(<.nvmrc)"
else
  TARGET_NODE="22"
fi
print_status "Node.js → $TARGET_NODE"
nvm install "$TARGET_NODE" >/dev/null
nvm use    "$TARGET_NODE" >/dev/null
nvm alias default "$TARGET_NODE"
corepack enable
print_success "Node.js: $(node --version)"

# Ruby via mise
if [ -n "$CODEX_ENV_RUBY_VERSION" ]; then
  CURRENT_RUBY=$(ruby -v | awk '{print $2}' | cut -d'p' -f1)
  print_status "Ruby → $CODEX_ENV_RUBY_VERSION (current: $CURRENT_RUBY)"
  if [ "$CURRENT_RUBY" != "$CODEX_ENV_RUBY_VERSION" ]; then
    mise use --global "ruby@$CODEX_ENV_RUBY_VERSION"
  fi
  print_success "Ruby: $(ruby -v | awk '{print $2}' | cut -d'p' -f1)"
fi

# Rust via rustup
if [ -n "$CODEX_ENV_RUST_VERSION" ]; then
  CURRENT_RUST=$(rustc --version | awk '{print $2}')
  print_status "Rust → $CODEX_ENV_RUST_VERSION (current: $CURRENT_RUST)"
  if [ "$CURRENT_RUST" != "$CODEX_ENV_RUST_VERSION" ]; then
    rustup default "$CODEX_ENV_RUST_VERSION"
  fi
  print_success "Rust: $(rustc --version | awk '{print $2}')"
fi

# Go via mise
if [ -n "$CODEX_ENV_GO_VERSION" ]; then
  CURRENT_GO=$(go version | awk '{print $3}' | sed 's/go//')
  print_status "Go → $CODEX_ENV_GO_VERSION (current: $CURRENT_GO)"
  if [ "$CURRENT_GO" != "$CODEX_ENV_GO_VERSION" ]; then
    mise use --global "go@$CODEX_ENV_GO_VERSION"
  fi
  print_success "Go: $(go version | awk '{print $3}')"
fi

# Swift via mise
if [ -n "$CODEX_ENV_SWIFT_VERSION" ]; then
  CURRENT_SWIFT=$(swift --version 2>&1 | sed -n 's/^Swift version \([0-9]\+\.[0-9]\+\).*/\1/p')
  print_status "Swift → $CODEX_ENV_SWIFT_VERSION (current: $CURRENT_SWIFT)"
  if [ "$CURRENT_SWIFT" != "$CODEX_ENV_SWIFT_VERSION" ]; then
    mise use --global "swift@$CODEX_ENV_SWIFT_VERSION"
  fi
  print_success "Swift: $(swift --version 2>&1 | sed -n 's/^Swift version \([0-9]\+\.[0-9]\+\).*/\1/p')"
fi

# PHP via mise
if [ -n "$CODEX_ENV_PHP_VERSION" ]; then
  CURRENT_PHP=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')
  print_status "PHP → $CODEX_ENV_PHP_VERSION (current: $CURRENT_PHP)"
  if [ "$CURRENT_PHP" != "$CODEX_ENV_PHP_VERSION" ]; then
    mise use --global "php@$CODEX_ENV_PHP_VERSION"
  fi
  print_success "PHP: $CURRENT_PHP"
fi

#
# Phase II – Project Tools
#

# Ensure our local bin directory shims take precedence
export PATH="$PWD/bin:$PATH"

# Fix npm config
print_status "Optimizing npm config..."
npm config delete proxy         >/dev/null 2>&1 || true
npm config delete https-proxy   >/dev/null 2>&1 || true
npm config delete http-proxy    >/dev/null 2>&1 || true
npm config set registry https://registry.npmjs.org/
npm config set fetch-timeout 300000
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
print_success "npm config optimized"

# Install dprint
print_status "Installing dprint..."
if ! command -v dprint >/dev/null 2>&1; then
  curl -fsSL https://dprint.dev/install.sh | sh
  export PATH="$HOME/.dprint/bin:$PATH"
  echo 'export PATH="$HOME/.dprint/bin:$PATH"' >> ~/.bashrc
fi
print_success "dprint: $(dprint --version || echo 'not found')"

# Install npm packages
print_status "Installing npm packages..."
npm install --no-audit --no-fund || {
  print_warning "npm install failed; installing critical packages..."
  for pkg in prettier@3 dprint @playwright/test c8 npm-run-all eslint markdown-link-check; do
    npm install --no-audit --no-fund --save-dev --save-exact "$pkg" || print_warning "Failed $pkg"
  done
}
print_success "npm dependencies installed"

# Install system utilities for shims
print_status "Ensuring shim utilities..."
apt-get update -y
apt-get install -y --no-install-recommends \
  fd-find sd tree bat jq ripgrep coreutils
print_success "Shim utilities installed"

# Install Playwright browsers
print_status "Installing Playwright browsers..."
npx playwright install --with-deps || print_warning "Playwright install issues"
print_success "Playwright browsers installed"

#
# Phase III – Verification
#
print_status "Verifying installation..."

# Node
print_status "Node.js $(node --version)"

# dprint
print_status "dprint $(dprint --version || echo 'none')"

# Key npm packages
for pkg in @playwright/test c8 npm-run-all eslint prettier; do
  if npm list "$pkg" >/dev/null 2>&1; then
    print_success "$pkg installed"
  else
    print_warning "$pkg missing"
  fi
done

# npm scripts
print_status "Testing npm run doctor..."
npm run doctor >/dev/null 2>&1 && print_success "doctor passes" || print_warning "doctor fails"

print_status "Testing npm run format:check..."
npm run format:check >/dev/null 2>&1 && print_success "format:check passes" || print_warning "format:check fails"

print_success "🎉 Setup complete! Source ~/.bashrc to apply PATH changes."
