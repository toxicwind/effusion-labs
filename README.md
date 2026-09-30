<div align="right">

![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg?style=for-the-badge)
![Node >=22.19](https://img.shields.io/badge/node-%3E%3D22.19-3c873a.svg?style=for-the-badge)
![Eleventy](https://img.shields.io/badge/eleventy-3.1-3a4048.svg?style=for-the-badge)
![Vite](https://img.shields.io/badge/vite-6-646cff.svg?style=for-the-badge)
![MCP](https://img.shields.io/badge/MCP-tools-7c3aed.svg?style=for-the-badge)
![Netlify](https://img.shields.io/badge/netlify-deployed-00c7b7.svg?style=for-the-badge)

</div>

# Effusion Labs 🧠✨

**An autonomous knowledge organism with first-class lens perception.**

This is not a static site generator with plugins bolted on. Effusion Labs is a digital studio and knowledge base that *sees its own content*: an agentic lens system perceives, analyzes, and cross-links every page at build time — then serves that perception as real MCP tools at runtime.

> Why should I care? If you run a knowledge-heavy site — docs, research notes, a personal wiki — the lens subsystem gives your build a perception pipeline: stylometric fingerprints, heading topology, crypto provenance, drift analysis, all computed automatically and queryable by agents through the Model Context Protocol.

## Features

- **🔭 Agentic lens system** — 10 lenses run a swarm DAG across all content at build time
- **`{% lens %}` shortcode** — call any lens inline from Nunjucks templates
- **`lensManifest.json`** — every lens verdict, materialized for templates
- **🤖 Lens MCP server** — lens profiles exposed as first-class MCP tools (`@effusion/lens-server` 2.0.0)
- **🌐 MCP gateway** — unified gateway server for the whole MCP stack
- **🧬 AST-first perception** — the AST engine makes syntax trees a first-class sense
- **⚡ Eleventy 3 + Vite** — static output with a modern client asset pipeline
- **🎨 Tailwind CSS 4 + daisyUI** — design system ready
- **🛡️ Consensus engine** — lenses reach agreement, not just opinions
- **🚀 Netlify-native** — `npm run build` → `_site`, deploy in one push

## How it sees

```mermaid
flowchart LR
    subgraph build [Build time]
        C[Content] --> E[Eleventy]
        E --> LO[lens-orchestrator.js]
        LO --> SW[swarm-orchestrator.js]
        SW --> L1[ast_dependency]
        SW --> L2[stylometric]
        SW --> L3[tectonic]
        SW --> Lx[+7 more lenses]
        L1 & L2 & L3 & Lx --> CE[consensus-engine.js]
        CE --> LM[lensManifest.json]
        LM --> T[{% lens %} shortcode]
    end
    subgraph runtime [Runtime]
        LS[lens-server / server.ts] -->|MCP tools| A[Agents]
    end
```

Ten lenses, zero configuration: `ast_dependency`, `cryptographic`, `osint`, `probabilistic`, `quantum_superposition`, `semantic`, `strata_debt`, `stylometric`, `tectonic`, `temporal_drift` — discovered automatically from `src/_11ty/lenses/`.

## Quick start

```bash
bun install        # install dependencies
bun run dev        # serve with hot reload
bun run build      # production build → _site/
```

Prerequisites: Node.js `>=22.19.0` (see [`.nvmrc`](.nvmrc)) and [Bun](https://bun.sh).

## Architecture

```
effusion-labs/
├── lib/                  # Eleventy registration + shared perception machinery
│   ├── lens-orchestrator.js    # discovers lenses, runs the swarm DAG
│   ├── swarm-orchestrator.js   # parallel agent execution
│   ├── consensus-engine.js     # lens agreement protocol
│   ├── knowledge-graph.js      # knowledge graph adapter
│   ├── vector-pipeline.js      # vector embedding pipeline
│   ├── sync-layer.js           # WebSocket sync layer
│   └── ast-engine.js + ast-visitors/  # AST as first-class perception
├── src/_11ty/lenses/      # the 10 lenses (lens_*.js), auto-discovered
├── src/                  # site templates, content, assets, client JS
├── services/mcp-stack/
│   ├── gateway/          # MCP gateway server (bun run mcp:start)
│   └── lens-server/      # lens MCP server — lenses as MCP tools
├── tools/                # build / test / ops helper scripts
├── docs/                 # audits, migration notes, reports
└── tests/                # integration, playwright, lens-orchestrator suites
```

The full lens doctrine lives in [`docs/AGENTIC-LENS-FIRST.md`](docs/AGENTIC-LENS-FIRST.md). Build-output oddities are tracked in [`docs/build-output-weirdness-audit-2026-03-12.md`](docs/build-output-weirdness-audit-2026-03-12.md).

## Config & services

| Piece | How | Notes |
|---|---|---|
| Environment | copy [`.env.example`](.env.example) → `.env` | never commit `.env` |
| MCP gateway | `bun run mcp:start` | `services/mcp-stack/gateway/server.mjs` |
| Lens MCP server | `bun services/mcp-stack/lens-server/server.ts` | `@effusion/lens-server` 2.0.0, lenses as tools |
| Client assets | [`vite.config.mjs`](vite.config.mjs) | `@11ty/eleventy-plugin-vite` |
| Deploy | [`netlify.toml`](netlify.toml) | `npm run build` publishes `_site/` |

## Dev & contributing

```bash
bun run check           # doctor + quality checks + integration tests
bun run quality:apply   # auto-fix formatting/lint (dprint, eslint, rustywind)
bun run test:playwright  # browser suite
bun run links:check      # link-check the README
```

Commits follow [Conventional Commits](https://www.conventionalcommits.com/) (see [`commitlint.config.js`](commitlint.config.js)). Agent contributors: read [`AGENTS.md`](AGENTS.md) and [`AGENTS_LOG.md`](AGENTS_LOG.md) first.

## License & security

Licensed under **ISC** — see [`LICENSE`](LICENSE).

Security: report vulnerabilities via [GitHub Issues](https://github.com/toxicwind/effusion-labs/issues). Operational hardening history is logged in [`HARDENING_LOG.md`](HARDENING_LOG.md).
