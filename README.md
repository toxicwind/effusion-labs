# Effusion Labs

Effusion Labs is a digital studio and knowledge base for rapid iteration. It uses **Eleventy v3** as a static-site generator with **Vite** for modern bundling and hot-module reloading. Content is authored in **Markdown** and **Nunjucks** under `src/content/` and compiled into a deployable static site in `_site/`. Styles are managed with **Tailwind CSS v4** and **daisyUI v5**, with a single entry stylesheet at `src/assets/css/app.css`. The project targets **Node.js ≥24** and runs fully in **ECMAScript-module (ESM)** mode.

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
  - [Tailwind \& Theming](#tailwind--theming)
  - [Optional Services](#optional-services)
  - [Development Workflow](#development-workflow)
  - [Search \& View (quick orientation)](#search--view-quick-orientation)
  - [Contributing](#contributing)
  - [License](#license)
  - [References](#references)

---

## Overview

A fast, opinionated Eleventy + Tailwind static site—curated as a digital garden. Batteries included, CI-ready, and friendly to autonomous coding agents.

---

## Features

- **Dynamic interlinking** — Uses `@photogabble/eleventy-plugin-interlinker` to resolve wiki-style links across multiple content types. If a link omits a kind (e.g. `[[Labubu]]`), the resolver falls back through:  
  `work → character → product → series → concept → project → spark → meta`.  
  Named kinds such as `product`, `character`, and `series` map to canonical archive routes like `/archives/product/<slug>/`.

- **Unresolved-link reporting** — Each build writes `artifacts/reports/interlinker-unresolved.json`. CI can be configured with `INTERLINKER_MAX_UNRESOLVED` and `INTERLINKER_FAIL_ON_UNRESOLVED` to fail on overs.

- **Patched interlinker** — A hotfix via `patch-package` adds a `toHtmlString` coercion and guards non-string inputs across ESM/CJS, preventing crashes in Markdown-it and JSDOM.

- **Eleventy plugins** — Navigation, RSS, sitemap, schema, plus official Vite integration. The Vite plugin exposes `/assets/js/app.js` as entry, maintains a stable temp dir, and supports middleware mode.

- **Tailwind & daisyUI** — CSS-first styling. Tokens, fonts, and breakpoints live in `tailwind.config.mjs`. Themes and utility layers are defined in `src/assets/css/app.css`. DaisyUI registers `light` and `dark`; a toggle in `src/assets/js/app.js` switches `data-theme`.

- **Content collections** — Custom collections expose “featured,” “interactive,” and “recentAll.” The `work` collection aggregates sparks, concepts, projects, and meta content.

- **Image optimization** — The Eleventy image plugin generates AVIF, WebP, and fallback images at multiple widths under `/assets/images/`. Filenames are slugified for determinism.

- **Link verification** — `npm run lint:links` uses `markdown-link-check` to detect broken links. `npm run lint` runs link checks as part of linting.

- **Testing & coverage** — Integration tests live in `test/` and run via **Playwright**, with coverage via `c8`. Use `npm run test:watch` for continuous feedback.
- **npm-utils** — Built-in CLI to search, analyze, and install npm packages. We love new packages and libraries; always consider them.

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

When the dev server prints a local URL, open it in your browser. Files under `src/content/` and `src/assets/` are watched and reloaded automatically.

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
| `check`        | Run format check, lint, and tests                                |
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
config/        → Eleventy & Vite configuration (plugins, collections, site settings)
utils/         → Development and build helpers
src/content/   → Markdown & Nunjucks pages
src/assets/    → Client JS, images, and CSS (compiled to /assets/)
test/          → Integration & unit tests (Playwright)
patches/       → Hotfixes via patch-package
artifacts/     → Reports (e.g., unresolved links), worklogs, export bundles
```

Collections: `sparks`, `concepts`, `projects`, `meta`, `archives`, `work`.
Assets in `src/assets/` emit to `/assets/` by Vite; images processed by the Eleventy image plugin appear in `/assets/images/`.

---

## Linking & Route Canon

Effusion Labs treats wiki-style links as first-class citizens.

- `[[product:Tempura Shrimp]]` → `/archives/product/tempura-shrimp/`
- `[[character:Momo Fox]]` → `/archives/character/momo-fox/`
- Kindless links attempt: `work → character → product → series → concept → project → spark → meta`.

All slugs normalize to lowercase, NFKD, punctuation-free identifiers.
Unresolved links are recorded in `artifacts/reports/interlinker-unresolved.json` and can fail CI when thresholds are exceeded.

---

## Tailwind & Theming

- **Config:** `tailwind.config.mjs` defines tokens and typography.
- **Styles:** `src/assets/css/app.css` imports Tailwind, typography, and daisyUI; adds Hyperbrut utilities.
- **Themes:** `light` and `dark` registered in CSS; `src/assets/js/app.js` toggles `data-theme` and Lucide icons.

---

## Optional Services

A companion `markdown_gateway/` service provides an HTML→Markdown proxy via Docker Compose.

```bash
cd markdown_gateway
docker compose up
```

This starts a gateway container and FlareSolverr solver, useful when converting external HTML into Markdown for inclusion in the digital garden.

---

## Development Workflow

- Use `npm run dev` for local editing.
- Keep dependency hotfixes under `patches/` using `patch-package`.
- Run `npm run check` before opening a PR.
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

Pull requests are welcome. Keep patches focused and run `npm run check` before submitting. Contributions should comply with the **ISC License** and follow repo conventions. For agent workflows, see [`AGENTS.md`](./AGENTS.md).

---

## License

This project is licensed under the [ISC License](./LICENSE).

---

## References

- [`package.json`](./package.json)
- [`config/interlinkers/route-registry.mjs`](./config/interlinkers/route-registry.mjs)
- [`config/interlinkers/unresolved-report.mjs`](./config/interlinkers/unresolved-report.mjs)
- [`patches/@photogabble+eleventy-plugin-interlinker+1.1.0.patch`](./patches/@photogabble+eleventy-plugin-interlinker+1.1.0.patch)
- [`config/plugins.js`](./config/plugins.js)
- [`config/register.mjs`](./config/register.mjs)
- [`tailwind.config.mjs`](./tailwind.config.mjs)
- [`src/assets/css/app.css`](./src/assets/css/app.css)
- [`markdown_gateway/docker-compose.yml`](./markdown_gateway/docker-compose.yml)
