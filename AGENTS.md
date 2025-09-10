## BEGIN OF AGENTS.md - HYPEBRUT CONTEXT INJECTION — Eleventy • Node/ESM • npm • Shell (`AGENTS.md`)

Repository-specific operating layer that extends `SYSTEM.md`. This guide is **always-on**: assume processes may already be running, prefer reuse over restart, and use repo-local tooling. Where this names commands or paths, **do exactly that**.

---

## Environment & Local Tooling (MUST)

- **Activate (idempotent)**  
  ```bash
  source utils/scripts/setup/env-bootstrap.sh
````

Signals of success:
`✅ HYPEBRUT Environment activated. Tools are available...` or
`ℹ️ HYPEBRUT Environment already active. Sourcing skipped...`

* **Recovery check**

  ```bash
  type -t llm_cat || source utils/scripts/setup/env-bootstrap.sh
  ```

* **Use repo-shipped binaries only** (never globals; PATH must resolve to `./bin/*`)
  `./bin/node  ./bin/npm  ./bin/prettier  ./bin/rg  ./bin/jq  ./bin/yq  ./bin/fd  ./bin/bat  ./bin/tree`
  If `which node` or `which npm` is not under `./bin/`, re-source the environment.

---

## Persistence Paths (MUST)

* `PERSIST_ROOT=src/content/docs/`
* Reports → `src/content/docs/reports/`
* Worklogs → `src/content/docs/worklogs/`
* Knowledge (raw fetches, tables, JSON, logs) → `src/content/docs/knowledge/`
* **Filenames are UTC**: `YYYYMMDDThhmmssZ.ext` and paths are **repo-relative** in your final message.

---

## Running Services Are Assumed

* **Inspect before starting**

  ```bash
  hype_status
  ```
* **Reuse an existing dev server** when present; **do not** start a duplicate or change ports blindly.
* **Start only if absent**

  ```bash
  hype_bg --port 8080 devserver -- ./bin/npm run dev
  ```
* **Stop explicitly** (no kill+start chaining)

  ```bash
  hype_kill devserver
  ```

---

## Eleventy Build/Serve

* **Build**

  ```bash
  ./bin/npm run build \
    || ./bin/node ./node_modules/@11ty/eleventy/cmd.js
  ```
* **Serve (dev)**

  ```bash
  ./bin/npm run dev \
    || ./bin/node ./node_modules/@11ty/eleventy/cmd.js --serve --port=8080
  ```
* **Structure map**
  Config `eleventy.config.mjs`, `config/**/*.mjs|js`;
  Templates `src/_includes/**`; Content `src/content/**`; Pages `src/pages/**`;
  CSS/Tailwind/PostCSS `tailwind.config.mjs`, `postcss.config.mjs`, `src/assets/css/**`;
  Client JS `src/assets/js/**`.

---

## npm Discovery & Decisions (REQUIRED)

**Registry intelligence precedes every dependency decision.** Use **repo-local npm** and the curated helper to search, analyze, and persist evidence.

* **Canonical registry truth**

  ```bash
  ./bin/npm ls --depth=0
  ./bin/npm view <pkg> version time dist-tags license repository.url engines peerDependencies deprecated
  ```

* **Find viable packages** (required discovery)

  ```bash
  ./bin/npm search --searchlimit=25 "eleventy plugin interlink"
  ```

* **Curated helper (MUST for analysis & artifacts)** — `utils/scripts/npm-utils.js`

  ```bash
  # Search (20 results)
  ./bin/node utils/scripts/npm-utils.js search "eleventy plugin"

  # Deep analyze (10 results; score + lastPublish)
  ./bin/node utils/scripts/npm-utils.js analyze "markdown plugin" \
    > src/content/docs/knowledge/npm-analyze-markdown-$(date -u +%Y%m%dT%H%M%SZ).json

  # Full registry JSON for one package
  ./bin/node utils/scripts/npm-utils.js view "markdown-it" \
    > src/content/docs/knowledge/npm-view-markdown-it-$(date -u +%Y%m%dT%H%M%SZ).json

  # Install **exact** latest dist-tag through repo-local npm (env must be active)
  ./bin/node utils/scripts/npm-utils.js install "markdown-it"
  ```

* **Direct installs (after you’ve decided)**

  ```bash
  ./bin/npm i <pkg>@^X.Y.Z           # runtime dep (caret range; lockfile controls exact)
  ./bin/npm i -D <pkg>@~A.B.C        # dev dep (tilde pin for patch stability)
  ```

* **Patch maintenance** (`patches/` is authoritative)

  ```bash
  ./bin/npx patch-package || true
  # after editing node_modules/<pkg> to hotfix:
  ./bin/npx patch-package <pkg>
  ```

---

## ESM `.mjs` Utilities

Prefer **Node ESM** for repo utilities; run with repo-local Node. Persist structured outputs to `…/knowledge/`.

```bash
./bin/node utils/scripts/my-task.mjs --flag value
```

```js
// utils/scripts/example.mjs
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

const { stdout } = await run('./bin/npm', ['view', 'markdown-it', 'version']);
console.log(JSON.stringify({ pkg: 'markdown-it', version: stdout.trim() }, null, 2));
```

---

## Interlinking & Archives Contracts

* Resolvers `config/interlinkers/resolvers.mjs` • Registry `config/interlinkers/route-registry.mjs` • Reporter `config/interlinkers/unresolved-report.mjs`
* **Link syntax** prefers namespaced wikilinks `[[kind:slug-or-title]]`; omitted kind `[[Title]]` is tolerated but less deterministic.
* **Routes** are canonicalized as `/archives/<kind>/<slug>/`.
* **Audit loop** (persist the artifact and iterate until clean or justified):

  ```bash
  ./bin/node config/interlinkers/unresolved-report.mjs \
    | tee src/content/docs/knowledge/interlinker-unresolved-$(date -u +%Y%m%dT%H%M%SZ).log

  ./bin/rg -n '\[\[[^\]]+\]\]' src | ./bin/bat -l markdown

  ./bin/node ./node_modules/@11ty/eleventy/cmd.js
  ./bin/node config/interlinkers/unresolved-report.mjs
  ```

---

## Tests, Format, Scans

```bash
./bin/npm test \
  || ./bin/node --test --test-reporter=spec "test/**/*.mjs"

./bin/prettier --log-level warn --write .

./bin/rg -n 'add(Collection|Shortcode|Filter)\(' config src
```

---

## Quick Command Deck (paste-ready; non-destructive; coexists with running services)

```bash
# activate env (idempotent)
source utils/scripts/setup/env-bootstrap.sh

# deps + patches
./bin/npm ci || ./bin/npm i
./bin/npx patch-package || true

# npm discovery (persist evidence)
./bin/node utils/scripts/npm-utils.js analyze "eleventy plugin" \
  > src/content/docs/knowledge/npm-analyze-eleventy-$(date -u +%Y%m%dT%H%M%SZ).json

# build + reuse dev server
./bin/npm run build || ./bin/node ./node_modules/@11ty/eleventy/cmd.js
hype_status | grep -q devserver || hype_bg --port 8080 devserver -- ./bin/npm run dev

# interlinker audit
./bin/node config/interlinkers/unresolved-report.mjs \
  | tee src/content/docs/knowledge/interlinker-unresolved-$(date -u +%Y%m%dT%H%M%SZ).log

# tests + format
./bin/npm test || ./bin/node --test --test-reporter=spec "test/**/*.mjs"
./bin/prettier --log-level warn --write .
```

## AGENT CONTEXT INJECTION COMPLETE