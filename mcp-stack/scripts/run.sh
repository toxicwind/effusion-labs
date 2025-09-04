#!/usr/bin/env bash
set -euo pipefail
PROFILE=${PROFILE:-dev}
node ../gateway/index.js
