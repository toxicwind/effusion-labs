# Effusion Labs — Digital Garden

[![Deploy](https://github.com/effusion-labs/effusion-labs/actions/workflows/deploy.yml/badge.svg)](https://github.com/effusion-labs/effusion-labs/actions/workflows/deploy.yml)
[![Link Check](https://github.com/effusion-labs/effusion-labs/actions/workflows/link-check.yml/badge.svg)](https://github.com/effusion-labs/effusion-labs/actions/workflows/link-check.yml)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](./LICENSE)

A fast, opinionated Eleventy + Nunjucks + Tailwind static site—curated as a “digital garden.” Batteries included, CI-ready, and friendly to autonomous coding agents.

---

## Table of Contents

- [Effusion Labs — Digital Garden](#effusion-labs--digital-garden)
  - [Table of Contents](#table-of-contents)
  - [Project Overview](#project-overview)
  - [Quickstart](#quickstart)
  - [Activate the Guardrail Environment (optional but recommended)](#activate-the-guardrail-environment-optional-but-recommended)
  - [Interactive Development](#interactive-development)
  - [Key Features](#key-features)
  - [Project Layout (high-level)](#project-layout-high-level)
  - [1) Site Source \& Build Logic](#1-site-source--build-logic)
  - [2) Automation, Tooling \& Guardrails](#2-automation-tooling--guardrails)
  - [3) Services \& Infrastructure](#3-services--infrastructure)
  - [4) Docs, Research \& Outputs](#4-docs-research--outputs)
  - [5) Tests \& Quality](#5-tests--quality)
  - [6) Build Products \& Dependencies (generated/managed)](#6-build-products--dependencies-generatedmanaged)
  - [7) Repo Control \& Configuration](#7-repo-control--configuration)
    - [Quick orientation (on demand)](#quick-orientation-on-demand)
  - [Configuration](#configuration)
  - [Services](#services)
  - [Scripts](#scripts)
    - [Core](#core)
  - [For Autonomous Agents](#for-autonomous-agents)
  - [Contributing](#contributing)
  - [License](#license)

---

## Project Overview

Effusion Labs is a static site built with:

* **Eleventy (11ty)** for generation
* **Nunjucks** for templating
* **Tailwind CSS** (with DaisyUI) for styling
* **Markdown** content in `src/content`

Output is emitted to `_site/`, suitable for direct static hosting or containerization. GitHub Actions drive deploys and link checks.

**Runtime target:** Node.js **24+** (honor `.nvmrc` if present).

---

## Quickstart

> You just want the site running locally? Do this.

```bash
# 1) Clone & enter
git clone https://github.com/effusion-labs/effusion-labs.git
cd effusion-labs

# 2) Install deps
npm install

# 3) Configure env (optional; only if you need overrides)
cp .env.example .env

# 4) Start the dev server
npm run dev
```

When the dev server prints a URL, open it in your browser.

---

## Activate the Guardrail Environment (optional but recommended)

This repo ships a tiny shell layer that improves logs/streams and makes CI/agent runs predictable. It’s safe for humans too.

```bash
source scripts/llm-bootstrap.sh
```

**What you get, in plain terms**

* **Streaming runs** with `llm_run` (clean interrupts, preserved exit codes, optional “tail N on completion”).
* **Smarter I/O**: pretty `cat` for code/text; guard rails for `tail`/`head` to avoid runaway terminals.
* **No surprise silence**: long commands stream instead of hiding behind redirects.
* **Autoinstall-on-change**: if lockfiles change, `npm ci` runs automatically on activation.

Use it during local dev if you like clearer logs; it’s **required** for our agent workflows (see `AGENTS.md`).

---

## Interactive Development

“Interactive development” here simply means **run the dev server with live reload** while you edit content, templates, or styles.

* **Humans**: Run `npm run dev` (or via guardrails: `llm_run --out /tmp/dev.log --tail 120 -- npm run dev`) and work as usual in your editor.
* **Agents/CI**: We avoid `tail -f` loops and use bounded output so runs finish cleanly; details live in `AGENTS.md`.

Nothing exotic—just a normal Eleventy dev loop, with nicer defaults if you opt into guardrails.

---

## Key Features

* **Homepage**: Multi-column “Work” feed, filter toolbar, concept-map CTA, animated lab seal flourish.
* **Work Section**: `/work` aggregates projects, concepts, and sparks with category filters & deep links.
* **Product Pages**: Surfaces provenance metadata; links related “character” pages where applicable.
* **Utilities**: Helpers like ordinal suffixing (including negative numbers) and robust file caching.
* **Collections**: Curated Eleventy collections (e.g., `sparks`, `concepts`, `projects`, `archives`, `meta`) plus convenience composites (`nodes`, `featured`, `interactive`, `recentAll`).

---

## Project Layout (high-level)

> This is a bird’s-eye view. The exact tree can change—see `AGENTS.md` for auto-orientation commands.

## 1) Site Source & Build Logic

* `src/` — All content & templates used by Eleventy (Markdown, Nunjucks, data, assets).
* `lib/` — Reusable app/library code (helpers, transforms, utilities).
* `.eleventy.js` — Eleventy config (collections, filters/shortcodes, passthrough).
* `tailwind.config.cjs` / `postcss.config.cjs` — Styling pipeline config (Tailwind + PostCSS).

## 2) Automation, Tooling & Guardrails

* `scripts/` — Operational scripts (includes `llm-bootstrap.sh` guardrail env).
* `bin/` / `tools/` — CLI utilities, one-offs, maintenance tools.

## 3) Services & Infrastructure

* `markdown_gateway/` — Python HTML→Markdown proxy (optional service).
* `docker-compose.yml` — Local service orchestration (web, gateway, etc.).
* `.github/` — CI workflows (deploy, link-check).
* `.portainer/` — Portainer stack/config.

## 4) Docs, Research & Outputs

* `docs/` — Project documentation, design notes, generated reports.
* `research/` — Notebooks, experiments, scratch investigations.
* `artifacts/` — Build artifacts or export bundles you want to keep.
* `logs/` — Runtime logs (local/CI runs), agent traces, diagnostics.

## 5) Tests & Quality

* `test/` — Unit/integration tests and fixtures.
* `link-check.config.json` — Link checker settings for docs/site.

## 6) Build Products & Dependencies (generated/managed)

* `_site/` — Final static site output (never edit directly, but use to understand final site).
* `node_modules/` — Node dependencies (managed by npm).
* `tmp/` — Scratch/ephemeral working area (if present).

## 7) Repo Control & Configuration

* `package.json` / `package-lock.json` — Scripts & dependency lock.
* `.nvmrc` — Node version pin.
* `.prettierrc`, `.gitignore`, `.dockerignore` — Formatting & VCS/docker hygiene.
* `AGENTS.md` — Operating protocol for autonomous agents (how to run safely).
* `README.md` — Human-facing overview.
* `LICENSE` — ISC license.

---

### Quick orientation (on demand)

* Humans: `npm run dev` to work with live reload.
* Agents/CI: `source scripts/llm-bootstrap.sh` then `llm_run --out /tmp/build.log -- npm run build`.
* Want a current snapshot? `tree -L 2 -I "node_modules|_site|.git|tmp"` (don’t commit the output).

---

## Configuration
* **Eleventy**:

  * Collections via `addCollection` in `.eleventy.js`
  * Static assets via `addPassthroughCopy`
* **Tailwind/DaisyUI**: theme in `tailwind.config.cjs`
* **Node version**: respect `.nvmrc`

---

## Services

Optional local services via Docker Compose:

* **`effusion-labs`** web container (port mapping as defined in `docker-compose.yml`)
* **`markdown_gateway`**: proxies HTML→Markdown (uses FlareSolverr)

  * Configure solver with `SOLVER_URL` in your environment

Start with:

```bash
docker compose up
```

(Or run individual services as needed.)

---

## Scripts

Requires **Node ≥ 24** (see `package.json` / `.nvmrc`). Run from the repo root.

### Core

* `npm run dev` — Start Eleventy dev server with live reload (`eleventy --serve`).
* `npm run build` — Build the static site to `_site/` (`eleventy`).
* `npm test` — Run the test runner under coverage (`c8 node tools/runner.mjs`).
* `npm run format` — Format the repo with Prettier (`prettier -w .`).

---

## For Autonomous Agents

If you’re running this repo under an automated coding agent (Codex-style, CI sandboxes, etc.), **read `AGENTS.md`**. It defines the operating protocol, canonical run shapes, and log/artifact expectations.

---

## Contributing

1. Fork & clone your fork
2. `npm install`
3. Create a feature branch
4. Add tests or docs as appropriate
5. `npm test`
6. Open a PR

We use the **ISC** license and expect contributions to be compatible.

---

## License

This project is licensed under the **ISC License**. See [LICENSE](./LICENSE).