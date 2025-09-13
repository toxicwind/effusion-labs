# BEGIN OF AGENTS.md — HYPEBRUT CONTEXT INJECTION • Eleventy • Node/ESM • npm • Shell

This layer is **always on**. Assume processes exist, **reuse** them, and **only** use repo-local tooling. When this file names commands or paths, **do exactly that**.

---

## Environment & Local Tooling (MUST)

**Activate (idempotent)**

```bash
source utils/scripts/setup/env-bootstrap.sh
```

**Signals (stderr)**

- Fresh: `[HB] Bootstrap active. Guard=3800b …`
- Already active: `[HB] Ready in this process. Proceed.`

**Repo binaries only** — PATH resolves to `./bin/*`. Enforce:

```bash
which node && which npm
# Expect: ./bin/node  ./bin/npm
```

---

## Output Guard (CONTRACT)

- Every line to the platform is ≤ **3800 bytes**. Long text is split with visible markers.
- **Wrapped text** example:

  ```
  [HBWRAP 1/3 1..3800] …
  [HBWRAP 2/3 3801..7600] …
  [HBWRAP 3/3 7601..N] …
  ```

- **Binary** lines are emitted as:

  ```
  [HBB64 LEN=<bytes> SHA256=<hash>]
  <base64 body>
  ```

- A **raw, unsplit** copy of all output is written to `/tmp/hype_logs/hb.*.log`.

Reconstruct text from wrapped output:

```bash
awk '/^\[HBWRAP [0-9]+\/[0-9]+ [0-9]+\.\.[0-9]+\] /{sub(/^\[HBWRAP [^]]+\] /,"");printf "%s",$0;next}{print}' wrapped.txt > original.txt
```

Decode a binary block:

```bash
awk 'BEGIN{p=0} /^\[HBB64 /{p=1;next} {if(p)print}' wrapped.txt | base64 -d > original.bin
```

---

## Persistence Paths (MUST)

- `PERSIST_ROOT=src/content/docs/`
- Reports → `src/content/docs/reports/`
- Worklogs → `src/content/docs/worklogs/`
- Knowledge → `src/content/docs/knowledge/`
- Filenames are **UTC**: `YYYYMMDDThhmmssZ.ext`. Paths are **repo-relative**.

---

## Running Services

**Inspect**

```bash
lsof -t -i :8080 >/dev/null 2>&1 && echo "devserver: present" || echo "devserver: absent"
```

**Start (only if absent)**

```bash
if ! lsof -t -i :8080 >/dev/null 2>&1; then
  nohup ./bin/npm run dev > /tmp/hype_logs/devserver.$(date -u +%Y%m%dT%H%M%SZ).log 2>&1 &
  echo "devserver: started (8080)"
else
  echo "devserver: already running (8080)"
fi
```

**Stop**

```bash
pid=$(lsof -t -i :8080 2>/dev/null | head -n1) && kill -TERM "$pid" || true
```

---

## Eleventy Build/Serve

**Build**

```bash
./bin/npm run build || ./bin/node ./node_modules/@11ty/eleventy/cmd.js
```

**Serve (dev)**

```bash
./bin/npm run dev || ./bin/node ./node_modules/@11ty/eleventy/cmd.js --serve --port=8080
```

---

## npm Discovery & Decisions (REQUIRED)

Use **repo-local npm** and the curated helper. Persist evidence.

**Registry truth**

```bash
./bin/npm ls --depth=0
./bin/npm view <pkg> version time dist-tags license repository.url engines peerDependencies deprecated
```

**Search**

```bash
./bin/npm search --searchlimit=25 "eleventy plugin interlink"
```

**Curated helper — `utils/scripts/npm-utils.js`**

```bash
./bin/node utils/scripts/npm-utils.js search "eleventy plugin"

./bin/node utils/scripts/npm-utils.js analyze "markdown plugin" \
  > src/content/docs/knowledge/npm-analyze-markdown-$(date -u +%Y%m%dT%H%M%SZ).json

./bin/node utils/scripts/npm-utils.js view "markdown-it" \
  > src/content/docs/knowledge/npm-view-markdown-it-$(date -u +%Y%m%dT%H%M%SZ).json

./bin/node utils/scripts/npm-utils.js install "markdown-it"
```

**Direct installs**

```bash
./bin/npm i <pkg>@^X.Y.Z
./bin/npm i -D <pkg>@~A.B.C
```

**Patch maintenance**

```bash
./bin/npx patch-package || true
./bin/npx patch-package <pkg>   # after editing node_modules/<pkg>
```

---

## ESM Utilities

Run repo utilities with repo Node. Persist outputs to `…/knowledge/`.

```bash
./bin/node utils/scripts/my-task.mjs --flag value
```

```js
// utils/scripts/example.mjs
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const { stdout } = await run('./bin/npm', ['view', 'markdown-it', 'version']);
console.log(
  JSON.stringify({ pkg: 'markdown-it', version: stdout.trim() }, null, 2),
);
```

---

## Interlinking & Archives

- Resolvers `config/interlinkers/resolvers.mjs`
- Registry `config/interlinkers/route-registry.mjs`
- Reporter `config/interlinkers/unresolved-report.mjs`

**Contracts**

- Prefer `[[kind:slug-or-title]]`. `[[Title]]` is tolerated but weaker.
- Routes are `/archives/<kind>/<slug>/`.

**Audit loop**

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
./bin/npm test || ./bin/node --test --test-reporter=spec "test/**/*.mjs"
./bin/prettier --log-level warn --write .
./bin/rg -n 'add(Collection|Shortcode|Filter)\(' config src
```

## AGENT CONTEXT INJECTION COMPLETE
