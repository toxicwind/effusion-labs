# Effusion Labs

Effusion Labs is a Hypebrut-flavoured Eleventy site wired for constrained CI. The build stack couples
Eleventy 3, Vite 7, Tailwind 4, and daisyUI 5 on Node.js ≥ 22.19. Chromium-driven tooling (Puppeteer,
Playwright) now targets a system-installed browser so the pipeline stays deterministic even when the
network is hostile.

---

## Table of Contents

1. [Quickstart](#quickstart)
2. [Script Taxonomy](#script-taxonomy)
3. [Continuous Integration](#continuous-integration)
4. [Chromium Policy](#chromium-policy)
5. [Docker Image](#docker-image)
6. [Shell Shims](#shell-shims)
7. [Project Structure](#project-structure)
8. [Contributing](#contributing)

---

## Quickstart

```bash
npm ci
npm run dev            # Eleventy dev server with Vite
npm run build          # Production build → _site/
npm run lint           # ESLint + markdown-link-check (skips network in CI)
npm run test           # Playwright integration suite (Chromium required)
```

All scripts assume ESM (`"type": "module"`) and respect Node ≥ 22.19. Use `npm run check` to execute
doctor, formatting, linting, and tests as a single gate before shipping.

---

## Script Taxonomy

The npm scripts are grouped by intent. Network-dependent commands are kept under the `tools:*` tree
and guard against restricted CI environments.

### Build & Runtime

| Script | Description |
| --- | --- |
| `start` / `dev` | Eleventy dev server with Vite live reload. |
| `build` | Production build wrapper (`build:site`). |
| `build:site` | Runs Eleventy in production mode. |
| `build:offline` | Hydrates the LV Images dataset and runs Eleventy behind the offline shim. |
| `build:ci` | Production build that explicitly keeps `CI_NETWORK_OK=0`. |
| `clean` | Removes the `_site/` output directory. |

### Lint, Format, and Tests

| Script | Description |
| --- | --- |
| `format`, `format:check`, `format:classes`, `format:all` | dprint + Rustywind formatting. |
| `lint` | Runs `lint:js` and `lint:links` with pretty stage output. |
| `lint:fix` | ESLint autofix plus link lint (when permitted). |
| `lint:links` | Uses `tools/run-if-network.mjs` to skip when `CI_NETWORK_OK` is not `1`. |
| `lint:dead` | Delegates to `tools:knip:ci`. |
| `test`, `test:watch`, `test:playwright` | Ensure Chromium is wired (`tools/check-chromium.mjs`) before launching the runner. |
| `check` | doctor → format check → lint → tests. |
| `doctor` | Verifies local prerequisites (`rg`, `fd`, `jq`, `sd`, etc.). |

### Tooling & Datasets

All LV Images routines sit under `tools:lv-images:*` so CI never calls them implicitly. Notable
commands:

- `tools:lv-images:hydrate` — restore the bundled dataset.
- `tools:lv-images:build:ci` — deterministic hydrate + offline Eleventy build profile.
- `tools:apply-patches` / `tools:check-patches` — wrap `tools/apply-patches.mjs` for manual patch
  management.
- `tools:run-if-network` — helper used by lint scripts to enforce the network contract.

### MCP Utilities

The MCP gateway lives under `mcp-stack/` and retains the `mcp:*` trio for development, integration,
and smoke testing. They continue to run only when explicitly requested.

---

## Continuous Integration

- **`ci.yml`** — three-stage pipeline (lint → test → build). Each stage installs Chromium via APT,
  writes `PUPPETEER_EXECUTABLE_PATH`, and runs `tools/check-chromium.mjs` before any headless work.
  Build artifacts are published as workflow artifacts for inspection.
- **`dead.yml`** — scheduled/manual Knip scan. Respects the network contract and uploads the JSON
  report when generated.
- **`deploy.yml`** — builds the production image with `.portainer/Dockerfile`, pushes to GHCR, and
  optionally pings the Portainer webhook.

> **Network contract:** CI runners treat the public network as unavailable unless
> `CI_NETWORK_OK=1`. Scripts that require outbound traffic are opt-in via `tools/run-if-network.mjs`.

---

## Chromium Policy

- Chromium is provisioned via system packages (`apt-get install chromium`).
- `tools/check-chromium.mjs` validates availability and writes `PUPPETEER_EXECUTABLE_PATH` to the
  GitHub Actions environment when missing.
- `bin/chromium` exposes a consistent CLI entrypoint, prioritising the env var and falling back to
  system binaries.
- Puppeteer and Playwright downloads are disabled (`PUPPETEER_SKIP_DOWNLOAD=1`,
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`).

This keeps Puppeteer, Playwright, and any Eleventy transforms aligned without hitting forbidden CDNs.

---

## Docker Image

`.portainer/Dockerfile` now targets Debian Bookworm. It installs Chromium inside the build stage,
exports `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`, runs `tools/check-chromium.mjs`, validates
patches, and produces the static `_site/` output. The final image is a slim `nginx:1.27-bookworm`
layer with health checks intact.

---

## Shell Shims

Local shims live under `bin/bin/` and provide deterministic CLIs for CI and Docker. Highlights:

- `bin/_lib.sh` removes the repo bin directory from lookup order to avoid recursion.
- `bin/chromium` honours `PUPPETEER_EXECUTABLE_PATH` then falls back to system executables.
- `bin/curl` funnels requests through `tools/shims/curl-to-markdown.mjs` while preserving the system
  binary in `CURL_SHIM_REAL`.
- `fd`, `rg`, and siblings enforce safe defaults (hidden files allowed, repository directories
  excluded, risky flags stripped) before delegating to Node-installed or system binaries.

Shims exit with clear errors when the required command is missing—especially important when running
in CI.

---

## Project Structure

```
src/content/          → Markdown & Nunjucks content.
src/lib/              → Filters, data pipelines, Eleventy helpers.
tools/                → Build + diagnostics scripts (Chromium checker, LV Images pipeline, patches).
bin/bin/              → Shimmed CLI utilities for reproducible environments.
.github/workflows/    → ci.yml, dead.yml, deploy.yml.
.portainer/           → Dockerfile + nginx.conf for production.
patches/              → Vendored hotfixes applied via tools/apply-patches.mjs.
```

---

## Contributing

1. `npm ci`
2. `npm run check`
3. Open a pull request — CI will lint, test, and build automatically.

Follow the ISC license and respect the network contract (`CI_NETWORK_OK`) when adding new scripts or
workflows.
