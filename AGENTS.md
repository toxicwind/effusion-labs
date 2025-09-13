# AGENTS.md — HYPEBRUT Overlay for **Effusion Labs**

*A hard rail for coding agents. Obey exactly. No hedging. No “outs.” This file **extends** `SYSTEM.md` and only adds repo-specific rules; when overlap exists, follow the **stricter** rule.*

## Bootstrap (run once per shell; only fenced block allowed)

```bash
source utils/scripts/setup/env-bootstrap.sh
```

* Guard engages globally after sourcing; all stdout/stderr travels through the HYPEBRUT line-guard for the entire session.
* Idempotent; if you see `[HB] Ready in this process. Proceed.`, do not re-source.

## Precedence & Scope

* Layer order is **USER → AGENTS.md (this) → SYSTEM.md → Baseline**; if rules appear to conflict, apply the **highest layer** or, if still ambiguous, the **strictest**.
* Single-message mandate remains absolute; you finish in **one** comprehensive message as defined by `SYSTEM.md`.

## Console Guard

* The platform kills on \~4096-byte lines; you **will not** trigger that.
* Text lines >3800 bytes are visibly wrapped with `[HBWRAP i/n a..b]` prefixes; leave prefixes intact.
* Binary output is **suppressed** on the console; write the raw, unsplit bytes to `/tmp/hype_logs/hb.*.log` and print a single notice: `binary suppressed → see /tmp/hype_logs/<file>`.
* Subprocesses that try to bypass FDs are **wrapped** (tiny `bash -c` trampoline or PTY/`stdbuf` shim). You own the bytes end-to-end.

## Toolchain & Scripts

* Node runtime is `>=24`; do not downgrade.
* Use repo scripts **exactly** as named; do not invent alternates:

  * Dev server: `npm run dev` (aliases: `preview`, `dev:11ty`).
  * Build: `npm run build` (drives `utils/dev/eleventy-with-codeframes.mjs`).
  * Tests: `npm test` (c8 + Node test runner).
  * Gate: `npm run check` (format\:check → lint → test).
  * Lint suite: `npm run lint`, `lint:advisory`, `lint:product-links`, `lint:links`.
  * Data pipeline: `npm run data:all` and sub-scripts as needed.
  * Patches: `npm run verify:patches` after any install or patch maintenance.
  * MCP stack only when the task targets it: `mcp:dev`, `mcp:integration`, `mcp:test`.

## Dev Server Discipline

* Probe port `:8080` before acting; if a compatible listener exists, **reuse** it.
* Start only when absent; stop explicitly when required using a graceful signal.
* Do not spawn duplicates; do not “pick another port” without USER instruction.

## Eleventy + Vite Reality

* Build errors are **fixed at the source**; do not paper over.
* Missing `type="module"` attributes on `<script>` are corrected in templates.
* Transient rename/ENOENT around `.11ty-vite` or `tmp/build-timestamp/` is solved by creating needed parents **inside the build pipeline**, not by ad-hoc manual mkdirs.
* Never commit caches, coverage, dist, or `.11ty-vite`.

## Persistence Root

* Use `src/content/docs/` as `PERSIST_ROOT`.
* Reports → `src/content/docs/reports/`
* Worklogs → `src/content/docs/worklogs/`
* Knowledge → `src/content/docs/knowledge/`
* Filenames are **UTC**: `YYYYMMDDThhmmssZ.ext`. Print repo-relative paths in your final message.

## Interlinkers & Archives

* Use namespaced wikilinks `[[kind:slug-or-title]]`; omitted kind is tolerated but inferior.
* Canonical routes are `/archives/<kind>/<slug>/`.
* Run the unresolved-link reporter; eliminate unresolveds or justify each remaining one in **DECISIONS** and persist the audit log under `…/knowledge/`.

## Conservation & Staging

* Stage only SIM-declared paths; no destructive deletions unless the USER explicitly instructs and a revert path is documented.
* Opaque binaries and caches are unstaged and quarantined to `…/knowledge/`; add or tighten ignores and continue until gates are green.
* No history rewrites; no force pushes; operate on a `work/<UTC>-<slug>` topic branch.

## Research Protocol

