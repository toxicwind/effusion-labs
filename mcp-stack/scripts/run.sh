#!/bin/sh
set -eu
_self="$0"
case "$_self" in /*) _dir=$(dirname "$_self");; *) _dir=$(dirname "$(pwd)/$_self");; esac
root="$_dir/.."
root=$(cd "$root" 2>/dev/null && pwd)
engine="$root/scripts/engine-detect.sh"
ENGINE="$($engine)"
if [ "$ENGINE" = podman ]; then
  podman compose -f "$root/ci/compose.dev.yml" up -d
  exit 0
fi
if [ "$ENGINE" = docker ]; then
  docker compose -f "$root/ci/compose.dev.yml" up -d
  exit 0
fi
# none
"$root/ci/stubs/start-stubs.sh" &
stub_pid=$!
trap 'kill $stub_pid 2>/dev/null || true' INT TERM EXIT
HOST_ALLOWLIST=${HOST_ALLOWLIST:-localhost,127.0.0.1} \
FLARESOLVERR_URL=${FLARESOLVERR_URL:-http://127.0.0.1:8191} \
PROFILE=${PROFILE:-dev} \
node "$root/gateway/server.mjs"
