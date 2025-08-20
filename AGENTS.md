## START OF AGENTS.md — effusion-labs

_Effusion Labs — Operating Rails for Autonomous Coding Agents (Codex-style)_

This is the **in-repo operating spec** for autonomous coding agents that run bash, read/write files, and iterate quickly. It complements the upstream system charter (Mission Anchor, No-Ask, single final message) — keep that in mind and use this as the on-disk contract.

---

## 0) Runtime Augmentation (one command)

Activate the augmented shell so you get streaming runs, structured notices, and sane defaults.

```bash
source scripts/llm-bootstrap.sh
```

**You get**

- **`llm_run`** → canonical runner: live streaming, idle beacons, preserved exit codes, clean interrupts, bounded post-tails.
- **I/O wrappers** → `cat` → `llm_cat` (format-aware, folded lines); `tail -f/-F` auto-bounded; `head` clamped.
- **Command rewrite** → naive `> file` or `> file && tail …` becomes a streaming pipeline (or is rejected in strict mode) so logs are visible and token-efficient.
- **Autoinstall** → hash-based detection triggers `npm ci`

> Quick sanity check (optional):
> `type llm_run && trap -p DEBUG && echo "STRICT=$LLM_STRICT"`

---

## 1) Fast Orientation Macro (always run before planning)

Build a current mental model of the workspace in \~seconds.

```bash
tree -L 3 -I "node_modules|_site|.git"
llm_cat package.json
llm_cat eleventy.config.mjs
[ -f tailwind.config.cjs ] && llm_cat tailwind.config.cjs
[ -f docker-compose.yml ]  && llm_cat docker-compose.yml
```

**Pull out**

- `package.json` → scripts (`dev`, `build`, `test`) and key deps.
- `eleventy.config.mjs` → `addCollection`, filters/shortcodes, `addPassthroughCopy`.

---

## 2) Golden Execution Macros

Prefer these shapes. They stream, they finish, they leave artifacts.

```bash
# dev: bounded digest on completion
llm_run --out /tmp/dev.log   --tail 120 -- npm run dev

# build: one-shot
llm_run --out /tmp/build.log             -- npm run build

# tests: CI-friendly presets may be applied (CI=1, ELEVENTY_ENV=test, WATCH=0)
llm_run --out /tmp/test.log              -- npm test
```

**Signals you’ll see**

- Idle: emits `event=run.idle` at \~`LLM_IDLE_SECS` when the child is quiet.
- Stall cutoff: after `LLM_IDLE_FAIL_AFTER_SECS`, run ends (non-zero) with a bounded tail for triage.
- Ctrl-C: prints \~80 trailing lines, exits **130**.

> You can write naive patterns (`cmd > log && tail …`); the DEBUG trap will rewrite or reject. The golden macros are faster and clearer — use them.

---

## 3) Live Registry Expansion (dependencies are a first-class tool)

Treat the npm registry as the **ground truth** when expanding capability. Fetch facts, choose versions deliberately, pin, and run.

```bash
# discover candidates
llm_run --out /tmp/npm-search.log -- npm search --searchlimit 20 "<keywords>"

# inspect specific packages
llm_run --out /tmp/npm-view.log   -- npm view <pkg> version dist-tags latest time --json

# choose & pin exact version, then install
llm_run --out /tmp/npm-install.log -- npm install <pkg>@<exact> --save-exact
```

**Principles**

- Prefer **maintained** libs with clear semver and healthy release cadence.
- Pin **exact** versions to stabilize builds; record choice rationale in your final Result.
- Lockfile changes will trigger autoinstall on next activation; you can also run `llm_run --out /tmp/ci.log -- npm ci` explicitly.

---

## 4) Reading & Summarizing Code (token-smart)

Use `llm_cat` for source (pretty + folded); bypass with `command cat` only for binaries or raw pipes.

```bash
llm_cat src/_data/site.json
llm_cat src/_includes/layouts/base.njk
llm_cat src/content/projects/example.md
```

Summaries should be crisp: what the file does, the key interfaces, and the specific seams you’ll modify.

---

## 5) Eleventy-specific Notes (work with the grain)

- Collections live in `eleventy.config.mjs` → read `addCollection` shapes before changing front matter.
- Assets via `addPassthroughCopy`.
- Output is `_site/` → never edit `_site/`; build to change it.

---

## 6) “Interactive Development” clarified

This setup lets an agent **observe** a dev server in a sandbox **without hanging** on `tail -f`. Use bounded tails so each run yields a digest and exits.

- Run: `llm_run --out /tmp/dev.log --tail 120 -- npm run dev`
- If the server prints a URL, **surface it** in your final Result.
- If the server is long-quiet by design, increase the stall cutoff per command:
  `LLM_IDLE_FAIL_AFTER_SECS=900 llm_run --out /tmp/dev.log --tail 120 -- npm run dev`

---

## 7) Tuning Knobs (set only with intent)

- `LLM_STRICT=1` → enforce rewrite/reject of risky redirects; prefer canonical runs.
- `LLM_TAIL_BLOCK=1` / `LLM_TAIL_MAX_LINES=5000` → follow protection & snapshot size.
- `LLM_HEAD_MAX_LINES=2000` → cap for `head`.
- `LLM_SUPPRESS_PATTERNS` → awk/regex to drop noisy lines.
- `LLM_IDLE_SECS` / `LLM_IDLE_FAIL_AFTER_SECS` → idle cadence & stall cutoff.

Per-command override example:

```bash
LLM_IDLE_FAIL_AFTER_SECS=1200 llm_run --out /tmp/slow.log -- <quiet-task>
```

---

## 8) Operating Cadence (tight loop, decisive edits)

1. **Anchor** (system charter) → define Mission Anchor + BDD acceptance.
2. **Recon** (macro above) → facts over guesses.
3. **Execute** (golden macros) → small, verifiable steps.
4. **Expand** (live registry) → add/upgrade libs when they unlock capability; pin exact.
5. **Verify** → evidence from logs/builds/tests.
6. **Record** → summarize diffs and decisions.

---

## 9) Completion Lens (what “DONE” means)

Mark complete only when:

- Acceptance criteria are met with observable evidence (`event=run.complete status=0` for the decisive command).
- A log artifact exists for each major step (`--out /tmp/*.log`).
- The diff is minimal and purposeful (include `git diff --stat` if available).
- Any dev server URL printed by tools is included in your Result.

**Result skeleton (single final message, as per system charter)**

```
Analysis: facts, constraints, assumptions, risks.
Plan: steps, commands (llm_run …), expected signals.
Result: diffs (stat), artifacts (/tmp/*.log), URLs, Acceptance Map, Resolution Map.
```

---

## 10) Rapid Recovery (when something misbehaves)

- Show last \~120 lines from the relevant `/tmp/*.log`.
- Re-read targeted files with `llm_cat`; adjust the plan minimally.
- If a tool is chatty but correct, raise `LLM_IDLE_FAIL_AFTER_SECS` for that run only.
- If a library blocks progress, pivot: pick the next best maintained alternative from the registry and pin.

## END OF AGENTS.md — effusion-labs
