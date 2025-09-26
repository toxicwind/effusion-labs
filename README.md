# Effusion Labs

Effusion Labs is a digital studio and knowledge base for rapid iteration. It uses **Eleventy v3** as
a static-site generator with **Vite** for modern bundling and hot-module reloading. Content is
authored in **Markdown** and **Nunjucks** under `src/content/` and compiled into a deployable static
site in `_site/`. Styles are managed with **Tailwind CSS v4** and **daisyUI v5**, with a single
entry stylesheet. The project targets **Node.js ≥24** and runs fully in **ECMAScript-module (ESM)**
mode.

---

## Table of Contents

- [Effusion Labs](#effusion-labs)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Features](#features)
  - [Requirements](#requirements)
  - [Quickstart](#quickstart)
  - [Scripts](#scripts)
    - [Core runtime](#core-runtime)
    - [Quality, linting, and tests](#quality-linting-and-tests)
    - [Dataset / LV images](#dataset--lv-images)
  - [MCP (optional experiments)](#mcp-optional-experiments)
  - [Project Structure](#project-structure)
  - [Linking \& Route Canon](#linking--route-canon)
  - [Optional Services](#optional-services)
  - [Development Workflow](#development-workflow)
  - [Search \& View (quick orientation)](#search--view-quick-orientation)
  - [Contributing](#contributing)
  - [License](#license)

---

## Overview

A fast, opinionated Eleventy + Tailwind static site—curated as a digital garden. Batteries included,
CI-ready, and friendly to autonomous coding agents.

---

## Features

- **Dynamic interlinking** — Uses `@photogabble/eleventy-plugin-interlinker` to resolve wiki-style
  links across multiple content types. If a link omits a kind (e.g. `[[Labubu]]`), the resolver
  falls back through:\
  `work → character → product → series → concept → project → spark → meta`.\
  Named kinds such as `product`, `character`, and `series` map to canonical archive routes like
  `/archives/product/<slug>/`.

- **Unresolved-link reporting** — Each build writes `artifacts/reports/interlinker-unresolved.json`.
  CI can be configured with `INTERLINKER_MAX_UNRESOLVED` and `INTERLINKER_FAIL_ON_UNRESOLVED` to
  fail on overs.

- **Patched interlinker** — A hotfix via `tools/apply-patches.mjs` adds a `toHtmlString`
  coercion and guards non-string inputs across ESM/CJS, preventing crashes in
  Markdown-it and JSDOM.

- **Eleventy plugins** — Navigation, RSS, sitemap, schema, plus official Vite integration.

- **Tailwind & daisyUI** — CSS-first styling.

- **Content collections** — Custom collections expose “featured,” “interactive,” and “recentAll.”
  The `work` collection aggregates sparks, concepts, projects, and meta content.

- **Image optimization** — The Eleventy image plugin generates AVIF, WebP, and fallback images at
  multiple widths under `/public`. Filenames are slugified for determinism.

- **Link verification** — `npm run lint:links` uses `markdown-link-check` to detect broken links.
  `npm run lint` runs link checks as part of linting.

- **Testing & coverage** — Integration tests live in `test/` and run via **Playwright**, with
  coverage via `c8`. Use `npm run test:watch` for continuous feedback.
- **npm-utils** — Built-in CLI to search, analyze, and install npm packages. We love new packages
  and libraries; always consider them.

---

## Requirements

- Node.js ≥ 24 (ESM)
- npm (≥ 10 recommended)
- Git
- Optional: Docker + Docker Compose for the companion Markdown gateway

---

## Quickstart

```bash
# install dependencies
npm install

# start dev server with hot reload
npm run dev

# generate a static build in _site/
npm run build

# run format check, lint, and tests
npm run check
```

When the dev server prints a local URL, open it in your browser.

---

## Scripts

> Commands are grouped by intent; every entry maps 1:1 with `package.json`.

### Core runtime

| Script            | Purpose                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `dev` / `start`   | Launch Eleventy + Vite dev server with HMR.                             |
| `serve`           | Run Eleventy in preview mode (`--serve`) without rebuilding on save.    |
| `watch`           | Watch-mode Eleventy rebuilds (no Vite overlay).                         |
| `bench`           | Benchmark Eleventy boot/build with `DEBUG=Eleventy:Benchmark*`.         |
| `eleventy`        | Direct access to the Eleventy CLI (`npx @11ty/eleventy`).               |
| `build`           | Standard production build (`dataset:hydrate` + Eleventy).               |
| `build:offline`   | Offline profile used for smoke checks (hydrate, verify, offline shim).  |
| `build:full`      | Full-network crawl + bundle refresh before building.                    |
| `build:ci`        | Deterministic CI build (hydrate, strict verify, quiet Eleventy).        |
| `clean`           | Delete `_site/`.                                                         |

### Quality, linting, and tests

| Script         | Purpose                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------- |
| `format`       | Format sources via `dprint`.                                                             |
| `format:check` | Validate formatting without touching files.                                             |
| `format:classes` | Normalize Tailwind class order with `rustywind`.                                      |
| `format:all`   | Run `format:classes` then `format`.                                                      |
| `lint`         | Parallel `lint:js` + `lint:links`.                                                       |
| `lint:js`      | ESLint across `src/`, `tools/`, `mcp-stack/`, and `eleventy.config.mjs`.                 |
| `lint:fix`     | ESLint with `--fix`.                                                                     |
| `lint:links`   | Markdown link validation via `markdown-link-check`.                                      |
| `dead`         | Base Knip scan (compact reporter).                                                       |
| `dead:ci`      | Production Knip check (used by CI summaries).                                           |
| `dead:strict`  | Knip production scan with `--strict`.                                                    |
| `dead:watch`   | Watch-mode Knip for local pruning.                                                       |
| `dead:deps` / `dead:files` / `dead:exports` | Focused Knip reports for dependencies, files, and exports. |
| `dead:fix` / `dead:fix:deps` | Guided Knip autofixers for exports/deps.                                   |
| `dead:json` / `dead:md` | Emit Knip reports in JSON or Markdown.                                          |
| `test`         | Integration suite (`c8` + Playwright runner).                                           |
| `test:watch`   | Watch mode for the integration suite.                                                    |
| `test:playwright` | Raw Playwright runner (no coverage).                                                 |
| `check`        | Aggregate guard (`verify:patches`, `format:check`, `lint`, `test`).                      |
| `check:fast`   | Quicker guardrail (`lint` + `test`).                                                     |
| `ci:quality`   | Compact lint + production Knip, intended for CI use.                                    |
| `ci:test`      | Hydrate the dataset (keep cache) then run `npm test`.                                    |
| `ci:build`     | Verify dependency patches then execute the strict CI build profile.                      |
| `doctor`       | Verify local tooling (Node, npm, `rg`, `fd`/`fdfind`, `jq`, etc.).                       |
| `verify:patches` | Ensure `patches/` have been applied to dependencies.                                   |

### Dataset / LV images

| Script              | Purpose                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| `dataset:hydrate`   | Expand the committed `lv.bundle.tgz` into `generated/lv/` (supports `--keep`).   |
| `dataset:update`    | Run the Playwright crawler to refresh the dataset snapshot.                      |
| `dataset:bundle`    | Pack the dataset into `lv.bundle.tgz` and regenerate the manifest.               |
| `dataset:verify`    | Validate archive hash/size against the manifest.                                |
| `dataset:normalize` | Repair absolute paths inside cached URL metadata.                               |
| `dataset:sync`      | Convenience combo (`update` + `bundle` + `verify`).                              |
| `dataset:stats`     | Print file counts and byte totals.                                               |
| `build:full`        | Crawl, bundle, verify, then build locally with full network.                     |
| `build:offline`     | Hydrate + offline Eleventy build for zero-network environments.                   |
| `build:ci`          | Hydrate + strict verify + quiet Eleventy (CI/Portainer profile).                  |
| `lv-images:*`       | Legacy aliases pointing to the corresponding `dataset:*` commands.               |

### MCP (optional experiments)

| Script            | Purpose                   |
| ----------------- | ------------------------- |
| `mcp:dev`         | Start MCP gateway (dev).  |
| `mcp:integration` | Run MCP integration tests |
| `mcp:test`        | Run MCP smoke tests       |

---

## Project Structure

```
eleventy.config.mjs → Monolithic Eleventy configuration (single source of truth)
src/lib/       → Runtime helpers (filters, shortcodes, collections, markdown, archives, data, transforms)
utils/         → Dev wrappers and scripts (no runtime code)
tools/         → Build/validation CLIs (e.g., doctor)
src/content/   → Markdown & Nunjucks pages
test/          → Integration & unit tests (Playwright)
patches/       → Hotfixes applied by tools/apply-patches.mjs
artifacts/     → Reports (e.g., unresolved links), worklogs, export bundles
```

Collections: `sparks`, `concepts`, `projects`, `meta`, `archives`, `work`.

Globals: only editorial data remains in `src/_data/` (e.g., branding, sections). Programmatic data
(build metadata, computed keys, navigation, archive nav) is injected once via `addGlobalData` from
modules in `src/lib/data/` and `src/lib/archives/`.

---

## Linking & Route Canon

Effusion Labs treats wiki-style links as first-class citizens.

- `[[product:Tempura Shrimp]]` → `/archives/product/tempura-shrimp/`
- `[[character:Momo Fox]]` → `/archives/character/momo-fox/`
- Kindless links attempt: `work → character → product → series → concept → project → spark → meta`.

All slugs normalize to lowercase, NFKD, punctuation-free identifiers. Unresolved links are recorded
in `artifacts/reports/interlinker-unresolved.json` and can fail CI when thresholds are exceeded.

---

## Optional Services

A companion `markdown_gateway/` service provides an HTML→Markdown proxy via Docker Compose.

```bash
cd markdown_gateway
docker compose up
```

This starts a gateway container and FlareSolverr solver, useful when converting external HTML into
Markdown for inclusion in the digital garden.

---

## LV Images dataset workflow

The crawler stores its snapshot under `src/content/projects/lv-images/generated/lv/`. GitHub Actions
and Portainer can't rely on the public network, so the pipeline centres around a bundled archive
that travels with the repo.

| Scenario                      | Command                        | Purpose                                                                                                    |
| ----------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Local refresh (full internet) | `npm run dataset:sync`         | Run the Playwright crawler, normalize cache metadata, bundle, and verify the manifest.                     |
| Quick snapshot stats          | `npm run dataset:stats`        | Print file counts and total size for the generated dataset.                                                |
| Offline reuse / CI prep       | `npm run dataset:hydrate -- --keep` | Expand `generated/lv` from the committed bundle; keep existing files between runs.                    |
| Integrity check               | `npm run dataset:verify`       | Confirm archive size/hash and dataset counts against `lv.bundle.json`.                                     |

For end-to-end builds the orchestration commands roll these steps together:

- `npm run build:full` — crawl + bundle + Eleventy build (with full network access).
- `npm run build:offline` — hydrate the bundle and run Eleventy through the offline shim (no
  external calls).
- `npm run build:ci` — strict hydrate/verify + offline Eleventy; this is the profile used by
  CI and Portainer.

Commit `generated/lv/`, `generated/lv.bundle.tgz`, and `generated/lv.bundle.json` after running
`npm run dataset:sync` so that downstream builds stay deterministic even when the network is
hostile.

---

## CI & deployment pipeline

- **Quality** restores cached `node_modules`, runs ESLint, link checks, and Knip in soft-fail mode, and uploads concise summaries.
- **Tests** reuse the same cache, hydrate the dataset bundle with `--keep`, and execute the integration suite.
- **Static build** runs `npm run ci:build`, producing the exact offline artifact that Portainer consumes; pull requests upload `_site/` for inspection.
- **Docker images** leverage Buildx cache, pushing only on `main` (PRs build locally with `load: true`). Gateway images rebuild only when `markdown_gateway/` changes.
- **Deploy** triggers the Portainer webhook once the web image is published.

---

## Development Workflow

- Use `npm run dev` for local editing.
- Keep dependency hotfixes under `patches/` and manage them with `npm run postinstall` (via `tools/apply-patches.mjs`).
- Run `npm run check` before opening a PR.
- Mirror GitHub Actions locally with `npm run ci:quality`, `npm run ci:test`, and `npm run ci:build`.
- CI may enforce unresolved-link thresholds and script consistency.
- Explore new packages with `npm-utils`; we love new libraries and always consider them.

---

## Search & View (quick orientation)

For fast repo mapping and sampling large files:

- List files: `fd` / `fdfind` or `rg --files`
- Read in small windows (head/anchor/tail); avoid dumping minified or >4k-line blocks
- Treat heavy zones cautiously: `node_modules/`, `_site/`, `artifacts/`, `logs/`, `lib_content.json`

See `AGENTS.md` for the full protocol, clamps, and Preview Capsule format.

---

## Contributing

Pull requests are welcome. Keep patches focused and run `npm run check` before submitting.
Contributions should comply with the **ISC License** and follow repo conventions. For agent
workflows, see [`AGENTS.md`](./AGENTS.md).

---

## License

This project is licensed under the [ISC License](./LICENSE).
