# Effusion Labs

Effusion Labs is a digital studio and knowledge base for rapid iteration. It
uses **Eleventy v3** as a static-site generator with **Vite** for modern
bundling and hot-module reloading. Content is authored in **Markdown** and
**Nunjucks** under `src/content/` and compiled into a deployable static site in
`_site/`. Styles are managed with **Tailwind CSS v4** and **daisyUI v5**, with a
single entry stylesheet. The project targets **Node.js ≥24** and runs fully in
**ECMAScript-module (ESM)** mode.

---

## Table of Contents

- [Effusion Labs](#effusion-labs)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Features](#features)
  - [Requirements](#requirements)
  - [Quickstart](#quickstart)
  - [Scripts](#scripts)
    - [Core](#core)
    - [Tooling / Utilities](#tooling--utilities)
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

A fast, opinionated Eleventy + Tailwind static site—curated as a digital garden.
Batteries included, CI-ready, and friendly to autonomous coding agents.

---

## Features

- **Dynamic interlinking** — Uses `@photogabble/eleventy-plugin-interlinker` to
  resolve wiki-style links across multiple content types. If a link omits a kind
  (e.g. `[[Labubu]]`), the resolver falls back through:  
  `work → character → product → series → concept → project → spark → meta`.  
  Named kinds such as `product`, `character`, and `series` map to canonical
  archive routes like `/archives/product/<slug>/`.

- **Unresolved-link reporting** — Each build writes
  `artifacts/reports/interlinker-unresolved.json`. CI can be configured with
  `INTERLINKER_MAX_UNRESOLVED` and `INTERLINKER_FAIL_ON_UNRESOLVED` to fail on
  overs.

- **Patched interlinker** — A hotfix via `patch-package` adds a `toHtmlString`
  coercion and guards non-string inputs across ESM/CJS, preventing crashes in
  Markdown-it and JSDOM.

- **Eleventy plugins** — Navigation, RSS, sitemap, schema, plus official Vite
  integration.

- **Tailwind & daisyUI** — CSS-first styling.

- **Content collections** — Custom collections expose “featured,” “interactive,”
  and “recentAll.” The `work` collection aggregates sparks, concepts, projects,
  and meta content.

- **Image optimization** — The Eleventy image plugin generates AVIF, WebP, and
  fallback images at multiple widths under `/public`. Filenames are slugified
  for determinism.

- **Link verification** — `npm run lint:links` uses `markdown-link-check` to
  detect broken links. `npm run lint` runs link checks as part of linting.

- **Testing & coverage** — Integration tests live in `test/` and run via
  **Playwright**, with coverage via `c8`. Use `npm run test:watch` for
  continuous feedback.
- **npm-utils** — Built-in CLI to search, analyze, and install npm packages. We
  love new packages and libraries; always consider them.

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

> The tables below mirror `package.json` exactly.

### Core

| Script         | Purpose                                                          |
| -------------- | ---------------------------------------------------------------- |
| `dev`          | Run Eleventy with Vite and hot-module reloading                  |
| `preview`      | Serve via the Eleventy wrapper with `--serve` (explicit preview) |
| `eleventy`     | Invoke Eleventy CLI directly (`npx @11ty/eleventy`)              |
| `build`        | Build the static site to `_site/`                                |
| `doctor`       | Verify local environment (Node, npm, rg, fd/fdfind, jq, sd)      |
| `check`        | Run doctor, format check, lint, and tests                        |
| `test`         | Run Playwright integration tests under coverage (`c8`)           |
| `test:watch`   | Watch tests during development                                   |
| `format`       | Format the repo with Prettier (`prettier -w .`)                  |
| `format:check` | Check formatting (`prettier -c .`)                               |
| `lint`         | Project lint entry (runs link checks)                            |
| `lint:links`   | Check Markdown links via `markdown-link-check`                   |

### Tooling / Utilities

| Script            | Purpose                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| `verify:patches`  | Ensure required dependency patches are applied                                 |
| `deps:playwright` | Install Playwright Chromium dependency (no-fail helper)                        |
| `patch:ternary`   | Patch Nunjucks ternary patterns                                                |
| `scan:ternary`    | Scan Nunjucks ternary usage                                                    |
| `npm-utils`       | Search, view, analyze, and install npm packages; always consider new libraries |

### MCP (optional experiments)

| Script            | Purpose                   |
| ----------------- | ------------------------- |
| `mcp:dev`         | Start MCP gateway (dev)   |
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
patches/       → Hotfixes via patch-package
artifacts/     → Reports (e.g., unresolved links), worklogs, export bundles
```

Collections: `sparks`, `concepts`, `projects`, `meta`, `archives`, `work`.

Globals: only editorial data remains in `src/_data/` (e.g., branding, sections).
Programmatic data (build metadata, computed keys, navigation, archive nav) is
injected once via `addGlobalData` from modules in `src/lib/data/` and
`src/lib/archives/`.

---

## Linking & Route Canon

Effusion Labs treats wiki-style links as first-class citizens.

- `[[product:Tempura Shrimp]]` → `/archives/product/tempura-shrimp/`
- `[[character:Momo Fox]]` → `/archives/character/momo-fox/`
- Kindless links attempt:
  `work → character → product → series → concept → project → spark → meta`.

All slugs normalize to lowercase, NFKD, punctuation-free identifiers. Unresolved
links are recorded in `artifacts/reports/interlinker-unresolved.json` and can
fail CI when thresholds are exceeded.

---

## Optional Services

A companion `markdown_gateway/` service provides an HTML→Markdown proxy via
Docker Compose.

```bash
cd markdown_gateway
docker compose up
```

This starts a gateway container and FlareSolverr solver, useful when converting
external HTML into Markdown for inclusion in the digital garden.

---

## LV Images dataset workflow

The Louis Vuitton crawler writes its dataset to
`src/content/projects/lv-images/generated/lv/`. GitHub Actions and Portainer
builds now expect a pre-built bundle rather than reaching out to the network.

| Step | Command | Purpose |
| --- | --- | --- |
| 1 | `npm run lv-images:update` | Refresh the dataset locally via Playwright. |
| 2 | `npm run lv-images:bundle` | Normalize cache metadata and publish `lv.bundle.tgz` + manifest. |
| 3 | Commit `generated/lv/`, `lv.bundle.tgz`, and `lv.bundle.json`. | Makes the snapshot consumable in CI. |

On any machine (including CI) you can hydrate the dataset without touching the
network:

```bash
npm run lv-images:hydrate
```

This script expands `generated/lv` from the bundled archive and will fail if the
bundle is missing or stale. CI jobs call it automatically before running tests
or builds, guaranteeing deterministic snapshots even on restricted networks.

To sanity-check the archive, run `npm run lv-images:verify`; the helper compares
hashes and file counts against the manifest.

---

## Development Workflow

- Use `npm run dev` for local editing.
- Keep dependency hotfixes under `patches/` using `patch-package`.
- Run `npm run check` before opening a PR.
- CI may enforce unresolved-link thresholds and script consistency.
- Explore new packages with `npm-utils`; we love new libraries and always
  consider them.

---

## Search & View (quick orientation)

For fast repo mapping and sampling large files:

- List files: `fd` / `fdfind` or `rg --files`
- Read in small windows (head/anchor/tail); avoid dumping minified or >4k-line
  blocks
- Treat heavy zones cautiously: `node_modules/`, `_site/`, `artifacts/`,
  `logs/`, `lib_content.json`

See `AGENTS.md` for the full protocol, clamps, and Preview Capsule format.

---

## Contributing

Pull requests are welcome. Keep patches focused and run `npm run check` before
submitting. Contributions should comply with the **ISC License** and follow repo
conventions. For agent workflows, see [`AGENTS.md`](./AGENTS.md).

---

## License

This project is licensed under the [ISC License](./LICENSE).