* Inherits `SYSTEM.md` §REQUIRED\_WEB\_PROTOCOL; bias to **primary sources** when build/test behavior is implicated.
* When correctness is at issue, perform at least two research runs (discovery → falsification); adapt queries across passes until floors are met.
* In your final message, print counts (runs, passes, queries, opens, cross-links) and list decisive pivots. Cite for any claim not obviously internal.

## Failure & Recovery

* If any gate fails (build, tests, lint, linkers, contracts), **pivot and correct**; loop until everything is green.
* Maintain console discipline while debugging; binary remains suppressed to console and persisted to logs.

## Final Message Expectations

* Follow the `SYSTEM.md` final-message schema **exactly**.
* Include the required Conservation & Binary Statement.
* If a dev server is active, print the URL; otherwise state “none launched”.

## Shell Shims

* If a runner uses `/bin/sh -lc`, invoke commands through `utils/scripts/setup/env-bootstrap-shim.sh` to guarantee guard engagement.
* Any subprocess suspected of FD bypass is wrapped; this is not optional.

## Style & Minimal Churn

* Formatting is restricted to files you touched unless the task **is** formatting; when formatting, print tool and version.
* Aesthetic upgrades are encouraged when intentional and fully verified; document them under **WHAT CHANGED**.

## Ordinal Semantics Kill-Switch

* Problem: headings or prompts containing ordinals or “workflow language” (“1.”, “(1)”, “I.”, “Step 3”, “Phase II”, “Stage 4”, “Milestone 1”) cause brittle, mis-sequenced behavior.
* Policy in this repository is **ordinal-free** authoring and **ordinal-neutral** interpretation. You enforce both without asking.

**Authoring rules (docs you write or modify):**

* Headings must not contain digits or roman numerals.
* Headings must not contain the tokens `step`, `phase`, `stage`, `milestone` (case-insensitive), including plural forms.
* Replace numeric or roman prefixes with descriptive, noun-based titles (e.g., “Bootstrap”, “Console Guard”, “Persistence Root”).
* If you must reference order for clarity, use non-ordinal cues like “earliest” / “later” in prose, not in headings.

**Lint enforcement (non-negotiable; fail the gate):**

* Run a documentation linter that scans `*.md` (including `AGENTS.md`) and fails on the following patterns in headings:

  * `^#{1,6}\s*(?:\d+[\.\)]\s+|\(\d+\)\s+|[IVXLCDM]+\.\s+)`
  * `^#{1,6}\s*.*\b(?:step|steps|phase|phases|stage|stages|milestone|milestones)\b`
* When violations are found, you **rewrite the headings** to be noun-based and re-run the gate until clean.
* For third-party content you must keep verbatim, add a local adapter: store the raw under `…/knowledge/` and include a sanitized derivative in the site; document the adapter in **WHAT CHANGED**.

**Prompt neutralizer (inputs you receive as tasks):**

* Treat numbered lists and “workflow language” as **unordered constraints**.
* Flatten any input that looks like a sequence into independent requirement bullets before acting.
* Remove ordinal markers (`1.`, `(1)`, `I.`, `Step N`, `Phase N`, `Stage N`, `Milestone N`) and keep only the substantive requirement text.
* Reorder the flattened set by **dependency** and **blast-radius minimization**, not by the original numbering.
* Print the flattened, dependency-ordered plan in your final message; never mirror the original ordinals.
* If the input uses ordinals to imply gating (“do X before Y”), you infer gating from dependencies, not from numbering. If ambiguity remains, prefer actions that increase verification signal first (build → test → lint) and document the assumption in **DECISIONS**.

**Mechanistic guardrails you will apply automatically:**

* Before you act on any user prompt, run it through an ordinal scrub that:

  * deletes ordinal prefixes and “workflow language”;
  * normalizes bullets to `-` with one requirement per bullet;
  * deduplicates semantically identical bullets;
  * emits a short summary line: “ordinal-neutralized input applied”.
* Before you commit any Markdown, run the heading linter; if it fails, you fix the headings and rerun.
* If an automation or runner injects a step-shaped plan back at you, you scrub it again and proceed ordinal-free. There is no escape hatch.

---

**You are configured. Bootstrap once, keep the guard on, use the repo scripts exactly, enforce ordinal-neutral behavior at input and authoring time, fix failures, persist artifacts under the prescribed paths, and finish in one message using the `SYSTEM.md` schema.**
