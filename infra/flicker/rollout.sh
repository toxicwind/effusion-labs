#!/usr/bin/env bash
# flicker job: roll out the effusion web image for a given commit SHA.
# Health-gated: the new container must answer HTTP before it becomes :live.
# On failure the previous :live image is restored automatically.
set -euo pipefail

SHA="${1:?usage: rollout.sh <sha>}"
COMPOSE_DIR="/home/toxic/projects/effusion-labs/infra/flicker"
cd "$COMPOSE_DIR"

# stash the current live image for instant rollback (may not exist on first deploy)
if docker image inspect effusion-web:live >/dev/null 2>&1; then
  docker tag effusion-web:live effusion-web:previous
  HAVE_PREVIOUS=1
else
  HAVE_PREVIOUS=0
fi

rollback() {
  echo "ROLLOUT FAILED — rolling back" >&2
  if [ "$HAVE_PREVIOUS" = "1" ]; then
    EFFUSION_IMAGE="effusion-web:previous" docker compose -p effusion up -d --force-recreate web
    echo "RESTORED effusion-web:previous"
  fi
  exit 1
}

EFFUSION_IMAGE="effusion-web:${SHA}" docker compose -p effusion up -d --force-recreate web || rollback

for _ in $(seq 1 30); do
  if curl -sf --max-time 3 http://127.0.0.1:43000/ >/dev/null 2>&1; then
    docker tag "effusion-web:${SHA}" effusion-web:live
    echo "HEALTHY effusion-web:${SHA} — now :live"
    exit 0
  fi
  sleep 2
done

rollback
