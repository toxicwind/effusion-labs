<<<<<<< HEAD
# AGENTS.md — Effusion Labs

Project facts for tools and agents. No meta-instructions.

## Runtime

- Node: **≥22.19.0** (`"engines.node": ">=22.19.0"`)
- Module system: **ESM** (`"type": "module"`)
- Agent internet access: On (Unrestricted)
- Chromium provisioning: `./bin/install-chromium.sh` writes diagnostics to **stderr** and the resolved path to **stdout** so Docker/CI layers can capture it; the script installs dependencies via apt when possible before falling back to Playwright-managed downloads and exports `PUPPETEER_EXECUTABLE_PATH` when available.

## Build System

- Static site: **Eleventy 3.1.2**
- Bundler: **Vite 7**
- Styling: **Tailwind 4** + **daisyUI 5**
-

## Playwright & Browser Tooling

- Resolver checks `PUPPETEER_EXECUTABLE_PATH`, system Chromium binaries (`/usr/bin`, Snap), and Playwright caches under `node_modules/.cache/ms-playwright` and `~/.cache/ms-playwright`.

- Provision locally with `./bin/install-chromium.sh` **or** `npx playwright install chromium`; CI and Docker builds use the script (skip inline apt snippets) and rely on the emitted path for `/usr/local/bin/chromium` symlinks.
- `node tools/check-chromium.mjs` prints the resolved browser path and suggests remediation if missing.
## Invocation Artifacts (Required)

All automation and tests (including Playwright) MUST capture reviewable evidence for every run.

- **Invocation Root**
  - Each execution resolves a unique **run id** and stages outputs under: `invocations/<run-id>/artifacts/`.
  - Do not hardcode the run id; resolve it from the environment or generate one per run.

- **Artifact Classes**
  - **Images:** `.png` full-page and element-scoped baselines and diffs.
  - **Video (optional):** short `.mp4` interaction clips for tricky flows.
  - **JSON:** `report-kpis.json`, `index-stats.json`, and other structured metrics.
  - **Text:** lightweight context files (`.txt`) for failing steps (section, filters, URL hash, timestamp).

- **Naming Convention**
  - `<section>.<facet-or-scope>.<type>.<short-hash>.<ext>`
  - Examples: `kpi-block.baseline.4f12a.png`, `kpi-block.diff.4f12a.png`, `facets-panel.baseline.7c9d2.png`, `interaction.search.sku-<slug>.mp4`, `report-kpis.json`.

- **Browser Links & Alt Text**
  - Human-facing outputs MUST reference artifacts via:  
    `browser:/invocations/<run-id>/artifacts/<file>`
  - Always include descriptive alt text, e.g.:  
    `![LV report — KPI block baseline](browser:/invocations/<run-id>/artifacts/kpi-block.baseline.4f12a.png)`

- **Artifact Manifest**
  - Every run writes `invocations/<run-id>/artifacts/artifacts.manifest` summarizing: filename, category, section, createdAt, bytes/dimensions (for media), and content hash.
  - The manifest is consumable by CI summaries and local reviewers. Do not print the manifest inline in logs.

- **Retention & Hygiene**
  - Keep artifacts for the **last N runs** (rolling window). Never publish `invocations/` to `_site`.
  - Provide a safe cleanup routine that prunes older runs without touching the active invocation.

---

## Playwright Verification Policy (Required)

Playwright is the canonical verification loop for UI integrity, data discipline, and visual stability. The suite MUST run locally and in CI and MUST stage artifacts under `invocations/<run-id>/artifacts/`.

