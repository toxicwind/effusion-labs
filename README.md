# Effusion Labs

Effusion Labs is an **autonomous knowledge organism** with first-class lens perception — built on Eleventy, Nunjucks, Tailwind CSS, Vite, and Bun-based tooling. It is no longer just a static site generator: content is perceived, analyzed, and cross-linked by an agentic lens system at build time, and exposed as tools at runtime. See [`docs/AGENTIC-LENS-FIRST.md`](./docs/AGENTIC-LENS-FIRST.md) for the full architecture.

[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](./LICENSE)

## Quickstart

### Prerequisites

- Node.js `>=22.19.0`
- Bun

### Install

```bash
bun install
```

### Develop

```bash
bun run dev
```

### Build

```bash
bun run build
```

### Test

```bash
bun run test
```

## Common commands

- `bun run check` — doctor + quality + integration tests
- `bun run quality:check` — quality checks
- `bun run quality:apply` — auto-fix formatting/lint where supported
- `bun run test:playwright` — Playwright suite
- `bun run mcp:start` — start MCP gateway server
- `bun run server.ts` (from `services/mcp-stack/lens-server/`) — start the lens MCP server

## Agentic lens subsystem

The lens system is how the site sees. At build time, Eleventy loads
[`lib/lens-orchestrator.js`](./lib/lens-orchestrator.js), which discovers every
`lens_*.js` in [`src/_11ty/lenses/`](./src/_11ty/lenses/), runs a swarm DAG
across all content, and writes `src/_data/lensManifest.json` for templates to
consume — including the `{% lens %}` shortcode:

```njk
{% lens "stylometric", page.content %}
```

Current lenses (10): `ast_dependency`, `cryptographic`, `osint`,
`probabilistic`, `quantum_superposition`, `semantic`, `strata_debt`,
`stylometric`, `tectonic`, `temporal_drift`.

Supporting machinery in `lib/`:

- `swarm-orchestrator.js` — parallel agent execution (swarm DAG)
- `vector-pipeline.js` — vector embedding pipeline
- `sync-layer.js` — WebSocket sync layer
- `knowledge-graph.js` — knowledge graph adapter
- `consensus-engine.js` — consensus engine
- `ast-engine.js` + `ast-visitors/` — AST as first-class perception

At runtime, the **lens MCP server**
([`services/mcp-stack/lens-server/`](./services/mcp-stack/lens-server/),
`@effusion/lens-server` 2.0.0, `server.ts`) exposes lens profiles as
first-class MCP tools — separate from the gateway server that `mcp:start` runs.

## Project structure

- `src/` — site templates, content, assets, and client JS
- `lib/` — Eleventy registration/config helpers and shared utilities
- `docs/` — audits, knowledge artifacts, migration notes, reports
- `services/mcp-stack/` — MCP gateway, lens MCP server, and related integration pieces
- `tools/` — build/test/ops helper scripts

## Current build audit

Build output oddities and cleanup priorities are tracked here:

- [`docs/build-output-weirdness-audit-2026-03-12.md`](./docs/build-output-weirdness-audit-2026-03-12.md)

## Deployment notes

The site builds to `_site/` and can be containerized via `.portainer/Dockerfile`.
Netlify deploys via [`netlify.toml`](./netlify.toml) (`npm run build` → `_site`).
Vite (`@11ty/eleventy-plugin-vite`, [`vite.config.mjs`](./vite.config.mjs)) handles
the client asset pipeline.

## License

Licensed under ISC. See [`LICENSE`](./LICENSE).
