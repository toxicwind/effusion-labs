# Effusion Labs

[![CI](https://github.com/OWNER/REPO/actions/workflows/deploy.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/deploy.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

## Overview

Effusion Labs is a digital studio and knowledge base built on the Eleventy static site generator. It blends a
lightweight authoring model with a modern asset pipeline so new pages and experiments can ship quickly. Content is
written in Markdown or Nunjucks, rendered with Eleventy v3, and bundled through Vite for an efficient development
experience. The repository aims to serve humans and autonomous agents alike by favoring explicit conventions over
implicit magic.

## Features

- **Hybrid rendering.** Eleventy processes content while Vite handles hot-reloaded assets, offering instant feedback
  during development and optimized bundles for production.
- **Styling toolkit.** Tailwind v4 and daisyUI v5 provide expressive, utility-first components and design primitives
  that encourage consistent UI without heavy CSS handcrafting.
- **Node ≥24 with ES modules.** The project embraces native ESM, enabling standard `import` syntax and modern
  tooling without transpilation.
- **Dynamic generation.** Eleventy plugins drive on-demand rendering, creating pages as data arrives and keeping build
  times brisk.
- **Agent-friendly layout.** Repository structure, scripts, and naming are intentionally predictable, easing navigation
  for automation.

## Quickstart

```bash
npm install
npm run dev    # launch dev server on http://localhost:8080
npm run build  # output production site to _site/
```

Node 24 or later is required. Using `nvm`, execute `nvm install 24 && nvm use 24` once. The dev server enables live
reload for templates, scripts, and styles, while `npm run build` compiles a fully static site into the `_site/` folder.

## Scripts

| Script   | Purpose                           |
| -------- | --------------------------------- |
| `dev`    | Serve site with Eleventy + Vite   |
| `build`  | Produce static site in `_site/`   |
| `check`  | Run format check, lint, and tests |
| `test`   | Run integration tests             |
| `format` | Format code with Prettier         |
| `lint`   | Check markdown links              |

Each script maps directly to commands in `package.json`. The `check` script chains formatting, linting, and tests to
ensure patches meet baseline standards before commit.

## Project Structure

```
config/      build & site config
utils/       dev and build helpers
src/content/ markdown & Nunjucks pages
src/assets/  source assets → /assets/
test/        integration and unit tests
```

Generated pages live under `src/content/` while static assets originate in `src/assets/`. The final site is emitted to
`_site/`, ready for deployment. Additional automation scripts reside in `utils/` and configuration files consolidate in
the `config/` directory.

## Development Workflow

Run `npm run dev` to start a hot-reloading environment that watches templates, styles, and client-side code. Format
changes with `npm run format` to keep the codebase consistent, and verify outbound links using `npm run lint`. Prior to
opening a pull request, execute `npm run check` to run formatting in check mode, lint the README, and launch the
integration test suite. Repository facts for autonomous agents live in [AGENTS.md](AGENTS.md).

## Testing

Integration tests run through [c8](https://github.com/bcoe/c8) for coverage. To execute the suite once:

```bash
npm test
```

During active development, use the watch mode:

```bash
npm run test:watch
```

The combined `check` script is convenient for validating a patch in one command:

```bash
npm run check
```

## Contributing

Fork the repository, create a focused feature branch, and keep commits cohesive. Run `npm run check` before submitting
pull requests. Documentation, tooling improvements, and new content are all welcome. For larger proposals, open an issue
first to discuss the approach.

## License

[ISC](LICENSE)
