#!/bin/bash
set -euo pipefail

# CHRONOS FORGE :: Sync to Production
# Orchestrator script: Generates artifacts (if missing), uploads them. (Deploy via flicker; see DEPLOY.md.)

echo "🚀 Syncing to Production..."

# 1. Generate Artifacts if needed
if [ ! -f "artifacts/LATEST_BUNDLE" ]; then
    echo "⚙️  Generating artifacts..."
    ./tools/generate-artifacts.sh
else
    echo "ℹ️  Using existing artifacts (run generate-artifacts.sh to refresh)"
fi

# 2. Upload Artifacts
echo "u001b[34m📤 Uploading artifacts...\u001b[0m"
./tools/upload-artifacts.sh

echo "🎉 Sync flow complete."
