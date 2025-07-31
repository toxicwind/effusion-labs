# AGENTS.md — Repository Conventions (Advisory, Emergent, npm-enabled)

This file provides **signals** to coding agents (e.g., OpenAI Codex / ARACA). It is advisory, not authoritative.   
System / task instructions and executable configuration files outrank this document.

---

## 0) Scope & Precedence
* **Scope:** Applies to the directory tree rooted at this file. A deeper `AGENTS.md` may override it for its subtree.  
* **Precedence (high → low):**  
  1. System / task-level instructions.  
  2. Executable truth in build / test / type-check configs (`package.json` scripts, `Makefile`, `pyproject.toml`, `tox.ini`, `go.mod`, `Cargo.toml`, `tsconfig.json`, `.tool-versions`, etc.).  
  3. **This AGENTS.md** (advisory).  
  4. Other docs (README, comments, commit messages).  
* **Conflict rule:** If this file conflicts with configs, prefer the configs. If it conflicts with the active system / task, prefer the system / task.

---

## 1) Baseline Invariants (do not replace)
| Layer | Locked Technology |
|-------|-------------------|
| Generator | **Eleventy (11ty)** |
| Templating | **Nunjucks** |
| Styling | **Tailwind CSS** |
| Content model | **Markdown + front-matter** |

Extensions may augment these layers; they must **not replace** them unless explicitly requested by the active task.

---

## 2) Emergent Extension Policy (internet + npm allowed)

Agents may autonomously **discover, evaluate, and add** capabilities via npm and 2025-era docs as long as the **baseline invariants remain intact**.

### Allowed extension domains (examples, not limits)
* **11ty layer:** plugins, shortcodes, filters, data sources, markdown-it plugins, modular config.  
* **Tailwind layer:** official plugins (typography, forms, aspect-ratio), component libs (e.g., **daisyUI**), custom themes.  
* **Authoring & content tooling:** remark/rehype pipelines, MDX adapters (scoped), link checkers, front-matter validators.  
* **Build / dev tooling:** formatters, linters, type-checkers, doc generators, analyzers, asset bundlers (esbuild / Rollup / Vite) that **do not migrate off Eleventy**.  
* **Perf & quality:** image pipelines, safe HTML minification, CSS purge globs, critical-CSS extraction.  
* **A11y & i18n:** accessibility checkers, locale scaffolding (flagged).  
* **Observability (dev-only):** build stats, bundle reporters. Avoid runtime trackers unless requested.

### Guardrails for additions / upgrades
* **Scoped & reversible:** funnel new config through a single module (e.g., `lib/eleventy/plugins.{js,ts}`, `lib/tailwind/plugins.{js,ts}`, `lib/markdown/pipeline.{js,ts}`) with a clear toggle.  
* **Runtime footprint:** prefer `devDependencies`; keep client bundle growth within perf budget (§ 4).  
* **Feature gating:** default new features to **off** or limited scope until validated.  
* **Compatibility:** prefer semver minor / patch; majors only with a rollback path.  
* **No baseline swaps:** never replace Eleventy, Nunjucks, Tailwind, or Markdown without explicit instruction.  
* **Licensing / telemetry:** avoid incompatible licenses or forced telemetry; note opt-outs.  
* **Security:** install via npm; commit lockfiles; avoid remote scripts/binaries.

### Decision rubric (before adding)
1. Baseline preserved?  
2. Layer-compatible & clearly beneficial?  
3. Rollback trivial (single module / flag)?  
4. Perf / a11y budgets respected?  
5. No license / telemetry surprises?

---

## 3) Task-Derived Operation & Validation (emergent)

**Behavior derives from the current instructions; no fixed modes.**

* **If asked for analysis only →** read-only, return insights.  
* **If asked for edits/generation →** write within scope.  
* **If ambiguous →** follow repo conventions; make least-surprising, reversible choices.

**Validation strategy (intent-based)**  
* Discover repo scripts / targets; run what exists.  
* Avoid heavyweight frameworks unless the task demands them.  
* **Narrow changes:** minimal checks (type-check, linter, fast tests).  
* **Broad changes:** full repo validations (tests, lint, build).  
* If a touched surface lacks checks, add **minimal std-lib** tests only when essential.

---

## 4) UX, Accessibility, Performance (mobile-first & desktop-strong)

* **Responsive:** verify `sm`, `lg`, `xl`.  
* **A11y:** meet WCAG 2.1 AA; keyboard focus rings; logical tab order; honor `prefers-reduced-motion`.  
* **Design tokens:** centralize colors/spacing/typography; map component libraries (e.g., daisyUI) to tokens—no hard-coded hex.  
* **Perf:** lean critical CSS; accurate Tailwind purge globs; modern image formats; cautious prefetching.

---

## 5) Repository Signals (hints)

* `src/_includes/` — templates  
* `src/content/` — Markdown collections/drafts  
* `src/assets/`  — CSS / images  
* Root configs: `.eleventy.js`, `package.json`, `tailwind.config.*`, `docker-compose.yml`  
* Front-matter keys: `title`, `date`, `tags`, etc.  
* Conventional commit style preferred (`feat:`, `fix:`, `refactor:`).

---

## 6) Content Authoring (activate only when requested)

* **Locations:** `src/content/<collection>/` or `src/content/drafts/` if unclear.  
* **Names:** `YYYY-MM-DD-slug.md` or `slug/index.md`.  
* **Front-matter template:**
  ```yaml
  ---
  title: ""
  date: YYYY-MM-DD
  tags: []
  summary: ""
  slug: ""
  draft: true
  canonical_url: ""
  ---
````

* **Checks:** if configured, run site build (`npm run build` or similar) to verify compile.

---

## 7) Reporting (task-driven, optional)

If requested, create **`ARACA_REPORT_YYYYMMDD-HHMMSS.md`** (UTC) at repo root listing objectives, touched areas, validation results, perf notes, citations, and next steps.

---

## 8) ARACA Compatibility (conditional)

When the active task declares **ARACA**:

* Treat §§ 1–7 as *signals*, ignoring them when they would limit deep refactor or re-org.
* ARACA **may** add or upgrade **baseline-preserving** npm packages across any domain (UI, content, build, perf, a11y, analysis) under § 2 guardrails.
* ARACA must still respect secrets, licensing, telemetry, validation, and internet safety.

---

## 9) Local Optimization Hints (non-binding)

Small, readable diffs grouped by concern; reversible where practical.
Avoid unrelated re-formatting or vendor-locked files.
Improve existing scripts before adding new ones; remove dead code/config when safe.