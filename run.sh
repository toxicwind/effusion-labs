diff --git a/artifacts/reports/20250828T025101Z.md b/artifacts/reports/20250828T025101Z.md
new file mode 100644
index 0000000000000000000000000000000000000000..72ce216bd640dfb0e2436e3331cc3461dc3341cf
--- /dev/null
+++ b/artifacts/reports/20250828T025101Z.md
@@ -0,0 +1,82 @@
+HEADER
+Summary: Extended PostCSS pipeline and Eleventy config to build overlay CSS and ship icons【F:lib/postcss.js†L58-L69】【F:lib/eleventy/register.mjs†L137-L142】【F:lib/eleventy/register.mjs†L156-L160】
+Tags: Scope=S2 • Approach=A4 • Novelty=N1,N5 • Skin=K2
+Diff: 5 files changed, 23 insertions(+), 3 deletions(-)
+Files: lib/postcss.js, lib/eleventy/register.mjs, src/styles/app.tailwind.css, src/assets/icons/apple-touch-icon.png, src/assets/icons/favicon.svg
+Checks: tests: pass, build: pass, icons: pass
+Dev URL: –
+Commit: feat(build): compile overlay CSS and add icons
+Worklog: artifacts/worklogs/20250828T025101Z.md
+Report: artifacts/reports/20250828T025101Z.md
+Web Insights: Generated apple-touch icon via placehold.co placeholder API.
+Risk: low
+
+WHAT CHANGED
+- Added batch PostCSS helper in lib/postcss.js: compile multiple styles【F:lib/postcss.js†L58-L69】
+- Composed Eleventy build in lib/eleventy/register.mjs: copy icons and compile overlay【F:lib/eleventy/register.mjs†L137-L142】【F:lib/eleventy/register.mjs†L156-L160】
+- Removed overlay import in src/styles/app.tailwind.css: avoid duplicate CSS【F:src/styles/app.tailwind.css†L2-L5】
+- Web-Integrated neon icons in src/assets/icons: fill missing favicon and touch icon【F:src/assets/icons/favicon.svg†L1-L4】
+
+EDIT CARDS
+- Path: lib/postcss.js
+  Ops: [Compose]
+  Anchors: runPostcssAll()
+  Before → After: single-file PostCSS → batch-processing helper.
+  Micro Example: await runPostcssAll([{ src: "a.css", dest: "b.css" }]);
+  Impact: Enables concise multi-file style compilation.
+- Path: lib/eleventy/register.mjs
+  Ops: [Compose]
+  Anchors: runPostcssAll, addPassthroughCopy
+  Before → After: processed one CSS and no icons → builds overlay and ships icons.
+  Micro Example: eleventyConfig.addPassthroughCopy({ "src/assets/icons": "assets/icons" });
+  Impact: Overlay CSS and icons reach the output bundle.
+- Path: src/styles/app.tailwind.css
+  Ops: [Normalize]
+  Anchors: imports
+  Before → After: overlay bundled inside → overlay built separately.
+  Micro Example: imports now stop at tokens.css and tailwind layers.
+  Impact: Prevents duplicated overlay styles.
+- Path: src/assets/icons/favicon.svg
+  Ops: [Aestheticize]
+  Anchors: <rect/>
+  Before → After: missing icon → neon “EL” square.
+  Micro Example: <rect width="64" height="64" rx="8" fill="#00FF41"/>
+  Impact: Browsers now display a branded favicon.
+- Path: src/assets/icons/apple-touch-icon.png
+  Ops: [Aestheticize]
+  Anchors: neon placeholder
+  Before → After: no apple-touch icon → green “EL” PNG.
+  Micro Example: binary 180×180 neon PNG.
+  Impact: iOS home screens show the site badge.
+
+CHECKS & EVIDENCE
+- Name: tests
+  Location: ✅ npm test
+  Expectation: repository scripts run without errors.
+  Micro Example: index.js                  |   96.66 |       75 |     100 |   96.66 | 31-32【0d4750†L2】
+  Verdict: pass
+- Name: build
+  Location: ✅ npm run build
+  Expectation: generates site assets.
+  Micro Example: ✅ Eleventy build completed. Generated 48 files.【a54524†L22】
+  Verdict: pass
+- Name: icons
+  Location: ✅ ls _site/assets/icons
+  Expectation: apple-touch-icon.png and favicon.svg present.
+  Micro Example: apple-touch-icon.png  favicon.svg【399f97†L2】
+  Verdict: pass
+
+DECISIONS
+- Strategy Justification: A4 chosen to hook Eleventy config without changing templates; S2 fits small asset pipeline tweak; N1 adds reusable PostCSS batch helper while N5 drops neon icons.
+- Assumptions: Placeholder icons are acceptable and overlay CSS should be a standalone asset.
+- Discarded Alternatives: Considered copying overlay file directly but preferred PostCSS batch for reusability.
+- Pivots & Failures: tree command's spinner crashed; hype_run wrapper failed so tests ran via plain npm.
+- Rollback: revert commit feat(build): compile overlay CSS and add icons.
+
+CAPABILITY
+- Name: runPostcssAll(entries)
+- Defaults: Processes no files when entries is empty.
+- Usage: await runPostcssAll([{ src: "src/styles/foo.css", dest: "src/assets/css/foo.css" }]);
+
+AESTHETIC CAPSULE
+⚡ Neon overlays mesh with new icons — the site glows clean.
diff --git a/artifacts/worklogs/20250828T025101Z.md b/artifacts/worklogs/20250828T025101Z.md
new file mode 100644
index 0000000000000000000000000000000000000000..cf7b356c5c98b424bcbbe8779ec0b037bc40216d
--- /dev/null
+++ b/artifacts/worklogs/20250828T025101Z.md
@@ -0,0 +1,10 @@
+## Worklog 20250828T025101Z
+- Sourced bootstrap script; encountered some shell warnings.
+- Orientation with `tree` failed due to spinner EPIPE, noted.
+- Identified missing assets causing 404: overlay CSS and icons.
+- Added PostCSS batch helper `runPostcssAll`.
+- Hooked Eleventy to compile overlay CSS and copy icons.
+- Created neon placeholder icons (PNG & SVG) using external placeholder service and manual SVG.
+- Removed overlay import from main Tailwind bundle.
+- Ran `npm test` and `npm run build` to verify; build produced overlay CSS and icons.
+- Committed changes.
diff --git a/lib/eleventy/register.mjs b/lib/eleventy/register.mjs
index a299a7a80d74493149f378bf16fd5c219ff4200c..4ae574af84139a1ec75f127b9fe3fbcdb51d5636 100644
--- a/lib/eleventy/register.mjs
+++ b/lib/eleventy/register.mjs
@@ -1,43 +1,43 @@
 // lib/eleventy/register.mjs
 import markdownItFootnote from "markdown-it-footnote";
 import markdownItAttrs from "markdown-it-attrs";
 import markdownItAnchor from "markdown-it-anchor";
 import markdownItShiki from "@shikijs/markdown-it";
 import { transformerNotationDiff, transformerNotationHighlight } from "@shikijs/transformers";
 import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
 import path from "node:path";
 import slugify from "slugify";
 import { dirs } from "../config.js";
 import { icons } from "lucide";
 
 import getPlugins from "../plugins.js";
 import filters from "../filters.js";
 import { applyMarkdownExtensions } from "../markdown/index.js";
 import { specnote } from "../shortcodes.js";
 import { CONTENT_AREAS, baseContentPath } from "../constants.js";
