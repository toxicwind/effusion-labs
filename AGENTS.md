# AGENTS.md — Effusion Labs

Project facts for tools and agents. No meta-instructions.

## Runtime

- Node: **≥22.19.0** (`"engines.node": ">=22.19.0"`)
- Module system: **ESM** (`"type": "module"`)
- Agent internet access: On (Unrestricted)
- Chromium provisioning: `./bin/install-chromium.sh` installs via apt and exports `PUPPETEER_EXECUTABLE_PATH` when available.

## Build System

- Static site: **Eleventy 3.1.2**
- Bundler: **Vite 7**
- Styling: **Tailwind 4** + **daisyUI 5**
-

## Playwright & Browser Tooling

- Resolver checks `PUPPETEER_EXECUTABLE_PATH`, system Chromium binaries (`/usr/bin`, Snap), and Playwright caches under `node_modules/.cache/ms-playwright` and `~/.cache/ms-playwright`.
- Provision locally with `./bin/install-chromium.sh` **or** `npx playwright install chromium`; CI uses the script (skip inline apt snippets).
- `node tools/check-chromium.mjs` prints the resolved browser path and suggests remediation if missing.

## Paths

- Content: `src/content/`
- Public assets: `public/`
- Build output: `_site/`

## Commands (npm scripts)

| Script          | Command |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| start / dev     | `npx @11ty/eleventy --serve` |
| serve           | `npx @11ty/eleventy --serve` (Playwright web server hook) |
| clean           | `del-cli _site` |
| build           | `npm run build:site` (prebuild hooks run `node bin/quality.mjs apply`) |
| build:site      | `NODE_ENV=production npx @11ty/eleventy` |
| build:ci        | `node bin/quality.mjs check --soft && NODE_ENV=production npx @11ty/eleventy` |
| quality         | `node bin/quality.mjs` |
| quality:apply   | `node bin/quality.mjs apply` |
| quality:check   | `node bin/quality.mjs check` |
| quality:ci      | `node bin/quality.mjs check --soft` |
| quality:report  | `node bin/quality.mjs check --soft --knip-report` (writes JSON + Markdown + CodeClimate reports) |
| lint            | `npm run quality:check` |
| lint:ci         | `npm run quality:ci` |
| format          | `npm run quality:apply` |
| links:check     | `node tools/run-if-network.mjs markdown-link-check -c oneoff/link-check.config.json README.md` |
| links:ci        | `node tools/run-if-network.mjs markdown-link-check -c oneoff/link-check.config.json README.md || true` |
| lint:dead       | `npm run quality:report` |
| test            | `node tools/check-chromium.mjs && c8 node test/integration/runner.spec.mjs` |
| test:watch      | `node tools/check-chromium.mjs && node --watch test/integration/runner.spec.mjs` |
| test:playwright | `node tools/check-chromium.mjs && playwright test` |
| check           | `npm run doctor && npm run quality:check && npm run test` |
| doctor          | `node tools/doctor.mjs` |
| mcp:*           | MCP gateway + tests (`mcp:dev`, `mcp:integration`, `mcp:test`) |
| lv-images:*     | Dataset utilities |

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
