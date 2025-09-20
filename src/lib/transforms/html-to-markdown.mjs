// ESM module — Eleventy extension that turns .html files into Markdown.
// Usage: imported and registered from your eleventy.config.mjs

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import fs from "node:fs/promises";
import path from "node:path";

import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkStringify from "remark-stringify";

/** Deeply remove noisy elements by tagName anywhere in HAST. */
function rehypeDeepStripTags(tags = ["script", "style", "noscript", "template"]) {
  // ✅ Return the transformer (tree) => void directly — no extra wrapper.
  return (tree) => {
    function prune(node) {
      if (!node || !node.children) return;
      node.children = node.children.filter((child) => {
        if (child?.type === "element" && tags.includes(child.tagName)) return false;
        prune(child);
        return true;
      });
    }
    prune(tree);
  };
}


/** Safe, precise “in repo scope” check */
function inScope(inputPath, rootDir) {
  const full = path.resolve(inputPath);
  const root = path.resolve(rootDir) + path.sep;
  return full.startsWith(root);
}

/** HTML fragment -> Markdown string via unified */
async function htmlFragmentToMarkdown(html, { smartTypography = false } = {}) {
  // Build pipeline
  let processor = unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeDeepStripTags, ["script", "style", "noscript", "template"])
    .use(rehypeRemark)
    .use(remarkGfm)
    .use(remarkMath);

  // Optional smart typography (off by default to keep MD diffs stable)
  if (smartTypography) {
    const { default: smartypants } = await import("remark-smartypants");
    processor = processor.use(smartypants);
  }

  processor = processor.use(remarkStringify, {
    bullet: "-",
    rule: "-",
    fences: true,
    fence: "`",
    listItemIndent: "one",
    emphasis: "_",
    strong: "*",
    quote: '"',
  });

  const file = await processor.process(html);
  return String(file);
}

/**
 * Eleventy extension: treat .html files under `rootDir` as content to convert to Markdown.
 * The Markdown is emitted so your normal MD layouts/shortcodes/filters apply.
 */
export default function htmlToMarkdownUnified(
  eleventyConfig,
  {
    rootDir = "src/content",        // Only convert HTML inside this root
    dumpMarkdownTo = null,          // Optional debug write of generated .md files
    defaultLayout = null,           // e.g., "layouts/article.njk"
    pageTitlePrefix = "",
    frontMatterExtra = {},
    smartTypography = false,        // default OFF to keep ASCII-stable MD
  } = {},
) {
  eleventyConfig.addExtension("html", {
    outputFileExtension: "md",

    compile: function (inputContent, inputPath) {
      if (!inScope(inputPath, rootDir)) return undefined; // Defer to normal .html handling outside scope

      return async () => {
        // 1) Extract main article with Readability (falls back to original HTML)
        const dom = new JSDOM(inputContent, { url: "https://local.source/" });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        const title =
          article?.title || path.basename(inputPath).replace(/\.html$/i, "");
        const byline = article?.byline || "";
        const excerpt = article?.excerpt || "";
        const length = article?.length || 0;
        const extractedHtml = article?.content || inputContent;

        // 2) Convert to Markdown
        const markdownBody = await htmlFragmentToMarkdown(extractedHtml, {
          smartTypography,
        });

        // 3) Front matter (minimal and predictable)
        const fm = {
          ...(defaultLayout ? { layout: defaultLayout } : {}),
          title: `${pageTitlePrefix}${title}`,
          byline,
          excerpt,
          sourcePath: inputPath,
          readabilityLength: length,
          ...frontMatterExtra,
        };

        const fmLines = [
          "---",
          ...Object.entries(fm)
            .filter(([, v]) => v !== undefined && v !== "")
            .map(([k, v]) =>
              typeof v === "string"
                ? `${k}: "${v.replace(/"/g, '\\"')}"`
                : `${k}: ${JSON.stringify(v)}`,
            ),
          "---",
          "",
        ];

        const mdFull = fmLines.join("\n") + markdownBody.trim() + "\n";

        // Optional debug dump to a mirror path
        if (dumpMarkdownTo) {
          const relOut = path
            .resolve(inputPath)
            .replace(path.resolve(rootDir) + path.sep, "");
          const mdOutPath = path.join(
            dumpMarkdownTo,
            relOut.replace(/\.html$/i, ".md"),
          );
          await fs.mkdir(path.dirname(mdOutPath), { recursive: true });
          await fs.writeFile(mdOutPath, mdFull, "utf8");
        }

        return mdFull;
      };
    },
  });
}
