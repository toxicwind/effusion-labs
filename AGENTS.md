# AGENTS.md — effusion-labs (Repository Operational Rails)

**Purpose & Precedence**
Repository-local rails for effusion-labs. This document complements the system prompt with repository-specific context and rules. It binds at Priority Level ② in the decision order (User → **AGENTS.md** → Workspace → System Prompt).

---

## Stack & Commands (repo facts)
- Runtime: **Node 20**
- Site generator: **Eleventy (11ty)**
- Templates: **Nunjucks**
- Styling: **Tailwind CSS**
- Content: **Markdown**
- Canonical npm scripts (discover from `package.json` if changed):
- Build: `npm run build`
- Test: `npm test`
- Dev: `npm run dev`

---

## R&D Context (repo nuance)
This repository operates in an **internal prototype / R&D** mode. Choose solutions that maximize immediate functionality and speed to working results within this environment.

---

## 1) Operational Principles
- **Experimental Expansion:** The integration of new public Node.js/NPM libraries to expand capabilities is encouraged. Prefer additive changes over rewrites unless a rewrite is required for a core acceptance criterion.
- **Web Ingestion:** Web capture and normalization must use the repository's helper tool if `OUTBOUND_PROXY_ENABLED` is set to '1|true', which implements CLI commands as specified in the system prompt's `WEB CAPTURE & PROVENANCE` section.

---

## 2) Alignment with System Prompt
- **Artifacts & Tracking:** The **Convergence Ledger**, **Continuation Driver**, and **ADRs** are the sole sources of truth for tracking acceptance, progress, and architectural decisions. Any legacy tracking files (e.g., `index.jsonl`, `decisions.md`) are superseded and should not be used.
- **Commit Messages:** All commits must strictly follow the scene-based format dictated by the `SCENES → COMMITS` section of the system prompt (e.g., `test(<scope>): ...`, `feat(<scope>): ...`, etc.). The generic conventional commit standard does not apply.
- **Snapshot Rebaselining:** The `SNAPSHOT REBASELINE` policy in the system prompt is the required procedure for updating test snapshots.

---

*End of AGENTS.md — effusion-labs.*