#!/usr/bin/env bash
# flicker job: build the effusion web image for a given commit SHA.
# Runs on yote. The flicker content-hash cache makes identical SHAs a no-op
# at the job layer; docker layer caching speeds up rebuilds underneath.
set -euo pipefail

REPO="/home/toxic/projects/effusion-labs"
SHA="${1:?usage: build.sh <sha>}"
SHORT="${SHA:0:7}"

cd "$REPO"
git fetch origin -q
git checkout -q "$SHA"

docker build \
  -f infra/flicker/Dockerfile.web \
  -t "effusion-web:${SHA}" \
  -t "effusion-web:${SHORT}" \
  .

echo "BUILT effusion-web:${SHA}"
