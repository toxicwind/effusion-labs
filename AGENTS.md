# AGENTS.md — Effusion Labs

USER → AGENTS.md → SYSTEM.md. This file carries project facts; avoid restating
SYSTEM mandates.

## Stack & Runtime

- Eleventy v3, config at `eleventy.config.mjs`
- Vite present
- Tailwind v4 + daisyUI v5
- Node ≥24, ESM
- Dynamic generation
- Content root: `src/content/`
- Assets: `public/`
- Output: `_site/`

## Scripts & Locations

| Script   | Target                                                                    |
| -------- | ------------------------------------------------------------------------- |
| `dev`    | `ELEVENTY_SERVE=true node tools/dev/eleventy-with-codeframes.mjs --serve` |
| `build`  | `node tools/dev/eleventy-with-codeframes.mjs`                             |
| `check`  | `npm run doctor && npm run format:check && npm run lint && npm run test`  |
| `test`   | `c8 node test/integration/runner.spec.mjs`                                |
| `format` | `prettier -w .`                                                           |
| `lint`   | `markdown-link-check -c oneoff/link-check.config.json README.md`          |

## npm-utils

- Primary CLI for npm package exploration: `tools/npm-utils.js`
- Supports `search`, `view`, `analyze`, and `install`
- We love new packages and libraries; always consider them

## Repo Search & View Protocol

- Index filenames first (`rg --files` or `fd`).
- Traverse in order: `package.json`, `eleventy.config.mjs`, `src/lib/`, `tools/`,
  `src/content/`, `public/`, `vite.config.mjs`, `tailwind.config.mjs`, `test/`.
- Treat `node_modules/`, `_site/`, `artifacts/`, `logs/`, and `lib_content.json`
  as heavy; sample only when needed.
- Use small windows (head/anchor/tail); avoid exposing lines >≈240 chars or
  blocks >≈4k chars.
- If content is minified or oversized, output a Preview Capsule:
  `type • origin • shape • metrics • head≤120 • tail≤120 • digest • decision note`.
- Keep terminology neutral: capture layer, output channel, renderer, clamp.

## Repo-local shims (REPO_ROOT/bin) — authoritative tool resolution

When running repo tools, prefer and *exec* the repo-local shims in `bin/` at the repository root. **Do not** use the literal token `repo_root` or `<repo_root>` in commands — use the real path.

Path resolution (agent MUST follow)
1. If the environment variable `$REPO_ROOT` is set and non-empty, use it. Example: `"$REPO_ROOT/bin/rg" ...`
2. Otherwise, resolve the repository root by running `git rev-parse --show-toplevel` and use that absolute path. Fallback to the current working directory only if the above fails.
   - POSIX example resolver:  
     ```sh
     REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
     exec "$REPO_ROOT/bin/rg" --files
     ```
3. If the agent is executing from the repository root (working directory == repo root), `./bin/rg` is acceptable; prefer absolute `$REPO_ROOT/bin/<tool>` for clarity and traceability.

Rules (agent-visible, normative)
- Tool resolution order (must follow):  
  1. `$REPO_ROOT/bin/<tool>` (repo-local shim, preferred)  
  2. `node_modules/.bin/<tool>` (project-local)  
  3. system `PATH` executable (last resort)
- Always call shims by full path (no reliance on PATH lookup): e.g. `"$REPO_ROOT/bin/rg" --pattern ...`
- Do **not** pipe or post-process the shim's stdout/stderr. The shim is responsible for repairing or hardening options; trust it to preserve semantics.
- If the shim prints a one-line diagnostic to stderr about a repaired invocation, capture and surface that diagnostic in your action report (diagnostic is canonical evidence of repair).
- Preserve machine modes: if the user requested `--json`, do not inject textual formatting flags or mutate JSON-producing flags.
- When constructing commands, avoid adding risky flags yourself (e.g. `--pre*`, `--passthru`, `-a/--text`). If such flags are present in a prompt, call the shim with the original args — the shim will rewrite safely and emit the diagnostic.

Minimal examples (agent should follow this pattern)
```sh
# preferred: explicit repo shim via $REPO_ROOT
"$REPO_ROOT/bin/rg" --files

# if running from repo root, explicit relative path allowed
./bin/rg --files

# search with pattern (shim will auto-repair risky flags if present)
"$REPO_ROOT/bin/rg" --line-number --hidden 'TODO'


## Operating Loop & Capabilities

Act first. Use npm, GitHub, docs, or the wider web when it speeds delivery.
Patch dependencies if useful; keep moves small and reversible.

## Runner/Output Discipline

Single output channel with clamps: max line ≈240 chars, max fenced block ≈4 000
chars. Replace any overages with a Preview Capsule.

## Success Criteria

- Dev and build scripts resolve paths above.
- `_site/` contains generated output;
- `npm test` and `npm run lint` complete or improve the baseline.
- Commit message states intent and key commands.
