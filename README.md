# Effusion Labs Digital Garden

[](https://github.com/effusion-labs/effusion-labs/actions/workflows/deploy.yml)
[](https://github.com/effusion-labs/effusion-labs/actions/workflows/link-check.yml)
[](https://www.google.com/search?q=./LICENSE)

## Table of Contents

  - [Effusion Labs Digital Garden](https://www.google.com/search?q=%23effusion-labs-digital-garden)
      - [Table of Contents](https://www.google.com/search?q=%23table-of-contents)
      - [🚀 Project Overview](https://www.google.com/search?q=%23-project-overview)
      - [🛡️ Guardrail Environment](https://www.google.com/search?q=%23%EF%B8%8F-guardrail-environment)
      - [✨ Key Features](https://www.google.com/search?q=%23-key-features)
          - [Eleventy Plugins](https://www.google.com/search?q=%23eleventy-plugins)
          - [Core `npm` Scripts](https://www.google.com/search?q=%23core-npm-scripts)
              - [Primary Commands](https://www.google.com/search?q=%23primary-commands)
              - [Testing Commands 🧪](https://www.google.com/search?q=%23testing-commands-)
              - [Documentation & Tools 📚](https://www.google.com/search?q=%23documentation--tools-)
              - [System & Dependencies ⚙️](https://www.google.com/search?q=%23system--dependencies-%EF%B8%8F)
          - [Tailwind Theme](https://www.google.com/search?q=%23tailwind-theme)
          - [Eleventy Collections](https://www.google.com/search?q=%23eleventy-collections)
          - [Services](https://www.google.com/search?q=%23services)
      - [⚡ Quickstart](https://www.google.com/search?q=%23-quickstart)
      - [📂 Project Layout](https://www.google.com/search?q=%23-project-layout)
      - [🚢 Deployment](https://www.google.com/search?q=%23-deployment)
      - [🧪 Quality Assurance](https://www.google.com/search?q=%23-quality-assurance)
      - [🤝 Contributing](https://www.google.com/search?q=%23-contributing)
      - [📄 License](https://www.google.com/search?q=%23-license)

## 🚀 Project Overview

Effusion Labs is a static digital garden built with Eleventy, Nunjucks templates and Tailwind CSS. Markdown content in `src/content` feeds Eleventy's collections to generate a fully static site. Node.js 20 powers the build pipeline, and the resulting `_site/` directory can be served directly or packaged into a lightweight Nginx container. GitHub Actions drive tests and deployments to GitHub Container Registry.

## 🛡️ Guardrail Environment

This project uses a specialized "no friction" shell environment to accelerate autonomous and human development. Activating it is a mandatory first step for working in this repository.

**Activation Command:**

```bash
source scripts/llm-bootstrap.sh
```

Sourcing this script **once per session** enables several key features:

  * **Smart Dependency Management:** The script automatically checks if your `npm` and `pip` dependencies are out of sync and, if they are, installs the correct versions.
  * **Live Output Correction:** Any command that redirects output to a file (e.g., `npm test > test.log`) is invisibly rewritten to a live, streaming pipeline. This prevents silent CI timeouts and errors from long output lines.
  * **Enhanced Tooling:** Core commands are enhanced for better readability and to prevent common failures.
  * **Persistence:** The environment automatically re-activates itself when you change branches via Git hooks, ensuring the guardrails are always active.

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