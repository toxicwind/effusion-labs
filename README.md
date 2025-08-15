# Effusion Labs Digital Garden

Effusion Labs is a long‑form digital garden and studio powered by Eleventy, Nunjucks and Tailwind CSS. It serves as a structured space for developing ideas, capturing research and publishing a static site.

## Badges

[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](./LICENSE)

## Table of Contents

- [Overview](#overview)
- [Features / Capabilities](#features--capabilities)
- [Quickstart](#quickstart)
- [Configuration](#configuration)
- [Testing](#testing)
- [Web Ingestion Helper](#web-ingestion-helper)
- [Project Layout](#project-layout)
- [Deployment / Release](#deployment--release)
- [Contributing](#contributing)
- [License](#license)
- [Links](#links)

## Overview

This repository contains the source for the Effusion Labs site. The build pipeline combines Eleventy for static generation, Nunjucks templates for layout, and Tailwind CSS (with daisyUI) for styling. Markdown files under `src/content` provide the primary content. The project targets practitioners who want a reproducible digital garden with bidirectional links, a graph view and containerised deployment.

The repository is intentionally self‑describing. Configuration is expressed as code, tests run without network access and every external reference is captured for provenance. Publishing involves compiling Markdown and assets into a static directory that can be served by any HTTP host or bundled into a container image.

Content is organised into **Sparks**, **Concepts**, **Projects** and **Meta** areas. Documents can interlink and evolve over time, turning transient notes into durable knowledge while remaining easy to publish.

## Features / Capabilities

- **Eleventy static site** with configurable collections for Sparks, Concepts, Projects and Meta documents, generated via the shared register module and constants【F:lib/eleventy/register.js†L33-L38】【F:lib/constants.js†L7-L13】
- **Nunjucks layout** with an accessible dark/light theme toggle (defaulting to dark) driven by CSS variables, skip navigation link and meta sidebar for document metadata【F:src/\_includes/layout.njk†L1-L37】【F:src/\_includes/header.njk†L20-L27】
- **Tailwind CSS v4** configured through PostCSS, extended with custom colours and fonts, and wired to theme tokens via daisyUI【F:tailwind.config.cjs†L1-L43】【F:postcss.config.cjs†L1-L5】
- **Bidirectional linking** using `@photogabble/eleventy-plugin-interlinker`, producing annotated `<a class="interlink">` elements for internal references【F:lib/plugins.js†L1-L26】
- **Syntax highlighting** via `@11ty/eleventy-plugin-syntaxhighlight` and Prism themes loaded through the Tailwind entry file【F:lib/plugins.js†L27-L31】【F:src/styles/app.tailwind.css†L4-L5】
- **Responsive image transform**: `@11ty/eleventy-img` generates AVIF, WebP and original formats at multiple widths with lazy‑loading and async decoding attributes【F:lib/eleventy/register.js†L40-L52】
- **Interactive concept map** built with `vis-network`, exposing collections as a node‑edge graph at `/map/` for exploratory browsing【F:src/map.njk†L38-L121】
- **Webpage ingestion helper** providing both an Eleventy filter and a CLI to convert external pages to Markdown using Readability.js and Turndown【F:lib/filters.js†L1-L5】【F:lib/webpageToMarkdown.js†L1-L26】
- **PostCSS pipeline** that compiles `src/styles/app.tailwind.css` on each build and copies static assets through to `_site/`【F:lib/eleventy/register.js†L69-L72】
- **Accessible baseline** including skip‑link, semantic landmarks and footnote enhancements for improved keyboard navigation and readability【F:src/\_includes/layout.njk†L33-L75】【F:src/styles/app.tailwind.css†L12-L38】

## Quickstart

### Prerequisites

- Node.js ≥20【F:package.json†L12-L13】
- npm (bundled with Node)

### Clone and Install

```bash
git clone https://github.com/effusion-labs/effusion-labs.git
cd effusion-labs
npm install
```

### Local Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Utility Scripts

```bash
npm run docs:reindex     # rebuild vendor docs index
npm run docs:validate    # verify hashes
```

The `dev` command watches templates, Markdown and styles, recompiling Tailwind through PostCSS before each serve cycle and serving `_site/` via BrowserSync. The `build` command performs a one‑off production build. Tests are hermetic and execute without internet access.

No lint or format scripts are defined.

## Markdown Gateway Service

### Configuration
Copy `.env.example` to `.env` and set a secure, random `GATEWAY_API_KEY`.

### Deployment
Run `docker compose up --build -d` from the `markdown_gateway` directory.

### Usage
```bash
curl -X POST http://localhost:49159/convert \
     -H "Content-Type: application/json" \
     -H "X-Api-Key: YOUR_SECRET_KEY_FROM_.ENV_FILE" \
     -d '{"url": "https://example.com"}'
```

### Environment

Clients communicate with the gateway via these variables:

```
OUTBOUND_MARKDOWN_URL=http://localhost:49159
OUTBOUND_MARKDOWN_API_KEY=your_key
OUTBOUND_MARKDOWN_TIMEOUT=120000 # optional, ms
```

## Configuration

- **Content directories**: Markdown lives under `src/content/{sparks,concepts,projects,meta}`【F:lib/constants.js†L7-L13】
- **Data files**: `src/_data/` holds global data such as navigation links【F:src/\_data/nav.js†L1-L11】
- **Includes**: Nunjucks layouts and partials reside in `src/_includes/`
- **Env vars**:
  - `CASSETTE_DIR` – path to snapshot vault (`docs/cassettes/` by default)
  - `API_TWIN_DIR` – path to API twin stubs (`tools/api-twin/` by default)

Setting these variables allows custom storage locations for captures or twins when running tests in specialised environments. All other configuration resides in the `lib/` directory as plain JavaScript modules.

## Testing

`npm test` runs an adaptive harness that targets only tests related to your changes. It inspects `git status` to detect modified files and executes matching tests, falling back to the full suite when no direct matches are found. Use `npm run test:all` to force a complete run or when CI sets `CI=true`. Integration tests that exercise network calls use the **Live‑Capture‑Lock** policy:

- **Snapshot vault**: Recorded HTTP interactions are stored under `docs/cassettes/`【9ad1e7†L1-L2】
- **Creating captures**: run the relevant tests with network access; responses are saved as fixtures for replay
- **Replay**: PR CI replays snapshots and **fails closed** if a test attempts live network access
- **API twin**: when live capture is unsafe or unavailable, stub the endpoint under `tools/api-twin/` and point tests to the twin【44f46f†L1-L2】
- **Idempotency**: live probes must be repeatable and safe; destructive flows are simulated via the twin

Snapshots are deterministic: headers and bodies are stored alongside SHA256 hashes. Any attempt to mutate the snapshot store during CI causes the build to fail, ensuring reproducibility. Developers should refresh snapshots only when contract drift breaks replay, committing both the updated fixture and the rationale in the decision log.


Within templates, the filter can ingest content on build:

```njk
{{ "https://example.com/article" | webpageToMarkdown }}
```

## Project Layout

```
.
├── .eleventy.js               # Eleventy configuration entry
├── .github/workflows/deploy.yml
├── .portainer/                # Dockerfile and nginx.conf for deployment
├── docs/
│   ├── cassettes/             # Snapshot vault for recorded HTTP interactions
│   └── knowledge/             # Decision log, sources and research snapshots
├── lib/                       # Configuration, plugins, filters, utilities
├── src/
│   ├── _data/                 # Global data files
│   ├── _includes/             # Nunjucks layouts and partials
│   ├── assets/                # Static assets (copied through)
│   ├── content/               # Markdown content grouped by area
│   ├── scripts/               # Client-side JavaScript
│   └── styles/                # Tailwind entry points
├── test/                      # Node.js test suite
├── tools/
│   └── api-twin/              # Placeholder for API stubs used during offline tests
└── webpage-to-markdown.js     # CLI for web ingestion
```

## Deployment / Release

The project builds to static files in `_site/`. A GitHub Actions workflow installs dependencies, runs tests, builds the site and produces an Nginx image pushed to GitHub Container Registry. The container embeds the generated `_site/` output and a tailored `nginx.conf`. Successful pushes to `main` trigger the pipeline and a Portainer webhook redeploys the container on the target host【F:.github/workflows/deploy.yml†L1-L61】【F:.portainer/Dockerfile†L1-L24】.

Local deployment can be tested with:

```bash
docker build -t effusion-labs . -f .portainer/Dockerfile
docker run --rm -p 8080:80 effusion-labs
```

The running container serves the static site with caching headers and an SPA fallback defined in `.portainer/nginx.conf`.

## Contributing

1. Fork the repository and create a local clone.
2. Install dependencies with `npm install`.
3. Create feature branches that keep experimental work behind flags.
4. Update or add tests alongside code changes; record any new external captures in `docs/knowledge/` and commit snapshots under `docs/cassettes/`.
5. Run `npm test` for fast feedback or `npm run test:all` to execute the entire suite and verify snapshots without network access.
6. Submit a pull request describing your changes, snapshot updates and any assumptions.

## License

This project is licensed under the [ISC License](./LICENSE)【F:LICENSE†L1-L11】

## Links

- [docs/knowledge/](./docs/knowledge/) – decision history and source captures
- [tools/api-twin/](./tools/api-twin/) – API twin stub location
