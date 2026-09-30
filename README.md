<div align="right">

![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg?style=for-the-badge)
![Node >=22.19](https://img.shields.io/badge/node-%3E%3D22.19-3c873a.svg?style=for-the-badge)
![Eleventy](https://img.shields.io/badge/eleventy-3.1-3a4048.svg?style=for-the-badge)
![Vite](https://img.shields.io/badge/vite-6-646cff.svg?style=for-the-badge)
![MCP](https://img.shields.io/badge/MCP-tools-7c3aed.svg?style=for-the-badge)

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
- **🚀 Deploy lanes** — prod via dedi Portainer stack → cloudflared, staging via flicker → `:43000` (see [Deploy](#deploy))

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
| Deploy | [Deploy](#deploy) | prod: dedi Portainer → cloudflared; staging: flicker → `:43000` |

## Resume

The resume is data-driven: one canonical JSON feeds both the web page and the downloadable PDF.

```
src/pages/resume/resume.json                    # canonical source — edit THIS
  ├─→ src/pages/resume/index.njk                # /resume/ page (Eleventy + Nunjucks)
  └─→ bun scripts/generate-resume-pdf.ts        # 2-page canonical PDF
        └─→ src/assets/static/Christopher_Ortega_Resume_2026.pdf  # served at /assets/…
```

- **Canonical source:** [`src/pages/resume/resume.json`](src/pages/resume/resume.json) — title, summary, experience, skills, projects, education. Single source of truth since `d24ab059` (2026-09-30).
- **Page:** [`src/pages/resume/index.njk`](src/pages/resume/index.njk) renders `/resume/` through the [`subdomains/resume` layout](src/_includes/layouts/subdomains/resume/page.njk).
- **PDF:** [`scripts/generate-resume-pdf.ts`](scripts/generate-resume-pdf.ts) (Bun, added in `2a0e2151`) reads the JSON, renders a standalone print-optimized HTML document (inline CSS, no site-pipeline dependency), and prints it via headless Chromium. The committed PDF lives at `src/assets/static/` and is served at `/assets/Christopher_Ortega_Resume_2026.pdf` — passthrough configured in [`lib/eleventy/register.js`](lib/eleventy/register.js); the `downloadPdf` key in the JSON points the page's download button at it.

**Update flow:** edit the JSON → `bun run build` (page) → `bun scripts/generate-resume-pdf.ts` (PDF) → commit both. The generator's header links back to this section.

## Deploy

Production and staging are **different lanes** — don't confuse them (corrected 2026-09-30).

**Production — `effusionlabs.com`** is served from the dedi (`mildlyawesome.com`):

```
repo build (_site/) → copy to dedi → Portainer stack → Traefik → nginx:alpine
  (bind-mounted _site) → cloudflared tunnel → Cloudflare → effusionlabs.com
```

- The prod image is defined by [`.portainer/Dockerfile`](.portainer/Dockerfile) (+ [`nginx.conf`](.portainer/nginx.conf)); the live stack serves a bind-mounted `_site`.
- **Auto-deploy is dead:** `infra/flicker/hook.ts` (GitHub push → webhook on `:25242` → flicker build → rollout) has no runner — nothing supervises it, and the repo-side GitHub Actions deploy path was retired in `b3d7834f`. Deploys to prod are **manual** until the path is re-lit.

**Staging — flicker → yote `:43000`:**

```bash
infra/flicker/build.sh && infra/flicker/rollout.sh   # → effusion-web:live container, health-gated with auto-rollback
```

Staging/preview only — it does **not** serve the public domain.

**Netlify:** the `netlify.toml` at repo root is a 55-byte stub (`npm run build` → `_site`), added in a 2026-08-18 sync commit and never wired to an actual Netlify site. The old "Netlify-native"/"deployed" claims in this README were inaccurate and were removed 2026-09-30. (Related: the consulting contact form still carries a `data-netlify="true"` attribute — inert on the current non-Netlify prod; see `src/_includes/standalone/consulting/contact-form.njk`.)

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
