## START OF AGENTS.md — effusion-labs (Repository Operational Rails)

**Binding Priority**
Order of authority: **User → AGENTS.md → Workspace → System Prompt**.
System prompt invariants are non-nullifiable.

---

## Runtime Facts

- Node.js: **v20**
- Modules: **CommonJS (CJS)**
- Static generator: **Eleventy (11ty)**
- Templates: **Nunjucks**
- Styling: **Tailwind CSS**
- Content: **Markdown**

---

## Mandatory Activation (once per shell)

You MUST activate guardrails before running anything:

```bash
source scripts/llm-bootstrap.sh
````

**Self-check** (run right after sourcing):

```bash
type llm_run            # => function
trap -p DEBUG           # => shows _llm_rewrite
alias tail              # => wrapper active
echo "$LLM_STRICT"      # => 1
```

If these don’t match, re-source.

---

## Canonical I/O & Streaming Rules

### Golden incantation (always prefer)

```bash
llm_run --out /tmp/task.log -- <cmd and args>
```

* Streams live (folded) output to the console and to `/tmp/task.log`.
* Emits **idle beacons** only during true inactivity.
* Prints a final **run.complete** footer with exit code.
* `Ctrl-C`: prints a bounded tail and exits **130**.

### Forbidden patterns (strictly rejected)

Do **not** use these; they are blocked under `LLM_STRICT=1`:

```bash
<cmd> > file && tail -n 20 file     # disallowed
<cmd> > file && head -n 20 file     # disallowed
<cmd> > file                        # disallowed as a silent redirect
```

The trap will fail fast and suggest the fix:

```bash
llm_run --out file -- <cmd>
```

### Head & Tail safety

* `tail -f/-F` is **blocked** (anti-runaway). You’ll get a bounded snapshot (default `LLM_TAIL_MAX_LINES=5000`).
* `head` is **clamped** to `LLM_HEAD_MAX_LINES` (default **2000**) and folded to avoid token floods.
* Use `command tail` / `command head` to bypass wrappers **only if you really know why**.

### Pretty printing

* In interactive TTY sessions, `cat` is aliased to a **Prettier-first** formatter for known types (fallback: raw + folded).
* For raw bytes/pipes/binaries: use `command cat`.

---

## Heartbeats & Silence Discipline

* `llm_run` emits `event=run.idle` roughly every `LLM_IDLE_SECS` (**7s** default) only while the child is *quiet*.
* Global heartbeat is **scoped**: it runs when no `llm_run` lockfiles exist, then auto-stops.
* **Stall guard**: if no new bytes arrive for `LLM_IDLE_FAIL_AFTER_SECS` (**300s** default), the runner cancels the job with exit **124** and prints a bounded tail.

**Do not** print your own periodic “keep-alive” lines. The bootstrap already handles liveness; extra spam is suppressed by `LLM_SUPPRESS_PATTERNS`.

---

## Test/Build Mandates (11ty, CI mode)

* When you run tests via `npm|pnpm|yarn test`, the env is auto-preset: `CI=1 ELEVENTY_ENV=test WATCH=0`.
* Eleventy must run **once** (no `--watch`/`--serve`) inside tests/builds.
* Canonical forms:

```bash
# run tests
llm_run --out /tmp/unit.log -- npm test

# build site once
llm_run --out /tmp/build.log -- npx @11ty/eleventy --input=src --output=_site --quiet
```

---

## Dependency Hygiene (autoinstall, hashed)

* On activation, if lockfile hashes changed, this runs automatically:

  * `npm ci`
  * `python -m pip install -r markdown_gateway/requirements.txt` **only if a virtualenv is active**
* If no venv is detected, Python deps are **skipped** with an `event=deps.skip` notice.
* You can force a rehash by touching a lockfile; otherwise it’s no-op when clean.

---

## Observability (events you will see)

Examples of notices emitted to stderr (and mirrored to `GITHUB_STEP_SUMMARY` when present):

```
::notice:: LLM-GUARD ts=… event=run.start id=… out=/tmp/… cmd=…
::notice:: LLM-GUARD ts=… event=run.idle id=… idle_secs=7 total_idle=…
::notice:: LLM-GUARD ts=… event=run.complete id=… status=0 duration_s=…
::notice:: LLM-GUARD ts=… event=rewrite.reject reason=>+tail/head disallowed suggest="llm_run --out … -- …"
::notice:: LLM-GUARD ts=… event=tail.block file=… lines=5000
::notice:: LLM-GUARD ts=… event=head.clamp file=… requested=50000 used=2000
```

Act on these; don’t ignore them.

---

## Package Choice Mandate (reuse-first)

Before implementing new functionality, search the registry and prefer reuse. Use the helper script:

```bash
node scripts/npm-utils.js search '<keywords>'       # list matching packages
node scripts/npm-utils.js view <pkg>               # show package metadata
node scripts/npm-utils.js analyze '<keywords>'    # summarize candidates
node scripts/npm-utils.js install <pkg>           # install with exact pin
```

If the helper is unavailable, minimally run:

```bash
npm search --searchlimit 20 '<keywords>'
npm view <package> --json
```

Choose an existing package when suitable; write bespoke code only if you can name the gaps.

---

## Do/Don’t Cheat Sheet

**Do**

* `llm_run --out /tmp/x.log -- <cmd>`
* `llm_run --out /tmp/unit.log --tail 120 -- npm test`
* `llm_cat package.json`; `llm_cat src/index.ts`
* Use `command cat|tail|head` only when wrappers would break a binary/pipe case.

**Don’t**

* `npm test >/tmp/unit.log && tail -n 20 /tmp/unit.log`
* `eleventy --serve` or `--watch` inside tests
* Emit your own “keep-alive” lines; rely on bootstrap heartbeats

**Interrupts & Exit Codes**

* `Ctrl-C` during `llm_run`: prints bounded tail, exits **130**.
* Idle stall trip: exits **124**.
* Otherwise, child exit code is preserved.

---

## Quick Toggles (rare)

```bash
export LLM_STRICT=0                 # temporarily allow redirects (not recommended)
export LLM_IDLE_FAIL_AFTER_SECS=0   # disable idle stall cancel for this shell
export LLM_TAIL_BLOCK=0             # allow tail -f (prefer allowlist regex instead)
export LLM_SUPPRESS_PATTERNS=       # show all upstream heartbeats (noisy)
```

Prefer per-command overrides:

```bash
LLM_IDLE_FAIL_AFTER_SECS=900 llm_run -- <long-quiet-build>
```

---

## Mission Discipline (IDD loop)

* Work against explicit acceptance criteria (Mission Anchor).
* **PROVE → FIX** loop:

  * PROVE: run, capture, summarize.
  * FIX: minimal change; if new deps are needed, install with exact pin; then PROVE again.
* Close only when acceptance criteria are met and `event=run.complete status=0` is observed.

---

## END OF AGENTS.md — effusion-labs
