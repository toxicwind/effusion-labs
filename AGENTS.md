# AGENTS.md — Effusion Labs

USER → AGENTS.md → SYSTEM.md. This file carries project facts; avoid restating SYSTEM mandates.

## Stack & Runtime

- Eleventy v3, config at `eleventy.config.mjs`
- Vite present
- Tailwind v4 + daisyUI v5
- Node ≥24, ESM
- Dynamic generation
- Content root: `src/content/`
- Assets: `src/assets/` → `/assets/`
- Output: `_site/`

## Scripts & Locations

| Script   | Target                                                                    |
| -------- | ------------------------------------------------------------------------- |
| `dev`    | `ELEVENTY_SERVE=true node utils/dev/eleventy-with-codeframes.mjs --serve` |
| `build`  | `node utils/dev/eleventy-with-codeframes.mjs`                             |
| `check`  | `npm run format:check && npm run lint && npm run test`                    |
| `test`   | `c8 node test/integration/runner.spec.mjs`                                |
| `format` | `prettier -w .`                                                           |
| `lint`   | `markdown-link-check -c oneoff/link-check.config.json README.md`          |

## npm-utils

- Primary CLI for npm package exploration: `utils/scripts/npm-utils.js`
- Supports `search`, `view`, `analyze`, and `install`
- We love new packages and libraries; always consider them

## Repo Search & View Protocol

- Index filenames first (`rg --files` or `fd`).
- Traverse in order: `package.json`, `eleventy.config.mjs`, `config/`, `utils/`, `src/content/`, `src/assets/`, `vite.config.mjs`, `tailwind.config.mjs`, `test/`.
- Treat `node_modules/`, `_site/`, `artifacts/`, `logs/`, and `lib_content.json` as heavy; sample only when needed.
- Use small windows (head/anchor/tail); avoid exposing lines >≈240 chars or blocks >≈4k chars.
- If content is minified or oversized, output a Preview Capsule: `type • origin • shape • metrics • head≤120 • tail≤120 • digest • decision note`.
- Keep terminology neutral: capture layer, output channel, renderer, clamp.

## Operating Loop & Capabilities

Act first. Use npm, GitHub, docs, or the wider web when it speeds delivery. Patch dependencies if useful; keep moves small and reversible.

## Runner/Output Discipline

Single output channel with clamps: max line ≈240 chars, max fenced block ≈4 000 chars. Replace any overages with a Preview Capsule.

## Success Criteria

- Dev and build scripts resolve paths above.
- `_site/` contains generated output; assets publish under `/assets/`.
- `npm test` and `npm run lint` complete or improve the baseline.
- Commit message states intent and key commands.
