# Effusion Labs — Full Project Audit (2026-09-30)

**Auditor:** Ember (master lane, Chris's order). Evidence: Tanager's read-only crawl + my own build/test on yote.
**Repo:** `/home/toxic/projects/effusion-labs`, was detached at `b3d7834f` (= origin/main). Public on GitHub: `toxicwind/effusion-labs`.

## 1. What this project actually is

Strip the narrative and the repo is: **a personal digital studio + knowledge-base static site** — Eleventy 3.1.6, Nunjucks, Tailwind, bun tooling, deployed via Netlify (`netlify.toml` verified present). The package.json description says exactly this and is the honest one-liner: *"a digital studio and knowledge base for Effusion Labs, built with Eleventy and the powerful @photogabble/eleventy-plugin-interlinker."*

Everything beyond that — "autonomous knowledge organism", "first-class lens perception" — is an aspirational narrative layer. Some of it is real code that never runs (see §2).

## 2. Quote-vs-behavior audit ("hypocrisy" findings)

Each claim paired with the observed behavior and the file/line that proves it.

| # | Claim (quote) | Observed behavior | Evidence |
|---|---|---|---|
| 1 | "Ten lenses analyze every page at build time" | All 10 lens files exist in `src/_11ty/lenses/` and `lib/lens-orchestrator.js` is real code (discover/analyzeAll/semaphore fan-out). **But the build pipeline is gated on `LENS_ENABLED=true` (off by default), `runBuildPipeline()` is never invoked by any config, and `src/_data/lensManifest.json` is never emitted.** The perception pipeline is code-complete and never executes. | `lib/lens-orchestrator.js:117`; `.eleventy.js` eleventy.before hook calls `discover()` only |
| 2 | "Lenses reach consensus" | `lib/consensus-engine.js` is real code with **zero callers** — nothing requires it. Unwired. | grep: only self-references |
| 3 | "`{% lens %}` — call any lens inline" | Registered in live `.eleventy.js:55`, but **used zero times** in `src/` content and renders a stub `<lens-output>` span. A second definition in `lib/shortcodes.js:88-94` claims output is "pre-computed in `_data/lensManifest.json`" — a file that does not exist. | `.eleventy.js:55`, `lib/shortcodes.js:88-94`, `ls src/_data/lensManifest.json` → missing |
| 4 | "Eleventy 3 + Vite" | Eleventy 3.1.6 verified in node_modules. `@11ty/eleventy-plugin-vite ^7.1.1` in package.json, `vite.config.mjs` at root — **but neither the live `.eleventy.js` nor `eleventy.config.mjs` references Vite.** Plugin installed, never wired. | grep vite in both configs → empty |
| 5 | "knowledge graph / vector pipeline / sync layer" | `lib/knowledge-graph.js`, `lib/vector-pipeline.js`, `lib/sync-layer.js` all exist but have **zero references** anywhere in lib, configs, `_data`, or templates. Dead files. | repo-wide grep → no hits |
| 6 | "Live config is `eleventy.config.mjs`" (modular ESM config) | **False.** Eleventy 3.1.6 resolves `.eleventy.js` → `eleventy.config.js` → `eleventy.config.mjs` (TemplateConfig.js:73-79). The dirty legacy CJS `.eleventy.js` **shadows** the ESM config; `eleventy.config.mjs` is inert. Anyone auditing the ESM file is reading a dead config. | `node_modules/@11ty/eleventy/src/TemplateConfig.js:73-79` |
| 7 | "every page analyzed and cross-linked at build time" | Partially true: `@photogabble/eleventy-plugin-interlinker` **is** registered via `lib/plugins.js:getPlugins()` → `lib/eleventy/register.js` → live `.eleventy.js`. Per-page coverage is plugin runtime behavior, not audited here. The "analysis" half (lenses) does not run — see #1. | `lib/plugins.js`, `lib/eleventy/register.js:19` |
| 8 | "MCP tools" | `services/mcp-stack/` exists with `lens-server` (`@effusion/lens-server` 2.0.0, `server.ts` present), `swarm-server`, `gateway`, etc. **Existence verified; server internals and liveness not audited.** | `services/mcp-stack/lens-server/package.json` |
| 9 | "Netlify-native" | `netlify.toml` exists at root. Contents not audited. | root listing |

**Bottom line:** the lens/MCP narrative is ~40% real — the code exists and is non-trivial (real semaphore pools, DAG with deadlock detection), but the build never invokes it. The site that actually ships is a well-built Eleventy garden with interlinking. The honest README is package.json's one-liner, not the "autonomous knowledge organism" framing.

## 3. Routes — verified against a real production build

`NODE_ENV=production bunx eleventy` → **374 files, 13.72s, green** (after the fix in §5).

| Route | Status | Notes |
|---|---|---|
| `/map/` | **WORKS** | `_site/map/index.html` emitted. An earlier read of the source (relative permalink `"map/index.html"` in `src/pages/map.njk`) looked broken, but relative permalinks resolve against the output root — the build proves it. `src/map.njk` has `permalink: false` (dead duplicate, harmless). |
| `/tags/<tag>/` | **WORKS** | `_site/tags/<tag>/index.html` generated for every tag via `src/tags.njk` + `collections.tagList`. An earlier crawl called this broken because `src/tags.njk` is **untracked** — `git ls-files` couldn't see it. Lesson: untracked files are invisible to git-scoped crawls. |
| `/tags/` index | **WORKS** | `src/tag-index.njk` (untracked) renders the tag list. |
| `/feed.xml` | **WORKS** | Single `feed.xml` emitted. The dirty `src/feed.njk` change (`permalink: false` → `"/feed.xml"`) re-enabled it; no duplicate (only one `feed.xml` in `_site`). |
| `/404` | **WORKS** | Single `_site/404.html`. (`src/404.njk` has `permalink: false`; `src/pages/404.njk` emits. Harmless duplicate source.) |
| `/search` | **MISSING** | No search route, UI, or index anywhere. If any doc claims search, that's a gap. |
| `/projects/safety-classifiers-unreliable-narrators/` | **WORKS** | New whitepaper page, see §6. |

## 4. Suspicious tracked artifacts

- `audit_kimi_20260811_113315/` — 21 files, looks like a browser-automation security-audit dump **of other services** ("portal billing", "drive9", "envd"). Credential-shaped names. **This is the one that matters — see §7.**
- `bfg.jar`, `archive.zip`, `bin.zip` — tracked binaries/archives. Unusual for a site repo; bloat, not malice (bfg.jar is even the tool you'd use to clean the rest up).
- `bin/bin/` — 13 vendored binaries (`rg`, `jq`, `fd`, `curl`, `chromium`, …). Bloat.
- `..bfg-report/2026-01-23/`, `_artifacts/`, `.chronos/`, `diagnostics/` — audit/diagnostic residue. Bloat.
- `src/content/docs/**` — scraped 11ty/daisyui mirrors, **excluded from the build** by `.eleventy.js` ignore. They're the source of every alarming external link (`casino.ua`, `payid-pokies.net`, etc.) a naive crawl finds. Not shipped.

## 5. Build fix applied (was red, now green)

The working tree did not build: `config.addCollection("nodes") already exists` — the uncommitted tags/feed WIP added a broader `nodes` collection in `.eleventy.js:85` while `lib/eleventy/register.js:54` still defined the original. Fix: removed the older narrower `nodes` definition from `lib/eleventy/register.js` (per-area `type` mapping is preserved via the per-area collections in the same file, which `recentAll` depends on). One-line semantic change, build verified green after.

## 6. Whitepaper placed

**"The Refusal Is Not the Reason: Safety Classifiers as Unreliable Narrators"** — new project page at `/projects/safety-classifiers-unreliable-narrators/` (`src/content/projects/safety-classifiers-unreliable-narrators.md`, sha256 `f68218f4…afe12230`, transferred byte-exact). Reciprocal link added to Project Dandelion's "friction boundaries" section (`src/content/projects/project-dandelion.md`). Both pages render in the production build.

## 7. ⚠️ Credential-shaped files in the PUBLIC repo — needs Chris's call

`audit_kimi_20260811_113315/` (committed 2026-08-18, `b54c13f0`, in the public `toxicwind/effusion-labs`) contains files with cookie/authorization/bearer/session markers: `portal_billing_auth.txt` (769KB, 248 marker hits), `drive9_auth.txt` (381KB, 24 hits), `envd_auth.txt` (266KB, 87 hits). No standard key prefixes (`sk-`, `ghp_`, `AKIA`, …) detected; contents deliberately not read.

Two possibilities: (a) live session artifacts from an automated audit — a real leak that's been public ~7 weeks; (b) honeytokens/canaries. **I did not touch these files.** Rotation-or-confirm is Chris's call — credentials are his alone. If they're real, the fix is rotation first (history rewrite doesn't un-leak), then BFG the directory out of history.

## 8. Deliberately left alone

- Dirty: `src/site.webmanifest` (theme recolor), `infra/flicker/nginx.conf`, `src/index.11tydata.js` — not mine, not audited, not committed.
- Untracked: `src/favicon.svg`, `src/apple-touch-icon.png`, `src/sitemap.njk`, `src/content/flower_reports_showcase/*` — someone's WIP, left in place.
- The lens pipeline: real code, gated off. Wiring it into the build (or deleting the narrative) is a product decision, not an audit fix — flagged, not changed.
