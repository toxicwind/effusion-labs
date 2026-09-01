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
