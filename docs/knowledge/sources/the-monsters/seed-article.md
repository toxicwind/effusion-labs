# TASK: Fully audit and repair `search2serp` and `web2md` for chained-proxy (two-hop) operation and Cloudflare challenges

## Objective

Make `search2serp` and `web2md` run end-to-end **only** through a fixed two-hop outbound chain and reliably traverse Cloudflare “managed challenge” pages. The audit must **auto-fix** repo-local issues, **retest until green**, and write a detailed report to **`./proxy_audit_report.md`** before exiting.

---

## Target query & verification

* **Query:** `pop mart monsters time to chill site:popmart.com`
* **Expected SERP match (any of):**

  * `https://www.popmart.com/us/products/578/labubu-time-to-chill-vinyl-plush-doll`
  * `https://www.popmart.com/products/578/labubu-time-to-chill-vinyl-plush-doll` (no `/us/` also acceptable)
* **Expected page content via web2md:** contains the literal string `October 31, 2022`

---

## Two-hop proxy chain (mandatory, everywhere)

All tools, child processes, libraries, and browsers must route **exclusively**:

```
runner → http://proxy:8080 → http://mildlyawesome.com:49159 → destination
```

### Single source of truth (env)

Export once and treat as canonical:

**Bash/macOS/Linux**

```bash
export PRE_HOP_PROXY="http://proxy:8080"
export OUTBOUND_PROXY_ENABLED=1
export OUTBOUND_PROXY_URL="http://mildlyawesome.com:49159"
export OUTBOUND_PROXY_USER="toxic"
export OUTBOUND_PROXY_PASS='Ann3xx!597e5Bmx'

# Local chain-shim that forces both hops (started below)
export CHAIN_PROXY_URL="http://127.0.0.1:8899"

# Universal env most tools auto-honor
export http_proxy="$CHAIN_PROXY_URL"
export https_proxy="$CHAIN_PROXY_URL"
[ -n "$CODEX_PROXY_CERT" ] && export NODE_EXTRA_CA_CERTS="$CODEX_PROXY_CERT"
```

**PowerShell/Windows**

```powershell
$env:PRE_HOP_PROXY       = "http://proxy:8080"
$env:OUTBOUND_PROXY_ENABLED = "1"
$env:OUTBOUND_PROXY_URL  = "http://mildlyawesome.com:49159"
$env:OUTBOUND_PROXY_USER = "toxic"
$env:OUTBOUND_PROXY_PASS = "Ann3xx!597e5Bmx"
$env:CHAIN_PROXY_URL     = "http://127.0.0.1:8899"
$env:http_proxy          = $env:CHAIN_PROXY_URL
$env:https_proxy         = $env:CHAIN_PROXY_URL
if ($env:CODEX_PROXY_CERT) { $env:NODE_EXTRA_CA_CERTS = $env:CODEX_PROXY_CERT }
```

### Chain-shim (forces both hops for tools that only accept one proxy)

Create `tools/shared/chain-proxy.mjs` and start it before any tests/tools:

```js
// tools/shared/chain-proxy.mjs
import { Server } from 'proxy-chain';
import process from 'node:process';

function req(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const PRE     = req('PRE_HOP_PROXY');         // e.g. http://proxy:8080
const TARGET  = req('OUTBOUND_PROXY_URL');    // e.g. http://mildlyawesome.com:49159
const USER    = process.env.OUTBOUND_PROXY_USER || '';
const PASS    = process.env.OUTBOUND_PROXY_PASS || '';

const targetWithAuth = (() => {
  const u = new URL(TARGET);
  if (USER) u.username = USER;
  if (PASS) u.password = PASS;
  return u.toString();
})();

const server = new Server({
  port: 8899,
  prepareRequestFunction: () => ({
    // hop#1
    upstreamProxyUrl: PRE,
    // hop#2 (final squid with auth)
    customConnectServer: targetWithAuth,
  }),
});

server.listen(() => {
  console.log(`CHAIN_PROXY_URL=http://127.0.0.1:${server.port}`);
});
```

Add script:

```json
// package.json
{
  "scripts": {
    "proxy:chain": "node tools/shared/chain-proxy.mjs"
  },
  "devDependencies": {
    "proxy-chain": "^2.5.0"
  }
}
```

Run it before anything else:

```bash
npm i -D proxy-chain
node tools/shared/chain-proxy.mjs &
export http_proxy="http://127.0.0.1:8899"
export https_proxy="$http_proxy"
```

> From now on, **every** Node/Playwright/`fetch`/`curl`/`npm`/`git` call inherits the chain automatically.

---

## Required code wiring (must be present in repo)

1. **Playwright (BrowserEngine) always uses the env proxy**

   * In `tools/shared/BrowserEngine.mjs`:

     ```js
     const server = process.env.http_proxy || process.env.https_proxy; // -> 127.0.0.1:8899
     const launchOpts = {};
     if (server) launchOpts.proxy = { server };
     // headless/headful handled by CF ladder (below)
     ```
   * Set realistic headers per-page and hide `navigator.webdriver`.
   * Persist storage state (`tmp/pw-state.json`) between runs.

2. **Undici / Node fetch global proxy**

   * `lib/proxyAgent.js` already sets a `ProxyAgent`. Ensure it reads `http_proxy/https_proxy` (the chain URL).

3. **Cloudflare mitigation (shared)**
   Add `tools/shared/cf.mjs` with:

   * `isCloudflareChallenge(HTML|{headers,body})` → detects `cf-mitigated: challenge`, `__cf_bm`, “Just a moment…”, `/cdn-cgi/challenge-platform/`
   * `realisticHeaders()`, `fingerprintOptions()`
   * `persistedStatePath = tmp/pw-state.json`
   * `shouldHeadful(retries)` & `markChallenge()` for retry ladder

4. **search2serp**

   * On navigate, if CF detected → retry ladder:

     1. headless + persisted state
     2. headful + persisted state
     3. headful + minor UA/viewport jitter → if still challenged, mark **probable IP reputation block**
   * Output JSON with `{query, url, results:[{rank,title,url,snippet}], proxy, traceFile}`.

5. **web2md**

   * First attempt with `fetch` (undici) → if CF page detected, fallback to BrowserEngine with the same CF ladder; normalize with Readability/Turndown.

6. **Scripts inherit the chain**

   * Prefix **every** script with the env exports above or ensure they run in a shell where `http_proxy=https_proxy=127.0.0.1:8899` is already set.

---

## Preflight & gating (prevent poisoning runs with a dead proxy)

Run **before** exporting any env in CI shell:

1. **Baseline reachability (no proxy override):**

```bash
curl -fsS https://www.gstatic.com/generate_204 -o /dev/null && echo "[baseline] OK" || echo "[baseline] FAIL"
echo "HTTP_PROXY=$HTTP_PROXY"; echo "HTTPS_PROXY=$HTTPS_PROXY"
```

2. **DNS & TCP to final hop:**

```bash
getent hosts mildlyawesome.com || nslookup mildlyawesome.com || dig +short mildlyawesome.com
(curl -sS --connect-timeout 5 "telnet://mildlyawesome.com:49159" >/dev/null) || nc -vz mildlyawesome.com 49159 || echo "[tcp] FAIL"
```

3. **Gate:**

* If baseline OK **and** TCP OK → start `proxy:chain`, export `http_proxy/https_proxy` to `127.0.0.1:8899`, continue.
* If TCP FAIL → mark **EXTERNAL BLOCKER** in the report, write/commit `proxy_audit_report.md`, stop (do not export proxies).

4. **Once gated, verify proxy path quickly:**

```bash
# through the chain-shim
curl -v -x "$CHAIN_PROXY_URL" https://httpbin.org/ip
# explicit proof of both hops (ad-hoc)
curl -v --preproxy "$PRE_HOP_PROXY" -x "$OUTBOUND_PROXY_URL" -U "toxic:Ann3xx!597e5Bmx" https://httpbin.org/ip
```

---

## Audit & auto-fix loop (execute in order; loop until PASS)

0. **Repo prep**

* `npm ci || npm install` in repo root and tool dirs.
* Ensure scripts exist in `package.json`:

  ```json
  {
    "scripts": {
      "build:tools": "npm install --prefix tools/google-search && npm run build --prefix tools/google-search",
      "deps:playwright": "npx playwright install chromium || true",
      "deps:system": "npx playwright install-deps || true",
      "proxy:chain": "node tools/shared/chain-proxy.mjs"
    }
  }
  ```
* Run: `npm run build:tools || true && npm run deps:playwright || true && npm run deps:system || true`

1. **Proxy preflight (after gate & chain up)**

* Unauth proxy expectation (should be 407):

  ```bash
  curl -sS -o /dev/null -w '%{http_code}\n' -x "$OUTBOUND_PROXY_URL" http://example.com --connect-timeout 8
  ```
* Authenticated CONNECT (should be 200/301/302):

  ```bash
  curl -sS -o /dev/null -w '%{http_code}\n' --connect-timeout 12 \
    -x "$OUTBOUND_PROXY_URL" -U "$OUTBOUND_PROXY_USER:$OUTBOUND_PROXY_PASS" https://httpbin.org/ip
  ```

2. **Run CF-aware `search2serp`**
   Retry up to 3 with backoff; capture first Pop Mart link matching the expected patterns.

3. **Run CF-aware `web2md`**
   Fetch that link; assert Markdown contains `October 31, 2022`.

4. **Self-healing**
   On failure, parse signature and auto-apply repo-local fixes in priority:

* Missing Playwright deps → install and retry.
* Proxy not applied in any path → patch launches/env, log effective proxy server.
* CF challenge persists → enable headful & state reuse, realistic headers, UA-CH tweaks, small jitter, longer `networkidle` waits.
* Selector/schema parsing issues → harden selectors/parsers.
* Commit after each fix:

  ```bash
  git add -A && git commit -m "chore(self-heal): <brief cause/fix>" || true
  ```

Repeat until PASS or two consecutive cycles produce identical failure with no repo diffs → stop and mark **probable external blocker** (e.g., egress IP reputation).

---

## Deliverables (mandatory)

1. **`./proxy_audit_report.md`** containing:

   * Environment snapshot (Node/npm/Playwright), masked env, presence of `NODE_EXTRA_CA_CERTS`
   * Baseline & TCP gate results; unauth 407; authenticated CONNECT status
   * Chain-shim status and proof of path (sample `curl -v` output)
   * CF detections and which mitigation path triggered (headless/headful, retries)
   * Dependency installs attempted and outcomes
   * Code changes (files + short diff summaries)
   * E2E outputs across attempts (retries + final PASS/FAIL)
   * External blockers (if any) with concrete remediation (alternate egress, different port 3128/8080, wait/backoff window)
2. Commit the report:
   `git add proxy_audit_report.md && git commit -m "docs(audit): proxy + CF audit report"`

---

## Success criteria (all required)

1. Baseline/TCP gate passes and authenticated CONNECT returns 200/301/302.
2. `search2serp` returns at least one Pop Mart link for the query (prefer the `/us/products/578/…` page).
3. `web2md` of that link yields Markdown containing `October 31, 2022`.
4. `proxy_audit_report.md` is written and committed with full findings.

---

**Do not allow any path to bypass the chain.** If a tool can’t be coerced to use the chain, wrap it with the chain-shim or block execution with a clear failure in the report.
