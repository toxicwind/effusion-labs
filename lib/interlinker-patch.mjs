// lib/eleventy/interlinker-patch.mjs
//
// A defensive monkey-patch for @photogabble/eleventy-plugin-interlinker,
// compatible with Eleventy 3.x. This avoids the "document.match is not a function"
// error by ensuring every input to WikilinkParser.find() and Interlinker.compute()
// is normalized into a string before being processed.
//
// No changes are made inside node_modules; instead, we patch prototypes here
// before registering the plugin.

import interlinker from "@photogabble/eleventy-plugin-interlinker";

/**
 * Normalize any incoming "document" into a string so `.match()` is safe.
 * Covers primitives, arrays, objects, null/undefined.
 * Adds warnings to help you trace non-string inputs.
 */
function normalizeInput(input, context = "unknown") {
  // Fast path: already a string
  if (typeof input === "string") return input;

  // Handle numbers, booleans, bigint
  if (typeof input === "number" || typeof input === "boolean" || typeof input === "bigint") {
    console.warn(`[Interlinker Patch] Non-string primitive received in ${context}:`, input);
    return String(input);
  }

  // Handle null / undefined
  if (input == null) {
    console.warn(`[Interlinker Patch] Null/undefined input in ${context}`);
    return "";
  }

  // Handle arrays
  if (Array.isArray(input)) {
    console.warn(`[Interlinker Patch] Array received in ${context} (length=${input.length})`);
    return input.map((el) => normalizeInput(el, `${context}:array`)).join("\n");
  }

  // Handle objects
  if (typeof input === "object") {
    // Eleventy often passes a template/data object with a .content field
    if ("content" in input) {
      const c = input.content;
      if (typeof c === "string") return c;
      console.warn(`[Interlinker Patch] Object with non-string .content in ${context}`);
      return normalizeInput(c, `${context}:content`);
    }

    // Otherwise stringify safely
    try {
      return JSON.stringify(input);
    } catch (err) {
      console.warn(`[Interlinker Patch] Object could not be stringified in ${context}`, err);
      return String(input);
    }
  }

  // Fallback (functions, symbols, weird cases)
  console.warn(`[Interlinker Patch] Unhandled type (${typeof input}) in ${context}`);
  return String(input);
}

/**
 * Apply monkey patches to WikilinkParser.find and Interlinker.compute
 * before returning the plugin for registration.
 */
export default async function interlinkerPatched(eleventyConfig, options = {}) {
  // Dynamically import to avoid breaking normal require()
  const { WikilinkParser } = await import(
    "@photogabble/eleventy-plugin-interlinker/src/wikilink-parser.js"
  );
  const { default: Interlinker } = await import(
    "@photogabble/eleventy-plugin-interlinker/src/interlinker.js"
  );

  // Patch WikilinkParser.find
  if (WikilinkParser?.prototype?.find) {
    const origFind = WikilinkParser.prototype.find;
    WikilinkParser.prototype.find = function patchedFind(input, ...rest) {
      const safe = normalizeInput(input, "WikilinkParser.find");
      return origFind.call(this, safe, ...rest);
    };
  } else {
    console.warn("[Interlinker Patch] Could not locate WikilinkParser.find to patch");
  }

  // Patch Interlinker.compute
  if (Interlinker?.prototype?.compute) {
    const origCompute = Interlinker.prototype.compute;
    Interlinker.prototype.compute = async function patchedCompute(input, ...rest) {
      const safe = normalizeInput(input, "Interlinker.compute");
      return await origCompute.call(this, safe, ...rest);
    };
  } else {
    console.warn("[Interlinker Patch] Could not locate Interlinker.compute to patch");
  }

  // Return the plugin with options unchanged
  return interlinker(eleventyConfig, options);
}