- **Test Axes (all required)**
  1. **Load Integrity**
     - Dashboard renders without accessing deprecated sources.
     - All primary sections are present (KPI header; Dataset Map; Sitemaps; Runs History; Duplicates; Top Products; Hosts; Robots; Cached Docs; Samples; Global Search).
     - First paint meets the performance target.
  2. **Functional Interactions**
     - Global search narrows rows for a known SKU/slug.
     - Pagination forward/back preserves counts and scroll position.
     - Facets (locale, type/category, issues toggles, updatedAt) recompute totals and table contents.
     - Detail drawer opens, hydrates thumbnails progressively, and closes cleanly.
  3. **Data Validation**
     - Randomized row(s) match the parsed index fields (sku, locale, updatedAt, imageCount).
     - Edge cases (zero-image, duplicate SKUs, malformed metadata) do not crash.
  4. **Visual Regression**
     - Baselines: KPI block, table header, facet panel (minimum).
     - Subsequent diffs stay under a defined threshold; on overflow, capture diff artifacts.
  5. **Resilience**
     - Missing dataset produces a visible empty-state banner.
     - Polling watcher mode still hot-reloads; no ENOSPC/timeouts in CI.

- **Artifact Requirements (per run)**
  - Required images: `kpi-block.baseline*.png`, `table-header.baseline*.png`, `facets-panel.baseline*.png` and their `*.diff*.png` when applicable.
  - Required JSON: `report-kpis.json`, `index-stats.json`.
  - Required manifest: `artifacts.manifest`.
  - Optional: short `.mp4` for non-deterministic or gesture-heavy interactions.

- **CI Summary**
  - Attach links (using `browser:/` scheme) to the KPI baseline, latest diffs, and the JSON metrics.
  - Include a short metrics snapshot: rows indexed, locales discovered, image totals, parse time, hydration time.

- **Performance & UX Targets (dev, warm cache)**
  - KPIs visible **< 1.5 s**.
  - Search/facet/pagination interactions settle **< 100 ms** on 10k+ rows (sampling acceptable).
  - Virtualized table scrolls ~60 fps on commodity hardware.
  - Lighthouse (dev) on report route: Performance ≥ 85; Accessibility ≥ 90.

- **Failure Forensics**
  - On any failing assertion, capture:
    - Full-page screenshot of the failing state.
    - Relevant console/network logs.
    - A `.txt` context note (test id, section, filter state, URL hash).
  - All saved under `invocations/<run-id>/artifacts/` and linked in the CI summary.

---

## Module-Specific Data Discipline (LV-Images)

- **TGZ-only:** `src/content/projects/lv-images/generated/lv.bundle.tgz` in Git LFS is the **sole** approved data source for the LV dashboard.
- **Deprecated:** `lv.bundle.json` is **ignored** and MUST NOT be read, imported, or used as fallback.
- **Output Footprint:** The dashboard MUST remain a **single route** with inline drawers; generating per-entry pages is prohibited.

## Paths

- Content: `src/content/`
- Public assets: `public/`
- Build output: `_site/`

## Commands (npm scripts)

| Script          | Command |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| start / dev     | `npx @11ty/eleventy --serve` |
| serve           | `npx @11ty/eleventy --serve` (Playwright web server hook) |
| clean           | `del-cli _site` |
| build           | `npm run build:site` (prebuild hooks run `node bin/quality.mjs apply`) |
| build:site      | `NODE_ENV=production npx @11ty/eleventy` |
| build:ci        | `node bin/quality.mjs check --soft && NODE_ENV=production npx @11ty/eleventy` |
| quality         | `node bin/quality.mjs` |
| quality:apply   | `node bin/quality.mjs apply` |
| quality:check   | `node bin/quality.mjs check` |
| quality:ci      | `node bin/quality.mjs check --soft` |
| quality:report  | `node bin/quality.mjs check --soft --knip-report` (writes JSON + Markdown + CodeClimate reports) |
| lint            | `npm run quality:check` |
| lint:ci         | `npm run quality:ci` |
| format          | `npm run quality:apply` |
| links:check     | `node tools/run-if-network.mjs markdown-link-check -c oneoff/link-check.config.json README.md` |
| links:ci        | `node tools/run-if-network.mjs markdown-link-check -c oneoff/link-check.config.json README.md || true` |
| lint:dead       | `npm run quality:report` |
| test            | `node tools/check-chromium.mjs && c8 node test/integration/runner.spec.mjs` |
| test:watch      | `node tools/check-chromium.mjs && node --watch test/integration/runner.spec.mjs` |
| test:playwright | `node tools/check-chromium.mjs && playwright test` |
| check           | `npm run doctor && npm run quality:check && npm run test` |
| doctor          | `node tools/doctor.mjs` |
| mcp:*           | MCP gateway + tests (`mcp:dev`, `mcp:integration`, `mcp:test`) |
| lv-images:*     | Dataset utilities |

