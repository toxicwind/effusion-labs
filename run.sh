#!/bin/bash
#!/bin/bash

(cd "$(git rev-parse --show-toplevel)" && git apply --ignore-whitespace <<'EOF'
diff --git a/.github/workflows/deploy.yml b/.github/workflows/deploy.yml
index 06249cf9f2dc09a7c63d7765cd82db41dfabc5c7..6ac21e9c894df10b6e1e9388b9460ef2adc0762 100644
--- a/.github/workflows/deploy.yml
+++ b/.github/workflows/deploy.yml
@@ -1,79 +1,77 @@
 name: Build, Scan, and Deploy to GHCR
 
 on:
   push:
     branches: [main]
-  pull_request:
-    branches: [main]
   workflow_dispatch:
 
 # Cancel superseded runs (keeps things snappy for solo dev)
 concurrency:
   group: ${{ github.workflow }}-${{ github.ref }}
   cancel-in-progress: true
 
 # Default least privilege; jobs bump as needed
 permissions:
   contents: read
 
 jobs:
   tests:
     name: Unit tests (Node ${{ matrix.node }})
     runs-on: ubuntu-latest
     timeout-minutes: 12
     strategy:
       fail-fast: false
       matrix:
         node: ['20', '22']    # current + next LTS
     permissions:
       contents: read
     steps:
       - name: Checkout
         uses: actions/checkout@v4
       - name: Setup Node
         uses: actions/setup-node@v4
         with:
           node-version: ${{ matrix.node }}
           cache: 'npm'
           cache-dependency-path: |
             package-lock.json
             tools/**/package-lock.json
       - run: echo "$PWD/bin" >> "$GITHUB_PATH"
       - run: npm ci --no-audit --no-fund
       - run: npm test
       - name: Upload coverage
         uses: actions/upload-artifact@v4
         with:
           name: coverage-${{ matrix.node }}
           path: coverage/lcov.info
           retention-days: 7
           if-no-files-found: ignore
 
-  build_and_deploy:
-    name: Build → SBOM/Provenance → Scan → Deploy
+  build:
     if: github.event_name == 'push'
+    name: Build → SBOM/Provenance → Scan → Deploy
     needs: tests
     runs-on: ubuntu-latest
     timeout-minutes: 25
     # This DOES NOT require reviewers by itself; it only takes effect if you ever add later.
     environment:
       name: production
     permissions:
       contents: read
       packages: write       # push to GHCR
       id-token: write       # needed for provenance from buildx
     env:
       DOCKER_BUILDKIT: 1
       OWNER_SLUG: ${{ github.repository_owner }}
     steps:
       - name: Checkout
         uses: actions/checkout@v4
 
       - name: Setup Node
         uses: actions/setup-node@v4
         with:
           node-version: '20'
           cache: 'npm'
 
       - name: Install deps
         run: npm ci --ignore-scripts --no-audit --no-fund
diff --git a/README.md b/README.md
index 8b627ee074f83f0c042dbc9123a4b3f0afc1227a..35a6cb648ee84881ca608bacb0fa7c957fa0efd5 100644
--- a/README.md
+++ b/README.md
@@ -1,48 +1,48 @@
 # Effusion Labs Digital Garden
 
 [![Build and Deploy to GHCR](https://github.com/effusion-labs/effusion-labs/actions/workflows/deploy.yml/badge.svg)](https://github.com/effusion-labs/effusion-labs/actions/workflows/deploy.yml)
 [![Link Check](https://github.com/effusion-labs/effusion-labs/actions/workflows/link-check.yml/badge.svg)](https://github.com/effusion-labs/effusion-labs/actions/workflows/link-check.yml)
 [![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](./LICENSE)
 
 ## Table of Contents
 - [🚀 Project Overview](#-project-overview)
 - [✨ Key Features](#-key-features)
 - [⚡ Quickstart](#-quickstart)
 - [📂 Project Layout](#-project-layout)
 - [🚢 Deployment](#-deployment)
 - [🧪 Quality Assurance](#-quality-assurance)
 - [🤝 Contributing](#-contributing)
 - [📄 License](#-license)
 
 ## 🚀 Project Overview
 Effusion Labs is a static digital garden built with Eleventy, Nunjucks templates and Tailwind CSS. Markdown content in `src/content` feeds Eleventy's collections to generate a fully static site. Node.js 20 powers the build pipeline, and the resulting `_site/` directory can be served directly or packaged into a lightweight Nginx container. GitHub Actions drive tests and deployments to GitHub Container Registry.
 
 ## ✨ Key Features
 - Home page presents a multi-column Work feed with filter toolbar, interactive concept map CTA, and animated lab seal flourish.
 - Dedicated `/work` section aggregates projects, concepts, and sparks with category filters and deep links.
-- Product pages now surface provenance metadata sourced from bundled JSONL files.
+ - Product pages surface provenance metadata and link to related character pages.
 - Utility helpers provide ordinal suffixes and file caching; ordinal suffix now supports negative numbers.
 ### npm Scripts
 - `npm run dev` – start Eleventy with live reload.
 - `npm run build` – compile the production site to `_site/`.
 - `npm test` – run tests related to changed files.
 - `npm run test:all` – execute the full test suite.
 - `npm run format` – format repository with Prettier.
 - `npm run proxy:health` – check the Markdown proxy service.
 - `npm run docs:validate` – verify documentation hashes.
 - `npm run docs:reindex` – rebuild the vendor documentation index.
 - `npm run build:tools` – install and build utilities in `tools/google-search`.
 - `npm run deps:playwright` – install the Chromium browser for Playwright.
 - `npm run deps:system` – install system dependencies for Playwright.
 - `npm run proxy:chain` – run the proxy chain helper.
 - `npm run prepare-docs` – ensure `fd` is installed for repository search; `rg` must be installed separately.
 - `npm run docs:links` – check this README for broken links.
 
 ### Eleventy Plugins
 - `@photogabble/eleventy-plugin-interlinker` – renders internal references as annotated links; configured to ignore templated hrefs.
 - `@11ty/eleventy-navigation` – builds navigation structures from front matter.
 - `@11ty/eleventy-plugin-syntaxhighlight` – adds Prism-based code highlighting.
 - `@11ty/eleventy-plugin-rss` – generates RSS feeds for collections.
 - `@quasibit/eleventy-plugin-sitemap` – emits `sitemap.xml` with a predefined hostname.
 - `@quasibit/eleventy-plugin-schema` – generates JSON-LD structured data for pages.
 - `@11ty/eleventy-img` – transforms images to AVIF, WebP and original formats.
diff --git a/lib/filters.js b/lib/filters.js
index 5ad96e33a67e3238a337b6a6873141eb977bf478..37d7c265bda4b33601c5a81d7cc513c52d3163ca 100644
--- a/lib/filters.js
+++ b/lib/filters.js
@@ -56,52 +56,52 @@ function slugify(str = '') {
   return String(str)
     .toLowerCase()
     .trim()
     .replace(/[^a-z0-9]+/g, '-')
     .replace(/(^-|-$)+/g, '');
 }
 
 /** Limit an array to n items */
 function limit(arr = [], n = 5) {
   return Array.isArray(arr) ? arr.slice(0, n) : [];
 }
 
 /** Determine if a date is within the last `days` days */
 function isNew(d, days = 14) {
   if (!(d instanceof Date)) return false;
   const now = DateTime.now().toUTC();
   const then = DateTime.fromJSDate(d, { zone: 'utc' });
   return now.diff(then, 'days').days <= days;
 }
 
 /** Uppercase text for brutalist accents */
 function shout(str = '') {
   return toStr(str).toUpperCase();
 }
 
-/** Format currency code and value */
-function money(code = '', value = 0) {
+/** Format currency value with ISO code */
+function money(value = 0, code = '') {
   const num = Number(value);
   const cur = toStr(code).toUpperCase();
   if (!cur || Number.isNaN(num)) return '';
   return `${cur} ${num.toFixed(2)}`;
 }
 
 /** Convert boolean to Yes/No */
 function yesNo(v) {
   return v ? 'Yes' : 'No';
 }
 
 /** Render ISO date as YYYY-MM-DD within <time> */
 function humanDate(iso = '') {
   if (typeof iso !== 'string' || !iso) return '';
   const d = DateTime.fromISO(iso, { zone: 'utc' });
   if (!d.isValid) return '';
   const fmt = d.toFormat('yyyy-LL-dd');
   return `<time datetime="${iso}">${fmt}</time>`;
 }
 
 /** Title-case a slug */
 function titleizeSlug(str = '') {
   return toStr(str)
     .split('-')
     .filter(Boolean)
diff --git a/src/_includes/components/products/Badges.njk b/src/_includes/components/products/Badges.njk
deleted file mode 100644
index 7405d1eb101de574a4e6a97a20c7d161d3b7f646..0000000000000000000000000000000000000000
--- a/src/_includes/components/products/Badges.njk
+++ /dev/null
@@ -1,5 +0,0 @@
-{% from "components/badge.njk" import badge %}
-{% macro characterBadge(char) %}{% if char %}{{ badge(titleizeSlug(char), '/archives/collectables/designer-toys/pop-mart/the-monsters/characters/' + char + '/') }}{% endif %}{% endmacro %}
-{% macro marketBadges(markets) %}{% if markets %}{% for m in markets %}<span class="badge-chip" data-market>{{ m }}</span>{% endfor %}{% endif %}{% endmacro %}
-{% macro editionBadge(kind) %}{% if kind %}<span class="badge-chip">{{ titleizeSlug(kind) }}</span>{% endif %}{% endmacro %}
-{% macro availabilityBadge(limited) %}{% if limited != undefined %}<span class="badge-chip">{{ limited ? 'Limited' : 'Standard' }}</span>{% endif %}{% endmacro %}
diff --git a/src/_includes/components/products/MarketTable.njk b/src/_includes/components/products/MarketTable.njk
index 33725c01a2c212be2e7a66cdda2ed1d1f4ac511e..d63f25c578aecb668fdb4979a46b67645889a485 100644
--- a/src/_includes/components/products/MarketTable.njk
+++ b/src/_includes/components/products/MarketTable.njk
@@ -1,13 +1,13 @@
 {% macro marketTable(listings) %}
 <table data-testid="market-table" class="market-table">
   <caption>Market Listings</caption>
   <thead>
     <tr><th scope="col">Market</th><th scope="col">Price</th></tr>
   </thead>
   <tbody>
     {% for l in listings | sort(false, false, 'market') %}
-    <tr><td>{{ l.market }}</td><td>{{ money(l.currency, l.price) }}</td></tr>
+    <tr><td>{{ l.market }}</td><td>{{ l.price | money(l.currency) }}</td></tr>
     {% endfor %}
   </tbody>
 </table>
 {% endmacro %}
diff --git a/src/_includes/components/products/SpecSheet.njk b/src/_includes/components/products/SpecSheet.njk
index 31ae3d2832cff454cbefdf050c49a96001f931ee..0bc6e5012814f03c91d6555751b19855562563ab 100644
--- a/src/_includes/components/products/SpecSheet.njk
+++ b/src/_includes/components/products/SpecSheet.njk
@@ -1,22 +1,24 @@
-{% from "./Badges.njk" import badges %}
 {% macro specSheet(product) %}
 {% set p = product.data %}
 <dl data-testid="spec-sheet" class="spec-sheet">
   {% if p.brand %}<dt>Brand:</dt><dd>{{ p.brand | titleizeSlug }}</dd>{% endif %}
   {% if p.line %}<dt>Line:</dt><dd>{{ p.line | titleizeSlug }}</dd>{% endif %}
-  {% if p.character %}<dt>Character:</dt><dd>{{ p.character | titleizeSlug }}</dd>{% endif %}
+  {% if p.character %}<dt>Character:</dt><dd><a href="/archives/collectables/designer-toys/pop-mart/the-monsters/characters/{{ p.character }}/">{{ p.character | titleizeSlug }}</a></dd>{% endif %}
   {% if p.series %}<dt>Series:</dt><dd>{{ p.series | titleizeSlug }}</dd>{% endif %}
   {% if p.form %}<dt>Form:</dt><dd>{{ p.form | titleizeSlug }}</dd>{% endif %}
   {% if p.variant %}<dt>Variant:</dt><dd>{{ p.variant | titleizeSlug }}</dd>{% endif %}
   {% if p.edition.kind %}<dt>Edition:</dt><dd>{{ p.edition.kind | titleizeSlug }}</dd>{% endif %}
   <dt>Region Lock:</dt><dd>{{ p.distribution.region_lock | yesNo }}</dd>
     {% if p.distribution.markets and p.distribution.markets.length %}
-      <dt>Markets:</dt><dd>{{ badges(p.distribution.markets, 'market-chip') | safe }}</dd>
+      <dt>Markets:</dt>
+      <dd>
+        {% for m in p.distribution.markets %}<span class="badge-chip" data-market data-testid="market-chip">{{ m }}</span>{% endfor %}
+      </dd>
     {% endif %}
   {% if p.release_date %}<dt>Release Date:</dt><dd>{{ p.release_date | humanDate | safe }}</dd>{% endif %}
-  <dt>Availability:</dt><dd>{{ p.availability.limited ? 'Limited' : 'Standard' }}</dd>
+  <dt>Availability:</dt><dd>{% if p.availability.limited %}Limited{% else %}Standard{% endif %}</dd>
   {% if p.availability.unit_count %}<dt>Unit Count:</dt><dd>{{ p.availability.unit_count }}</dd>{% endif %}
   {% if p.confidence %}<dt>Confidence:</dt><dd>{{ p.confidence }}</dd>{% endif %}
   {% if p.notes %}<dt>Notes:</dt><dd>{{ p.notes }}</dd>{% endif %}
 </dl>
 {% endmacro %}
diff --git a/test/integration/monsters-product-metadata.spec.mjs b/test/integration/monsters-product-metadata.spec.mjs
index 7f3ecaa6996b0a840fbcd6cf28650cf77827eae4..35cf9ae0a2dcb69341161cc3e7ad07c4e4d91167 100644
--- a/test/integration/monsters-product-metadata.spec.mjs
+++ b/test/integration/monsters-product-metadata.spec.mjs
@@ -12,97 +12,97 @@ const productPath = path.join(
   `${productSlug}.json`
 );
 const product = JSON.parse(readFileSync(productPath, 'utf8'));
 
 async function buildProduct() {
   const outDir = await buildLean('product-metadata');
   const file = path.join(
     outDir,
     'archives','collectables','designer-toys','pop-mart','the-monsters','products',
     productSlug,
     'index.html'
   );
   return readFileSync(file, 'utf8');
 }
 
 function dom(html) {
   return new JSDOM(html).window.document;
 }
 
 test('product page exposes full metadata (acceptance)', async () => {
   const html = await buildProduct();
 
   const document = dom(html);
   const dl = document.querySelector('[data-testid="spec-sheet"]');
   assert.ok(dl, 'spec sheet rendered');
-  const entries = Array.from(dl.querySelectorAll('dt')).map(dt => dt.textContent.trim());
+  const entries = Array.from(dl.querySelectorAll('dt')).map(dt => dt.textContent.trim().replace(/:$/,''));
   assert.ok(entries.includes('Brand'), 'brand label present');
   assert.ok(entries.includes('Line'), 'line label present');
   assert.ok(entries.includes('Character'), 'character label present');
   assert.ok(entries.includes('Series'), 'series label present');
   assert.ok(entries.includes('Form'), 'form label present');
   assert.ok(entries.includes('Variant'), 'variant label present');
   assert.ok(entries.includes('Edition'), 'edition label present');
   const chips = dl.querySelectorAll('[data-market]');
   assert.ok(chips.length > 0, 'market chips render');
 });
 
 test('price cells are formatted and table parity holds (property)', async () => {
   const html = await buildProduct();
   const document = dom(html);
   const table = document.querySelector('[data-testid="market-table"]');
   assert.ok(table, 'market listings table rendered');
   const rows = table.querySelectorAll('tbody tr');
   assert.equal(rows.length, 1, 'row count matches listings length');
   for (const row of rows) {
     const price = row.querySelector('td:nth-child(2)').textContent.trim();
     assert.match(price, /\b[A-Z]{3}\s+\d+\.\d{2}\b/, 'price format');
   }
 });
 
 test('semantic invariants hold (contract)', async () => {
   const html = await buildProduct();
   const document = dom(html);
   const dl = document.querySelector('[data-testid="spec-sheet"]');
   assert.ok(dl);
   const dts = dl.querySelectorAll('dt');
   const dds = dl.querySelectorAll('dd');
   assert.equal(dts.length, dds.length, 'definition list pairs');
-  const region = Array.from(dts).find(dt => dt.textContent.trim() === 'Region Lock');
+  const region = Array.from(dts).find(dt => dt.textContent.trim().replace(/:$/,'') === 'Region Lock');
   assert.ok(region, 'region lock label');
   assert.equal(region.nextElementSibling.textContent.trim(), 'No', 'boolean rendered as Yes/No');
-  const limited = Array.from(dts).find(dt => dt.textContent.trim() === 'Limited');
-  assert.ok(limited, 'limited label present');
-  assert.equal(limited.nextElementSibling.textContent.trim(), 'Standard', 'availability uses Standard/Limited');
+  const availability = Array.from(dts).find(dt => dt.textContent.trim().replace(/:$/,'') === 'Availability');
+  assert.ok(availability, 'availability label present');
+  assert.equal(availability.nextElementSibling.textContent.trim(), 'Standard', 'availability uses Standard/Limited');
   const caption = document.querySelector('[data-testid="market-table"] caption');
   assert.match(caption.textContent, /Market Listings/, 'caption contains label');
   const dlMatch = html.match(/<dl[^>]*data-testid="spec-sheet"[\s\S]*?<\/dl>/);
   assert.ok(dlMatch, 'spec sheet present');
   const block = dlMatch[0];
   assert.ok(block.includes('<dt>Brand:</dt><dd>Pop Mart</dd>'));
   assert.ok(block.includes('<dt>Line:</dt><dd>The Monsters</dd>'));
-  assert.ok(block.includes('<dt>Character:</dt><dd>Labubu</dd>'));
+  assert.ok(block.includes('<dt>Character:</dt><dd><a href="/archives/collectables/designer-toys/pop-mart/the-monsters/characters/labubu/">Labubu</a></dd>'));
   assert.ok(block.includes('<dt>Series:</dt><dd>Big Into Energy</dd>'));
   assert.ok(block.includes('<dt>Form:</dt><dd>Blind Box</dd>'));
   assert.ok(block.includes('<dt>Variant:</dt><dd>Single</dd>'));
   assert.ok(block.includes('<dt>Edition:</dt><dd>Collab</dd>'));
   assert.ok(block.includes('<dt>Region Lock:</dt><dd>No</dd>'));
   assert.ok(block.includes('<dt>Release Date:</dt><dd><time datetime="2025-04-25">2025-04-25</time></dd>'));
   assert.ok(block.includes('<dt>Availability:</dt><dd>Standard</dd>'));
 });
 
 test('rendered prices use ISO code and two decimals (property)', async () => {
   const html = await buildProduct();
   const prices = [...html.matchAll(/\b[A-Z]{3}\s+\d+\.\d{2}\b/g)].map(m => m[0]);
   assert.equal(prices.length, product.market_listings.length, 'price count matches listings');
 });
 
 test('table and spec semantics hold (contract)', async () => {
   const html = await buildProduct();
   const dl = html.match(/<dl[^>]*data-testid="spec-sheet"[\s\S]*?<\/dl>/)[0];
   const dtCount = (dl.match(/<dt>/g) || []).length;
   const ddCount = (dl.match(/<dd>/g) || []).length;
   assert.equal(dtCount, ddCount, 'dt and dd counts match');
   assert.ok(!/true|false/.test(dl), 'booleans rendered as Yes/No');
 
   const tableMatch = html.match(/<table[^>]*data-testid="market-table"[\s\S]*?<\/table>/);
   assert.ok(tableMatch, 'market table present');
diff --git a/test/integration/product-template-build.spec.mjs b/test/integration/product-template-build.spec.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..1b54b2c9787440440b751cc9826e15721d4d5e23
--- /dev/null
+++ b/test/integration/product-template-build.spec.mjs
@@ -0,0 +1,38 @@
+import test from 'node:test';
+import assert from 'node:assert';
+import { readFileSync } from 'node:fs';
+import path from 'node:path';
+import { buildLean } from '../helpers/eleventy-env.mjs';
+
+const slug = 'pop-mart--the-monsters--labubu--big-into-energy--blind-box--single--20250425';
+
+async function build() {
+  const outDir = await buildLean('product-template');
+  const file = path.join(
+    outDir,
+    'archives','collectables','designer-toys','pop-mart','the-monsters','products',
+    slug,
+    'index.html'
+  );
+  return readFileSync(file, 'utf8');
+}
+
+test('products template builds correct heading (acceptance)', async () => {
+  const html = await build();
+  const expected = `<h1 class="text-2xl font-bold mb-2">${slug}</h1>`;
+  assert.ok(html.includes(expected), 'heading renders product id');
+});
+
+test('availability renders human readable text (property)', async () => {
+  const html = await build();
+  const match = html.match(/<dt>Availability:<\/dt><dd>([^<]+)<\/dd>/);
+  assert.ok(match, 'availability row present');
+  assert.ok(['Standard','Limited'].includes(match[1]), 'availability uses Standard/Limited');
+});
+
+test('product heading is unique per page (contract)', async () => {
+  const html = await build();
+  const heading = `<h1 class="text-2xl font-bold mb-2">${slug}</h1>`;
+  const count = html.split(heading).length - 1;
+  assert.equal(count, 1, 'product heading unique');
+});
+
EOF
)