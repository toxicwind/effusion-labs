# Effusion Labs

Effusion Labs is a digital studio and knowledge base curated with **Eleventy v3**, **Vite 7**, and a
deterministic LV images dataset. The stack targets **Node.js ≥ 22.19** and runs entirely in
**ECMAScript modules**. Builds run without public-network access thanks to a bundled offline dataset
and tightly cached CI.

---

## Table of Contents

- [System Overview](#system-overview)
- [Requirements](#requirements)
- [Setup](#setup)
- [Scripts](#scripts)
  - [Core Workflow](#core-workflow)
  - [Quality & Safety Nets](#quality--safety-nets)
  - [Dataset Orchestration (`images:*`)](#dataset-orchestration-images)
  - [Utilities & Legacy Aliases](#utilities--legacy-aliases)
- [Dataset Lifecycle](#dataset-lifecycle)
- [CI & Automation](#ci--automation)
- [Docker & Portainer](#docker--portainer)
- [Development Workflow](#development-workflow)
- [Search & Orientation](#search--orientation)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## System Overview

- **Eleventy + Vite** for site generation and dev-time bundling.
- **Tailwind CSS 4** and **daisyUI 5** provide styling primitives.
- **LV images pipeline** ships with a pre-bundled archive so CI, Docker, and Portainer stay fast even
  with unreliable networks.
- **Patching** is handled by `tools/apply-patches.mjs` with explicit scripts (`apply:patches`,
  `verify:patches`).
- **Testing** uses Playwright + `c8` coverage; linting uses ESLint 9 with custom resolvers.

---

## Requirements

- Node.js ≥ 22.19 (see [`.nvmrc`](./.nvmrc))
- npm ≥ 10
- Git
- Optional: Docker + Docker Compose (for Portainer and the Markdown gateway)

---

## Setup

```bash
# install dependencies (patches run automatically when tools are present)
npm install

# hydrate the offline dataset from the committed archive
npm run images:hydrate

# start the dev server
npm run dev
```

The LV dataset lives in `src/content/projects/lv-images/generated/`. Keep the bundle (`lv.bundle.tgz`
and `lv.bundle.json`) committed so deterministic offline builds stay fast.

---

## Scripts

> Tables below mirror the `package.json` script map (new aliases included for backwards compatibility).

### Core Workflow

| Script | Purpose |
| --- | --- |
| `npm run dev` / `npm start` | Eleventy dev server with live reload. |
| `npm run watch` | Eleventy in watch mode without the dev server shell. |
| `npm run build` | Standard production build (hydrates dataset automatically). |
| `npm run build:ci` | Offline + strict build used by CI/Docker. |
| `npm run build:offline` | Offline Eleventy build for local verification. |
| `npm run build:full` | Full-network crawl + build (slow, use sparingly). |
| `npm run clean` | Remove `_site/`. |

### Quality & Safety Nets

| Script | Purpose |
| --- | --- |
| `npm run lint` | ESLint across `src/`, `tools/`, `mcp-stack/`, and Eleventy config. |
| `npm run lint:fix` | ESLint with `--fix`. |
| `npm run lint:links` | Markdown link validation (soft gate in CI). |
| `npm run lint:ci` | Convenience combo: `lint` + `lint:links`. |
| `npm run format` | `dprint` formatter. |
| `npm run format:classes` | Tailwind class sorting via `rustywind`. |
| `npm run format:all` | Class sort + format pass. |
| `npm run check` | Verify patches → lint → tests. |
| `npm test` | Playwright integration tests under `c8` coverage. |
| `npm run doctor` | Environment doctor (Node, tooling, dataset shims). |
| `npm run ci:smoke` | `verify:patches` + `build:ci` (fast assurance used in automation). |

### Dataset Orchestration (`images:*`)

| Script | Purpose |
| --- | --- |
| `npm run images:hydrate` | Expand `generated/lv` from the committed bundle (force clean). |
| `npm run images:update` | Run the Playwright crawler to refresh the dataset. |
| `npm run images:bundle` | Pack a new `lv.bundle.tgz` + manifest. |
| `npm run images:verify` | Check archive hash/size + manifest counts. |
| `npm run images:sync` | Update → bundle → verify (full refresh). |
| `npm run images:stats` | Print dataset counts and total size. |
| `npm run build:full` | Sync + Eleventy build with live network. |

Legacy commands (`lv-images:*`, `build-local-*`, `build-gitactions`) forward to the new names so older
notes still work.

### Utilities & Legacy Aliases

| Script | Purpose |
| --- | --- |
| `npm run apply:patches` | Force-apply dependency patches (used in Docker/CI). |
| `npm run verify:patches` | Validate that patches can be applied cleanly. |
| `npm run bench` | Run Eleventy benchmarks. |
| `npm run knip`, `npm run knip:prod`, `npm run knip:strict` | Dead code analysis variants. |
| `npm run test:ui` | Run Playwright without coverage wrapper. |
| `npm run test:watch` | Watch mode for integration tests. |
| `npm run lv-images:*` | Aliases to the new `images:*` commands. |

---

## Dataset Lifecycle

The LV dataset is bundled with the repo so CI and Docker never depend on the public network.

1. **Hydrate**: `npm run images:hydrate` expands `generated/lv` from `lv.bundle.tgz`.
2. **Verify**: `npm run images:verify` confirms manifest counts and archive hash.
3. **Refresh** (optional):
   - `npm run images:update` crawls fresh assets via Playwright.
   - `npm run images:bundle` produces a new archive & manifest.
   - `npm run images:sync` chains update → bundle → verify for a full refresh.
4. **Commit**: check in `generated/lv/`, `lv.bundle.tgz`, and `lv.bundle.json` so other environments
   hydrate instantly.

During builds the Eleventy pipeline reads from the hydrated dataset. `build:ci` enforces
`verify:patches` and an offline Eleventy run, matching the Docker image.

---

## CI & Automation

GitHub Actions live in [`.github/workflows/`](./.github/workflows/).

- **`CI • Build • Deploy` (`deploy.yml`)**
  - Single `checks` job installs dependencies once, restores the dataset cache, and runs:
    1. `npm run verify:patches`
    2. `npm run lint`
    3. Soft quality signals (`lint:links`, `knip:ci`) with grouped summaries
    4. `npm test`
    5. `npm run build:ci` (artifact uploaded for inspection)
  - Docker builds reuse BuildKit cache scopes (`portainer-web` / `portainer-gateway`) and push to GHCR
    when the branch is `main`.
  - Portainer deploy triggers only after a successful web image push.

- **`build-offline.yml`**
  - Validates the offline bundle by running `npm ci`, `npm run verify:patches`, and
    `npm run build:offline` against the cached dataset.

- **`dependabot-auto-merge.yml`**
  - Approves Dependabot PRs (patch/minor/security) and enables squash auto-merge via the GitHub API.

All workflows prime the npm cache and restore the LV dataset cache, greatly reducing dependence on
unreliable networks.

---

## Docker & Portainer

- `.portainer/Dockerfile` is a 3-stage build (deps → builder → nginx runtime).
  - `npm ci` runs in the deps layer with npm cache mounts.
  - The builder stage applies patches explicitly (`npm run apply:patches`) before verifying and
    running `npm run build:ci`.
  - `_site/` is served via `nginx:stable-alpine` with a lightweight healthcheck.
- Portainer deploys via the webhook stored in `PORTAINER_WEBHOOK_EFFUSION` once the GHCR push
  completes.

Local smoke test:

```bash
docker build -f .portainer/Dockerfile -t effusion-labs:local .
```

---

## Development Workflow

1. `npm install`
2. `npm run images:hydrate`
3. `npm run dev`
4. Before PRs, run `npm run check`. For a faster build sanity check, use `npm run ci:smoke`.

Keep hotfixes in `patches/` and use `npm run apply:patches` whenever dependencies are reinstalled
outside npm scripts (e.g., CI containers).

---

## Search & Orientation

- Use `fdfind`/`fd` or `rg --files` for quick inventory.
- Heavy zones to avoid dumping wholesale: `node_modules/`, `_site/`, `artifacts/`, `logs/`,
  `lib_content.json`.
- Central configs: `eleventy.config.mjs`, `vite.config.mjs`, `tailwind.config.mjs`, `tools/`,
  `src/lib/`.

---

## Troubleshooting

- **Missing patches in Docker/CI**: run `npm run apply:patches` before builds. The Dockerfile already
  does this; local environments should too if `postinstall` is skipped.
- **Dataset checksum mismatch**: rerun `npm run images:sync` and recommit the refreshed bundle.
- **Markdown link check noise**: run `npm run lint:links` locally before pushing to keep the soft CI
  warnings green.
- **Skipping patch apply message**: during `npm ci` (e.g., dependency cache priming) the script logs
  “Skipping patch apply…” when `tools/apply-patches.mjs` is absent; this is expected.

---

## Contributing

Pull requests are welcome—keep patches focused and run `npm run check` before submitting. For agent
operators, follow the conventions in [`AGENTS.md`](./AGENTS.md).

---

## License

Licensed under the [ISC License](./LICENSE).

