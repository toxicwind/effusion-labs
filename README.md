# Effusion Labs Digital Garden

[![Build and Deploy to GHCR](https://github.com/effusion-labs/effusion-labs/actions/workflows/deploy.yml/badge.svg)](https://github.com/effusion-labs/effusion-labs/actions/workflows/deploy.yml)
[![Link Check](https://github.com/effusion-labs/effusion-labs/actions/workflows/link-check.yml/badge.svg)](https://github.com/effusion-labs/effusion-labs/actions/workflows/link-check.yml)
[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](./LICENSE)

## Table of Contents
- [🚀 Project Overview](#-project-overview)
- [✨ Key Features](#-key-features)
- [⚡ Quickstart](#-quickstart)
- [📂 Project Layout](#-project-layout)
- [🚢 Deployment](#-deployment)
- [🧪 Quality Assurance](#-quality-assurance)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## 🚀 Project Overview
Effusion Labs is a static digital garden built with Eleventy, Nunjucks templates and Tailwind CSS. Markdown content in `src/content` feeds Eleventy's collections to generate a fully static site. Node.js 20 powers the build pipeline, and the resulting `_site/` directory can be served directly or packaged into a lightweight Nginx container. GitHub Actions drive tests and deployments to GitHub Container Registry.

## ✨ Key Features
- Home page presents a multi-column Work feed with filter toolbar, interactive concept map CTA, and animated lab seal flourish.
- Dedicated `/work` section aggregates projects, concepts, and sparks with category filters and deep links.
- Product pages now surface provenance metadata sourced from bundled JSONL files.
- Utility helpers provide ordinal suffixes and file caching; ordinal suffix now supports negative numbers.
### npm Scripts
- `npm run dev` – start Eleventy with live reload.
- `npm run build` – compile the production site to `_site/`.
- `npm test` – run tests related to changed files.
- `npm run test:all` – execute the full test suite.
- `npm run proxy:health` – check the Markdown proxy service.
- `npm run docs:validate` – verify documentation hashes.
- `npm run docs:reindex` – rebuild the vendor documentation index.
- `npm run build:tools` – install and build utilities in `tools/google-search`.
- `npm run deps:playwright` – install the Chromium browser for Playwright.
- `npm run deps:system` – install system dependencies for Playwright.
- `npm run proxy:chain` – run the proxy chain helper.
- `npm run prepare-docs` – ensure `fd` is installed for repository search; `rg` must be installed separately.
- `npm run docs:links` – check this README for broken links.

### Eleventy Plugins
- `@photogabble/eleventy-plugin-interlinker` – renders internal references as annotated links; configured to ignore templated hrefs.
- `@11ty/eleventy-navigation` – builds navigation structures from front matter.
- `@11ty/eleventy-plugin-syntaxhighlight` – adds Prism-based code highlighting.
- `@11ty/eleventy-plugin-rss` – generates RSS feeds for collections.
- `@quasibit/eleventy-plugin-sitemap` – emits `sitemap.xml` with a predefined hostname.
- `@quasibit/eleventy-plugin-schema` – generates JSON-LD structured data for pages.
- `@11ty/eleventy-img` – transforms images to AVIF, WebP and original formats.

### Tailwind Theme
- Custom colour palette and font families defined in `tailwind.config.cjs` with dark and light themes supplied by DaisyUI.

### Eleventy Collections
- `sparks`, `concepts`, `projects`, `archives` and `meta` sourced from `src/content`.
- `nodes` aggregates all content areas for global queries.
- `featured`, `interactive` and `recentAll` power home page sections.
- Archive collections are auto-generated for `products`, `series` and `characters` data.

### Services
- `effusion-labs` container exposed on port `18400:80` via `docker-compose.yml`.
- `markdown_gateway` proxies HTML to Markdown via FlareSolverr; override the default solver address with `SOLVER_URL`.

## ⚡ Quickstart
```bash
git clone https://github.com/effusion-labs/effusion-labs.git
cd effusion-labs
npm install
cp .env.example .env          # OUTBOUND_MARKDOWN_ENABLED, OUTBOUND_MARKDOWN_USER, OUTBOUND_MARKDOWN_PASS, OUTBOUND_MARKDOWN_URL, OUTBOUND_MARKDOWN_PORT, OUTBOUND_MARKDOWN_API_KEY, OUTBOUND_MARKDOWN_TIMEOUT
npm run prepare-docs          # installs fd if missing
npm run dev                   # Eleventy + live reload
npm run build                 # production output in _site/
npm test                      # run test suite
docker-compose up --build     # launch services
```

## 📂 Project Layout
```text
/
├── .portainer/        # Dockerfile and nginx config for production image
├── docs/              # cassettes, knowledge and ADRs
├── lib/               # configuration, plugins and utilities
├── markdown_gateway/  # web ingestion helper service
├── scripts/           # maintenance scripts
├── src/               # templates, assets and Markdown content
├── test/              # legacy test harness
├── tests/             # Node.js test suite
├── tools/             # developer tools and API twin
```

## 🚢 Deployment
- **GitHub Actions**: the “Build and Deploy to GHCR” workflow runs tests, builds the site and pushes images to GitHub Container Registry.
- **Docker**: `.portainer/Dockerfile` builds a static Nginx image and `docker-compose.yml` exposes the site on port 18400.

## 🧪 Quality Assurance
  - `npm test` runs the Node.js test suite.
- `npm run docs:links` verifies links in this README.
- GitHub Actions execute both checks on every push.

## 🤝 Contributing
1. Fork the repository and clone your fork.
2. Install dependencies with `npm install`.
3. Create a branch and commit your changes with accompanying tests.
4. Run `npm test` and `npm run docs:links` before opening a pull request.

## 📄 License
This project is licensed under the [ISC License](./LICENSE).
