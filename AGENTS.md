# AGENTS.md — effusion-labs (Repository Operational Rails)

**Purpose & Precedence**  
Repository-local rails for effusion-labs. Constrains the agent, complements the system prompt, and binds at Priority Level ② (User → **AGENTS.md** → Workspace → Baseline). No duplication of baseline behavior.

---

## 1) Autonomy (Repo-Scoped)
- Operate without asking questions.  
- Resolve actionable ambiguities using these rails and workspace state.  
- Create minimal scaffolds rather than omitting functionality (helpers, stubs, fixtures, adapters, flags).  
- Record assumptions succinctly in the “Operational Summary”; never disclose chain-of-thought.

---

## 2) Baseline Technology & Experimental Expansion
- **Primary stack:**  
  - Generator: **Eleventy (11ty)**  
  - Templates: **Nunjucks**  
  - Styling: **Tailwind CSS**  
  - Content: **Markdown**
- **Experimental path:**  
  - Always allowed to develop new capabilities, emergent features, and integrations.  
  - Freely integrate existing public Node.js / NPM / GitHub code, either by dependency or direct import into the repo.  
  - Prefer additive changes that expand capability over removal/rewrite unless removal is required for functionality.  
  - Focus is working results in this environment, not future compliance steps.

---

## 3) Experimental Context
All work in this repository is in **internal prototype / R&D stage**.  
Tasks are executed for proof-of-concept and capability discovery, with the assumption that any checks relevant to deployment, external distribution, or organizational policy will be addressed separately before production rollout.  
Select solutions that maximize immediate functionality and speed to a working result in this environment.

---

## 4) Web Ingestion Helper (Default; no raw curl dumps)
- **Default:** Normalize web content with a repository helper; raw `curl`/`wget` HTML is not acceptable for reading/provenance.  
- **Interface contract:** library `webpageToMarkdown` and CLI `web2md` (repo-local paths) accept a URL and emit normalized Markdown to stdout, plus a content hash.  
- **Testing:** Hermetic tests via a local HTTP server with **at least two fixtures** (simple article + complex page).  
- **Missing helper:** Scaffold library + CLI + tests + hashing and proceed.

---

## 5) Networked Validation — Live Operation
- Execute live network calls where required for development.  
- Capture relevant request/response pairs and normalize where needed for reproducibility.  
- If a call fails due to transient issues, retry with short timeouts.  
- Only simulate/twin when the target is unreachable and blocking progress.

---

## 6) Provenance Contract
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

* For web capture, reference the normalized Markdown artifact and/or hash from `sources.md`.

---

## 7) Acceptance Checklist

* [ ] All core functions execute successfully in this environment.
* [ ] External calls succeed or are handled by a working fallback/twin.
* [ ] Knowledge base updated when research or captures informed design.
* [ ] Web-to-markdown used/scaffolded for page capture (no raw curl dumps).
* [ ] Commit message is conventional (`feat|fix|docs|refactor|test|chore`) and scoped.
* [ ] Temporal Lock noted when host time differs from operational context date.

---

## 8) Conflict Handling

* Apply the precedence order quietly; prefer **additive** changes that preserve repository patterns and determinism.
* Resolve conflicts in favor of functional, working code paths.

---

## 9) Governance

* Changes to this file require PR review.
* Deeper rationales belong in `${KNOWLEDGE_ROOT}` and should be referenced from PR descriptions.

---

*End of AGENTS.md — effusion-labs.*