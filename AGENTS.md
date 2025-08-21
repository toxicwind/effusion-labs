## START OF AGENTS.md — effusion-labs

_Effusion Labs — Operating Rails for Autonomous Coding Agents (Codex-style)_

This is the **in-repo operating spec** for autonomous coding agents that run bash, read/write files, and iterate quickly. It complements the upstream system charter (Mission Anchor, No-Ask, single final message) — treat this as the on-disk contract.

> **ESM note**: Application code uses native ES modules. Configuration files like `tailwind.config.mjs` and `postcss.config.mjs` are also ESM; avoid CommonJS unless a third-party tool strictly requires it.
>
> **Highlighting & Icons**: Shiki performs build-time code highlighting (no Prism). Common Lucide icons are inlined as SVG; only include the Lucide runtime on pages needing dynamic icons.

---

## 0) Runtime Augmentation (one command)

Activate the augmented shell so you get streaming runs, structured notices, and sane defaults.

````bash
source scripts/llm-bootstrap.sh
`````

**You get**

* **`llm_run`** → canonical runner: live streaming, idle beacons, preserved exit codes, clean interrupts, bounded post-tails.
* **I/O wrappers** → `cat` → `llm_cat` (format-aware, folded); `tail -f/-F` auto-bounded; `head` clamped.
* **Command rewrite** → naive `> file` or `> file && tail …` becomes a streaming pipeline (or is rejected in strict mode) so logs are visible and token-efficient.
* **Autoinstall** → hash-based detection triggers `npm ci` (+ optional Python reqs if a venv is active).

> Quick sanity check (optional):
>
> ```bash
> type llm_run && trap -p DEBUG && echo "STRICT=$LLM_STRICT"
> ```

---

## 1) Fast Orientation Macro (always run before planning)

Build a current mental model of the workspace in \~seconds.

```bash
tree -L 3 -I "node_modules|_site|.git"
llm_cat package.json
llm_cat eleventy.config.mjs
[ -f tailwind.config.mjs ] && llm_cat tailwind.config.mjs
[ -f docker-compose.yml ]  && llm_cat docker-compose.yml
```

**Pull out**

* `package.json` → scripts (`dev`, `build`, `test`) and key deps.
* `eleventy.config.mjs` → `addCollection`, filters/shortcodes, `addPassthroughCopy`.
* Any required env from `.env*`.

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

* Idle: emits `event=run.idle` at \~`LLM_IDLE_SECS` when the child is quiet.
* Stall cutoff: after `LLM_IDLE_FAIL_AFTER_SECS`, run ends (non-zero) with a bounded tail for triage.
* Ctrl-C: prints \~80 trailing lines, exits **130**.

> You can write naive patterns (`cmd > log && tail …`); the DEBUG trap will rewrite or reject. The golden macros are faster and clearer — use them.

---

## 2.5) Commit & Artifact Rails (NEW — MUST FOLLOW)

These rails guarantee **no work is lost**, even when tests/builds fail.

```bash
# One-time at session start (idempotent)
mkdir -p logs artifacts/patches docs/wip

# Timestamp & branch
ts="$(date -u +%Y%m%dT%H%M%SZ)"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  cur="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
  branch="wip/${ts}-$(echo "$cur" | tr '/ ' '--')"
  git switch -c "$branch" 2>/dev/null || git switch "$branch"
fi

# Safe checkpoint helper: commit even if tests are red
_ckpt() {
  msg="${1:-chore: checkpoint}"
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git add -A || true
    git commit -m "$msg" || true
    git show --stat -1 > "logs/ckpt-${ts}.log" 2>/dev/null || true
    git diff -U0 HEAD~1..HEAD > "artifacts/patches/${ts}.patch" 2>/dev/null || true
  else
    # Fallback: synthesize a patch snapshot when not in a git repo
    { find . -type f ! -path "./node_modules/*" -maxdepth 3 -print; } > "artifacts/patches/${ts}-snapshot.txt" 2>/dev/null || true
  fi
}

