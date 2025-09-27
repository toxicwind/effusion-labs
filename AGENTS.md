# AGENTS.md — Effusion Labs

Project facts for tools and agents. No meta-instructions.

## Runtime

- Node: **≥22.19.0** (`"engines.node": ">=22.19.0"`)
- Module system: **ESM** (`"type": "module"`)
- Agent internet access: On (Unrestricted)

## Build System

- Static site: **Eleventy 3.1.2**
- Bundler: **Vite 7**
- Styling: **Tailwind 4** + **daisyUI 5**
-

## Paths

- Content: `src/content/`
- Public assets: `public/`
- Build output: `_site/`

## Commands (npm scripts)

| Script          | Command                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| start / serve   | `npx @11ty/eleventy --serve`                                                                                                     |
| watch           | `npx @11ty/eleventy --watch`                                                                                                     |
| bench           | `DEBUG=Eleventy:Benchmark* npx @11ty/eleventy`                                                                                   |
| build           | `npx @11ty/eleventy`                                                                                                             |
| clean           | `del-cli _site`                                                                                                                  |
| format          | `dprint fmt -c dprint.json`                                                                                                      |
| format:check    | `dprint check -c dprint.json`                                                                                                    |
| format:classes  | `rustywind --write "src/**/*.{njk,html,js,jsx,ts,tsx}"`                                                                          |
| format:all      | `npm run format:classes && npm run format`                                                                                       |
| lint            | `npm-run-all --parallel lint:js lint:links`                                                                                      |
| lint:js         | `eslint "src/**/*.{js,mjs,ts,tsx}" "tools/**/*.mjs" "mcp-stack/**/*.mjs" eleventy.config.mjs --report-unused-disable-directives` |
| lint:fix        | same targets as `lint:js` with `--fix`                                                                                           |
| lint:links      | `markdown-link-check -c oneoff/link-check.config.json README.md`                                                                 |
| dead (variants) | `knip` report tasks (`dead`, `dead:prod`, `dead:strict`, etc.)                                                                   |
| test            | `c8 node test/integration/runner.spec.mjs`                                                                                       |
| test:watch      | `node --watch test/integration/runner.spec.mjs`                                                                                  |
| test:playwright | `playwright test`                                                                                                                |
| check           | `npm run doctor && npm run format:check && npm run lint && npm run test`                                                         |
| doctor          | `node tools/doctor.mjs`                                                                                                          |
| mcp:*           | MCP gateway + tests (`mcp:dev`, `mcp:integration`, `mcp:test`)                                                                   |
| lv-images:*     | Dataset utilities                                                                                                                |

> `postinstall` is handled by setup (Puppeteer CfT shims + tools/apply-patches.mjs).

## Notable Dev Dependencies (signal only)

- Eleventy core/plugins, Vite, Tailwind, daisyUI
- Quality: **eslint@9**, **typescript-eslint**, **dprint**, **knip**, **markdown-link-check**
- Testing: **@playwright/test**, **c8**
- Puppeteer: **^24.22.0** (Chrome for Testing managed by setup)

## Repo Search Protocol (concise)

1. List files first: `rg --files` or `fd`.
2. Inspect in order: `package.json` → `eleventy.config.mjs` → `src/lib/` → `tools/` → `src/content/`
   → `public/` → `vite.config.mjs` → `tailwind.config.mjs` → `test/`.
3. Treat `node_modules/`, `_site/`, `artifacts/`, `logs/`, `lib_content.json` as heavy.

## Output Discipline

- Max line ≈ **240 chars**; fenced block ≤ **4000 chars**.
- For overages/minified blobs, emit a compact preview (type • origin • shape • metrics • head≤120 •
  tail≤120 • digest • decision note).

## Success Criteria

- `npm run build` produces `_site/`.
- `npm test` and `npm run lint` pass (or improve baseline).
- Commits include intent and the key commands executed.
