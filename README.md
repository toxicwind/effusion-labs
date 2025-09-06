# Effusion Labs — Digital Garden

[![Deploy](https://github.com/effusion-labs/effusion-labs/actions/workflows/deploy.yml/badge.svg)](https://github.com/effusion-labs/effusion-labs/actions/workflows/deploy.yml)
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

- **Eleventy v3** for generation
- **Nunjucks** for templating
- **Tailwind CSS v4** with **daisyUI v5** for styling
- **Markdown** content in `src/content`
- **Shiki** for build-time syntax highlighting with zero client-side JS
- **Build-time Lucide icons** via **lucide-eleventy**

The T4DL stack (Tailwind v4, daisyUI v5, Eleventy v3, lucide-eleventy) keeps styling CSS-first with a single compiled file at `/assets/css/app.css`.

Output is emitted to `_site/`, suitable for direct static hosting or containerization. GitHub Actions drive deploys.

### Tailwind/DaisyUI Canonical Setup

- Single Tailwind config at repo root: `tailwind.config.mjs` (typography, fonts, scales).
- DaisyUI is registered exactly once in CSS: `src/styles/app.tailwind.css` via `@plugin "daisyui" { themes: light --default, dark --prefersdark }`.
- `@source` globs in `src/styles/app.tailwind.css` limit class detection to real templates (`../**/*.njk`) and client scripts (`../scripts/**/*.js`).
- Modular CSS structure under `src/styles/`: tokens → base → components → utilities → theme overrides, all imported by `app.tailwind.css` in deterministic order.
- Dark variant is bound to DaisyUI’s dark theme using a `@custom-variant` targeting `data-theme=dark`.
- Theme toggle uses a single base script: `src/scripts/theme-toggle.js` backed by reusable `src/scripts/theme-utils.js`.

Add a theme: update the `@plugin "daisyui" { themes: ... }` block in `src/styles/app.tailwind.css`. The active theme is the `data-theme` attribute on `<html>`.

Run the gated doc fetcher locally (never required in CI):

```bash
DOC_FETCH=1 npm run docs:fetch
```

**Runtime target:** Node.js **24+** (honor `.nvmrc` if present). The repository is ESM-first (`package.json` sets `"type": "module"`); use `import`/`export` syntax. Configuration files like `eleventy.config.mjs`, `tailwind.config.mjs`, and `postcss.config.mjs` are ESM as well.

---

## Quickstart

> You just want the site running locally? Do this.

```bash
# 1) Clone & enter
git clone https://github.com/effusion-labs/effusion-labs.git
cd effusion-labs

# 2) Install deps
npm install

# 3) Start the dev server
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

- **Streaming runs** with `llm_run` (clean interrupts, preserved exit codes, optional “tail N on completion”).
- **Smarter I/O**: pretty `cat` for code/text; guard rails for `tail`/`head` to avoid runaway terminals.
- **No surprise silence**: long commands stream instead of hiding behind redirects.
- **Autoinstall-on-change**: if lockfiles change, `npm ci` runs automatically on activation.

Use it during local dev if you like clearer logs; it’s **required** for our agent workflows (see `AGENTS.md`).

---

## Interactive Development

“Interactive development” here simply means **run the dev server with live reload** while you edit content, templates, or styles.

- **Humans**: Run `npm run dev` (or via guardrails: `llm_run --out /tmp/dev.log --tail 120 -- npm run dev`) and work as usual in your editor.
- **Agents/CI**: We avoid `tail -f` loops and use bounded output so runs finish cleanly; details live in `AGENTS.md`.

Nothing exotic—just a normal Eleventy dev loop, with nicer defaults if you opt into guardrails.

---

## Key Features

- **Homepage**: Multi-column “Work” feed, filter toolbar, concept-map CTA, animated lab seal flourish.
- **Work Section**: `/work` aggregates projects, concepts, and sparks with category filters & deep links.
- **Utilities**: Helpers like ordinal suffixing (including negative numbers) and robust file caching.
- **Collections**: Curated Eleventy collections (e.g., `sparks`, `concepts`, `projects`, `archives`, `meta`) plus convenience composites (`nodes`, `featured`, `interactive`, `recentAll`).

---

## Archive Dynamics by Default

This repository treats archive-linked wikilinks as canonical dynamic routes. Namespaced links resolve to short, predictable URLs at build time.

- Namespace contract: `series:` → `/archives/series/<slug>/`, `character:` → `/archives/character/<slug>/`, `product:` → `/archives/product/<slug>/`.
- Slug normalization rules: lowercase; Unicode NFKD; strip punctuation; collapse whitespace to `-`; collapse consecutive dashes.
- Recommended default: always author archive entities as namespaced links.

Examples

- `[[series:Let’s Checkmate]]` → `/archives/series/lets-checkmate/`
- `[[character:Momo Fox]]` → `/archives/character/momo-fox/`
- `[[product:Tempura Shrimp]]` → `/archives/product/tempura-shrimp/`

Notes

- If a target isn’t yet present in the dataset, links still resolve to the canonical dynamic route (the page may 404 until data exists). This keeps authoring consistent and future‑proof.
- Internal templates and resolvers use the same canonical mapping; avoid hardcoding long, hierarchical legacy paths.

## Multi-Scaffold Dynamic Linking

All wikilinks resolve against a dynamic registry spanning work, concepts, projects, sparks, and archive entities. If the kind is omitted (e.g. `[[Labubu]]`), resolution falls back through `work`, `character`, `product`, `series`, `concept`, `project`, then `spark`.

## Wikilink Debugging

Builds write unresolved links to `artifacts/reports/interlinker-unresolved.json` with guessed kinds and attempted resolutions. Use `node tools/interlinker-audit.mjs` to inspect and patch aliases.

### CI Thresholds & Summary

- Gate unresolved count with env vars: `INTERLINKER_MAX_UNRESOLVED` (default 200 on CI, Infinity locally) and `INTERLINKER_FAIL_ON_UNRESOLVED=true` to hard‑fail.
- After builds, a compact line prints: `Interlinker: unresolved=<n> threshold=<t> action=<warn|fail>`.
- For PRs, render a quick table: `node tools/unresolved-to-md.mjs`.

### CLI Audit

Suggest or apply aliases from the unresolved report:

```bash
# Suggest top matches (all kinds)
node tools/interlinker-audit.mjs

# Limit to products, apply best matches with a minimum score
node tools/interlinker-audit.mjs --kind product --apply --min 0.9
```

When applying, a brief worklog entry is written under `artifacts/worklogs/`.

## Interlinker Hotfix v3

- Fixes Eleventy crashes (`TypeError: document.match is not a function`) by coercing all parser inputs to strings across Interlinker ESM + CJS surfaces and guarding `.match(...)`/`JSDOM` entrypoints.
- Applies patches via `patch-package` during Docker deps install by copying `patches/` before `npm ci`.
- Adds a CI guard that fails if the hotfix isn’t present.

What this means in practice:

- Sentinel comment `Patched-By: ARACA-INTERLINKER-HOTFIX-V3` is inserted into patched plugin files.
- Run `node tools/verify-patch-applied.mjs` after `npm ci` to verify locally or in CI.
- Dockerfile change (Option A): `.portainer/Dockerfile` now copies `patches/` into the deps stage prior to `npm ci`, ensuring postinstall applies patches.

Research trace and findings live in `artifacts/reports/interlinker-hotfix-discovery.json`.

## Product Archive Canon

All product entities resolve to `/archives/product/<slugCanonical>/` using a stable naming canon. Legacy deep routes and verbose slugs emit `308` redirects or stub pages that point back to the canonical URL. Product JSON now records `slugCanonical`, `slugAliases`, and `legacyPaths` to drive this layer.

## Project Layout (high-level)

> This is a bird’s-eye view. The exact tree can change—see `AGENTS.md` for auto-orientation commands.

## 1) Site Source & Build Logic

- `src/` — All content & templates used by Eleventy (Markdown, Nunjucks, data, assets).
- `lib/` — Reusable app/library code (helpers, transforms, utilities).
* `.eleventy.js` — Eleventy config (collections, filters/shortcodes, passthrough).
* `src/styles/app.tailwind.css` — Tailwind v4 entry with `@plugin` and `@source` directives.
* `tailwind.config.mjs` / `postcss.config.mjs` — Theme tokens and PostCSS pipeline.

## 2) Automation, Tooling & Guardrails

- `scripts/` — Operational scripts (includes `llm-bootstrap.sh` guardrail env).
- `bin/` / `tools/` — CLI utilities, one-offs, maintenance tools.

## 3) Services & Infrastructure

- `markdown_gateway/` — Python HTML→Markdown proxy (optional service).
- `docker-compose.yml` — Local service orchestration (web, gateway, etc.).
- `.github/` — CI workflows (deploy).
- `.portainer/` — Portainer stack/config.

## 4) Docs, Research & Outputs

- `docs/` — Project documentation, design notes, generated reports.
- `research/` — Notebooks, experiments, scratch investigations.
- `artifacts/` — Build artifacts or export bundles you want to keep.
- `logs/` — Runtime logs (local/CI runs), agent traces, diagnostics.

## 5) Tests & Quality

- `test/` — Unit/integration tests and fixtures.
- `link-check.config.json` — Config for manual dead-link checks (`npm run dead-links`).

## 6) Build Products & Dependencies (generated/managed)

- `_site/` — Final static site output (never edit directly, but use to understand final site).
- `node_modules/` — Node dependencies (managed by npm).
- `tmp/` — Scratch/ephemeral working area (if present).

## 7) Repo Control & Configuration

- `package.json` / `package-lock.json` — Scripts & dependency lock.
- `.nvmrc` — Node version pin.
- `.prettierrc`, `.gitignore`, `.dockerignore` — Formatting & VCS/docker hygiene.
- `AGENTS.md` — Operating protocol for autonomous agents (how to run safely).
- `README.md` — Human-facing overview.
- `LICENSE` — ISC license.

---

### Quick orientation (on demand)

- Humans: `npm run dev` to work with live reload.
- Agents/CI: `source scripts/llm-bootstrap.sh` then `llm_run --out /tmp/build.log -- npm run build`.
- Want a current snapshot? `tree -L 2 -I "node_modules|_site|.git|tmp"` (don’t commit the output).

---

## Configuration

- **Eleventy**:

  - Collections via `addCollection` in `eleventy.config.mjs`
  - Static assets via `addPassthroughCopy`

* **Tailwind/DaisyUI**: plugins/themes in `src/styles/app.tailwind.css`, tokens in `tailwind.config.mjs`
* **PostCSS**: plugin pipeline in `postcss.config.mjs`
* **Node version**: respect `.nvmrc`

---

## Services

Optional local services via Docker Compose:

- **`effusion-labs`** web container (port mapping as defined in `docker-compose.yml`)
- **`markdown_gateway`**: proxies HTML→Markdown (uses FlareSolverr)

  - Configure solver with `SOLVER_URL` in your environment

Start with:

```bash
docker compose up
```

(Or run individual services as needed.)

---

## Scripts

Requires **Node ≥ 24** (see `package.json` / `.nvmrc`). Run from the repo root.

### Core

- `npm run dev` — Start Eleventy dev server with live reload (`eleventy --serve`).
- `npm run build` — Build the static site to `_site/` (`eleventy`).
- `npm test` — Run the test runner under coverage (`c8 node tools/runner.mjs`).
- `npm run format` — Format the repo with Prettier (`prettier -w .`).

---

## Dependency Patches

We maintain fixes for third‑party packages using `patch-package`.

- Store patch files in `patches/` (e.g., `patches/tree-cli+0.6.7.patch`).
- `postinstall` runs `patch-package`, so patches apply automatically on `npm ci`.
- Keep patch diffs small and focused; upstream when possible.

Note: avoid editing `node_modules/` directly. If you must prototype a change, run `npx patch-package <pkg>` to capture your edits into `patches/` and commit the patch file.

### Multi‑Scaffold Dynamic Linking

This site treats namespaced wikilinks as dynamic routes across multiple scaffolds, not just `/archives/`.

- Supported kinds: `product`, `character`, `series`, `spark`, `concept`, `project`, `meta`, and the aggregate `work`.
- Omitted kinds (e.g., `[[labubu]]`) resolve by priority: `work → character → product → series → concept → project → spark → meta`.
- Canonicalization always emits stable URLs (e.g., `/archives/product/<slug>/`), resolving aliases and legacy paths.
- Back‑compat synonyms: `[[archive:product:...]]`, `[[archive:series:...]]`, etc.

Route behavior is centralized in `lib/interlinkers/route-registry.mjs` and `lib/interlinkers/resolvers.mjs`.

### Wikilink Debugging

Builds produce a stable report at `artifacts/reports/interlinker-unresolved.json`:

```json
{
  "schemaVersion": 1,
  "generatedAt": "YYYY-MM-DDTHH:mm:ss.sssZ",
  "count": 1,
  "items": [
    {
      "kind": "work",
      "key": "my-missing-work",
      "sourcePage": "src/content/foo.md",
      "guessedKind": "work",
      "attemptedKinds": ["work","character","project"],
      "when": "YYYY-MM-DDTHH:mm:ss.sssZ"
    }
  ]
}
```

Environment-driven thresholds (CI friendly):

- `INTERLINKER_MAX_UNRESOLVED`: Max unresolved to tolerate. Default: unlimited in dev, `200` in CI.
- `INTERLINKER_FAIL_ON_UNRESOLVED`: When `true`, fail build if `count > threshold`.

After each `eleventy` run, you’ll see: `Interlinker: unresolved=<N> threshold=<T> action=<warn|fail>`.

CLI audit tool: `tools/interlinker-audit.mjs`

- `node tools/interlinker-audit.mjs` — print ranked suggestions for unresolved links.
- `node tools/interlinker-audit.mjs --apply --kind product --min 0.86` — add `slugAliases` to best archive JSON match.

#### CI: Post Unresolved Table in PRs

Add a summary table to your PR using GitHub Actions:

```yaml
  - name: Build site
    run: npx @11ty/eleventy

  - name: Interlinker summary
    if: always()
    run: node tools/unresolved-summary.mjs >> "$GITHUB_STEP_SUMMARY"

  - name: Gate unresolved (optional)
    if: always()
    env:
      INTERLINKER_MAX_UNRESOLVED: 200
      INTERLINKER_FAIL_ON_UNRESOLVED: true
    run: |
      # Re-run summary for logs and enforce threshold
      node tools/unresolved-summary.mjs
      # summarizeAndGate() already ran in eleventy.after; rely on exitCode.
      test "$?" -eq 0
```

### Plugin Hardening

We patch `@photogabble/eleventy-plugin-interlinker@1.1.0` via `patch-package` to guard non‑string inputs in both ESM & CJS paths
so that neither `RegExp#match` nor JSDOM instantiation receive non‑strings.

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