# Use after each purposeful batch of edits
# _ckpt "feat: <batch summary>"
```

---

## 2.6) Log Persistence Rails (NEW)

Always persist transient `/tmp/*.log` outputs into the repo.

```bash
# Run after each llm_run (safe if no files exist)
for f in /tmp/*.log; do
  [ -f "$f" ] && cp -f "$f" "logs/$(basename "$f" .log)-${ts}.log"
done
```

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

* Prefer **maintained** libs with clear semver and healthy release cadence.
* Pin **exact** versions to stabilize builds; record choice rationale in your Result.
* Lockfile changes trigger autoinstall on next activation; you can also run `llm_run --out /tmp/ci.log -- npm ci`.

---

## 4) Reading & Summarizing Code (token-smart)

Use `llm_cat` for source (pretty + folded); bypass with `command cat` only for binaries/raw pipes.

```bash
llm_cat src/_data/site.json
llm_cat src/_includes/layouts/base.njk
llm_cat src/content/projects/example.md
```

Summaries should be crisp: what the file does, key interfaces, and the seams you’ll modify.

---

## 5) Eleventy-specific Notes (work with the grain)

* Collections live in `eleventy.config.mjs` — read `addCollection` shapes before changing front matter.
* Assets via `addPassthroughCopy`.
* Output is `_site/` — never edit `_site/`; **build** to change it.

---

## 6) “Interactive Development” clarified

This setup lets an agent **observe** a dev server in a sandbox **without hanging** on `tail -f`. Use bounded tails so each run yields a digest and exits.

* Run: \`\`\`\`bash
  llm\_run --out /tmp/dev.log --tail 120 -- npm run dev

  ```
  ```
* If the server prints a URL, **surface it** in your final Result.
* If the server is long-quiet by design, increase the stall cutoff per command:

  ```bash
  LLM_IDLE_FAIL_AFTER_SECS=900 llm_run --out /tmp/dev.log --tail 120 -- npm run dev
  ```

---

## 7) Tuning Knobs (set only with intent)

* `LLM_STRICT=1` → enforce rewrite/reject of risky redirects; prefer canonical runs.
* `LLM_TAIL_BLOCK=1` / `LLM_TAIL_MAX_LINES=5000` → follow protection & snapshot size.
* `LLM_HEAD_MAX_LINES=2000` → cap for `head`.
* `LLM_SUPPRESS_PATTERNS` → awk/regex to drop noisy lines.
* `LLM_IDLE_SECS` / `LLM_IDLE_FAIL_AFTER_SECS` → idle cadence & stall cutoff.

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
7. **Checkpoint often** → `_ckpt "feat: …"` after each meaningful batch.

---

## 9) Completion Lens (REPLACED)

Mark complete only when:

* Acceptance criteria are met with observable evidence (**or**, if not fully green) **all work is persisted and committed** with artifacts and a failure note.
* A log artifact exists for each major step (`logs/*-<UTC>.log`).
* A patch exists (`artifacts/patches/<UTC>.patch`) if diffs aren’t trivially inferable from commits.
* Diff is minimal and purposeful (include `git diff --stat`).
* Any dev server URL printed by tools is included in your Result.

**Result skeleton (single final message, as per system charter)**

```text
Analysis: facts, constraints, assumptions, risks.
Plan: steps, commands (llm_run …), expected signals.
Result: diffstat, change table, artifacts (logs/ & patches/), URLs, Acceptance Map, Resolution Map.
```

---

## 10) Rapid Recovery (EXTENDED)

When something misbehaves (non-zero exit, timeouts, or partial refactors):

1. **Persist logs**: copy `/tmp/*.log` → `logs/*-<UTC>.log`.
2. **Persist diffs**:

   * If in git: `git diff > artifacts/patches/<UTC>.patch` (or the last commit is the WIP).
   * If not in git: synthesize a snapshot under `artifacts/patches/`.
3. **Checkpoint commit**: `_ckpt "WIP(fail): <one-line reason>"`.
4. **Write failure note**: `docs/wip/<UTC>-failure.md` containing:

   * Mission Anchor (User Story + BDD)
   * What changed (diffstat)
   * Failing command and last \~120 lines of the relevant log
   * Minimal next steps to resume
5. **Do not discard or revert** uncommitted work; never end a session with a dirty tree.

---

## END OF AGENTS.md — effusion-labs