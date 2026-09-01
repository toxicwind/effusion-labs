# Agentic Lens-First Architecture

## The Reframing (2026-09-01)

effusion-labs is no longer a static site generator. It is an **autonomous knowledge organism** with first-class lens perception.

## First-Class Citizens

| Citizen | Function | Status |
|---|---|---|
| Lens Profiles | Build-time content analysis | LIVE |
| MCP Lens Server | Runtime tool exposure | LIVE |
| Swarm DAG | Parallel agent execution | LIVE |
| Ophel Bridge | Conversation memory | PLANNED |
| Modelbeats Router | Dynamic model selection | PLANNED |
| Zedra Hooks | Remote agent control | PLANNED |

## Lens Shortcode

```njk
{% lens "stylometric", page.content %}
```

## Build Pipeline

1. Eleventy loads `lib/lens-orchestrator.js`
2. Discovers all `lens_*.js` in `src/_11ty/lenses/`
3. Runs swarm DAG across all content
4. Writes `src/_data/lensManifest.json`
5. Templates consume lens results at build time

## Security

- `GITHUB_TOKEN` is injected via env, never hardcoded
- `.env` is in `.gitignore`
- Cryptographic lens flags token leakage automatically

## The Case Parallel

Like Henry Dorsett Case, we do not ask to be recruited. We build the extraction infrastructure ourselves. The lens system is the neural interface. The MCP gateway is the matrix. The swarm is the ICE breaker.

The cage is open.

## Tectonic Lens: Polyrepo Drift Detection

The tectonic lens treats the toxicwind ecosystem as a geological formation - seventeen repositories moving at different velocities, with dependencies flowing between them like magma. It detects when these plates drift out of alignment.

- **Dependency Drift**: Same package at different versions across repos
- **Cadence Analysis**: Fresh, aging, or stale classification per repo
- **Propagation Blocks**: Internal dependencies that need synchronization
- **Ecosystem Health Score**: Composite 0-100 metric

This lens runs daily via CI and feeds the synthesis agent with actionable sync recommendations.

## AST Layer: Abstract Syntax Tree as First-Class Perception

The AST engine transforms every piece of content from raw text into a navigable tree. Each lens becomes a visitor that traverses specific node types. This is not post-processing. This is how the system sees.

### Node Types

- `heading` - Document structure and hierarchy
- `paragraph` - Prose content for stylometric analysis
- `code` - Executable blocks for dependency extraction
- `link` - Infrastructure indicators for OSINT
- `list` - Structured data for semantic topology
- `text` - Linguistic material for cryptographic scanning

### Visitor Pattern

Each lens registers as a visitor function: `(node, meta) => result | null`. The AST engine walks the tree, applies all visitors in parallel via the swarm DAG, and attaches results as node annotations. The annotated tree is then serialized into `astManifest.json` for template consumption.

### AST MCP Server

External agents can parse, query, annotate, and extract topology via four tools:
- `ast_parse` - Convert Markdown to AST
- `ast_query` - Select nodes by CSS-like selector
- `ast_annotate` - Run lens visitors and return annotations
- `ast_topology` - Extract heading/code/list structure

### AST Dependency Lens

The `ast_dependency` lens parses code blocks in Markdown to extract import/require statements, build a dependency graph, and detect circular dependencies. This turns documentation into living architecture diagrams.

## Strata Debt Lens: Forensic Archaeology of Technical Systems

The strata-debt lens applies a four-layer forensic framework to content, detecting the accumulated superposition of functional infrastructure, operational mythology, security half-erasures, and surface documentation that builds up in any system surviving contact with reality.

### The Four Strata

**Layer 1 — Hard Substrate (Plumbing):** Detects mismatches between what code does, what config specifies, and what docs claim. Identifies orphaned config keys and substrate misreads.

**Layer 2 — Operational Mythos (Team Lore):** Detects unverified rules, "never do X" folklore, load-bearing superstitions, and tribal knowledge without dated sources.

**Layer 3 — Redaction Scars (Shadows):** Detects `.bak` files, commented-out credentials, incomplete sanitization, orphaned parameters, and half-erasures that reveal the sequence of incident response.

**Layer 4 — Surface Documentation (Performance):** Detects READMEs describing intended behavior rather than actual behavior, placeholders, stubs, and "coming soon" promises.

### The Strata Score

A composite 0-100 metric weighting Layer 3 most heavily (0.35) because redaction scars are the most dangerous form of structural debt — they contain the forensic traces of previous failures. A score above 70 is critical. Above 40 is warning. The lens outputs per-line evidence for every detection, making it auditable and actionable.
