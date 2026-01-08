#!/bin/bash
set -euo pipefail

# CHRONOS FORGE :: Artifact Uploader
# Uploads the latest artifact bundle to GitHub Releases

LOG_TAG="[artifact-upload]"
REPO="toxicwind/effusion_labs_final"
TAG="artifacts-latest"

log() {
    echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") ${LOG_TAG} $1"
}

# Ensure we're in repo root
cd "$(git rev-parse --show-toplevel)"

if [ ! -f "artifacts/LATEST_BUNDLE" ]; then
    log "ERROR: No artifact found to upload. Run tools/generate-artifacts.sh first."
    exit 1
fi

BUNDLE_PATH=$(cat artifacts/LATEST_BUNDLE)
BUNDLE_NAME=$(basename "$BUNDLE_PATH")

if [ -z "${GITHUB_TOKEN:-}" ]; then
    log "ERROR: GITHUB_TOKEN is not set. Cannot upload artifact."
    exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
    log "ERROR: gh CLI not found. Please install it or use the GitHub API directly."
    exit 1
fi

log "Targeting repository: ${REPO}"
log "Uploading ${BUNDLE_NAME} to release tag: ${TAG}"

# Ensure release exists (idempotent)
if ! gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
    log "Release ${TAG} not found. Creating it..."
    gh release create "$TAG" --repo "$REPO" --title "Artifacts Bundle" --notes "Latest automated artifact bundles." || true
fi

# Upload asset (overwrite if exists)
log "Uploading asset..."
gh release upload "$TAG" "$BUNDLE_PATH" --repo "$REPO" --clobber

log "Upload complete: https://github.com/${REPO}/releases/tag/${TAG}"
echo "$TAG" > artifacts/LATEST_TAG
echo "$REPO" > artifacts/LATEST_REPO
