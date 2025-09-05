#!/bin/sh
# Prints one of: podman, docker, none
if command -v podman >/dev/null 2>&1; then echo podman; exit 0; fi
if command -v docker >/dev/null 2>&1; then echo docker; exit 0; fi
echo none
