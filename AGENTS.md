# AGENTS.md — effusion-labs (Repository Operational Rails)

**Purpose & Precedence**  
Repository-local rails for effusion-labs. This document complements the system prompt with repository-specific context and rules. It binds at **Priority Level ②** in the decision order (**User → AGENTS.md → Workspace → System Prompt**). System prompt **invariants are non-nullifiable**.

---

## Stack & Commands (repo facts)
- Runtime: **Node 20**
- Module system: **CommonJS (CJS)**
- Site generator: **Eleventy (11ty)**
- Templates: **Nunjucks**
- Styling: **Tailwind CSS**
- Content: **Markdown**

---

## R&D Context (repo nuance)
This repository operates in an **internal prototype / R&D** mode. Prefer solutions that maximize immediate functionality and speed to working results within this environment.

---

## 1) Operational Principles
- **Experimental Expansion:** Adding new public Node.js/npm libraries to expand capabilities is encouraged. Prefer **additive** changes over rewrites unless a rewrite is required for a core acceptance criterion.
- **Web Ingestion:** When `OUTBOUND_MARKDOWN_ENABLED` is truthy (`1|true|yes`, case-insensitive), use the repo’s helper tool for capture/normalization and follow the system prompt’s **NETWORK I/O** and **PROVENANCE, LEDGER, CONTINUATION** rules.

Tests must run through the default npm scripts or repo `bin` shims; avoid `npm test > file && tail`. The first `SIGINT` is logged and ignored, the second exits with code `130`. Tune heartbeat and timeout with `LLM_HEARTBEAT_SECS` and `LLM_MAX_MINS`; set `LLM_HIJACK_DISABLE=1` to bypass temporarily.

---

## 1.1) npm Package Discovery & Integration (repo rail)

**Scope.** The agent may discover, install, and wire **public** npm packages when doing so increases **acceptance_delta** or **unification_gain** for the active slice. All discovery actions count toward the system prompt’s **Reads** budget.

**Discovery (counts toward Reads).**
- `npm view <pkg> --json` (alias: `npm show`) for: `version`, `dist-tags`, `time.modified`, `engines`, `types`, `repository`, `license`.
- `npm search <keyword>` for targeted registry search; derive keywords from repo context (templates, filters, transforms).
- If ambiguity remains, minimally inspect the candidate’s README via registry tarball metadata or repository URL.

**Selection signals (multi-factor).**
- Improves **acceptance_delta** (more criteria/tests satisfied this slice) **or** increases **unification_gain** (reduces duplication/config sprawl).
- Recent maintenance (e.g., modified within ~12 months); compatible `engines.node` (Node 20); types/ESM availability matches repo needs.
- Clear license and repository URL present.

**Install (reproducible).**
- `npm install <pkg>@<version> --save-exact`
- Record in the **Ledger**: `pkg@version`, repository URL, license, and the integrity hash from `package-lock.json`.  
  *Do not print new tokens or secrets in the Output Package.*

**Wire (Eleventy integration — CJS primary).**
- **Default (CJS plugin):**
  ```js
  // .eleventy.js  (CommonJS)
  const plugin = require('<pkg>');
  module.exports = function(eleventyConfig) {
    eleventyConfig.addPlugin(plugin /*, opts */);
    return { /* dir, template engines, etc. */ };
  };
````

* **ESM-only plugin in a CJS repo (use dynamic import):**

  ```js
  // .eleventy.js  (CommonJS with ESM plugin)
  module.exports = async function(eleventyConfig) {
    const { default: plugin } = await import('<pkg>');
    eleventyConfig.addPlugin(plugin /*, opts */);
    return { /* dir, template engines, etc. */ };
  };
  ```

  Use this path only if the package lacks a CJS entry point.

* Keep options minimal; prefer defaults unless an acceptance check requires configuration.

**Tests (SPEC → RED → GREEN).**

* Add a **SPEC** acceptance example exercising the plugin path (e.g., filter/shortcode/template transform) and a **property** guarding expected structure.
* Run to **RED** (capture failing proofs), implement to **GREEN**.

**Upgrade vs Add.**

* If a package is **required to pass** the acceptance slice, installation is allowed during **GREEN**.
* Otherwise, prefer version bumps and ecosystem modernization during **REFACTOR** (ties into “Opportunistic 2025 Upgrades”).

---

## 2) Alignment with System Prompt

* **Artifacts & Tracking:** The **Convergence Ledger**, **Continuation Driver**, and **ADRs** are the **sole sources of truth** for acceptance, progress, and architectural decisions. Any legacy tracking files (e.g., `index.jsonl`, `decisions.md`) are superseded.
* **Commit Messages:** Follow the scene-based format from the system prompt:
  `test(<scope>)`, `ci(<scope>)`, `feat(<scope>)`, `refactor(<scope>)`, `docs(<scope>)`.
* **Snapshot Rebaselining:** Follow the system prompt’s **SNAPSHOT REBASELINE** policy for updating test snapshots.

---

*End of AGENTS.md — effusion-labs.*