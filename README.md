# Effusion Labs Digital Garden

[![Deploy](https://github.com/effusion-labs/effusion-labs/actions/workflows/deploy.yml/badge.svg)](https://github.com/effusion-labs/effusion-labs/actions/workflows/deploy.yml)
[![Link Check](https://github.com/effusion-labs/effusion-labs/actions/workflows/link-check.yml/badge.svg)](https://github.com/effusion-labs/effusion-labs/actions/workflows/link-check.yml)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](./LICENSE)

## Table of Contents
- [Effusion Labs Digital Garden](#effusion-labs-digital-garden)
  - [Table of Contents](#table-of-contents)
  - [🚀 Project Overview](#-project-overview)
  - [🛡️ Guardrail Environment](#️-guardrail-environment)
    - [What you get after activation](#what-you-get-after-activation)
    - [Defaults (what’s on, what they do, and what they invoke)](#defaults-whats-on-what-they-do-and-what-they-invoke)
    - [How the LLM should use this environment (canonical patterns)](#how-the-llm-should-use-this-environment-canonical-patterns)
    - [Quick switches you may want](#quick-switches-you-may-want)
    - [One-liner to train agents (printed once at activation)](#one-liner-to-train-agents-printed-once-at-activation)
  - [✨ Key Features](#-key-features)
    - [Eleventy Plugins](#eleventy-plugins)
    - [Core `npm` Scripts](#core-npm-scripts)
      - [Primary Commands](#primary-commands)
      - [Testing Commands 🧪](#testing-commands-)
      - [Documentation \& Tools 📚](#documentation--tools-)
      - [System \& Dependencies ⚙️](#system--dependencies-️)
    - [Tailwind Theme](#tailwind-theme)
    - [Eleventy Collections](#eleventy-collections)
    - [Services](#services)
  - [⚡ Quickstart](#-quickstart)
  - [📂 Project Layout](#-project-layout)
  - [🚢 Deployment](#-deployment)
  - [🧪 Quality Assurance](#-quality-assurance)
  - [🤝 Contributing](#-contributing)
  - [📄 License](#-license)

## 🚀 Project Overview

Effusion Labs is a static digital garden built with Eleventy, Nunjucks templates and Tailwind CSS. Markdown content in `src/content` feeds Eleventy's collections to generate a fully static site. Node.js 20 powers the build pipeline, and the resulting `_site/` directory can be served directly or packaged into a lightweight Nginx container. GitHub Actions drive tests and deployments to GitHub Container Registry.

## 🛡️ Guardrail Environment

This repository ships a “no-friction” shell environment to keep both humans and LLMs productive and sane. **Activate it once per shell session** before running anything here.

**Activation**

```bash
source scripts/llm-bootstrap.sh
```

### What you get after activation

* **Smart dependency management**
  Detects drift in lockfiles; when enabled, runs `npm ci` and optional `pip install -r …` only when hashes change (fast when clean, automatic when stale).
* **Live output correction**
  Any `>` / `>>` redirection is transparently rewritten to a **live, streaming** pipeline (folded lines, original exit code preserved). The common anti-pattern
  `cmd > file && tail …` is auto-rewritten to a safe stream.
* **Enhanced tooling layer**

  * `llm_run` (PID-scoped runner): streams immediately; emits **idle beacons only during true inactivity**; stops cleanly on completion or Ctrl-C (prints a bounded tail, exits 130).
  * `tail` override: blocks `-f/-F` by default (returns a bounded snapshot instead; allowlist available); always folds long lines.
  * `llm_cat`: Prettier-first pretty-printing for known text/code types with a size cap; optional `cat` alias.
* **Persistence**
  Git hooks (`post-checkout`, `post-merge`) **auto-reactivate** this environment on branch changes.
  A **scoped global heartbeat** provides liveness only when no `llm_run` job is active (avoids ghost “still running” signals).
* **Observability**
  All key actions emit grep-friendly notices like:
  `::notice:: LLM-GUARD event=<name> k=v …`
  If `GITHUB_STEP_SUMMARY` is present, a summary line is mirrored there.

---

### Defaults (what’s on, what they do, and what they invoke)

* `LLM_VERBOSE=1`
  Emits `::notice:: LLM-GUARD …` lines and mirrors to `GITHUB_STEP_SUMMARY` if available.

* `LLM_HIJACK_DISABLE=0`
  **ON** by default. Enables command-line rewrite traps:

  * Simple redirects `cmd > file` / `cmd >> file` → run under `bash -c … | fold | tee` (preserves exit code, writes `file`, shows live stream).
  * Chains like `cmd > file && tail …` → rewritten to `llm_run --out file -- cmd` (continuous streaming; no deferred tail).

* `LLM_FOLD_WIDTH=4000`
  Max wrap width used by fold in runners, tail snapshots, and pretty-cat.

* `LLM_TAIL_BLOCK=1`
  `tail -f/-F` is blocked; instead you get `tail -n ${LLM_TAIL_MAX_LINES}` returned immediately.

* `LLM_TAIL_MAX_LINES=5000`
  Snapshot size when follow is blocked (used by the tail wrapper and some summaries).

* `LLM_TAIL_ALLOW_CMDS=""`
  Optional regex allowlist to permit `-f/-F` for specific commands (e.g., CI log collectors). When set and matched, the follow passes through.

* `LLM_IDLE_SECS=7`  (fallback to `LLM_HEARTBEAT_SECS` if you export it)
  Idle beacon cadence used **inside** `llm_run`. During periods with no new bytes in the job’s logfile, `event=run.idle` is emitted roughly every `LLM_IDLE_SECS`.

* `LLM_CAT_MAX_BYTES=0`
  0 = no cap. If > 0, `llm_cat` skips Prettier above this size and falls back to raw but folded output.

* `LLM_DEPS_AUTOINSTALL=1`
  On by default. When set to 1, activation hashes `package-lock.json` and (if present) `markdown_gateway/requirements.txt`. On change it invokes:

  * `npm ci`
  * `python -m pip install -r …` (or `pip install -r …` if `python` shim unavailable)

* `LLM_ALIAS_CAT=0`
  Off by default. Set to 1 to alias `cat` → `llm_cat`.

* `LLM_GIT_HOOKS=1`
  **ON** by default. Installs `post-checkout` and `post-merge` hooks that re-source `scripts/llm-bootstrap.sh` after branch moves.
  Turn off by exporting `LLM_GIT_HOOKS=0` **before** sourcing (prevents install). To remove installed hooks manually, delete the two files under `.git/hooks/`.

* `LLM_GLOBAL_HEARTBEAT=1`
  **ON** by default. Starts a **scoped** global heartbeat that emits `event=heartbeat` every \~`max(30, 4*LLM_IDLE_SECS)` **only when no `llm_run` lockfiles are present**. Auto-stops after `LLM_GLOBAL_HB_TIMEOUT_S` seconds (default 600) or when the shell exits.

* `LLM_GLOBAL_HB_TIMEOUT_S=600`
  Upper bound for the global heartbeat runtime (no effect when `LLM_GLOBAL_HEARTBEAT=0`).

---

### How the LLM should use this environment (canonical patterns)

**Do (canonical run form)**

```bash
llm_run --out /tmp/unit.log -- npm test
```

* Continuous, folded stream; bounded idle beacons if output stalls; log persisted at `/tmp/unit.log`; exit code preserved.

**Do (quick tail on completion without follow)**

```bash
llm_run --out /tmp/build.log --tail 120 -- make build
```

* Prints last 120 lines after job completes, then exits.

**Do (read files for planning)**

```bash
llm_cat package.json
llm_cat src/index.ts
```

* Prettier-formatted where applicable; long lines folded.

**Avoid (rewritten automatically, but don’t rely on it)**

```bash
npm test >/tmp/unit.log && tail -n 20 /tmp/unit.log
```

* This will be rewritten to `llm_run --out /tmp/unit.log -- npm test` to avoid silent periods and broken tails.

**Avoid (follow loops)**

```bash
tail -f build.log
```

* Blocked by default; you’ll get a bounded snapshot instead. If you really need follow for a specific tool, export an allowlist:

```bash
export LLM_TAIL_ALLOW_CMDS='^ci-log-consumer$'
```

**Interrupt behavior (Ctrl-C)**

* First `Ctrl-C` during `llm_run`:

  * Emits `event=run.interrupt`, prints the last \~80 lines, exits `130`.
* Second `Ctrl-C` (if any child remains): forces termination.

**Silence discipline**

* If a job is quiet for \~`LLM_IDLE_SECS`, you’ll see `event=run.idle` until bytes start flowing again. Beacons stop the instant the job ends.

---

### Quick switches you may want

* Disable command rewrites (debugging only):

```bash
export LLM_HIJACK_DISABLE=1
```

* Enable automatic dependency installs (CI/bootstrap):

```bash
export LLM_DEPS_AUTOINSTALL=1
```

* Make `cat` pretty by default:

```bash
export LLM_ALIAS_CAT=1
```

* Disable persistence/heartbeat for a one-off shell:

```bash
export LLM_GIT_HOOKS=0
export LLM_GLOBAL_HEARTBEAT=0
```

---

### One-liner to train agents (printed once at activation)

```
Prefer:  llm_run --out /tmp/unit.log -- <cmd>
Avoid:   <cmd> > /tmp/unit.log && tail -n …
```

## ✨ Key Features

  * **Homepage:** Presents a multi-column "Work" feed with a filter toolbar, an interactive concept map CTA, and an animated lab seal flourish.
  * **Work Section:** A dedicated `/work` page aggregates projects, concepts, and sparks, complete with category filters and deep-linking capabilities.
  * **Product Pages:** Automatically surface provenance metadata and link to related character pages.
  * **Utilities:** Core helpers provide features like ordinal number suffixes (now with negative number support) and robust file caching.

-----

### Eleventy Plugins

  * **`@photogabble/eleventy-plugin-interlinker`**: Renders internal references as annotated links, configured to ignore templated hrefs.
  * **`@11ty/eleventy-navigation`**: Builds navigation structures from front matter.
  * **`@11ty/eleventy-plugin-syntaxhighlight`**: Adds Prism-based code highlighting.
  * **`@11ty/eleventy-plugin-rss`**: Generates RSS feeds for collections.
  * **`@quasibit/eleventy-plugin-sitemap`**: Emits a `sitemap.xml` with a predefined hostname.
  * **`@quasibit/eleventy-plugin-schema`**: Generates JSON-LD structured data for pages.
  * **`@11ty/eleventy-img`**: Transforms images into modern formats like AVIF and WebP.

-----

### Core `npm` Scripts

This project uses a set of organized scripts for common tasks.

#### Primary Commands

  * **`npm run dev`**: Starts a live-reloading local server for development.
  * **`npm run build`**: Compiles the production site to the `_site/` directory.
  * **`npm run format`**: Formats the entire repository with Prettier.

#### Testing Commands 🧪

  * **`npm test`**: Intelligently runs only the tests related to your recent code changes.
  * **`npm test:all`**: Executes the full test suite.
  * **`npm run coverage`**: Generates a code coverage report.

#### Documentation & Tools 📚

  * **`npm run docs:links`**: Checks all Markdown files for broken links.
  * **`npm run docs:validate`**: Verifies documentation hashes.
  * **`npm run docs:reindex`**: Rebuilds the vendor documentation index.
  * **`npm run tools:build-search`**: Installs and builds utilities in `tools/google-search`.

#### System & Dependencies ⚙️

  * **`npm run deps:setup`**: A convenient one-time command to install all Playwright browser and system dependencies.
  * **`npm run proxy:health`**: Checks the status of the Markdown proxy service.

### Tailwind Theme

  * Custom colour palette and font families defined in `tailwind.config.cjs` with dark and light themes supplied by DaisyUI.

### Eleventy Collections

  * `sparks`, `concepts`, `projects`, `archives` and `meta` sourced from `src/content`.
  * `nodes` aggregates all content areas for global queries.
  * `featured`, `interactive` and `recentAll` power home page sections.
  * Archive collections are auto-generated for `products`, `series` and `characters` data.

### Services

  * `effusion-labs` container exposed on port `18400:80` via `docker-compose.yml`.
  * `markdown_gateway` proxies HTML to Markdown via FlareSolverr; override the default solver address with `SOLVER_URL`.

## ⚡ Quickstart

```bash
git clone https://github.com/effusion-labs/effusion-labs.git
cd effusion-labs
npm install
cp .env.example .env          # And configure your environment variables
source scripts/llm-bootstrap.sh # Activates guardrails & checks dependencies
npm run dev                   # Start the development server
```

## 📂 Project Layout

```text
/
├── .conda/            # Conda Python environment data
├── .github/           # GitHub Actions workflows and settings
├── .portainer/        # Dockerfile and nginx config for production image
├── _site/             # Eleventy build output directory
├── artifacts/         # Build artifacts and generated reports
├── bin/               # Binary executables or helper scripts
├── docs/              # Cassettes, knowledge, and ADRs
├── lib/               # Configuration, plugins, and utilities
├── logs/              # Runtime log files
├── markdown_gateway/  # Web ingestion helper service
├── node_modules/      # Node.js dependencies
├── research/          # Research documents and data
├── schema/            # Data schemas for validation
├── scripts/           # Maintenance scripts
├── src/               # Templates, assets, and Markdown content
├── test/              # The complete test suite (Node.js & Browser)
├── tmp/               # Temporary files
├── tools/             # Developer tools and API twin
├── .dockerignore      # Files to exclude from Docker builds
├── .env.example       # Example environment variables
├── .gitignore         # Files to ignore for git version control
├── .nvmrc             # Node Version Manager configuration
├── .prettierrc        # Prettier code formatting rules
├── AGENTS.md          # Rails and mandates for the autonomous agent
├── docker-compose.yml # Defines and runs multi-container Docker services
├── eleventy.js        # Core Eleventy configuration file
├── package.json       # Project dependencies and npm scripts
└── README.md          # This file
```

## 🚢 Deployment

  * **GitHub Actions**: the “Build and Deploy to GHCR” workflow runs tests, builds the site and pushes images to GitHub Container Registry.
  * **Docker**: `.portainer/Dockerfile` builds a static Nginx image and `docker-compose.yml` exposes the site on port 18400.

## 🧪 Quality Assurance

  * `npm test` uses an intelligent test runner (`tools/runner.mjs`) that executes tests relevant to recent code changes from the unified `test/` directory.
  * `npm test:all` executes the complete test suite in parallel for maximum speed.
  * The active shell guardrails (`llm-bootstrap.sh`) prevent common failures like CI timeouts.
  * `npm run docs:links` verifies all Markdown links.
  * GitHub Actions execute these checks on every push to ensure repository health.

## 🤝 Contributing

1.  Fork the repository and clone your fork.
2.  Install dependencies with `npm install`.
3.  Create a branch and commit your changes with accompanying tests.
4.  Run `npm test` and `npm run docs:links` before opening a pull request.

## 📄 License

This project is licensed under the [ISC License](https://www.google.com/search?q=./LICENSE).