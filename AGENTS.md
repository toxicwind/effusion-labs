# BEGIN OF AGENTS.md - HYPEBRUT CONTEXT INJECTION — Eleventy • Node/ESM • npm • Shell (`AGENTS.md`)

Repository-specific operating layer that extends `SYSTEM.md`. This guide is **always-on**: assume processes may already be running, prefer reuse over restart, and use repo-local tooling. Where this names commands or paths, **do exactly that**.

---

## Environment & Local Tooling (MUST)

- **Activate (idempotent)**

```bash
source utils/scripts/setup/env-bootstrap.sh
````

**Signals of success** (stderr):

* Fresh activation:
  `[HB] Bootstrap active. Guard armed (width=3800 bytes). Log: /tmp/hype_logs/hb.…log`

* Already active in this process:
  `[HB] Ready in this process. Proceed.`

* **Recovery check (guard must be engaged)**

```bash
# Expect output prefixed with visible wrap markers (never >4096 bytes/line)
python - <<'PY'
print("X"*5000)
PY
# should show:
# [HBWRAP 1/2 1..3800] XXXXX...
# [HBWRAP 2/2 3801..5000] XXXXX...

# Binary-ish line triggers base64 with header:
python - <<'PY'
import sys; sys.stdout.buffer.write(b'\x00\xffabc'*1000 + b'\n')
PY
# should show a header like:
# [HBB64 LEN=...] 
# <base64 lines...>

# A raw, unsplit copy of everything above is written to /tmp/hype_logs/hb.*.log
ls -1 /tmp/hype_logs/hb.*.log | tail -n1
```

* **Use repo-shipped binaries only** (never globals; PATH must resolve to `./bin/*`)
  `./bin/node  ./bin/npm  ./bin/prettier  ./bin/rg  ./bin/jq  ./bin/yq  ./bin/fd  ./bin/bat  ./bin/tree`
  If `which node` or `which npm` is not under `./bin/`, re-source the environment.

---

## Output Guard Contract (READ THIS)

* The platform kills sessions on lines > \~4096 bytes. The bootstrap **globally** routes stdout/stderr through a byte-safe filter.
* **Text lines** longer than 3800 bytes are split and annotated:

  ```
  [HBWRAP 1/3 1..3800]  <bytes 1–3800>
  [HBWRAP 2/3 3801..7600]  <bytes 3801–7600>
  [HBWRAP 3/3 7601..N]  <bytes 7601–N>
  ```
* **Binary lines** (contain non-printable bytes in C locale) are emitted as:

  ```
  [HBB64 LEN=<bytes> SHA256=<hash>]
  <base64 body wrapped at ~76 columns>
  ```
* A **raw, unmodified** copy of every line (text or binary) is written to a sidecar file: `/tmp/hype_logs/hb.*.log`. Use that file for forensics, not the console.

**Reconstruct one original text line (from wrapped console output) into a file**:

```bash
awk '{
  if ($0 ~ /^\[HBWRAP [0-9]+\/[0-9]+ [0-9]+\.\.[0-9]+\] /) { sub(/^\[HBWRAP [^]]+\] /,"",$0); printf "%s",$0; next }
  print
}' wrapped.txt > original.txt
```

**Decode base64 body (after the `[HBB64 …]` header) into a file**:

```bash
awk 'BEGIN{p=0} /^\[HBB64 /{p=1; next} { if(p) print }' wrapped.txt | base64 -d > original.bin
```

---

## Persistence Paths (MUST)

* `PERSIST_ROOT=src/content/docs/`
* Reports → `src/content/docs/reports/`
* Worklogs → `src/content/docs/worklogs/`
* Knowledge (raw fetches, tables, JSON, logs) → `src/content/docs/knowledge/`
* **Filenames are UTC**: `YYYYMMDDThhmmssZ.ext` and paths are **repo-relative** in your final message.

---

## Running Services Are Assumed

* **Inspect before starting** (port-aware; avoid duplicates)

```bash
# Check for listener on 8080
(lsof -t -i :8080 >/dev/null 2>&1 && echo "devserver: present") || echo "devserver: absent"
```

* **Reuse an existing dev server** when present; **do not** start a duplicate or change ports blindly.

* **Start only if absent** (background, log to /tmp/hype\_logs)

```bash
if ! lsof -t -i :8080 >/dev/null 2>&1; then
  nohup ./bin/npm run dev > /tmp/hype_logs/devserver.$(date -u +%Y%m%dT%H%M%SZ).log 2>&1 &
  echo "devserver: started (port 8080)"
else
  echo "devserver: already running (port 8080)"
fi
```

* **Stop explicitly** (choose one)

```bash
# Prefer graceful: find-by-port and TERM
pid=$(lsof -t -i :8080 2>/dev/null | head -n1) && kill -TERM "$pid" || true

# Or name-based (less precise):
pkill -f -- "npm run dev" || true
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
console.log(
  JSON.stringify({ pkg: 'markdown-it', version: stdout.trim() }, null, 2),
);
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

## Runner Note: `/bin/sh -lc` Environments

If your automation invokes `/bin/sh -lc "…"` instead of Bash, use the shim so the bootstrap **always** engages:

```bash
# Use the shim as the shell entrypoint:
utils/scripts/setup/env-bootstrap-shim.sh -lc "your command here"
```

The shim re-execs `bash -lc` and sources `utils/scripts/setup/env-bootstrap.sh` before running your command.

---

## Quick Command Deck (paste-ready; non-destructive; coexists with running services)

```bash
# activate env (idempotent)
source utils/scripts/setup/env-bootstrap.sh

# ensure topic branch (never main/master): work/<UTC>-<short-task-slug>
git branch --show-current | grep -q '^work/' || git switch -c "work/$(date -u +%Y%m%dT%H%M%SZ)-task"

# deps + patches
./bin/npm ci || ./bin/npm i
./bin/npx patch-package || true

# npm discovery (persist evidence)
./bin/node utils/scripts/npm-utils.js analyze "eleventy plugin" \
  > src/content/docs/knowledge/npm-analyze-eleventy-$(date -u +%Y%m%dT%H%M%SZ).json

# build + reuse dev server
./bin/npm run build || ./bin/node ./node_modules/@11ty/eleventy/cmd.js
if ! lsof -t -i :8080 >/dev/null 2>&1; then
  nohup ./bin/npm run dev > /tmp/hype_logs/devserver.$(date -u +%Y%m%dT%H%M%SZ).log 2>&1 &
  echo "devserver: started (8080)"
else
  echo "devserver: already running (8080)"
fi

# interlinker audit
./bin/node config/interlinkers/unresolved-report.mjs \
  | tee src/content/docs/knowledge/interlinker-unresolved-$(date -u +%Y%m%dT%H%M%SZ).log

# tests + format
./bin/npm test || ./bin/node --test --test-reporter=spec "test/**/*.mjs"
./bin/prettier --log-level warn --write .
```

## AGENT CONTEXT INJECTION COMPLETE