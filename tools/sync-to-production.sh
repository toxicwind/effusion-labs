#!/bin/bash
set -euo pipefail

echo "🚀 Syncing local artifacts to production..."

# Configuration
BUNDLE_NAME="lv-bundle-$(date +%Y%m%d).tar.gz"
TAG="artifacts-$(date +%Y%m%d)"
BUNDLE_PATH="artifacts/$BUNDLE_NAME"

# Check if bundle exists
if [ ! -f "$BUNDLE_PATH" ]; then
  echo "❌ Bundle not found: $BUNDLE_PATH"
  echo "Run ./tools/generate-artifacts.sh first"
  exit 1
fi

# 1. Create GitHub Release
echo "📤 Uploading to GitHub Releases..."
gh release create "$TAG" "$BUNDLE_PATH" \
  --title "LV Artifacts $(date +%Y-%m-%d)" \
  --notes "Generated artifacts from local crawl on $(hostname) at $(date)" \
  --repo toxicwind/effusion_labs_final

echo "✅ Uploaded to: https://github.com/toxicwind/effusion_labs_final/releases/tag/$TAG"

# 2. Trigger Portainer redeploy (optional)
if [[ -n "${PORTAINER_WEBHOOK:-}" ]]; then
  echo "🔄 Triggering Portainer redeploy..."
  curl --fail --retry 3 --retry-delay 2 -X POST "$PORTAINER_WEBHOOK"
  echo "✅ Portainer redeploy triggered"
else
  echo "⚠️  PORTAINER_WEBHOOK not set"
  echo "Set it with: export PORTAINER_WEBHOOK='https://...'"
  echo "Or manually redeploy via Portainer UI"
fi

echo "🎉 Sync complete!"
echo ""
echo "Next steps:"
echo "1. Wait for GitHub Actions to rebuild Docker image"
echo "2. Portainer will pull new image automatically"
echo "3. Verify deployment at your production URL"
