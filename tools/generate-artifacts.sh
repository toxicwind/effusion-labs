#!/bin/bash
set -euo pipefail

echo "🎨 Generating artifacts locally..."

# Configuration
ARTIFACT_DATE=$(date +%Y%m%d_%H%M%S)
ARTIFACT_DIR="artifacts/${ARTIFACT_DATE}"
BUNDLE_NAME="lv-bundle-$(date +%Y%m%d).tar.gz"

# 1. Run lv-images crawl (expensive operation)
echo "📸 Running lv-images crawl..."
npm run crawl:pages

# 2. Build dataset
echo "🏗️  Building dataset..."
node tools/lv-images/pipeline.mjs build --keep

# 3. Bundle artifacts
echo "📦 Bundling artifacts..."
mkdir -p "$ARTIFACT_DIR"

# Copy generated content
if [ -d "src/content/projects/lv-images/generated" ]; then
  cp -r src/content/projects/lv-images/generated "$ARTIFACT_DIR/"
fi

# Copy built site artifacts
if [ -d "_site/content/projects/lv-images" ]; then
  cp -r _site/content/projects/lv-images "$ARTIFACT_DIR/site_lv"
fi

# Create tarball
tar -czf "artifacts/$BUNDLE_NAME" -C "$ARTIFACT_DIR" .

# Cleanup temp directory
rm -rf "$ARTIFACT_DIR"

echo "✅ Artifact bundle created: artifacts/$BUNDLE_NAME"
echo "📊 Bundle size: $(du -h "artifacts/$BUNDLE_NAME" | cut -f1)"
