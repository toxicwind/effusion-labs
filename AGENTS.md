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