-import runPostcss from "../postcss.js";
+import { runPostcssAll } from "../postcss.js";
 
 const glob = (d) => `${baseContentPath}/${d}/**/*.md`;
 
 export default function register(eleventyConfig) {
   const plugins = getPlugins();
   plugins.forEach(([plugin, opts = {}]) => eleventyConfig.addPlugin(plugin, opts));
 
   if (process.env.ELEVENTY_ENV !== "test") {
     eleventyConfig.ignores.add("test/**");
     eleventyConfig.ignores.add("src/test/**");
   }
 
   const isTest = process.env.ELEVENTY_ENV === "test";
   const allowImages = process.env.ELEVENTY_TEST_ENABLE_IMAGES === "1";
 
   // Markdown (Shiki @ build time, footnotes, attrs, anchors)
   eleventyConfig.amendLibrary("md", (md) => {
     md.use(markdownItShiki, {
       themes: { light: "github-light", dark: "github-dark" },
       transformers: [
         {
           pre(node) {
             node.properties.tabindex = 0;
           },
           line(node, i) {
@@ -117,47 +117,51 @@ export default function register(eleventyConfig) {
 
   // Images
   if (!isTest || allowImages) {
     eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
       urlPath: "/assets/images/",
       outputDir: path.join(dirs.output, "assets/images/"),
       formats: ["avif", "webp", "auto"],
       widths: [320, 640, 960, 1200, 1800, "auto"],
       htmlOptions: {
         imgAttributes: { loading: "lazy", decoding: "async" },
         pictureAttributes: {},
       },
       filenameFormat: (id, src, width, format) => {
         const { name } = path.parse(src);
         const s = slugify(name, { lower: true, strict: true });
         return `${s}-${width}.${format}`;
       },
     });
   }
 
   // Assets & watches
   eleventyConfig.addPassthroughCopy({ "src/scripts": "assets/js" });
   eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });
   eleventyConfig.addPassthroughCopy({ "src/assets/static": "assets" });
   eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
+  eleventyConfig.addPassthroughCopy({ "src/assets/icons": "assets/icons" });
   eleventyConfig.addWatchTarget("src/styles");
   eleventyConfig.addWatchTarget("src/assets/static");
   eleventyConfig.addWatchTarget("tailwind.config.mjs");
   eleventyConfig.addWatchTarget("postcss.config.mjs");
 
   eleventyConfig.setBrowserSyncConfig({
     index: "index.html",
     server: { baseDir: "_site" },
   });
 
   eleventyConfig.addShortcode("specnote", specnote);
 
   if (!isTest) {
     eleventyConfig.on("eleventy.before", async () => {
       console.log("🚀 Eleventy build starting with enhanced footnote system...");
-      await runPostcss("src/styles/app.tailwind.css", "src/assets/css/app.css");
+      await runPostcssAll([
+        { src: "src/styles/app.tailwind.css", dest: "src/assets/css/app.css" },
+        { src: "src/styles/mschf-overlay.css", dest: "src/assets/css/mschf-overlay.css" },
+      ]);
     });
     eleventyConfig.on("eleventy.after", ({ results }) => {
       console.log(`✅ Eleventy build completed. Generated ${results.length} files.`);
     });
   }
 }
diff --git a/lib/postcss.js b/lib/postcss.js
index fd8704911dd2c58d13e68f35d01f5c5ed4b08d39..55e4ba29467550a1fa85b4fc988273bea4a9d1fc 100644
--- a/lib/postcss.js
+++ b/lib/postcss.js
@@ -31,26 +31,39 @@ export default async function runPostcss(inputPath, outputPath) {
       // We just continue to process the file.
       if (error.code !== 'ENOENT') {
         throw error; // Re-throw any other type of error
       }
     }
   }
 
   try {
     const css = await fs.readFile(inputPath, 'utf8');
     const plugins = await loadPostcssPlugins();
     const result = await postcss(plugins).process(css, {
       from: inputPath,
       to: outputPath,
       map: { inline: true }
     });
 
     // Ensure the output directory exists before writing the file
     await fs.mkdir(path.dirname(outputPath), { recursive: true });
     await fs.writeFile(outputPath, result.css);
 
     console.log(`[PostCSS] Compiled ${inputPath} -> ${outputPath}`);
   } catch (error) {
     console.error(`[PostCSS Error] Failed to process ${inputPath}:`, error);
     throw error; // Re-throw the error to be handled by the caller
   }
+}
+
+/**
+ * Compile multiple CSS files sequentially via PostCSS.
+ *
+ * @param {Array<{ src: string, dest: string }>} entries
+ * Files to process: each object should define `src` and `dest` paths.
+ * @returns {Promise<void>}
+ */
+export async function runPostcssAll(entries = []) {
+  for (const { src, dest } of entries) {
+    await runPostcss(src, dest);
+  }
 }
\ No newline at end of file
diff --git a/src/assets/icons/apple-touch-icon.png b/src/assets/icons/apple-touch-icon.png
new file mode 100644
index 0000000000000000000000000000000000000000..77cf62f38dd23b7eccbf1f283ce55608523e7316
GIT binary patch
literal 1141
zcmeAS@N?(olHy`uVBq!ia0vp^TR@nD4M^IaWitX&oCO|{#S9GG!XV7ZFl&wk0|Se?
zr;B4q#hkZyH+IFPO1M5$?(A5}md(rKwn0EzP{r9n|3ulVC46CV?Q5?mykw1Ni&!4M
z?M9cr&%K+*uQS3vZfXBon_h0;{@>zL?2^a-nfNCJwXl0=9%5c1@{lp8>jQ(PYemBp
zB^w7XK{<t`979<8Mn&Ds$G<-A+*?_;dGnrqRlA?>+wtVRy?PsaPK?c&LYe2^UcEef
z?$hh*`QPvK-+K<0vB+STWk1V*&GGq^4-D*Y7d&3@^Pts>IYM#|7RZ*!nAk_K&ka7r
zEVHG#ulX7K>jlML?~g2~|7Udkefam+=ktL|zTD;cHGTb$XPwP{qH-G^E||(lL$W}=
z`QMXf8GpMszyDl(d;Zaa;8ylO)AwuEe7FbY<yd5-Hn0;z-Z{Qt|9^|)r~QA|RTTZ+
zZ1E!GA*1xaFKc-|H1M+1mi#U8#XtVZkGHdbe?2byxAN~|_VUkP&z`RT@zMC7t@R7x
z%CBGY*lOeT<UYN>={Uaw81`iso)<n`AiJfRkB`6LLd|P1`<&)OM!s43w!qjayI`qm
zbHMTQ+V<u&+x=$>|Ngjh&t~_{$hi2AYp?%*^xk^e{m<6M8Jf()Aem#$zw`Dp$ji;J
VUB)NX2P{VzJYD@<);T3K0RSK1)dv6o

literal 0
HcmV?d00001

diff --git a/src/assets/icons/favicon.svg b/src/assets/icons/favicon.svg
new file mode 100644
index 0000000000000000000000000000000000000000..f574efdcdcad314cfa025c9f8350d69ed0d59f1c
--- /dev/null
+++ b/src/assets/icons/favicon.svg
@@ -0,0 +1,4 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
+  <rect width="64" height="64" rx="8" fill="#00FF41"/>
+  <text x="32" y="44" text-anchor="middle" font-family="monospace" font-size="40" fill="#000">EL</text>
+</svg>
diff --git a/src/styles/app.tailwind.css b/src/styles/app.tailwind.css
index 26d1d1dc1154246e47169ac58be1f818e3edcf60..392ba79bb61d1eab002b3de0bc750195cbace7bf 100644
--- a/src/styles/app.tailwind.css
+++ b/src/styles/app.tailwind.css
@@ -1,45 +1,44 @@
 /* src/styles/app.tailwind.css */
 @config "../../tailwind.config.mjs";
 @import "./tokens.css";
 @import "tailwindcss";
 
 /* Bind Tailwind's `dark:` variant to the daisyUI dark theme ("sunset") */
 @custom-variant dark (&:where([data-theme=sunset], [data-theme=sunset] *));
 
 /* Plugins (Tailwind v4 style) */
 @plugin "@tailwindcss/typography";
 
 /* daisyUI v5 — enable themes with explicit defaults */
 @plugin "daisyui" {
   themes: nord --default, sunset --prefersdark;
   /* logs: false;  // uncomment to silence plugin logs */
 }
 
 /* Project CSS */
 @import "./home.css";
-@import "./mschf-overlay.css";
 
 @layer base {
   body { @apply font-body text-[var(--step-0)] leading-[1.5]; }
   h1 { @apply font-heading text-[var(--step-4)] mb-8; }
   h2 { @apply font-heading text-[var(--step-3)] mb-6; }
   h3 { @apply font-heading text-[var(--step-2)] mb-4; }
   p, ul, ol, blockquote { @apply mb-4; }
   p:empty { display: none; }
 
   .heading-anchor { @apply mr-2 no-underline text-gray-400; }
 
   pre.shiki,
   :not(pre) > code {
     background-color: rgb(var(--color-code-bg));
     color: rgb(var(--color-code-text));
   }
 
   .shiki { counter-reset: line; }
   .shiki .line { display: block; }
   .shiki .line::before {
     counter-increment: line;
     content: counter(line);
     display: inline-block;
     width: 2rem;
     margin-right: 1rem;
