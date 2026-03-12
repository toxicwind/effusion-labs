# Effusion Labs

Effusion Labs is a static digital garden and studio site powered by Eleventy, Nunjucks, Tailwind CSS, and Bun-based tooling.

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

## Project structure

- `src/` — site templates, content, assets, and client JS
- `lib/` — Eleventy registration/config helpers and shared utilities
- `docs/` — audits, knowledge artifacts, migration notes, reports
- `services/mcp-stack/` — MCP gateway and related integration pieces
- `tools/` — build/test/ops helper scripts

## Current build audit

Build output oddities and cleanup priorities are tracked here:

- [`docs/build-output-weirdness-audit-2026-03-12.md`](./docs/build-output-weirdness-audit-2026-03-12.md)

## Deployment notes

The site builds to `_site/` and can be containerized via `.portainer/Dockerfile`.

## License

Licensed under ISC. See [`LICENSE`](./LICENSE).