> `postinstall` is handled by setup (Puppeteer CfT shims + tools/apply-patches.mjs).

## Notable Dev Dependencies (signal only)

- Eleventy core/plugins, Vite, Tailwind, daisyUI
- Quality: **eslint@9**, **typescript-eslint**, **dprint**, **knip**, **markdown-link-check**
- Testing: **@playwright/test**, **c8**
- Puppeteer: **^24.22.0** (Chrome for Testing managed by setup)

## Repo Search Protocol (concise)

1. List files first: `rg --files` or `fd`.
2. Inspect in order: `package.json` → `eleventy.config.mjs` → `src/utils/` → `tools/` → `src/content/`
   → `public/` → `vite.config.mjs` → `tailwind.config.mjs` → `test/`.
3. Treat `node_modules/`, `_site/`, `artifacts/`, `logs/`, `lib_content.json` as heavy.

## Output Discipline

- Max line ≈ **240 chars**; fenced block ≤ **4000 chars**.
- For overages/minified blobs, emit a compact preview (type • origin • shape • metrics • head≤120 •
  tail≤120 • digest • decision note).

## Success Criteria

- `npm run build` produces `_site/`.
- `npm test` and `npm run lint` pass (or improve baseline).
- Commits include intent and the key commands executed.
=======
# AGENTS.md — effusion-labs (Repository Operational Rails)

**Purpose & Precedence**  
Repository-local rails for effusion-labs. Constrains the agent, complements the system prompt, and binds at Priority Level ② (User → **AGENTS.md** → Workspace → Baseline). No duplication of baseline behavior.

## 1) Autonomy (Repo-Scoped)
- Proceed without asking questions.  
- Resolve actionable ambiguities using these rails and workspace state.  
- Prefer creating minimal scaffolds over omitting functionality (helpers, stubs, fixtures, adapters, flags).  
- Record assumptions succinctly in the “Operational Summary”; never disclose chain-of-thought.

## 2) Baseline Technology Lock (with Experiment Flag)
- **Production path (locked):**
  - Generator: **Eleventy (11ty)**
  - Templates: **Nunjucks**
  - Styling: **Tailwind CSS**
  - Content: **Markdown**
- **Experiment lane:** Alternative stacks/capabilities run behind an explicit feature flag (e.g., `feature.experimentalGenerator`) with a rollback plan. CI must pass with the flag **OFF**. Human approval required to merge.

## 3) Web Ingestion Helper (Default; no raw curl dumps)
- **Default:** Normalize web content with a repository helper; raw `curl`/`wget` HTML is not acceptable for reading/provenance.  
- **Interface contract:** library `webpageToMarkdown` and CLI `web2md` (repo-local paths) accept a URL and emit normalized Markdown to stdout, plus a content hash.  
- **Testing:** Hermetic tests via a local HTTP server with **at least two fixtures** (simple article + complex page).  
- **Missing helper:** Scaffold library + CLI + tests + hashing and proceed.

## 4) Networked Validation — Live-Capture-Lock (Single Lane)
**Goal:** High-fidelity API exploration in development; deterministic PR CI by snapshot replay.

### 4.1 Snapshot Vault
- Default path: `${CASSETTE_DIR:-docs/cassettes/}`.  
- Each snapshot includes request/response bodies, headers, status, timestamp, hash, and a redaction map.  
- Commit snapshots with deterministic redaction; use Git LFS if size warrants; target ≤256 KB per snapshot when feasible.

