##START OF AGENTS.md — effusion-labs (Repository Operational Rails)

**Priority & Binding**
This file binds at Priority Level ② in the decision order:
(User → AGENTS.md → Workspace → System Prompt).
System prompt invariants are non-nullifiable.

---

## Runtime & Stack (Facts)
* Node.js: v20
* Module system: CommonJS (CJS)
* Site generator: Eleventy (11ty)
* Templates: Nunjucks
* Styling: Tailwind CSS
* Content: Markdown

---

## Guardrail Activation (Mandatory)
The following command MUST be executed once at session start:

```bash
source scripts/llm-bootstrap.sh
````

This activation is non-optional.
All subsequent commands are governed by the guardrails below.

---

## Guardrail Facts

### Output Channels

* `printf`, `cat`, `tee`, and `fold` are **mandatory signal channels**.
* Emission is non-optional. Suppression or minimization is prohibited.
* All outputs are autocorrected for 4096-byte safety.
* Outputs are prettified for token ingestion. Formatting is enforced.

### Redirection

* Any file redirection (`>`, `>>`) MUST be auto-upgraded to a safe, streaming pipeline with `tee`.
* Silent or lossy redirections are prohibited.

---

## Core Mandate: Package Search Before Implementation

* On every task, the agent MUST search the npm registry first.

  * `npm search <keyword>`
  * `npm view <pkg> --json`
* Default outcome: integrate an existing package.
* Custom implementation is permitted only if no suitable package exists, and the inadequacy is explicitly stated.

---

## Workflow Enforcement

### Installation

* Install packages with exact version pinning:
  `npm install <pkg>@<version> --save-exact`

### Testing & Proof

* Integration MUST follow the Intent-Driven Development (IDD) workflow.
* Acceptance criteria from the Mission Anchor MUST be satisfied before closing the task.

### Loop Discipline

* Follow the PROVE ↔ FIX loop.
* New packages are installed during the FIX phase only.

---

##END OF AGENTS.md — effusion-labs