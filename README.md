# Effusion Labs — Digital Garden

[![Deploy](https://github.com/effusion-labs/effusion-labs/actions/workflows/deploy.yml/badge.svg)](https://github.com/effusion-labs/effusion-labs/actions/workflows/deploy.yml)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](./LICENSE)

A fast, opinionated Eleventy + Nunjucks + Tailwind static site—curated as a “digital garden.” Batteries included, CI-ready, and friendly to autonomous coding agents.

---

## Table of Contents

- [Effusion Labs — Digital Garden](#effusion-labs--digital-garden)
  - [Table of Contents](#table-of-contents)
  - [Project Overview](#project-overview)
    - [Tailwind/DaisyUI Canonical Setup](#tailwinddaisyui-canonical-setup)
  - [Quickstart](#quickstart)
  - [Activate the Guardrail Environment (optional but recommended)](#activate-the-guardrail-environment-optional-but-recommended)
  - [Interactive Development](#interactive-development)
  - [Key Features](#key-features)
  - [Archive Dynamics by Default](#archive-dynamics-by-default)
  - [Multi-Scaffold Dynamic Linking](#multi-scaffold-dynamic-linking)
  - [Wikilink Debugging](#wikilink-debugging)
    - [CI Thresholds \& Summary](#ci-thresholds--summary)
    - [CLI Audit](#cli-audit)
  - [Interlinker Hotfix v3](#interlinker-hotfix-v3)
  - [Product Archive Canon](#product-archive-canon)
  - [Services](#services)
  - [Scripts](#scripts)
    - [Core](#core)
  - [Dependency Patches](#dependency-patches)
    - [Multi‑Scaffold Dynamic Linking](#multiscaffold-dynamic-linking)
    - [Wikilink Debugging](#wikilink-debugging-1)
      - [CI: Post Unresolved Table in PRs](#ci-post-unresolved-table-in-prs)
    - [Plugin Hardening](#plugin-hardening)
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
- Theme toggle uses a single base script: `src/assets/js/theme-toggle.js` backed by reusable `src/assets/js/theme-utils.js`.

Add a theme: update the `@plugin "daisyui" { themes: ... }` block in `src/styles/app.tailwind.css`. The active theme is the `data-theme` attribute on `<html>`.

Run the gated doc fetcher locally (never required in CI):

```bash
DOC_FETCH=1 npm run docs:fetch
```

**Runtime target:** Node.js **24+** (honor `.nvmrc` if present). The repository is ESM-first (`package.json` sets `"type": "module"`); use `import`/`export` syntax. Configuration files like `eleventy.config.mjs`, `tailwind.config.mjs`, and `vite.config.mjs` are ESM as well.

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
source utils/scripts/setup/env-bootstrap.sh
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

Builds write unresolved links to `artifacts/reports/interlinker-unresolved.json` with guessed kinds and attempted resolutions. Use `node utils/scripts/interlinker-audit.mjs` to inspect and patch aliases.

### CI Thresholds & Summary

- Gate unresolved count with env vars: `INTERLINKER_MAX_UNRESOLVED` (default 200 on CI, Infinity locally) and `INTERLINKER_FAIL_ON_UNRESOLVED=true` to hard‑fail.
- After builds, a compact line prints: `Interlinker: unresolved=<n> threshold=<t> action=<warn|fail>`.
- For PRs, render a quick table: `node utils/scripts/unresolved-to-md.mjs`.

### CLI Audit

Suggest or apply aliases from the unresolved report:

```bash
# Suggest top matches (all kinds)
node utils/scripts/interlinker-audit.mjs

# Limit to products, apply best matches with a minimum score
node utils/scripts/interlinker-audit.mjs --kind product --apply --min 0.9
```

When applying, a brief worklog entry is written under `artifacts/worklogs/`.

## Interlinker Hotfix v3

- Fixes Eleventy crashes (`TypeError: document.match is not a function`) by coercing all parser inputs to strings across Interlinker ESM + CJS surfaces and guarding `.match(...)`/`JSDOM` entrypoints.
- Applies patches via `patch-package` during Docker deps install by copying `patches/` before `npm ci`.
- Adds a CI guard that fails if the hotfix isn’t present.

What this means in practice:

- Sentinel comment `Patched-By: ARACA-INTERLINKER-HOTFIX-V3` is inserted into patched plugin files.
- Run `node utils/scripts/validation/verify-patch-applied.mjs` after `npm ci` to verify locally or in CI.
- Dockerfile change (Option A): `.portainer/Dockerfile` now copies `patches/` into the deps stage prior to `npm ci`, ensuring postinstall applies patches.

Research trace and findings live in `artifacts/reports/interlinker-hotfix-discovery.json`.

## Product Archive Canon

All product entities resolve to `/archives/product/<slugCanonical>/` using a stable naming canon. Legacy deep routes and verbose slugs emit `308` redirects or stub pages that point back to the canonical URL. Product JSON now records `slugCanonical`, `slugAliases`, and `legacyPaths` to drive this layer.
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
- `npm test` — Run the test runner under coverage (`c8 node test/integration/runner.spec.mjs`).
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

CLI audit tool: `utils/scripts/interlinker-audit.mjs`

- `node utils/scripts/interlinker-audit.mjs` — print ranked suggestions for unresolved links.
- `node utils/scripts/interlinker-audit.mjs --apply --kind product --min 0.86` — add `slugAliases` to best archive JSON match.

#### CI: Post Unresolved Table in PRs

Add a summary table to your PR using GitHub Actions:

```yaml
  - name: Build site
    run: npx @11ty/eleventy

  - name: Interlinker summary
    if: always()
    run: node utils/scripts/unresolved-summary.mjs >> "$GITHUB_STEP_SUMMARY"

  - name: Gate unresolved (optional)
    if: always()
    env:
      INTERLINKER_MAX_UNRESOLVED: 200
      INTERLINKER_FAIL_ON_UNRESOLVED: true
    run: |
      # Re-run summary for logs and enforce threshold
      node utils/scripts/unresolved-summary.mjs
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