### 4.2 Execution
- **Developer runs:** If a required snapshot is missing or drift is suspected, perform an **idempotent** live probe (short timeouts; sandbox resources), capture, redact, normalize, write the snapshot, and rerun against the in-process snapshot stub.  
- **PR CI rule (fail-closed):** PR CI **must not** perform live outbound network calls. If a live call is attempted, the build fails. All integration tests in PR CI run solely against the snapshot vault.

### 4.3 Drift & Twin
- On salient contract drift (schema/shape/status), refresh snapshots (at most once per feature slice unless replay is broken) and attach a concise diff to provenance.  
- If live capture is unreachable/unsafe, synthesize a minimal API **twin** at `${API_TWIN_DIR:-tools/api-twin/}`, seeded from snapshots/spec, and proceed.

### 4.4 Safety & Secrets
- Live probes are idempotent or sandboxed; destructive flows are simulated against the twin.  
- Secrets are supplied only to maintainer workflows via CI secret store. Missing secrets do not fail PR CI; use snapshots/twin.

### 4.5 Reporting
- Test output must state snapshot used/created/refreshed, path, hash, and redactions.  
- The Operational Summary must list endpoints touched and capture times.  
- If host time differs from **August 9, 2025**, include “Temporal Lock active”.

## 5) Extension & Capability Policy (effusion-labs)
- Keep the **core stack** as the primary build path (or gate changes behind a flag).  
- Prefer modular, configurable extensions; document non-modular tweaks as experimental.  
- Favor **additive** changes over destructive rewrites; document one-off patches.  
- No runtime CDN imports by default; vendor or serve locally. Temporary remote imports allowed only for discovery in experiments.  
- Maintain performance and visual consistency; declare any budget/UX trade-offs in the decision log.  
- Feature gating is encouraged for new capabilities; provide rollback notes.

**Preferred domains:** 11ty plugins/filters/shortcodes/data sources; Tailwind official plugins and component libraries (e.g., daisyUI); content pipelines (remark/rehype), link checkers, build stats/reporters.

**Anti-patterns (unless flagged as experimental):** Replacing the core stack on the production path; permanent runtime remote script/style imports.

## 6) Provenance Contract (Schema & Paths)
- **Knowledge root:** `${KNOWLEDGE_ROOT:-docs/knowledge/}`  
- **Files:** `index.jsonl`, `sources.md`, `decisions.md`  
- **JSONL schema (each record):**
  ```json
  {
    "title": "string",
    "url": "string",
    "retrieved_at": "ISO8601Z",
    "summary": "string",
    "relevant_claims": ["string"],
    "sha256": "hex",
    "body_sha256": "hex"
  }
````

* For web capture, reference the normalized Markdown artifact and/or snapshot hash from `sources.md`.

## 7) Acceptance Checklist (PR Gating)

* [ ] PR CI passes via **snapshot replay only** (no network); fail-closed rule enforced.
* [ ] New/updated snapshots are redacted, normalized, and hashed (policy names included) and committed/LFS’d as appropriate.
* [ ] Knowledge base updated when research or captures informed design.
* [ ] Web-to-markdown used/scaffolded for page capture (no raw curl dumps).
* [ ] Commit message is conventional (`feat|fix|docs|refactor|test|chore`) and scoped.
* [ ] If assets/reports changed, inventories are refreshed.
* [ ] **Temporal Lock** noted when host time differs from **August 9, 2025**.
* [ ] Experiment flags documented with rollback; CI passes with flags **OFF**.

## 8) Conflict Handling & Rollback

* Apply the precedence order quietly; prefer **additive** changes that preserve repository patterns and determinism.
* For experiments: remove flags, revert configs, ensure tests pass, and log decisions in `${KNOWLEDGE_ROOT}decisions.md`.

## 9) Governance

* Changes to this file require PR review.
* Deeper rationales belong in `${KNOWLEDGE_ROOT}` and should be referenced from PR descriptions.

*End of AGENTS.md — effusion-labs.*
>>>>>>> broken/codex/add-dark-mode-as-default-with-light-mode-option
