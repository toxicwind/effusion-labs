#!/bin/bash
set -euo pipefail

# CHRONOS FORGE :: Artifact Sync (Production One-Shot)
# Fetches latest artifact bundle and expands it into the volume.

LOG_TAG="[artifact-sync]"
REPO="toxicwind/effusion_labs_final"
TAG="artifacts-latest"
DEST_DIR="/artifacts"
MARKER_FILE="${DEST_DIR}/.artifact_git_sha"

log() {
    echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") ${LOG_TAG} $1"
}

log "Starting artifact sync..."

if [ -z "${GITHUB_TOKEN:-}" ]; then
    log "ERROR: GITHUB_TOKEN is required for artifact sync."
    exit 1
fi

# 1. Fetch Latest Release Asset Info
log "Fetching latest release info from GitHub..."
# Try to use gh if available, else curl
if command -v gh >/dev/null 2>&1; then
    ASSET_URL=$(gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[] | select(.name | endswith(".tar.zst") or endswith(".tar.gz")) | .url' | head -n 1)
else
    # Fallback to curl + API
    ASSET_URL=$(curl -fsS -H "Authorization: token $GITHUB_TOKEN" \
        "https://api.github.com/repos/${REPO}/releases/tags/${TAG}" | \
        jq -r '.assets[] | select(.name | endswith(".tar.zst") or endswith(".tar.gz")) | .browser_download_url' | head -n 1)
fi

if [ -z "$ASSET_URL" ]; then
    log "No artifact found in release ${TAG}. Skipping sync."
    exit 0
fi

BUNDLE_NAME=$(basename "$ASSET_URL")
WORKAREA=$(mktemp -d)
trap 'rm -rf "$WORKAREA"' EXIT

# 2. Download Bundle
log "Downloading ${BUNDLE_NAME}..."
curl -fsSL -H "Authorization: token $GITHUB_TOKEN" -o "${WORKAREA}/${BUNDLE_NAME}" "$ASSET_URL"

# 3. Extract and Verify
log "Extracting bundle..."
mkdir -p "$DEST_DIR"

if [[ "$BUNDLE_NAME" == *.tar.zst ]]; then
    tar --zstd -xf "${WORKAREA}/${BUNDLE_NAME}" -C "$DEST_DIR"
else
    tar -xzf "${WORKAREA}/${BUNDLE_NAME}" -C "$DEST_DIR"
fi

# 4. Write Marker
if [ -f "${DEST_DIR}/manifest.json" ]; then
    GIT_SHA=$(jq -r .git_sha "${DEST_DIR}/manifest.json")
    echo "$GIT_SHA" > "$MARKER_FILE"
    log "Artifact sync complete. Git SHA: ${GIT_SHA}"
else
    log "WARNING: manifest.json not found in bundle."
fi

log "Sync finished."
