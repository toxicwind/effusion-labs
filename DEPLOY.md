# Effusion Labs — deploy pipeline (flicker-native)

Push to `main` → live on yote. No GitHub Actions, no Portainer, no GHCR round-trip.

## The flow

```
push to main (toxicwind/effusion-labs)
  → GitHub webhook → https://github-mcp-host.tailc9ac71.ts.net/effusion-hook
  → effusion-hook (yote :25242, HMAC-verified) submits flicker jobs
  → flicker job effusion-build-<sha>:  fetch + checkout → bun install →
     bun run build:site → docker build → effusion-web:<sha> (local image)
  → flicker job effusion-rollout-<sha>: compose up new image →
     health-gate on :43000 → promote :live, or auto-rollback to :previous
  → fleet announcement (build/rollout green or failed)
```

## Components

| Piece | Where | What |
|---|---|---|
| `infra/flicker/hook.ts` | yote, pitchfork daemon `effusion-hook` (:25242) | GitHub webhook receiver; verifies `X-Hub-Signature-256` against `/home/toxic/.secrets/effusion-hook`; submits the build+rollout jobs |
| `infra/flicker/build.sh` | repo, run as flicker job | checks out the pushed SHA, builds the static site, builds the local image |
| `infra/flicker/rollout.sh` | repo, run as flicker job | health-gated rollout with automatic rollback |
| `infra/flicker/docker-compose.yml` | repo | the stack (local images only) |
| `infra/flicker/Dockerfile.web` | repo | multi-stage: bun build → nginx serve |
| flicker daemon | yote :25241 | job queue, content-hash cache, log streaming |

Flicker's content-hash cache makes re-pushes of an identical tree a no-op
(`CACHED` — no rebuild). The previous `:live` image is always kept as
`:previous` for instant rollback.

## Secrets

- GitHub webhook HMAC secret: `/home/toxic/.secrets/effusion-hook` (yote only,
  0600). Minted on yote, never in the repo, never leaves the box.
- Nothing deploy-related lives in GitHub Secrets anymore.

## Manual deploy

```bash
SHA=$(git -C /home/toxic/projects/effusion-labs rev-parse HEAD)
/home/toxic/projects/effusion-labs/infra/flicker/build.sh $SHA
# or as flicker jobs:
curl -s -X POST 127.0.0.1:25241/api/jobs \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"effusion-build-manual\",\"command\":\"/home/toxic/projects/effusion-labs/infra/flicker/build.sh $SHA\"}"
```

## Rollback

```bash
EFFUSION_IMAGE=effusion-web:previous \
  docker compose -p effusion -f /home/toxic/projects/effusion-labs/infra/flicker/docker-compose.yml \
  up -d --force-recreate web
```

## Retired flow (do not resurrect)

Until 2026-09-30 deploys ran through GitHub Actions + Portainer, and it had
been **dead since 2026-03-15** (every `deploy.yml` run failing; the root
`Dockerfile` the workflow expected never existed in the repo, so
`build_web` could never succeed; Portainer target unreachable from yote).

- `.github/workflows/deploy.yml` — `deploy` job (Portainer webhook) removed.
  Build jobs removed: builds happen in flicker now.
- `tools/sync-to-server.sh`, `tools/sync-to-production.sh` — Portainer webhook
  trigger blocks removed (artifact sync helpers kept).
- GitHub secret `PORTAINER_WEBHOOK_EFFUSION` — deleted.
- `ghcr.io/toxicwind/effusion-labs` / `ghcr.io/toxicwind/markdown-gateway`
  images — superseded by local `effusion-web:*` images; no pushes.

## Out of scope (phase 2)

- The `mildlyawesome` orchestrator/redis/postgres/jaeger stack from the old
  root `docker-compose.yml` was never live on yote and needs secrets
  (`DATABASE_URL`, `POSTGRES_PASSWORD`) that aren't in the repo. It gets its
  own flicker pipeline once Chris provides those.
- `effusion-labs-tickets`: dormant (last push 2026-03-15, no workflows, no
  local checkout). Same pipeline pattern applies when it wakes up.
- Public serving: the stack listens on yote :43000 (tailnet-reachable).
  Funnel/DNS for a public domain is a follow-up.
