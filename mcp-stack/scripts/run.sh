#!/bin/sh
set -eu
# POSIX-safe resolution of this script's directory
_self="$0"
case "$_self" in /*) _dir=$(dirname "$_self");; *) _dir=$(dirname "$(pwd)/$_self");; esac
root="$_dir/../.."
# Normalize path
root=$(cd "$root" 2>/dev/null && pwd)
exec node "$root/mcp-stack/gateway/server.mjs"
